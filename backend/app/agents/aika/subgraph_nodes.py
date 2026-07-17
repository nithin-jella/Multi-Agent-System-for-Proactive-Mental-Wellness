"""Aika orchestrator — sub-agent execution nodes.

Each node wraps one specialist sub-agent (TCA, CMA, IA) with consistent:
- Execution tracking (start / complete / fail via ``execution_tracker``).
- Exception isolation (errors appended to state, never re-raised so the
  orchestrator can degrade gracefully).
- Lazy sub-graph imports to avoid circular dependencies at module load time.
- ``%``-style structured logging (never f-strings — keeps log aggregators happy).

Public API used in the LangGraph graph:
    parallel_crisis_node      Fan-out: TCA ∥ CMA concurrently (high/critical risk).
    execute_tca_subgraph      TCA only (moderate risk path).
    execute_cma_subgraph      CMA only (called internally by parallel_crisis_node).
    execute_ia_subgraph       Insights Agent (analytics queries).
    synthesize_final_response  Compose the final Aika reply from agent outputs.

Legacy (not in the active graph — STA is background-only):
    execute_sta_subgraph      Kept for manual tooling; not wired in the graph.

Shared Protocol:
    _AsyncInvokable           Minimal structural type used to type-hint sub-graphs.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Protocol, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.execution_tracker import execution_tracker
from app.agents.graph_state import AikaOrchestratorState, IAState
from langchain_core.runnables import RunnableConfig
from app.agents.aika.prompt_builder import (
    get_aika_system_prompts as _get_aika_prompts,
    normalize_role as _normalize_user_role,
    format_personal_memory_block as _format_personal_memory_block,
)
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared structural type used to cast sub-graph objects (avoids Any).
# ---------------------------------------------------------------------------

class _AsyncInvokable(Protocol):
    """Minimal interface for LangGraph compiled sub-graphs."""
    async def ainvoke(self, input: Any, *args: Any, **kwargs: Any) -> Any: ...


# ===========================================================================
# PURE HELPERS — no I/O, safe to unit-test in isolation
# ===========================================================================

def _build_tca_direct_response(state: AikaOrchestratorState) -> str:
    """Build the warm holding response for the TCA-only (moderate-risk) path.

    Called from ``execute_tca_subgraph`` when ``aika_direct_response`` is not
    yet set.  Keeps the user informed while the plan is stored.

    Pure function — depends only on state fields.
    """
    plan_id = state.get("tca_context", {}).get("intervention_plan_id")
    intent = state.get("sta_context", {}).get("intent", "emotional_support")

    plan_mention = (
        "Aku sudah buatkan rencana dukungan yang disesuaikan buat kamu — "
        "cek di sidebar ya! "
        if plan_id
        else ""
    )

    if state.get("tca_context", {}).get("should_intervene"):
        return (
            "Makasih banget udah mau cerita ke aku. "
            "Aku dengerin dan peduli sama kamu. "
            f"{plan_mention}"
            "Perasaanmu itu valid, dan kita bisa hadapin ini bareng. \U0001f499"
        )
    if intent == "appointment_scheduling":
        return (
            "Aku di sini dan siap bantu. "
            "Kalau kamu mau lanjut cerita atau butuh dukungan lebih, bilang aja ya."
        )
    return (
        "Aku dengar kamu. "
        "Perasaan itu wajar banget — kamu nggak harus hadapin ini sendiri. "
        "Cerita lebih kalau mau, aku di sini."
    )


def _build_synthesis_prompt(
    state: AikaOrchestratorState,
    personal_memory_block: str,
) -> str:
    """Build the synthesis prompt from agent output fields in state.

    Each agent section is only included when that agent was actually invoked,
    preventing the LLM from hallucinating data for agents that did not run.

    Pure function — depends only on its arguments.
    """
    agents_invoked: list[str] = state.get("agents_invoked") or []
    original_message = state.get("message", "")

    sections = [
        "You are Aika. Synthesize a final response based on the specialized agent outputs.",
        "",
        f"Original Message: {original_message}",
    ]

    if personal_memory_block:
        sections.append(personal_memory_block)

    sections.append("\nAgent Results:")

    if "STA" in agents_invoked:
        sections.append(
            "- Safety Triage (STA):\n"
            f"  * Risk Level: {state.get("sta_context", {}).get("severity", 'unknown')}\n"
            f"  * Intent: {state.get("sta_context", {}).get("intent", 'unknown')}\n"
            f"  * Risk Score: {state.get("sta_context", {}).get("risk_score", 0.0)}"
        )

    if "TCA" in agents_invoked:
        sections.append(
            "- Support Coach (TCA):\n"
            f"  * Intervention Created: {state.get("tca_context", {}).get("should_intervene", False)}\n"
            f"  * Intervention Type: {state.get("tca_context", {}).get("intervention_type", 'none')}\n"
            f"  * Plan ID: {state.get("tca_context", {}).get("intervention_plan_id", 'none')}"
        )

    if "CMA" in agents_invoked:
        sections.append(
            "- Service Desk (CMA):\n"
            f"  * Case Created: {state.get("cma_context", {}).get("case_created", False)}\n"
            f"  * Case ID: {state.get("cma_context", {}).get("case_id", 'none')}\n"
            f"  * Assigned Counselor: {state.get("cma_context", {}).get("assigned_counsellor_id", 'none')}"
        )

    if "IA" in agents_invoked:
        sections.append(
            "- Insights Agent (IA):\n"
            f"  * Report: {state.get("ia_context", {}).get("ia_report", 'No report generated')}\n"
            f"  * Query Type: {state.get("ia_context", {}).get("query_type", 'unknown')}"
        )

    sections.append(
        "\nCreate a warm, empathetic response that:\n"
        "1. Acknowledges the user's feelings\n"
        "2. Explains what you've done (if intervention/case created)\n"
        "3. Provides next steps or encouragement\n"
        "4. Maintains Aika's personality (caring, supportive)\n"
        "\nKeep response natural and conversational in Indonesian (for users) or "
        "professional (for admins/counselors).\n"
        "\nIMPORTANT: If an intervention plan was created (TCA), explicitly mention it:\n"
        "'Aku sudah buatkan rencana khusus buat kamu. Cek di sidebar ya!'\n"
        "\nIf Risk Level is 'low' or 'none' and no agent was active, respond naturally "
        "and concisely (under 100 words). Do NOT mention 'Safety Triage' or 'Risk Level'."
    )

    return "\n".join(sections)


# ===========================================================================
# ASYNC SUB-AGENT NODES
# ===========================================================================

@trace_agent("TCA_Subgraph")
async def execute_tca_subgraph(
    state: AikaOrchestratorState,
    config: RunnableConfig,
) -> AikaOrchestratorState:
    """Execute the Therapeutic Coach Agent (TCA) sub-graph.

    Generates an immediate coping / intervention plan for the user, merges the
    result into state, and pre-builds a warm direct response so that
    ``synthesize_final_response`` can short-circuit on the moderate-risk path.

    ``db`` is pulled from ``config["configurable"]["db"]`` so the compiled
    graph is independent of any particular database session.

    Args:
        state:  Orchestrator state; ``next_step`` must equal ``"tca"``.
        config: LangGraph runtime config carrying ``db`` under
                ``config["configurable"]["db"]``.

    Returns:
        Updated state with TCA outputs merged and ``aika_direct_response`` set.
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::tca", "aika")

    try:
        from app.agents.tca.tca_graph import get_tca_graph

        tca_graph = cast(_AsyncInvokable, get_tca_graph())
        tca_result = cast(dict[str, Any], await tca_graph.ainvoke(cast(dict[str, Any], state), config={"configurable": {"db": db}}))

        cast(dict[str, Any], state).update(tca_result)
        state.setdefault("agents_invoked", []).append("TCA")
        state.setdefault("execution_path", []).append("tca_subgraph")

        # Pre-build a holding response for the moderate path to avoid an extra
        # LLM call in synthesize_final_response for this common case.
        # The high/critical path pre-sets a crisis holding message in decision_node;
        # only overwrite when it has not already been set.
        if not state.get("aika_direct_response"):
            response = _build_tca_direct_response(state)
            state["aika_direct_response"] = response
            state["final_response"] = response
            state["response_source"] = "agents"

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::tca",
                metrics={
                    "should_intervene": tca_result.get("should_intervene", False),
                    "plan_id": tca_result.get("intervention_plan_id"),
                },
            )

        logger.info(
            "TCA completed: should_intervene=%s, plan_id=%s",
            tca_result.get("should_intervene"),
            tca_result.get("intervention_plan_id"),
        )

    except Exception as exc:
        error_msg = "TCA subgraph failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::tca", str(exc))

    return state


