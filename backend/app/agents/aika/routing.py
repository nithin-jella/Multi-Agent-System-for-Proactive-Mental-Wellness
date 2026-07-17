"""Aika orchestrator - conditional routing functions.

LangGraph evaluates these functions after each node to decide which edge to
follow.  They are kept deliberately thin: each one reads a small number of
state fields, traces the chosen edge, and returns a LangGraph route key.

No external I/O is performed - the only side effect is a call to
execution_tracker.trigger_edge, which records the routing decision for
observability dashboards.

Public API (actively wired in the graph):
    should_invoke_agents    Conditional edge after 'aika_decision'.

Legacy (not wired — retained for manual tooling only):
    should_route_to_sca     Post-STA routing; STA is now background-only.
"""
from __future__ import annotations

import logging

from app.agents.execution_tracker import execution_tracker
from app.agents.graph_state import AikaOrchestratorState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Route-key constants — kept here so callers that build the graph's
# ``conditional_edge`` mapping can import them instead of using plain strings.
# ---------------------------------------------------------------------------

ROUTE_CRISIS_PARALLEL = "invoke_crisis_parallel"
ROUTE_TCA = "invoke_tca"
ROUTE_IA = "invoke_ia"
ROUTE_END = "end"

ROUTE_CMA = "route_cma"
ROUTE_SYNTHESIZE = "synthesize"


def should_invoke_agents(state: AikaOrchestratorState) -> str:
    """Conditional edge executed after the aika_decision node.

    Reads the routing fields set by the decision node and returns the
    LangGraph route key that selects the next node.

    Route keys (see module-level constants):
    - ROUTE_CRISIS_PARALLEL: high/critical risk — TCA and CMA run concurrently.
    - ROUTE_TCA: moderate risk or structured-support request — TCA only.
    - ROUTE_IA: analytics query from admin or counselor — Insights Agent.
    - ROUTE_END: direct Aika response, no sub-agent involvement.

    Priority:
    1. 'next_step' field (set explicitly by decision_node._compute_routing).
    2. 'immediate_risk_level' field (safety-first override).
    3. Ambiguous needs_agents=True with no valid next_step -> safe end.

    Args:
        state: Orchestrator state after aika_decision_node ran.

    Returns:
        One of the ROUTE_* string constants defined at the top of this module.
    """
    execution_id = state.get("execution_id")
    next_step = str(state.get("sta_context", {}).get("next_step") or "end").lower()
    needs_agents: bool = bool(state.get("needs_agents", False))

    def _trace(edge: str) -> None:
        if execution_id:
            execution_tracker.trigger_edge(
                execution_id, edge, condition_result=True
            )

    # --- Explicit next_step from decision node (highest priority) ---
    if next_step == "cma":
        _trace("aika::decision->parallel_crisis")
        logger.warning(
            "Routing after Aika: PARALLEL CRISIS (TCA || CMA) risk=%s",
            state.get("immediate_risk_level"),
        )
        return ROUTE_CRISIS_PARALLEL

    if next_step == "tca":
        _trace("aika::decision->tca")
        logger.info("Routing after Aika: TCA (Support)")
        return ROUTE_TCA

    if next_step == "ia":
        _trace("aika::decision->ia")
        logger.info("Routing after Aika: IA (Analytics)")
        return ROUTE_IA

    # --- Fallback: resolve ambiguous needs_agents=True via risk level ---
    if needs_agents:
        immediate_risk = str(state.get("immediate_risk_level") or "none")

        if immediate_risk in {"high", "critical"}:
            _trace("aika::decision->parallel_crisis")
            return ROUTE_CRISIS_PARALLEL

        if immediate_risk == "moderate":
            _trace("aika::decision->tca")
            return ROUTE_TCA

        user_role = str(state.get("user_role", "")).lower()
        if (
            state.get("sta_context", {}).get("intent") == "analytics_query"
            and user_role in {"admin", "counselor"}
        ):
            _trace("aika::decision->ia")
            return ROUTE_IA

        # needs_agents=True but no valid routing signal — end safely.
        _trace("aika::decision->end")
        logger.warning(
            "Ambiguous needs_agents=True without valid route; ending safely."
        )
        return ROUTE_END

    # --- Direct Aika response ---
    _trace("aika::decision->end")
    logger.info("Routing after Aika: Direct Response")
    return ROUTE_END


def should_route_to_sca(state: AikaOrchestratorState) -> str:
    """Conditional edge executed after the legacy STA sub-graph node.

    .. deprecated::
        ``execute_sta_subgraph`` is no longer wired in the active graph — STA
        runs exclusively as a background post-conversation task.  This function
        is retained so counselors/admins can re-introduce an inline STA path in
        future without losing the routing logic, and for integration tests that
        exercise the legacy node manually.

        It is NOT re-exported from ``aika_orchestrator_graph`` to keep the
        public API surface clean.

    Returns:
        ROUTE_CMA:        High/critical severity — escalate to CMA.
        ROUTE_TCA:        Moderate with TCA recommendation.
        ROUTE_SYNTHESIZE: Low/moderate without intervention — go to synthesis.
    """
    execution_id = state.get("execution_id")
    severity = str(state.get("sta_context", {}).get("severity") or "low")
    next_step = str(state.get("sta_context", {}).get("next_step") or "end")

    def _trace(edge: str) -> None:
        if execution_id:
            execution_tracker.trigger_edge(
                execution_id, edge, condition_result=True
            )

    if severity in {"high", "critical"}:
        _trace("aika::sta->sda")
        logger.info(
            "STA routing: severity=%s → CMA (crisis escalation)", severity
        )
        return ROUTE_CMA

    if next_step == "tca":
        _trace("aika::sta->sca")
        logger.info(
            "STA routing: severity=%s, next_step=tca → TCA (support)", severity
        )
        return ROUTE_TCA

    _trace("aika::sta->synthesize")
    logger.info(
        "STA routing: severity=%s, next_step=%s → Synthesize",
        severity,
        next_step,
    )
    return ROUTE_SYNTHESIZE
