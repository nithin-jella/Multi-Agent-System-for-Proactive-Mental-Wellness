from __future__ import annotations

from datetime import datetime, timedelta


def compute_sla_deadline(started_at: datetime, minutes: int) -> datetime:
    """Return when the SLA will breach for a given start timestamp."""

    return started_at + timedelta(minutes=minutes)


async def notify_sla_breach(case_id: str) -> None:
    """Trigger downstream notification when an SLA breaches (stub)."""

    raise NotImplementedError("notify_sla_breach requires integration with webhook/event bus")
