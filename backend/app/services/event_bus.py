"""Event bus for inter-agent communication.

Simple in-memory pub/sub system for coordinating between agents.
Future: Can be replaced with Redis Pub/Sub for distributed systems.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Coroutine, Optional
from uuid import uuid4

from app.core.memory import get_redis_client

logger = logging.getLogger(__name__)

_INSTANCE_ID = str(uuid4())


class EventType(str, Enum):
    """Types of events that can be emitted by agents."""
    
    # Case events
    CASE_CREATED = "case_created"
    CASE_ASSIGNED = "case_assigned"
    CASE_STATUS_CHANGED = "case_status_changed"
    CASE_CLOSED = "case_closed"
    SLA_BREACH = "sla_breach"
    
    # Triage events
    HIGH_RISK_DETECTED = "high_risk_detected"
    CRITICAL_RISK_DETECTED = "critical_risk_detected"
    
    # Insights events
    IA_REPORT_GENERATED = "ia_report_generated"
    CAMPAIGN_TRIGGER_MATCHED = "campaign_trigger_matched"
    
    # Campaign events
    CAMPAIGN_EXECUTED = "campaign_executed"
    CAMPAIGN_MESSAGE_SENT = "campaign_message_sent"

    # Agent health events
    AGENT_ERROR = "agent_error"
    AGENT_DEGRADED = "agent_degraded"

    # Quest events
    QUEST_ISSUED = "quest_issued"
    QUEST_COMPLETED = "quest_completed"
    QUEST_ANALYTICS = "quest_analytics"


@dataclass
class Event:
    """Event payload for pub/sub."""
    
    event_type: EventType
    timestamp: datetime
    source_agent: str  # 'sta', 'sda', 'sca', 'ia', 'system'
    data: dict[str, Any]
    correlation_id: str | None = None  # For tracing related events


class EventBus:
    """In-memory event bus for agent coordination.
    
    Provides publish/subscribe pattern for loosely coupled agent communication.
    Thread-safe for async operations.
    """
    
    def __init__(self) -> None:
        self._subscribers: dict[EventType, list[Callable[[Event], Coroutine[Any, Any, None]]]] = defaultdict(list)
        self._lock = asyncio.Lock()
        self._redis_task: Optional[asyncio.Task] = None
        self._redis_pubsub = None
        logger.info("EventBus initialized (in-memory mode)")
    
    async def subscribe(
        self,
        event_type: EventType,
        handler: Callable[[Event], Coroutine[Any, Any, None]]
    ) -> None:
        """Subscribe to an event type with an async handler.
        
        Args:
            event_type: The type of event to listen for
            handler: Async function to call when event is published
        """
        async with self._lock:
            self._subscribers[event_type].append(handler)
            logger.info("Subscribed handler to %s", event_type.value)

        await self._ensure_redis_listener()
    
    async def publish(self, event: Event) -> None:
        """Publish an event to all subscribers.
        
        Args:
            event: The event to publish
        """
        await self._dispatch_local(event)
        await self._publish_redis(event)
    
    def unsubscribe(
        self,
        event_type: EventType,
        handler: Callable[[Event], Coroutine[Any, Any, None]]
    ) -> None:
        """Unsubscribe a handler from an event type.
        
        Args:
            event_type: The event type
            handler: The handler to remove
        """
        if handler in self._subscribers[event_type]:
            self._subscribers[event_type].remove(handler)
            logger.info("Unsubscribed handler from %s", event_type.value)
    
    def clear_all(self) -> None:
        """Clear all subscriptions (useful for testing)."""
        self._subscribers.clear()
        logger.info("Cleared all event subscriptions")

    async def _dispatch_local(self, event: Event) -> None:
        handlers = self._subscribers.get(event.event_type, [])

        if not handlers:
            logger.debug("No subscribers for event %s", event.event_type.value)
            return

        logger.info(
            "Publishing event %s from %s to %d subscriber(s)",
            event.event_type.value,
            event.source_agent,
            len(handlers),
        )

        tasks = [handler(event) for handler in handlers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(
                    "Handler %d for %s failed: %s",
                    idx,
                    event.event_type.value,
                    result,
                    exc_info=result,
                )

    async def _publish_redis(self, event: Event) -> None:
        try:
            redis_client = await get_redis_client()
            if not hasattr(redis_client, "publish"):
                return

            payload = {
                "event_id": str(uuid4()),
                "event_type": event.event_type.value,
                "timestamp": event.timestamp.isoformat(),
                "source_agent": event.source_agent,
                "data": event.data,
                "correlation_id": event.correlation_id,
                "instance_id": _INSTANCE_ID,
            }
            channel = f"events:{event.event_type.value}"
            await redis_client.publish(channel, json.dumps(payload))
        except Exception as exc:
            logger.warning("Redis publish failed for %s: %s", event.event_type.value, exc)

    async def _ensure_redis_listener(self) -> None:
        if self._redis_task is not None:
            return

        try:
            redis_client = await get_redis_client()
            if not hasattr(redis_client, "pubsub"):
                return
            pubsub = redis_client.pubsub()
            await pubsub.psubscribe("events:*")
            self._redis_pubsub = pubsub
            self._redis_task = asyncio.create_task(self._redis_listen())
        except Exception as exc:
            logger.warning("Redis pubsub not available: %s", exc)

    async def _redis_listen(self) -> None:
        pubsub = self._redis_pubsub
        if pubsub is None:
            return

        try:
            async for message in pubsub.listen():
                if not message:
                    continue
                message_type = message.get("type")
                if message_type not in {"message", "pmessage"}:
                    continue

                data = message.get("data")
                if not data:
                    continue
                if isinstance(data, bytes):
                    data = data.decode("utf-8")

                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if payload.get("instance_id") == _INSTANCE_ID:
                    continue

                event_type_raw = payload.get("event_type")
                if not event_type_raw:
                    continue

                try:
                    event_type = EventType(event_type_raw)
                except ValueError:
                    continue

                timestamp_raw = payload.get("timestamp")
                try:
                    timestamp = datetime.fromisoformat(timestamp_raw) if timestamp_raw else datetime.utcnow()
                except Exception:
                    timestamp = datetime.utcnow()

                event = Event(
                    event_type=event_type,
                    timestamp=timestamp,
                    source_agent=payload.get("source_agent", "system"),
                    data=payload.get("data", {}),
                    correlation_id=payload.get("correlation_id"),
                )
                await self._dispatch_local(event)
        except Exception as exc:
            logger.warning("Redis pubsub listener stopped: %s", exc)


# Global event bus instance
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    """Get the global event bus instance (singleton)."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


async def publish_event(
    event_type: EventType,
    source_agent: str,
    data: dict[str, Any],
    correlation_id: str | None = None
) -> None:
    """Convenience function to publish an event.
    
    Args:
        event_type: Type of event
        source_agent: Agent emitting the event
        data: Event payload
        correlation_id: Optional correlation ID for tracing
    """
    event = Event(
        event_type=event_type,
        timestamp=datetime.utcnow(),
        source_agent=source_agent,
        data=data,
        correlation_id=correlation_id
    )
    
    bus = get_event_bus()
    await bus.publish(event)