@trace_agent("CMA_Subgraph")
async def execute_cma_subgraph(
    state: AikaOrchestratorState,
    db: AsyncSession,
) -> AikaOrchestratorState:
    """Execute the Case Management Agent (CMA) sub-graph.

    Creates a counselor case for the user and merges CMA outputs into state.
    Called directly by ``parallel_crisis_node`` — not wired as a standalone
    graph node so CMA always runs in parallel with TCA on the crisis path.

    Args:
        state: Orchestrator state; ``needs_cma_escalation`` should be ``True``.
        db:    Database session passed down to the CMA graph.

    Returns:
        Updated state with CMA outputs merged.
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::cma", "aika")

    try:
        from app.agents.cma.cma_graph import get_cma_graph

        cma_graph = cast(_AsyncInvokable, get_cma_graph())
        cma_result = cast(dict[str, Any], await cma_graph.ainvoke(cast(dict[str, Any], state), config={"configurable": {"db": db}}))

        cast(dict[str, Any], state).update(cma_result)
        state.setdefault("agents_invoked", []).append("CMA")
        state.setdefault("execution_path", []).append("cma_subgraph")

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::cma",
                metrics={
                    "case_created": cma_result.get("case_created", False),
                    "case_id": str(cma_result.get("case_id")) if cma_result.get("case_id") else None,
                },
            )

        logger.info(
            "CMA completed: case_id=%s, case_created=%s",
            cma_result.get("case_id"),
            cma_result.get("case_created"),
        )

    except Exception as exc:
        error_msg = "CMA subgraph failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::cma", str(exc))

    return state


@trace_agent("ParallelCrisis")
async def parallel_crisis_node(
    state: AikaOrchestratorState,
    config: RunnableConfig,
) -> AikaOrchestratorState:
    """Fan-out node: run TCA and CMA concurrently for high/critical risk.

    Both sub-graphs are independent at this point — CMA creates a case and
    notifies a counselor, while TCA generates an immediate coping plan.
    Running them in parallel reduces latency from::

        TCA_time + CMA_time  →  max(TCA_time, CMA_time)

    State is deep-copied before each sub-graph invocation to prevent
    concurrent mutation across the two ``asyncio.gather`` branches.
    ``db`` is extracted from ``config["configurable"]["db"]`` and forwarded
    to each sub-graph directly.

    Args:
        state:  ``immediate_risk_level`` must be ``"high"`` or ``"critical"``.
        config: LangGraph runtime config; must contain ``db`` in
                ``config["configurable"]``.

    Returns:
        Updated state with merged TCA and CMA outputs.
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::parallel_crisis", "aika")

    try:
        logger.warning(
            "Parallel Crisis: launching TCA || CMA (risk=%s, keywords=%s)",
            state.get("immediate_risk_level"),
            state.get("crisis_keywords_detected"),
        )

        # Shallow-copy the state dict for each branch.  Both sub-graphs only
        # *read* the shared mutable fields (e.g. conversation_history) and write
        # disjoint keys (TCA → intervention_*, CMA → case_*), so a shallow copy
        # is safe and avoids the cost of deep-copying the full conversation history.
        tca_input = cast(dict[str, Any], state).copy()
        cma_input = cast(dict[str, Any], state).copy()

        # Flag TCA that it is running in parallel crisis mode so that its
        # safety_review_node does NOT block plan persistence for high/critical
        # severity — CMA handles the escalation, TCA provides coping support.
        tca_input["parallel_crisis_mode"] = True

        tca_result, cma_result = await asyncio.gather(
            execute_tca_subgraph(cast(AikaOrchestratorState, tca_input), config),
            execute_cma_subgraph(cast(AikaOrchestratorState, cma_input), db),
            return_exceptions=True,
        )

        # Merge helpers — skip bookkeeping lists (handled by setdefault below).
        _EXCLUDED_KEYS: frozenset[str] = frozenset({"agents_invoked", "execution_path", "errors"})

        def _merge_result(result: Any, label: str) -> None:
            if isinstance(result, Exception):
                logger.error("%s failed in parallel crisis path: %s", label, result, exc_info=True)
                state.setdefault("errors", []).append("%s parallel failure: %s" % (label, result))
                return
            result_dict = cast(dict[str, Any], result)
            for key, val in result_dict.items():
                if key not in _EXCLUDED_KEYS and val is not None:
                    cast(dict[str, Any], state)[key] = val
            state.setdefault("agents_invoked", []).extend(
                result_dict.get("agents_invoked", [])
            )

        _merge_result(tca_result, "TCA")
        _merge_result(cma_result, "CMA")

        state.setdefault("execution_path", []).append("parallel_crisis")

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::parallel_crisis",
                metrics={
                    "tca_success": not isinstance(tca_result, Exception),
                    "cma_success": not isinstance(cma_result, Exception),
                    "case_created": state.get("cma_context", {}).get("case_created", False),
                    "plan_created": state.get("tca_context", {}).get("should_intervene", False),
                },
            )

        logger.warning(
            "Parallel Crisis complete: case_created=%s, plan_created=%s",
            state.get("cma_context", {}).get("case_created"),
            state.get("tca_context", {}).get("should_intervene"),
        )

    except Exception as exc:
        error_msg = "Parallel crisis node failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::parallel_crisis", str(exc))

    return state


