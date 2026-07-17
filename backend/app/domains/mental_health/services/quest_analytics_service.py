from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models import QuestAnalyticsEvent, QuestInstance
from app.services.event_bus import EventType, publish_event

logger = logging.getLogger(__name__)


async def record_quest_event(
    session: AsyncSession,
    *,
    event_type: str,
    user_id: int,
    quest_instance: Optional[QuestInstance] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Persist quest analytics event and publish to in-memory bus."""
    record = QuestAnalyticsEvent(
        event_type=event_type,
        user_id=user_id,
        quest_instance_id=quest_instance.id if quest_instance else None,
        payload=payload or {},
    )
    session.add(record)
    await session.flush()

    bus_event_type = EventType.QUEST_ANALYTICS
    await publish_event(
        event_type=bus_event_type,
        source_agent="quests",
        data={
            "analytics_type": event_type,
            "user_id": user_id,
            "quest_instance_id": quest_instance.id if quest_instance else None,
            "payload": payload or {},
        },
    )
