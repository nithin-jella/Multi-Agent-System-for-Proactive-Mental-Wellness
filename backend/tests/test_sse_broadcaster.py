from __future__ import annotations

from typing import Any

import pytest

from app.services.sse_broadcaster import SSEBroadcaster


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sse_broadcaster_add_remove_and_stats() -> None:
    broadcaster = SSEBroadcaster()

    conn1 = await broadcaster.add_connection(user_id=1)
    conn2 = await broadcaster.add_connection(user_id=1)
    conn3 = await broadcaster.add_connection(user_id=2)

    stats = broadcaster.get_stats()
    assert stats["total_connections"] == 3
    assert stats["connected_users"] == 2
    assert stats["connections_per_user"][1] == 2
    assert stats["connections_per_user"][2] == 1

    await broadcaster.remove_connection(conn1.connection_id)

    stats2 = broadcaster.get_stats()
    assert stats2["total_connections"] == 2
    assert stats2["connections_per_user"][1] == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sse_broadcaster_broadcast_filters_by_user() -> None:
    broadcaster = SSEBroadcaster()

    conn_user_1 = await broadcaster.add_connection(user_id=1)
    conn_user_2 = await broadcaster.add_connection(user_id=2)

    sent_to_all = await broadcaster.broadcast("hello", {"x": 1})
    assert sent_to_all == 2

    sent_to_user_1 = await broadcaster.broadcast("private", {"y": 2}, user_id=1)
    assert sent_to_user_1 == 1

    # Drain queues (ensures events actually landed)
    assert (await conn_user_1.queue.get())["type"] in {"hello", "private"}
    assert (await conn_user_1.queue.get())["type"] in {"hello", "private"}

    assert (await conn_user_2.queue.get())["type"] == "hello"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sse_connection_formats_event_stream_message() -> None:
    broadcaster = SSEBroadcaster()
    conn = await broadcaster.add_connection(user_id=1)

    await conn.send({"type": "test", "data": {"a": 1}, "id": "evt1"})

    agen = conn.get_events()
    first = await agen.__anext__()

    assert "id: evt1" in first
    assert "event: test" in first
    assert "data:" in first