async def execute_ia_subgraph(
    state: AikaOrchestratorState,
    config: RunnableConfig,
) -> AikaOrchestratorState:
    """Execute the Insights Agent (IA) sub-graph and format the report.

    Builds an ``IAState`` from the date-range fields stored by the decision
    node, invokes the IA graph, and constructs a human-readable ``ia_report``
    string that ``synthesize_final_response`` can embed in the reply.

    ``db`` is pulled from ``config["configurable"]["db"]`` rather than being
    bound at graph-compile time.

    Args:
        state:  Orchestrator state; ``question_id``, ``start_date``, and
                ``end_date`` should be set (decision_node sets defaults).
        config: LangGraph runtime config carrying ``db`` under
                ``config["configurable"]["db"]``.

    Returns:
        Updated state with IA outputs merged and ``ia_report`` populated.
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::ia", "aika")

    try:
        from app.agents.ia.ia_graph import get_ia_graph

        ia_graph = cast(_AsyncInvokable, get_ia_graph())

        now = datetime.utcnow()
        ia_input: IAState = {
            "question_id": state.get("ia_context", {}).get("question_id") or "crisis_trend",
            "start_date": state.get("ia_context", {}).get("start_date") or (now - timedelta(days=30)),
            "end_date": state.get("ia_context", {}).get("end_date") or now,
            "user_hash": state.get("user_hash") or "user_%s" % state.get("user_id", "unknown"),
        }
        ia_result = cast(dict[str, Any], await ia_graph.ainvoke(ia_input, config={"configurable": {"db": db}}))

        # Build a human-readable report string from IA outputs.
        if ia_result.get("interpretation"):
            report_parts = [
                "**Summary:** %s" % ia_result.get("summary", ""),
                "\n\n**Interpretation:** %s" % ia_result.get("interpretation", ""),
            ]
            if ia_result.get("pdf_url"):
                report_parts.append("\n\n[Download PDF Report](%s)" % ia_result["pdf_url"])
            ia_result["ia_report"] = "".join(report_parts)

        cast(dict[str, Any], state).update(ia_result)
        state.setdefault("agents_invoked", []).append("IA")
        state.setdefault("execution_path", []).append("ia_subgraph")

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::ia",
                metrics={
                    "report_generated": bool(ia_result.get("ia_report")),
                    "query_type": ia_result.get("query_type"),
                },
            )

        logger.info("IA completed: report_generated=%s", bool(ia_result.get("ia_report")))

    except Exception as exc:
        error_msg = "IA subgraph failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::ia", str(exc))

    return state


async def synthesize_final_response(
    state: AikaOrchestratorState,
) -> AikaOrchestratorState:
    """Compose the final Aika reply when a sub-agent has run.

    Short-circuits immediately when ``aika_direct_response`` is already set
    (e.g., by the TCA path or decision_node's direct-response branch).
    Otherwise uses a synthesis prompt to ask Gemini to compose a warm,
    personality-consistent reply from the merged agent outputs.

    This node does not require a database session — all necessary information
    is already present in state from earlier nodes.

    Args:
        state: Orchestrator state after all sub-agents have run.

    Returns:
        Updated state with ``final_response`` and ``response_source`` set.
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::synthesize", "aika")

    try:
        # Short-circuit: sub-agents or decision_node already produced a response.
        if state.get("aika_direct_response"):
            state.setdefault("execution_path", []).append("synthesize_skipped")
            if execution_id:
                execution_tracker.complete_node(execution_id, "aika::synthesize")
            return state

        prompts = _get_aika_prompts()
        user_role: str = state.get("user_role", "user")
        normalized_role = _normalize_user_role(user_role)
        system_instruction = prompts.get(normalized_role, prompts["user"])
        personal_memory_block = _format_personal_memory_block(state)

        synthesis_prompt = _build_synthesis_prompt(state, personal_memory_block)

        from app.core.llm import generate_response, select_gemini_model

        # Choose the synthesis model based on intent and role so that high-stakes
        # paths (crisis/analytics) get the pro model while routine paths stay fast.
        synthesis_model = select_gemini_model(
            intent=state.get("sta_context", {}).get("intent"),
            role=normalized_role,
            has_tools=False,
            preferred_model=state.get("preferred_model"),
        )

        final_response = await generate_response(
            history=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": synthesis_prompt},
            ],
            model="gemini_google",
            temperature=0.7,
            preferred_gemini_model=synthesis_model,
        )

        state["final_response"] = final_response
        state["response_source"] = "agents"
        state.setdefault("execution_path", []).append("synthesize_response")

        if execution_id:
            execution_tracker.complete_node(execution_id, "aika::synthesize")

        logger.info("Final response synthesized from agent outputs.")

    except Exception as exc:
        error_msg = "Response synthesis failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        state["final_response"] = (
            "Maaf ya, aku mengalami sedikit kendala. "
            "Kalau urgent, hubungi Crisis Centre UGM: 0851-0111-0800"
        )
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::synthesize", str(exc))

    return state


