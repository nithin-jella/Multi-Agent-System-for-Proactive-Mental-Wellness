from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import AikaOrchestratorState
from app.database import AsyncSessionLocal
from app.domains.mental_health.models.agent_decision_events import AgentDecisionEvent


def _to_int(value: Any) -> Optional[int]:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return int(stripped)
        except ValueError:
            return None
    return None


async def record_aika_decision_event(
    db: AsyncSession,
    state: AikaOrchestratorState,
    *,
    raw_decision: Optional[dict[str, Any]] = None,
) -> AgentDecisionEvent:
    _ = db  # Keep signature compatibility for existing callers.
    payload = raw_decision or {}
    session_id = state.get("session_id")
    user_role = str(state.get("user_role") or "").strip() or None

    event = AgentDecisionEvent(
        decision_source="aika_decision",
        user_id=_to_int(state.get("user_id")),
        user_role=user_role,
        session_id=str(session_id) if session_id else None,
        intent=str(state.get("intent") or "").strip() or None,
        next_step=str(state.get("next_step") or "").strip() or None,
        needs_agents=bool(state.get("needs_agents", False)),
        risk_level=str(state.get("immediate_risk_level") or "none"),
        reasoning=str(state.get("agent_reasoning") or "").strip() or None,
        raw_decision_json=payload,
        autopilot_action_id=_to_int(state.get("autopilot_action_id")),
        autopilot_action_type=str(state.get("autopilot_action_type") or "").strip() or None,
        autopilot_policy_decision=str(state.get("autopilot_policy_decision") or "").strip() or None,
        autopilot_requires_human_review=False,
        attestation_record_id=_to_int(state.get("attestation_record_id")),
    )
    async with AsyncSessionLocal() as audit_db:
        try:
            audit_db.add(event)
            await audit_db.commit()
            await audit_db.refresh(event)
        except Exception:
            await audit_db.rollback()
            raise
    return event
