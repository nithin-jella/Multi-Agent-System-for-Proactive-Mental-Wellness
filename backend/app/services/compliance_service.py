from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ComplianceAuditLog

logger = logging.getLogger(__name__)


async def record_audit_event(
    session: AsyncSession,
    *,
    actor_id: Optional[int],
    actor_role: Optional[str],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    extra_data: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist an immutable audit log entry."""
    entry = ComplianceAuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=extra_data or {},
    )
    session.add(entry)
    try:
        await session.flush()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Failed to flush audit log entry: %s", exc)
        raise