# ===========================================================================
# LEGACY NODE — not wired in the active graph
# ===========================================================================

@trace_agent("STA_Subgraph")
async def execute_sta_subgraph(
    state: AikaOrchestratorState,
    db: AsyncSession,
) -> AikaOrchestratorState:
    """Execute the Safety Triage Agent (STA) sub-graph.

    DEPRECATED from the live graph.  STA now runs exclusively as a
    background post-conversation task triggered by
    ``trigger_sta_conversation_analysis_background``.  This function is
    retained so counselors/admins can invoke STA manually via the
    ``trigger_conversation_analysis`` tool, or for integration testing.

    Args:
        state: Orchestrator state with full conversation history.
        db:    Database session passed down to the STA graph.

    Returns:
        Updated state with STA outputs merged.
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::sta", "aika")

    try:
        from app.agents.sta.sta_graph import create_sta_graph

        sta_graph = cast(_AsyncInvokable, create_sta_graph(db))
        sta_result = cast(dict[str, Any], await sta_graph.ainvoke(cast(dict[str, Any], state)))

        cast(dict[str, Any], state).update(sta_result)
        state.setdefault("agents_invoked", []).append("STA")
        state.setdefault("execution_path", []).append("sta_subgraph")

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::sta",
                metrics={
                    "severity": sta_result.get("severity", "unknown"),
                    "next_step": sta_result.get("next_step", "unknown"),
                },
            )

        logger.info(
            "STA completed: severity=%s, next_step=%s",
            sta_result.get("severity"),
            sta_result.get("next_step"),
        )

    except Exception as exc:
        error_msg = "STA subgraph failed: %s" % exc
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        state.setdefault("sta_context", {})["next_step"] = "end"  # Safe fallback — prevents graph from hanging.
        if execution_id:
            execution_tracker.fail_node(execution_id, "aika::sta", str(exc))

    return state
