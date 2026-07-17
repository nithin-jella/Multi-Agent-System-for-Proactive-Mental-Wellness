from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.blockchain.attestation.chain_registry import get_attestation_chain_config
from app.domains.blockchain.nft.chain_registry import get_chain_config
from app.domains.mental_health.models.agent_decision_events import AgentDecisionEvent
from app.domains.mental_health.models.autopilot_actions import AutopilotAction
from app.domains.mental_health.models.quests import AttestationRecord

router = APIRouter(prefix="/agent-decisions", tags=["Admin - Agent Decisions"])


class AgentDecisionItem(BaseModel):
    id: int
    source: str
    action_type: str
    policy_decision: str
    risk_level: str
    status: str
    created_at: datetime
    executed_at: Optional[datetime] = None

    user_id: Optional[int] = None
    session_id: Optional[str] = None
    intent: Optional[str] = None
    next_step: Optional[str] = None
    agent_reasoning: Optional[str] = None

    requires_human_review: bool = False
    approved_by: Optional[int] = None
    approval_notes: Optional[str] = None

    chain_id: Optional[int] = None
    tx_hash: Optional[str] = None
    explorer_tx_url: Optional[str] = None

    attestation_record_id: Optional[int] = None
    attestation_status: Optional[str] = None
    attestation_last_error: Optional[str] = None
    attestation_tx_hash: Optional[str] = None
    attestation_schema: Optional[str] = None
    attestation_type: Optional[str] = None
    attestation_decision: Optional[str] = None
    attestation_feedback_redacted: Optional[str] = None


class AgentDecisionListResponse(BaseModel):
    items: list[AgentDecisionItem]
    total: int


class _MappedDecision:
    def __init__(self, created_at: datetime, item: AgentDecisionItem) -> None:
        self.created_at = created_at
        self.item = item


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


def _to_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _build_explorer_url(chain_id: Optional[int], tx_hash: Optional[str]) -> Optional[str]:
    if chain_id is None or not tx_hash:
        return None

    nft_cfg = get_chain_config(int(chain_id))
    if nft_cfg is not None:
        return nft_cfg.explorer_tx_url(tx_hash)

    att_cfg = get_attestation_chain_config(int(chain_id))
    if att_cfg is not None:
        return att_cfg.explorer_tx_url(tx_hash)

    return None


