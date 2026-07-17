from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models.autopilot_actions import (
    AutopilotAction,
    AutopilotActionStatus,
    AutopilotActionType,
)


def build_idempotency_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def hash_payload(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def get_action_by_id(
    db: AsyncSession,
    action_id: int,
) -> Optional[AutopilotAction]:
    result = await db.execute(select(AutopilotAction).where(AutopilotAction.id == action_id))
    return result.scalar_one_or_none()


async def list_actions(
    db: AsyncSession,
    *,
    status: Optional[AutopilotActionStatus] = None,
    action_type: Optional[AutopilotActionType] = None,
    risk_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[AutopilotAction], int]:
    filters = []
    if status:
        filters.append(AutopilotAction.status == status)
    if action_type:
        filters.append(AutopilotAction.action_type == action_type)
    if risk_level:
        filters.append(AutopilotAction.risk_level == risk_level)

    stmt = select(AutopilotAction).order_by(AutopilotAction.created_at.desc())
    count_stmt = select(func.count()).select_from(AutopilotAction)
    if filters:
        condition = and_(*filters)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    rows = (await db.execute(stmt.offset(skip).limit(limit))).scalars().all()
    total = int((await db.execute(count_stmt)).scalar() or 0)
    return list(rows), total


async def list_due_actions(
    db: AsyncSession,
    *,
    now: Optional[datetime] = None,
    limit: int = 20,
) -> list[AutopilotAction]:
    current = now or datetime.now(timezone.utc)
    stmt = (
        select(AutopilotAction)
        .where(
            AutopilotAction.status.in_(
                [AutopilotActionStatus.queued, AutopilotActionStatus.approved, AutopilotActionStatus.failed]
            ),
            or_(
                AutopilotAction.next_retry_at.is_(None),
                AutopilotAction.next_retry_at <= current,
            ),
        )
        .order_by(AutopilotAction.created_at.asc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())


async def enqueue_action(
    db: AsyncSession,
    *,
    action_type: AutopilotActionType,
    risk_level: str,
    idempotency_key: str,
    payload_json: dict[str, Any],
    commit: bool = True,
) -> AutopilotAction:
    existing = (
        await db.execute(
            select(AutopilotAction).where(AutopilotAction.idempotency_key == idempotency_key)
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    action = AutopilotAction(
        action_type=action_type,
        risk_level=risk_level,
        status=AutopilotActionStatus.queued,
        idempotency_key=idempotency_key,
        payload_hash=hash_payload(payload_json),
        payload_json=payload_json,
    )
    db.add(action)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def mark_running(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    commit: bool = True,
) -> AutopilotAction:
    action.status = AutopilotActionStatus.running
    action.executed_at = datetime.utcnow()
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def mark_confirmed(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    tx_hash: Optional[str] = None,
    chain_id: Optional[int] = None,
    commit: bool = True,
) -> AutopilotAction:
    action.status = AutopilotActionStatus.confirmed
    action.tx_hash = tx_hash
    action.chain_id = chain_id
    action.error_message = None
    action.executed_at = datetime.utcnow()
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def review_action(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    decision: str,
    reviewer_id: int,
    reviewer_note: Optional[str] = None,
    commit: bool = True,
) -> AutopilotAction:
    """Approve or reject an action that is awaiting human review.

    Args:
        db:            Database session.
        action:        The ``AutopilotAction`` to review.
        decision:      ``"approve"`` or ``"reject"``.
        reviewer_id:   ID of the admin performing the review.
        reviewer_note: Optional audit note attached to the action.
        commit:        Whether to commit the transaction immediately.

    Raises:
        ValueError: If the action is not in ``awaiting_approval`` state, or
                    if ``decision`` is not one of the accepted values.
    """
    if action.status != AutopilotActionStatus.awaiting_approval:
        raise ValueError(
            f"Action {action.id} cannot be reviewed — current status is "
            f"'{action.status.value}', expected 'awaiting_approval'."
        )

    if decision == "approve":
        action.status = AutopilotActionStatus.approved
    elif decision == "reject":
        action.status = AutopilotActionStatus.rejected
    else:
        raise ValueError(
            f"Invalid decision {decision!r}: must be 'approve' or 'reject'."
        )

    action.approved_by = reviewer_id
    action.approval_notes = reviewer_note
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def mark_failed(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    error_message: str,
    commit: bool = True,
) -> AutopilotAction:
    action.status = AutopilotActionStatus.failed
    action.error_message = error_message
    action.retry_count = int(action.retry_count or 0) + 1
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def schedule_retry(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    base_seconds: int,
    commit: bool = True,
) -> AutopilotAction:
    attempts = max(1, int(action.retry_count or 1))
    delay_seconds = base_seconds * (2 ** max(0, attempts - 1))
    action.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action


async def mark_dead_letter(
    db: AsyncSession,
    action: AutopilotAction,
    *,
    error_message: str,
    commit: bool = True,
) -> AutopilotAction:
    action.status = AutopilotActionStatus.dead_letter
    action.error_message = error_message
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(action)
    return action
