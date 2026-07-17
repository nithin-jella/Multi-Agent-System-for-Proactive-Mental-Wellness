"""Aika decision node — first node of the unified LangGraph orchestrator.

Responsibility: given an incoming message and orchestrator state, classify
the intent, decide whether a specialist sub-agent (TCA, CMA, IA) is needed,
and either route to it or generate a direct Aika response via the ReAct loop.

Architecture (functional decomposition)
----------------------------------------
The public entry point is ``aika_decision_node``.  All heavy logic is
delegated to narrowly-scoped helpers that are individually testable.

Pure (no I/O — safe to unit-test without a running app):
    _parse_llm_decision          Strip markdown fences; JSON-parse; validate.
    _detect_conversation_end     Inactivity + goodbye-signal detection.
    _parse_analytics_params      Extract date-range params for IA routing.
    _compute_routing             Derive all routing fields from parsed decision.
    _build_rate_limit_fallback   State patch for 429 / RESOURCE_EXHAUSTED errors.
    _build_model_error_fallback  State patch for generic model errors.

Async (I/O-containing, single responsibility each):
    _call_decision_llm           Fire the Gemini API call via the fallback chain.
    _evaluate_autopilot_policy   Enqueue a policy-governed action when applicable.
    _generate_direct_response    ReAct tool loop when no sub-agent is needed.
    _record_decision_audit       Persist an audit event (non-blocking).

Coordinator:
    aika_decision_node           Orchestrates the above helpers in sequence.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta
from typing import Any, Literal, NamedTuple, Optional, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.execution_tracker import execution_tracker
from app.agents.graph_state import AikaOrchestratorState
from langchain_core.runnables import RunnableConfig
from app.agents.aika.constants import MAX_HISTORY_TURNS as _MAX_HISTORY_TURNS
from app.agents.aika.message_classifier import (
    detect_crisis_keywords as _detect_crisis_keywords,
    is_smalltalk_message as _is_smalltalk_message,
    requests_structured_support as _requests_structured_support,
    tool_iterations_for_intent as _tool_iterations_for_intent,
)
from app.agents.aika.prompt_builder import (
    get_aika_system_prompts as _get_aika_prompts,
    normalize_role as _normalize_user_role,
    format_personal_memory_block as _format_personal_memory_block,
    build_smalltalk_response as _build_smalltalk_response,
    build_tail_context_block as _build_tail_context_block,
    build_decision_prompt as _build_decision_prompt,
)
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Conversation-end signal vocabulary
# ---------------------------------------------------------------------------
_CONVERSATION_END_SIGNALS: frozenset[str] = frozenset({
    "goodbye", "bye", "terima kasih banyak", "sampai jumpa",
    "selesai", "sudah cukup", "thanks bye", "see you", "sampai nanti",
})

# ---------------------------------------------------------------------------
# Canned responses (kept as constants to keep function bodies short)
# ---------------------------------------------------------------------------
_CRISIS_HOLDING_RESPONSE: str = (
    "Aku dengar kamu, dan kamu tidak sendirian sekarang. "
    "Biarkan aku ambilkan dukungan untukmu sebentar ya."
)
_AUTOPILOT_DENIED_RESPONSE: str = (
    "Aku belum bisa menjalankan aksi otomatis untuk konteks ini. "
    "Kita tetap bisa lanjut ngobrol dan cari langkah yang lebih aman ya."
)

_CONCERNING_DISCORDANCE_INTENTS: frozenset[str] = frozenset({
    "crisis",
    "emotional_support",
    "panic",
    "self_harm",
})

_CONCERNING_DISCORDANCE_TERMS: frozenset[str] = frozenset({
    "putus asa",
    "hopeless",
    "nggak sanggup",
    "tidak sanggup",
    "berat banget",
    "hampa",
    "empty",
    "overwhelmed",
    "nggak kuat",
    "tidak kuat",
    "kesepian",
    "sendiri",
})

_DECISION_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "intent": {"type": "string"},
        "intent_confidence": {"type": "number"},
        "needs_agents": {"type": "boolean"},
        "next_step": {"type": "string", "enum": ["tca", "cma", "ia", "none"]},
        "reasoning": {"type": "string"},
        "immediate_risk": {
            "type": "string",
            "enum": ["none", "low", "moderate", "high", "critical"],
        },
        "crisis_keywords": {
            "type": "array",
            "items": {"type": "string"},
        },
        "risk_reasoning": {"type": "string"},
        "analytics_params": {
            "type": "object",
            "properties": {
                "question_id": {"type": "string"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
            },
        },
    },
    "required": ["intent", "needs_agents", "next_step", "immediate_risk"],
}


# ===========================================================================
# PURE HELPERS — no I/O, no side effects, fully unit-testable
# ===========================================================================

def _parse_llm_decision(response_text: str) -> dict[str, Any]:
    """Parse and validate the JSON decision string returned by Gemini.

    Strips markdown code fences when present, then validates the two required
    fields (``intent`` and ``needs_agents``).

    Raises:
        json.JSONDecodeError: when the cleaned text is not valid JSON.
        ValueError: when required fields are absent.

    >>> _parse_llm_decision('{"intent": "casual_chat", "needs_agents": false}')
    {'intent': 'casual_chat', 'needs_agents': False}
    """
    cleaned = response_text.strip()
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()

    try:
        decision = json.loads(cleaned)
    except json.JSONDecodeError:
        # Recovery path: Gemini may prepend/append plain text even in JSON mode.
        # Try to salvage the first JSON object block from the response.
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            raise
        decision = json.loads(match.group(0))
    if not isinstance(decision, dict):
        raise ValueError(
            "LLM decision must be a JSON object, got %s" % type(decision).__name__
        )

    missing = {"intent", "needs_agents"} - decision.keys()
    if missing:
        raise ValueError("Decision JSON missing required fields: %s" % missing)

    return decision


def _detect_conversation_end(
    message: str,
    last_message_timestamp: Optional[float],
    now_ts: float,
    *,
    inactivity_threshold_s: int = 300,
) -> bool:
    """Return True when the conversation appears to have ended.

    Two independent signals are checked:
    1. The gap since the previous message exceeds *inactivity_threshold_s*
       (default: 5 minutes).
    2. The current message contains an explicit goodbye phrase.

    >>> _detect_conversation_end("bye", None, 0.0)
    True
    >>> _detect_conversation_end("hello", None, 0.0)
    False
    """
    if (
        last_message_timestamp is not None
        and (now_ts - last_message_timestamp) > inactivity_threshold_s
    ):
        return True
    lowered = message.lower()
    return any(signal in lowered for signal in _CONVERSATION_END_SIGNALS)


def _parse_analytics_params(decision: dict[str, Any]) -> dict[str, Any]:
    """Extract and validate analytics date-range params from the LLM decision.

    Returns an empty dict when the intent is not ``analytics_query`` or when
    the ``analytics_params`` key is absent.  Falls back to a 30-day window
    on date-parse errors.
    """
    if decision.get("intent") != "analytics_query" or "analytics_params" not in decision:
        return {}

    params = decision["analytics_params"]
    result: dict[str, Any] = {"question_id": params.get("question_id")}

    try:
        result["start_date"] = (
            datetime.strptime(params["start_date"], "%Y-%m-%d")
            if params.get("start_date")
            else datetime.now() - timedelta(days=30)
        )
        result["end_date"] = (
            datetime.strptime(params["end_date"], "%Y-%m-%d")
            if params.get("end_date")
            else datetime.now()
        )
    except (ValueError, KeyError) as exc:
        logger.warning(
            "Failed to parse analytics dates (%s) — defaulting to 30-day window.", exc
        )
        result["start_date"] = datetime.now() - timedelta(days=30)
        result["end_date"] = datetime.now()

    return result


def _compute_routing(
    decision: dict[str, Any],
    normalized_role: str,
    message: str,
) -> dict[str, Any]:
    """Derive all routing fields from the parsed LLM decision.

    Pure function — depends only on its arguments; returns a dict of state
    updates that the caller applies.  Applies safety-first risk overrides
    that can promote routing beyond what the LLM suggested.

    The returned dict may include a ``_holding_response`` key (internal
    scaffolding, not a real state field) when a crisis holding message
    should be conditionally set on the state.  The caller handles it.
    """
    next_step_raw = decision.get("next_step", "none").lower()
    immediate_risk = decision.get("immediate_risk", "none")
    intent = decision.get("intent", "unknown")
    agent_reasoning = decision.get("reasoning", "No reasoning provided")

    # --- Step 1: role-aware baseline from LLM suggestion ---
    if normalized_role == "user":
        if next_step_raw in ("tca", "cma"):
            needs_agents: bool = True
            routed_to: str = next_step_raw
        elif next_step_raw == "sta":
            # STA is background-only; redirect to real-time agents if risk warrants it.
            if immediate_risk in ("moderate", "high", "critical"):
                needs_agents = True
                routed_to = "cma" if immediate_risk in ("high", "critical") else "tca"
            else:
                needs_agents, routed_to = False, "none"
        else:
            needs_agents, routed_to = False, "none"
    else:
        # Admin / counselor: trust the LLM's needs_agents flag directly.
        needs_agents = bool(decision.get("needs_agents", False))
        routed_to = next_step_raw

    updates: dict[str, Any] = {
        "intent": intent,
        "intent_confidence": decision.get("intent_confidence", 0.5),
        "needs_agents": needs_agents,
        "agent_reasoning": agent_reasoning,
        "immediate_risk_level": immediate_risk,
        "crisis_keywords_detected": decision.get("crisis_keywords", []),
        "risk_reasoning": decision.get("risk_reasoning", ""),
        "needs_cma_escalation": False,
        "sta_context": {
            "intent": intent,
            "next_step": routed_to,
            "severity": immediate_risk,
        },
    }

    # --- Step 2: safety-first risk overrides (always takes precedence) ---
    if immediate_risk in ("high", "critical"):
        updates.update({
            "needs_cma_escalation": True,
            "needs_agents": True,
            "sta_context": {
                **updates.get("sta_context", {}),
                "next_step": "cma",
            },
            "_holding_response": _CRISIS_HOLDING_RESPONSE,
        })
    elif immediate_risk == "moderate":
        updates["sta_context"] = {
            **updates.get("sta_context", {}),
            "next_step": "tca",
        }
        updates["needs_agents"] = True
    elif immediate_risk == "low" and intent in ("emotional_support", "crisis"):
        if _requests_structured_support(message):
            updates["sta_context"] = {
                **updates.get("sta_context", {}),
                "next_step": "tca",
            }
            updates["needs_agents"] = True
        else:
            updates["sta_context"] = {
                **updates.get("sta_context", {}),
                "next_step": "none",
            }
            updates["needs_agents"] = False
    elif intent == "analytics_query" and normalized_role in ("admin", "counselor"):
        updates["sta_context"] = {
            **updates.get("sta_context", {}),
            "next_step": "ia",
        }
        updates["needs_agents"] = True
    else:
        # Resolve the ambiguous case: needs_agents=True with no valid next_step.
        sta_next_step = updates.get("sta_context", {}).get("next_step", "none")
        if updates["needs_agents"] and (not sta_next_step or sta_next_step == "none"):
            if immediate_risk in ("high", "critical"):
                updates["sta_context"]["next_step"] = "cma"
            elif immediate_risk == "moderate":
                updates["sta_context"]["next_step"] = "tca"
            elif normalized_role in ("admin", "counselor") and "analytics" in agent_reasoning.lower():
                updates["sta_context"]["next_step"] = "ia"
            else:
                updates["needs_agents"] = False
                updates["sta_context"]["next_step"] = "none"
                logger.warning(
                    "needs_agents=True with no valid next_step resolved; safe direct-response."
                )

    return updates


def _has_concerning_discordance_context(
    *,
    message: str,
    intent: Optional[str],
    crisis_keywords: list[str],
) -> bool:
    """Return True when context indicates elevated concern around discordance.

    This intentionally ignores PAD deltas themselves and only checks contextual
    signals (intent, crisis keywords, and language markers).
    """
    if crisis_keywords:
        return True

    normalized_intent = str(intent or "").lower()
    if normalized_intent in _CONCERNING_DISCORDANCE_INTENTS:
        return True

    lowered_message = message.lower()
    return any(term in lowered_message for term in _CONCERNING_DISCORDANCE_TERMS)


def _compute_high_discordance_routing_override(
    *,
    discordance_level: str,
    immediate_risk_level: Optional[str],
    needs_agents: bool,
    next_step: Optional[str],
    intent: Optional[str],
    message: str,
    crisis_keywords: list[str],
) -> dict[str, Any]:
    """Derive deterministic routing override for high discordance scenarios.

    Safety precedence is strict:
    1) Explicit moderate/high/critical risk routing remains authoritative.
    2) High discordance with concerning context escalates to TCA only when there
       is no active safety escalation path.
    """
    patch: dict[str, Any] = {
        "discordance_concerning_context": False,
        "discordance_escalated": False,
    }

    if discordance_level != "high":
        return patch

    immediate_risk = str(immediate_risk_level or "none").lower()
    concerning_context = (
        immediate_risk in {"moderate", "high", "critical"}
        or _has_concerning_discordance_context(
            message=message,
            intent=intent,
            crisis_keywords=crisis_keywords,
        )
    )
    patch["discordance_concerning_context"] = concerning_context

    if not concerning_context:
        return patch

    # Preserve explicit safety routing whenever immediate risk is already elevated.
    if immediate_risk in {"moderate", "high", "critical"}:
        return patch

    normalized_next_step = str(next_step or "none").lower()
    if needs_agents and normalized_next_step in {"tca", "cma"}:
        return patch

    patch.update(
        {
            "needs_agents": True,
            "sta_context": {
                "next_step": "tca",
            },
            "discordance_escalated": True,
        }
    )
    return patch


def _normalize_discordance_level(value: Optional[str]) -> Literal["none", "low", "medium", "high"]:
    """Normalize discordance level from free-form text into supported literals."""
    lowered = str(value or "none").lower()
    if lowered in {"none", "low", "medium", "high"}:
        return cast(Literal["none", "low", "medium", "high"], lowered)
    return "none"


def _build_rate_limit_fallback(error_str: str) -> dict[str, Any]:
    """Return a state-update dict for the rate-limit / resource-exhausted error path."""
    return {
        "needs_agents": False,
        "intent": "system_busy",
        "intent_confidence": 1.0,
        "immediate_risk_level": "none",
        "risk_score": 0.0,
        "aika_direct_response": (
            "Maaf ya, saat ini aku sedang melayani banyak teman-teman lain. "
            "Boleh coba kirim pesan lagi dalam 1 menit? "
            "Kalau kamu butuh bantuan darurat, jangan ragu hubungi Crisis Centre UGM."
        ),
        "response_source": "aika_direct",
        "is_fallback": True,
        "fallback_type": "rate_limit",
        "retry_after_ms": 60_000,
        "agent_reasoning": "System overloaded (Rate Limit): %s" % error_str,
    }


def _build_model_error_fallback(
    error_str: str, crisis_hits: list[str]
) -> dict[str, Any]:
    """Return a state-update dict for generic model-error fallback paths."""
    base: dict[str, Any] = {
        "needs_agents": bool(crisis_hits),
        "intent": "crisis_intervention" if crisis_hits else "system_fallback",
        "immediate_risk_level": "high" if crisis_hits else "none",
        "crisis_keywords_detected": crisis_hits,
        "next_step": "cma" if crisis_hits else "none",
        "agent_reasoning": (
            "Error occurred and crisis keywords detected; escalating to CMA: %s" % error_str
            if crisis_hits
            else "Error occurred; using safe direct-response fallback: %s" % error_str
        ),
    }
    if not crisis_hits:
        base.update({
            "aika_direct_response": (
                "Maaf, aku lagi sempat terkendala teknis sebentar. "
                "Coba kirim ulang pesanmu ya, aku tetap di sini buat bantu kamu."
            ),
            "response_source": "aika_direct",
            "is_fallback": True,
            "fallback_type": "model_error",
            "retry_after_ms": 0,
        })
    return base


# ===========================================================================
# ASYNC HELPERS — each owns exactly one I/O concern
# ===========================================================================

class _DirectResponseResult(NamedTuple):
    """Structured return value from ``_generate_direct_response``."""
    response_text: str
    tool_calls: list[Any]
    response_source: Literal["aika_direct", "aika_react_tools"]
    preferred_model: str


async def _call_decision_llm(
    decision_prompt: str,
    system_instruction: str,
    preferred_model: str,
) -> str:
    """Call the configured LLM for routing decision and return raw text.

    Token cap: 512 (decision JSON is <400 tokens).
    """
    # Late import — avoids circular dependency at module load time.
    from app.core.llm import generate_response

    return await generate_response(
        history=[{"role": "user", "content": decision_prompt}],
        model="gemini_google",
        temperature=0.3,
        max_tokens=512,
        system_prompt=system_instruction,
        preferred_gemini_model=preferred_model,
        json_mode=True,
        json_schema=_DECISION_JSON_SCHEMA,
    )


async def _repair_decision_json_once(
    raw_response_text: str,
    preferred_model: str,
) -> str:
    """Ask the configured LLM to repair malformed decision output once.

    This is intentionally isolated and only used after the primary decision parse
    fails, to reduce user-facing fallback responses caused by minor formatting
    drift (e.g., prose around JSON, markdown wrappers, trailing commentary).
    """
    from app.core.llm import generate_response

    repair_prompt = (
        "Convert the following model output into STRICT JSON only. "
        "Do not add markdown, explanations, or extra text. "
        "Ensure the result includes: intent, needs_agents, next_step, immediate_risk.\n\n"
        f"RAW_OUTPUT:\n{raw_response_text}"
    )

    return await generate_response(
        history=[{"role": "user", "content": repair_prompt}],
        model="gemini_google",
        temperature=0.0,
        max_tokens=512,
        preferred_gemini_model=preferred_model,
        json_mode=True,
        json_schema=_DECISION_JSON_SCHEMA,
    )


async def _evaluate_autopilot_policy(
    state: AikaOrchestratorState,
    normalized_role: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """Evaluate the autopilot policy and enqueue an action when applicable.

    Returns a dict of state patches.  An empty dict means no action was
    enqueued (autopilot disabled, or no candidate action for this context).

    Side effects: may write an ``AutopilotAction`` row and a compliance audit
    entry when a candidate action is found.
    """
    is_enabled = (
        os.getenv("AUTOPILOT_ENABLED", "true").strip().lower()
        in {"1", "true", "yes", "on"}
    )
    if not is_enabled:
        return {}

    try:
        from app.domains.mental_health.models.autopilot_actions import AutopilotActionType
        from app.domains.mental_health.services.autopilot_policy_engine import (
            evaluate_action_policy,
        )
        from app.domains.mental_health.services.autopilot_action_service import (
            build_idempotency_key,
            enqueue_action,
        )
        from app.services.compliance_service import record_audit_event

        # Determine which autopilot action type applies to this routing.
        next_step = str(state.get("sta_context", {}).get("next_step") or "").lower()
        candidate: Optional[AutopilotActionType] = None
        if normalized_role == "user":
            if next_step == "cma":
                candidate = AutopilotActionType.create_case
            elif next_step == "tca":
                candidate = AutopilotActionType.create_checkin

        if candidate is None:
            return {}

        policy_result = evaluate_action_policy(
            risk_level=str(state.get("immediate_risk_level") or "none"),
            action_type=candidate,
            context={
                "intent": state.get("sta_context", {}).get("intent"),
                "next_step": state.get("sta_context", {}).get("next_step"),
                "user_role": normalized_role,
                "session_id": state.get("session_id"),
            },
        )

        idempotency_key = build_idempotency_key(
            f"{candidate.value}:{state.get('user_id')}:{state.get('session_id')}"
            f":{state.get('immediate_risk_level')}:{str(state.get('message') or '')[:160]}"
        )

        action = await enqueue_action(
            db,
            action_type=candidate,
            risk_level=str(state.get("immediate_risk_level") or "none"),
            idempotency_key=idempotency_key,
            payload_json={
                "user_id": state.get("user_id"),
                "user_hash": state.get("user_hash"),
                "session_id": state.get("session_id"),
                "intent": state.get("sta_context", {}).get("intent"),
                "next_step": state.get("sta_context", {}).get("next_step"),
                "risk_level": state.get("immediate_risk_level"),
                "reasoning": state.get("agent_reasoning"),
            },
            commit=True,
        )

        patches: dict[str, Any] = {
            "autopilot_action_id": action.id,
            "autopilot_action_type": candidate.value,
            "autopilot_policy_decision": policy_result.decision.value,
        }

        if policy_result.decision.value == "deny":
            patches.update({
                "needs_agents": False,
                "next_step": "none",
                "needs_cma_escalation": False,
                # Soft denial message; overwritten by _generate_direct_response below.
                "aika_direct_response": _AUTOPILOT_DENIED_RESPONSE,
            })
            await record_audit_event(
                db,
                actor_id=state.get("user_id"),
                actor_role=normalized_role,
                action="autopilot.action_denied",
                entity_type="autopilot_action",
                entity_id=str(action.id),
                extra_data={
                    "action_type": candidate.value,
                    "risk_level": state.get("immediate_risk_level"),
                    "rationale": policy_result.rationale,
                },
            )
            await db.commit()

        return patches

    except Exception as exc:
        logger.warning(
            "Autopilot policy integration failed (non-blocking): %s", exc, exc_info=True
        )
        return {}


async def _apply_screening_discordance_policy(
    state: AikaOrchestratorState,
    normalized_role: str,
    db: AsyncSession,
) -> None:
    """Load screening-awareness context and apply deterministic discordance policy.

    This helper enriches state with screening prompt guidance and discordance
    metadata. It may also override routing to TCA for high discordance with
    concerning context while preserving explicit safety escalation precedence.
    """
    user_id = state.get("user_id")
    if normalized_role != "user" or not isinstance(user_id, int) or user_id <= 0:
        return

    try:
        from app.agents.aika.screening_awareness import (
            get_screening_aware_prompt_addition,
        )

        addition, gap_analysis = await get_screening_aware_prompt_addition(
            db=db,
            user_id=user_id,
            conversation_history=state.get("conversation_history", []),
            current_message=state.get("message", ""),
            session_id=state.get("session_id"),
        )
    except Exception as exc:
        logger.warning("Screening awareness failed (non-blocking): %s", exc)
        return

    discordance_level = _normalize_discordance_level(gap_analysis.discordance_level)

    state["screening_prompt_addition"] = addition
    state["discordance_level"] = discordance_level
    state["discordance_reason"] = gap_analysis.discordance_reason

    patch = _compute_high_discordance_routing_override(
        discordance_level=discordance_level,
        immediate_risk_level=state.get("immediate_risk_level"),
        needs_agents=bool(state.get("needs_agents")),
        next_step=state.get("sta_context", {}).get("next_step"),
        intent=state.get("sta_context", {}).get("intent"),
        message=state.get("message", ""),
        crisis_keywords=state.get("crisis_keywords_detected") or [],
    )

    if patch.get("discordance_escalated"):
        prior_reasoning = str(state.get("agent_reasoning") or "").strip()
        policy_reason = (
            "High affective discordance with concerning context; "
            "deterministic escalation to TCA."
        )
        state["agent_reasoning"] = (
            f"{prior_reasoning} | {policy_reason}"
            if prior_reasoning
            else policy_reason
        )
        logger.info(
            "Discordance policy escalation applied for user %s: level=%s",
            user_id,
            gap_analysis.discordance_level,
        )

    if patch.get("sta_context"):
        state.setdefault("sta_context", {}).update(patch.pop("sta_context"))
    
    cast(dict[str, Any], state).update(patch)


async def _generate_direct_response(
    state: AikaOrchestratorState,
    system_instruction: str,
    normalized_role: str,
    personal_memory_block: str,
    execution_id: Optional[str],
    db: AsyncSession,
) -> _DirectResponseResult:
    """Generate a direct Aika response when no sub-agent is needed (ReAct loop).

    For regular users the system instruction is optionally enriched with
    screening-awareness guidance before being sent to the model.

    Returns a ``_DirectResponseResult`` named-tuple so the coordinator can
    apply each field explicitly rather than relying on implicit side effects.
    """
    from app.core.llm import select_gemini_model
    from app.domains.mental_health.services.tool_calling import generate_with_tools
    from app.domains.mental_health.schemas.chat import ChatRequest

    preferred_model: str = select_gemini_model(
        intent=state.get("sta_context", {}).get("intent"),
        role=normalized_role,
        has_tools=True,
        preferred_model=state.get("preferred_model"),
    )

    # Optionally enrich with screening-awareness guidance for regular users.
    enhanced_system = system_instruction
    user_id = state.get("user_id")
    if normalized_role == "user" and isinstance(user_id, int) and user_id > 0:
        precomputed_addition = state.get("screening_prompt_addition")
        if isinstance(precomputed_addition, str):
            if precomputed_addition:
                enhanced_system = f"{system_instruction}\n\n{precomputed_addition}"
                logger.debug(
                    "Screening awareness reused for user %s: discordance=%s",
                    user_id,
                    state.get("discordance_level", "none"),
                )
        else:
            try:
                from app.agents.aika.screening_awareness import (
                    get_screening_aware_prompt_addition,
                )

                addition, gap_analysis = await get_screening_aware_prompt_addition(
                    db=db,
                    user_id=user_id,
                    conversation_history=state.get("conversation_history", []),
                    current_message=state.get("message", ""),
                    session_id=state.get("session_id"),
                )
                if addition:
                    discordance_level = _normalize_discordance_level(
                        gap_analysis.discordance_level
                    )
                    enhanced_system = f"{system_instruction}\n\n{addition}"
                    state["screening_prompt_addition"] = addition
                    state["discordance_level"] = discordance_level
                    state["discordance_reason"] = gap_analysis.discordance_reason
                    logger.debug(
                        "Screening awareness added for user %s: probe=%s",
                        user_id,
                        (
                            gap_analysis.suggested_probe.dimension.value
                            if gap_analysis and gap_analysis.suggested_probe
                            else "none"
                        ),
                    )
            except Exception as exc:
                logger.warning("Screening awareness failed (non-blocking): %s", exc)

    if personal_memory_block:
        enhanced_system = f"{enhanced_system}\n\n{personal_memory_block}"

    recent_history = (state.get("conversation_history") or [])[
        -(_MAX_HISTORY_TURNS * 2):
    ]
    history_payload = [
        {"role": h.get("role", "user"), "content": h.get("content", "")}
        for h in recent_history
    ] + [{"role": "user", "content": state.get("message", "")}]

    chat_request = ChatRequest(
        google_sub=str(state.get("user_id", 0)),
        session_id=state.get("session_id", "unknown_session"),
        conversation_id=state.get("conversation_id") or "unknown_conversation",
        message=state.get("message", ""),
        history=state.get("conversation_history", []),
        model=preferred_model,
        temperature=0.7,
    )

    response_text, tool_calls = await generate_with_tools(
        history=history_payload,
        system_prompt=enhanced_system,
        request=chat_request,
        db=db,
        user_id=state.get("user_id", 0),
        user_role=normalized_role,
        max_tool_iterations=_tool_iterations_for_intent(
            state.get("sta_context", {}).get("intent") or "unknown"
        ),
        execution_id=execution_id,
    )

    return _DirectResponseResult(
        response_text=response_text,
        tool_calls=tool_calls or [],
        response_source="aika_react_tools" if tool_calls else "aika_direct",
        preferred_model=preferred_model,
    )


async def _record_decision_audit(
    db: AsyncSession,
    state: AikaOrchestratorState,
    raw_decision: dict[str, Any],
) -> Optional[int]:
    """Persist a decision audit event and return the event ID (or None on failure)."""
    try:
        from app.domains.mental_health.services.agent_decision_audit_service import (
            record_aika_decision_event,
        )
        event = await record_aika_decision_event(db, state, raw_decision=raw_decision)
        return int(event.id)
    except Exception as exc:
        logger.warning("Decision audit persistence failed (non-blocking): %s", exc)
        return None


# ===========================================================================
# COORDINATOR
# ===========================================================================

@trace_agent("AikaDecision")
async def aika_decision_node(
    state: AikaOrchestratorState,
    config: RunnableConfig,
) -> AikaOrchestratorState:
    """First node of the unified Aika orchestrator graph.

    Classifies the incoming message, decides whether specialist sub-agents are
    needed, and either routes to them or generates a direct ReAct response.

    Delegates all heavy logic to narrowly-scoped helpers so each phase can be
    reasoned about, tested, and modified in isolation.

    ``db`` is injected at invocation time via ``config["configurable"]["db"]``
    rather than being bound at graph-compile time, which allows the compiled
    graph to be reused across every request (Fix: graph compiled once at
    FastAPI startup rather than per HTTP request).
    """
    configurable = cast(dict[str, Any], config).get("configurable")
    db_candidate = configurable.get("db") if isinstance(configurable, dict) else None
    if not isinstance(db_candidate, AsyncSession):
        raise ValueError("Missing AsyncSession in config['configurable']['db']")
    db: AsyncSession = db_candidate
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "aika::decision", "aika")

    start_time = time.time()
    raw_decision_payload: dict[str, Any] = {}

    try:
        # -----------------------------------------------------------------
        # 1. Role normalisation and system-prompt selection
        # -----------------------------------------------------------------
        prompts = _get_aika_prompts()
        user_role: str = state.get("user_role", "user")
        normalized_role = _normalize_user_role(user_role)
        system_instruction = prompts.get(normalized_role, prompts["user"])
        personal_memory_block = _format_personal_memory_block(state)
        current_message = state.get("message") or ""

        # -----------------------------------------------------------------
        # 2. Deterministic smalltalk short-circuit
        #    Bypasses the LLM call entirely for greetings and filler phrases.
        # -----------------------------------------------------------------
        if normalized_role == "user" and _is_smalltalk_message(current_message):
            cast(dict[str, Any], state).update({
                "intent": "casual_chat",
                "intent_confidence": 1.0,
                "needs_agents": False,
                "next_step": "none",
                "agent_reasoning": (
                    "Deterministic smalltalk route (no agent/tool invocation needed)."
                ),
                "immediate_risk_level": "none",
                "crisis_keywords_detected": [],
                "risk_reasoning": "No distress or risk signal detected from greeting/smalltalk.",
                "aika_direct_response": _build_smalltalk_response(normalized_role),
                "response_source": "aika_direct",
            })
            state["final_response"] = state.get("aika_direct_response")
            state.setdefault("execution_path", []).append("aika_decision")

            elapsed_ms = (time.time() - start_time) * 1000
            if execution_id:
                execution_tracker.complete_node(
                    execution_id,
                    "aika::decision",
                    metrics={
                        "intent": "casual_chat",
                        "needs_agents": False,
                        "duration_ms": elapsed_ms,
                    },
                )
            logger.info(
                "Aika Decision (deterministic smalltalk): duration=%.0fms", elapsed_ms
            )
            audit_id = await _record_decision_audit(
                db,
                state,
                raw_decision={
                    "mode": "deterministic_smalltalk",
                    "message": current_message,
                    "decision": {
                        "intent": state.get("sta_context", {}).get("intent"),
                        "needs_agents": state.get("needs_agents"),
                        "next_step": state.get("sta_context", {}).get("next_step"),
                        "immediate_risk": state.get("immediate_risk_level"),
                    },
                },
            )
            if audit_id:
                state["decision_event_id"] = audit_id
            return state

        # -----------------------------------------------------------------
        # 3. LLM routing decision
        # -----------------------------------------------------------------
        from app.core.llm import GEMINI_LITE_MODEL

        # Use the lite model for the classification/routing call itself — it only
        # needs to produce a small JSON blob (<400 tokens), not a long response.
        preferred_model: str = state.get("preferred_model") or GEMINI_LITE_MODEL
        logger.info("Aika decision using model: %s", preferred_model)

        tail_context = _build_tail_context_block(
            state.get("conversation_history") or []
        )
        decision_prompt = _build_decision_prompt(
            user_role=user_role,
            current_message=current_message,
            tail_context_block=tail_context,
            personal_memory_block=personal_memory_block,
        )

        response_text = await _call_decision_llm(
            decision_prompt, system_instruction, preferred_model
        )

        # -----------------------------------------------------------------
        # 4. Parse LLM response — fallback routing on JSON errors
        # -----------------------------------------------------------------
        try:
            decision = _parse_llm_decision(response_text)
        except (json.JSONDecodeError, ValueError) as parse_err:
            logger.warning("Failed to parse decision JSON: %s", parse_err)
            logger.debug("Raw response: %.200s", response_text)
            repaired_decision: Optional[dict[str, Any]] = None
            try:
                repaired_text = await _repair_decision_json_once(
                    response_text,
                    preferred_model,
                )
                repaired_decision = _parse_llm_decision(repaired_text)
                logger.info("Decision JSON repair retry succeeded.")
            except Exception as repair_err:
                logger.warning("Decision JSON repair retry failed: %s", repair_err)

            if repaired_decision is not None:
                execution_tracker.record_decision_parse_outcome(
                    execution_id=execution_id,
                    initial_parse_failed=True,
                    repaired=True,
                )
                decision = repaired_decision
                raw_decision_payload = decision

                routing = _compute_routing(decision, normalized_role, current_message)
                holding_response: Optional[str] = routing.pop("_holding_response", None)

                cast(dict[str, Any], state).update(_parse_analytics_params(decision))
                cast(dict[str, Any], state).update(routing)

                if holding_response and not state.get("aika_direct_response"):
                    state["aika_direct_response"] = holding_response

                now_ts = time.time()
                state["conversation_ended"] = _detect_conversation_end(
                    current_message,
                    state.get("last_message_timestamp"),
                    now_ts,
                )
                state["last_message_timestamp"] = now_ts

                # Enrich screening context and apply deterministic discordance policy
                # before evaluating autopilot and direct-response paths.
                await _apply_screening_discordance_policy(state, normalized_role, db)

                cast(dict[str, Any], state).update({
                    "autopilot_action_id": None,
                    "autopilot_action_type": None,
                    "autopilot_policy_decision": None,
                })
                autopilot_patches = await _evaluate_autopilot_policy(
                    state, normalized_role, db
                )
                cast(dict[str, Any], state).update(autopilot_patches)

                if state.get("immediate_risk_level", "none") != "none":
                    logger.info(
                        "Immediate Risk: %s (reasoning: %.100s)",
                        state.get("immediate_risk_level"),
                        state.get("risk_reasoning", ""),
                    )

                if not state.get("needs_agents"):
                    result = await _generate_direct_response(
                        state,
                        system_instruction,
                        normalized_role,
                        personal_memory_block,
                        execution_id,
                        db,
                    )
                    state["preferred_model"] = result.preferred_model
                    state["aika_direct_response"] = result.response_text
                    state["final_response"] = result.response_text
                    state["response_source"] = result.response_source
                    if result.tool_calls:
                        state["agents_invoked"] = ["AikaTools"]
                        state["tool_calls"] = result.tool_calls

            else:
                execution_tracker.record_decision_parse_outcome(
                    execution_id=execution_id,
                    initial_parse_failed=True,
                    repaired=False,
                )
                crisis_hits = _detect_crisis_keywords(current_message)
                cast(dict[str, Any], state).update({
                    "intent": "crisis_intervention" if crisis_hits else "casual_chat",
                    "needs_agents": bool(crisis_hits),
                    "next_step": "cma" if crisis_hits else "none",
                    "immediate_risk_level": "high" if crisis_hits else "none",
                    "crisis_keywords_detected": crisis_hits,
                    "agent_reasoning": (
                        "Decision JSON parse failed; crisis keywords detected, escalating to CMA."
                        if crisis_hits
                        else "Decision JSON parse failed; using safe direct-response fallback."
                    ),
                })

                raw_decision_payload = {
                    "decision_parse_error": str(parse_err),
                    "raw_response_preview": (response_text or "")[:1000],
                    "fallback": "crisis_escalation" if crisis_hits else "direct_response",
                }

                # Critical-risk messages still escalate to CMA directly.
                # Non-crisis parse failures should still produce a helpful direct reply,
                # not the generic route-level "Maaf, terjadi kesalahan." fallback.
                if not crisis_hits:
                    try:
                        direct = await _generate_direct_response(
                            state,
                            system_instruction,
                            normalized_role,
                            personal_memory_block,
                            execution_id,
                            db,
                        )
                        state["preferred_model"] = direct.preferred_model
                        state["aika_direct_response"] = direct.response_text
                        state["final_response"] = direct.response_text
                        state["response_source"] = direct.response_source
                        if direct.tool_calls:
                            state["agents_invoked"] = ["AikaTools"]
                            state["tool_calls"] = direct.tool_calls
                    except Exception as direct_err:
                        logger.warning(
                            "Direct response generation after decision parse fallback failed: %s",
                            direct_err,
                        )
                        cast(dict[str, Any], state).update({
                            "aika_direct_response": (
                                "Maaf, aku lagi sempat terkendala teknis sebentar. "
                                "Coba kirim ulang pesanmu ya, aku tetap di sini buat bantu kamu."
                            ),
                            "final_response": (
                                "Maaf, aku lagi sempat terkendala teknis sebentar. "
                                "Coba kirim ulang pesanmu ya, aku tetap di sini buat bantu kamu."
                            ),
                            "response_source": "aika_direct",
                            "is_fallback": True,
                            "fallback_type": "model_error",
                        })
        else:
            execution_tracker.record_decision_parse_outcome(
                execution_id=execution_id,
                initial_parse_failed=False,
                repaired=False,
            )
            # -----------------------------------------------------------------
            # 5. Routing, analytics params, conversation-end, autopilot, response
            # -----------------------------------------------------------------
            raw_decision_payload = decision

            # Derive routing fields (pure computation; no side effects).
            routing = _compute_routing(decision, normalized_role, current_message)
            holding_response: Optional[str] = routing.pop("_holding_response", None)

            cast(dict[str, Any], state).update(_parse_analytics_params(decision))
            cast(dict[str, Any], state).update(routing)

            # For high/critical risk, set a holding message only when absent —
            # the synthesize node will replace it with the full agent response.
            if holding_response and not state.get("aika_direct_response"):
                state["aika_direct_response"] = holding_response

            # Track conversation-end signals and update the timestamp.
            now_ts = time.time()
            state["conversation_ended"] = _detect_conversation_end(
                current_message,
                state.get("last_message_timestamp"),
                now_ts,
            )
            state["last_message_timestamp"] = now_ts

            # Enrich screening context and apply deterministic discordance policy
            # before evaluating autopilot and direct-response paths.
            await _apply_screening_discordance_policy(state, normalized_role, db)

            # Policy evaluation: enqueue autopilot action when applicable.
            cast(dict[str, Any], state).update({
                "autopilot_action_id": None,
                "autopilot_action_type": None,
                "autopilot_policy_decision": None,
            })
            autopilot_patches = await _evaluate_autopilot_policy(
                state, normalized_role, db
            )
            cast(dict[str, Any], state).update(autopilot_patches)

            if state.get("immediate_risk_level", "none") != "none":
                logger.info(
                    "Immediate Risk: %s (reasoning: %.100s)",
                    state.get("immediate_risk_level"),
                    state.get("risk_reasoning", ""),
                )

            # Generate direct response when no sub-agent routing is needed.
            if not state.get("needs_agents"):
                result = await _generate_direct_response(
                    state,
                    system_instruction,
                    normalized_role,
                    personal_memory_block,
                    execution_id,
                    db,
                )
                state["preferred_model"] = result.preferred_model
                state["aika_direct_response"] = result.response_text
                state["final_response"] = result.response_text
                state["response_source"] = result.response_source
                if result.tool_calls:
                    state["agents_invoked"] = ["AikaTools"]
                    state["tool_calls"] = result.tool_calls

        # -----------------------------------------------------------------
        # 6. Execution tracking and audit (always runs)
        # -----------------------------------------------------------------
        state.setdefault("execution_path", []).append("aika_decision")
        elapsed_ms = (time.time() - start_time) * 1000

        if execution_id:
            execution_tracker.complete_node(
                execution_id,
                "aika::decision",
                metrics={
                    "intent": state.get("sta_context", {}).get("intent"),
                    "needs_agents": state.get("needs_agents"),
                    "duration_ms": elapsed_ms,
                },
            )
        logger.info(
            "Aika Decision: intent=%s, needs_agents=%s, duration=%.0fms",
            state.get("sta_context", {}).get("intent"),
            state.get("needs_agents"),
            elapsed_ms,
        )

        audit_id = await _record_decision_audit(
            db, state, raw_decision=raw_decision_payload
        )
        if audit_id:
            state["decision_event_id"] = audit_id

        # -----------------------------------------------------------------
        # 7. Background STA analysis on conversation end (fire-and-forget)
        # -----------------------------------------------------------------
        if state.get("conversation_ended", False):
            logger.info(
                "Conversation ended — triggering background STA analysis (includes screening)."
            )
            from app.agents.aika.background_tasks import (
                trigger_sta_conversation_analysis_background,
            )
            asyncio.create_task(
                trigger_sta_conversation_analysis_background(state.copy(), db)
            )

    except Exception as exc:
        error_str = str(exc)
        error_msg = "Aika decision node failed: %s" % error_str
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)

        is_rate_limit = any(
            token in error_str
            for token in (
                "429",
                "RESOURCE_EXHAUSTED",
                "All Gemini models failed",
                "OpenRouter rate limit",
            )
        )
        if is_rate_limit:
            logger.warning(
                "Rate limit hit in decision node — returning graceful fallback."
            )
            cast(dict[str, Any], state).update(_build_rate_limit_fallback(error_str))
            if execution_id:
                execution_tracker.complete_node(
                    execution_id, "aika::decision", metrics={"fallback": "rate_limit"}
                )
        else:
            crisis_hits = _detect_crisis_keywords(str(state.get("message") or ""))
            cast(dict[str, Any], state).update(_build_model_error_fallback(error_str, crisis_hits))
            if execution_id:
                execution_tracker.fail_node(execution_id, "aika::decision", error_str)

        # Ensure final_response is always set so downstream nodes don't fail.
        state.setdefault("final_response", state.get("aika_direct_response", ""))

        audit_id = await _record_decision_audit(
            db, state, raw_decision=raw_decision_payload
        )
        if audit_id:
            state["decision_event_id"] = audit_id

    return state