@router.get("", response_model=AgentDecisionListResponse)
async def list_agent_decisions(
    user_id: Optional[int] = Query(default=None, ge=1),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> AgentDecisionListResponse:
    del admin_user

    linked_action_ids_subq = (
        select(AgentDecisionEvent.autopilot_action_id)
        .where(AgentDecisionEvent.autopilot_action_id.is_not(None))
    )

    events_stmt = select(AgentDecisionEvent)
    if user_id is not None:
        events_stmt = events_stmt.where(AgentDecisionEvent.user_id == user_id)

    event_total = int((await db.execute(
        select(func.count()).select_from(events_stmt.subquery())
    )).scalar() or 0)

    autopilot_only_stmt = select(AutopilotAction).where(
        ~AutopilotAction.id.in_(linked_action_ids_subq)
    )
    if user_id is not None:
        autopilot_only_stmt = autopilot_only_stmt.where(
            AutopilotAction.payload_json.op("->>")("user_id") == str(user_id)
        )

    autopilot_only_total = int((await db.execute(
        select(func.count()).select_from(autopilot_only_stmt.subquery())
    )).scalar() or 0)

    total = event_total + autopilot_only_total
    if total == 0:
        return AgentDecisionListResponse(items=[], total=0)

    fetch_window = min(max(skip + limit + 50, 200), 2000)
    event_rows = (
        await db.execute(
            events_stmt.order_by(desc(AgentDecisionEvent.created_at)).limit(fetch_window)
        )
    ).scalars().all()
    autopilot_only_rows = (
        await db.execute(
            autopilot_only_stmt.order_by(desc(AutopilotAction.created_at)).limit(fetch_window)
        )
    ).scalars().all()

    linked_action_ids: set[int] = set()
    attestation_ids: set[int] = set()
    for event in event_rows:
        if event.autopilot_action_id is not None:
            linked_action_ids.add(int(event.autopilot_action_id))
        if event.attestation_record_id is not None:
            attestation_ids.add(int(event.attestation_record_id))

    if linked_action_ids:
        linked_actions = (
            await db.execute(select(AutopilotAction).where(AutopilotAction.id.in_(linked_action_ids)))
        ).scalars().all()
        linked_action_map = {int(action.id): action for action in linked_actions}
    else:
        linked_action_map = {}

    for action in autopilot_only_rows:
        payload = action.payload_json or {}
        attestation_record_id = _to_int(payload.get("attestation_record_id"))
        if attestation_record_id is not None:
            attestation_ids.add(attestation_record_id)

    attestation_map: dict[int, AttestationRecord] = {}
    if attestation_ids:
        attestation_rows = (
            await db.execute(select(AttestationRecord).where(AttestationRecord.id.in_(attestation_ids)))
        ).scalars().all()
        attestation_map = {int(record.id): record for record in attestation_rows}

    combined: list[_MappedDecision] = []

    for event in event_rows:
        linked_action = linked_action_map.get(int(event.autopilot_action_id)) if event.autopilot_action_id is not None else None
        linked_payload = linked_action.payload_json if linked_action is not None else {}

        attestation_record_id = event.attestation_record_id
        if attestation_record_id is None:
            attestation_record_id = _to_int((linked_payload or {}).get("attestation_record_id"))
        attestation_record = attestation_map.get(int(attestation_record_id)) if attestation_record_id is not None else None

        attestation_tx_hash = None
        attestation_schema = None
        attestation_type = None
        attestation_decision = None
        attestation_feedback_redacted = None
        if attestation_record is not None:
            attestation_extra = attestation_record.extra_data or {}
            attestation_tx_hash = _to_str(attestation_extra.get("tx_hash"))
            attestation_schema = _to_str(attestation_extra.get("schema"))
            attestation_type = _to_str(attestation_extra.get("attestation_type"))
            attestation_decision = _to_str(attestation_extra.get("decision"))
            attestation_feedback_redacted = _to_str(attestation_extra.get("feedback_redacted"))

        action_type = (
            linked_action.action_type.value
            if linked_action is not None
            else (_to_str(event.autopilot_action_type) or f"decision_{_to_str(event.next_step) or 'none'}")
        )
        policy_decision = (
            linked_action.policy_decision.value
            if linked_action is not None
            else (_to_str(event.autopilot_policy_decision) or "recorded")
        )
        status = linked_action.status.value if linked_action is not None else "recorded"

        combined.append(
            _MappedDecision(
                created_at=event.created_at,
                item=AgentDecisionItem(
                    id=int(event.id),
                    source=event.decision_source,
                    action_type=action_type,
                    policy_decision=policy_decision,
                    risk_level=_to_str(event.risk_level) or (linked_action.risk_level if linked_action else "none"),
                    status=status,
                    created_at=event.created_at,
                    executed_at=(linked_action.executed_at if linked_action is not None else None),
                    user_id=event.user_id,
                    session_id=_to_str(event.session_id),
                    intent=_to_str(event.intent) or _to_str((linked_payload or {}).get("intent")),
                    next_step=_to_str(event.next_step) or _to_str((linked_payload or {}).get("next_step")),
                    agent_reasoning=_to_str(event.reasoning) or _to_str((linked_payload or {}).get("reasoning")),
                    chain_id=(linked_action.chain_id if linked_action is not None else None),
                    tx_hash=(linked_action.tx_hash if linked_action is not None else None),
                    explorer_tx_url=_build_explorer_url(
                        linked_action.chain_id if linked_action is not None else None,
                        linked_action.tx_hash if linked_action is not None else None,
                    ),
                    attestation_record_id=(int(attestation_record_id) if attestation_record_id is not None else None),
                    attestation_status=(attestation_record.status.value if attestation_record else None),
                    attestation_last_error=(attestation_record.last_error if attestation_record else None),
                    attestation_tx_hash=attestation_tx_hash,
                    attestation_schema=attestation_schema,
                    attestation_type=attestation_type,
                    attestation_decision=attestation_decision,
                    attestation_feedback_redacted=attestation_feedback_redacted,
                ),
            )
        )

    for row in autopilot_only_rows:
        payload = row.payload_json or {}
        attestation_record_id = _to_int(payload.get("attestation_record_id"))
        attestation_record = attestation_map.get(attestation_record_id) if attestation_record_id is not None else None

        attestation_tx_hash = None
        attestation_schema = None
        attestation_type = None
        attestation_decision = None
        attestation_feedback_redacted = None
        if attestation_record is not None:
            attestation_extra = attestation_record.extra_data or {}
            attestation_tx_hash = _to_str(attestation_extra.get("tx_hash"))
            attestation_schema = _to_str(attestation_extra.get("schema"))
            attestation_type = _to_str(attestation_extra.get("attestation_type"))
            attestation_decision = _to_str(attestation_extra.get("decision"))
            attestation_feedback_redacted = _to_str(attestation_extra.get("feedback_redacted"))

        combined.append(
            _MappedDecision(
                created_at=row.created_at,
                item=AgentDecisionItem(
                    id=int(row.id),
                    source="autopilot_action",
                    action_type=row.action_type.value,
                    policy_decision=row.policy_decision.value,
                    risk_level=row.risk_level,
                    status=row.status.value,
                    created_at=row.created_at,
                    executed_at=row.executed_at,
                    user_id=_to_int(payload.get("user_id")),
                    session_id=_to_str(payload.get("session_id")),
                    intent=_to_str(payload.get("intent")),
                    next_step=_to_str(payload.get("next_step")),
                    agent_reasoning=_to_str(payload.get("reasoning")),
                    chain_id=row.chain_id,
                    tx_hash=row.tx_hash,
                    explorer_tx_url=_build_explorer_url(row.chain_id, row.tx_hash),
                    attestation_record_id=attestation_record_id,
                    attestation_status=(attestation_record.status.value if attestation_record else None),
                    attestation_last_error=(attestation_record.last_error if attestation_record else None),
                    attestation_tx_hash=attestation_tx_hash,
                    attestation_schema=attestation_schema,
                    attestation_type=attestation_type,
                    attestation_decision=attestation_decision,
                    attestation_feedback_redacted=attestation_feedback_redacted,
                ),
            )
        )

    combined.sort(key=lambda row: row.created_at, reverse=True)
    paginated_items = [row.item for row in combined[skip: skip + limit]]
    return AgentDecisionListResponse(items=paginated_items, total=total)
