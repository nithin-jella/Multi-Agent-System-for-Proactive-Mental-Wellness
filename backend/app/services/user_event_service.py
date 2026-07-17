"""User event logging utilities for retention and analytics."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserEvent


def _sanitize_metadata(metadata: Optional[Mapping[str, Any]]) -> Optional[dict[str, Any]]:
    if not metadata:
        return None

    sanitized: dict[str, Any] = {}
    for key, value in metadata.items():
        if not isinstance(key, str):
            continue
        if len(sanitized) >= 20:
            break
        if value is None or isinstance(value, (int, float, bool)):
            sanitized[key] = value
            continue
        if isinstance(value, str):
            sanitized[key] = value[:200]
            continue
        if isinstance(value, list):
            sanitized[key] = [item for item in value if isinstance(item, (str, int, float, bool))][:20]
            continue
    return sanitized or None


async def record_user_event(
    db: AsyncSession,
    *,
    user_id: int,
    event_name: str,
    session_id: Optional[str] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
) -> None:
    """Persist a coarse analytics event for retention analysis.

    Caller controls the transaction boundary.
    """
    sanitized_metadata = _sanitize_metadata(metadata)
    event = UserEvent(
        user_id=user_id,
        event_name=event_name,
        session_id=session_id,
        request_id=request_id,
        ip_address=ip_address,
        user_agent=user_agent,
        event_metadata=sanitized_metadata,
    )
    db.add(event)
