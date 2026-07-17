import asyncio
from datetime import datetime

import pytest

from app.services.event_bus import Event, EventBus, EventType, get_event_bus


@pytest.mark.unit
async def test_event_bus_publish_invokes_all_subscribers() -> None:
    bus = EventBus()

    received: list[str] = []

    async def handler_one(event: Event) -> None:
        received.append(f"one:{event.data['x']}")

    async def handler_two(event: Event) -> None:
        received.append(f"two:{event.data['x']}")

    await bus.subscribe(EventType.CASE_CREATED, handler_one)
    await bus.subscribe(EventType.CASE_CREATED, handler_two)

    await bus.publish(
        Event(
            event_type=EventType.CASE_CREATED,
            timestamp=datetime.utcnow(),
            source_agent="test",
            data={"x": 123},
        )
    )

    assert sorted(received) == ["one:123", "two:123"]


@pytest.mark.unit
async def test_event_bus_publish_continues_when_one_handler_errors() -> None:
    bus = EventBus()

    received: list[str] = []

    async def ok_handler(event: Event) -> None:
        await asyncio.sleep(0)
        received.append("ok")

    async def failing_handler(event: Event) -> None:
        raise RuntimeError("boom")

    await bus.subscribe(EventType.AGENT_ERROR, failing_handler)
    await bus.subscribe(EventType.AGENT_ERROR, ok_handler)

    # Should not raise; errors are logged and swallowed.
    await bus.publish(
        Event(
            event_type=EventType.AGENT_ERROR,
            timestamp=datetime.utcnow(),
            source_agent="test",
            data={},
        )
    )

    assert received == ["ok"]


@pytest.mark.unit
def test_get_event_bus_is_singleton_and_clear_all_works() -> None:
    bus1 = get_event_bus()
    bus2 = get_event_bus()
    assert bus1 is bus2

    bus1.clear_all()
    assert bus1._subscribers == {}  # type: ignore[attr-defined]
