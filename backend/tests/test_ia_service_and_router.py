from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.ia.service import InsightsAgentService


@pytest.mark.asyncio
async def test_ia_router_query_calls_service() -> None:
    from app.agents.ia.router import query

    service = SimpleNamespace(query=AsyncMock(return_value=SimpleNamespace(chart={}, table=[], notes=[])))
    payload = SimpleNamespace(question_id="crisis_trend", params=SimpleNamespace(start=datetime(2025, 1, 1), end=datetime(2025, 1, 2)))

    await query(payload=payload, service=service)  # type: ignore[arg-type]
    service.query.assert_awaited_once()


@pytest.mark.asyncio
async def test_insights_agent_service_query_unsupported_question() -> None:
    session = SimpleNamespace()
    service = InsightsAgentService(session=session)  # type: ignore[arg-type]

    payload = SimpleNamespace(question_id="unknown", params=SimpleNamespace(start=datetime(2025, 1, 1), end=datetime(2025, 1, 2)))
    with pytest.raises(ValueError):
        await service.query(payload)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_insights_agent_service_query_invalid_date_range(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia import service as module

    class FakeSession:
        async def execute(self, *_args, **_kwargs):
            return SimpleNamespace(fetchall=lambda: [])

    service = module.InsightsAgentService(session=FakeSession())  # type: ignore[arg-type]

    payload = SimpleNamespace(question_id="crisis_trend", params=SimpleNamespace(start=datetime(2025, 1, 2), end=datetime(2025, 1, 1)))
    with pytest.raises(ValueError):
        await service.query(payload)  # type: ignore[arg-type]


def test_resolve_formatter_returns_callable() -> None:
    from app.agents.ia import service as module

    service = module.InsightsAgentService(session=SimpleNamespace())  # type: ignore[arg-type]
    formatter = service._resolve_formatter("dropoffs")
    assert callable(formatter)


def test_format_dropoffs_empty_rows() -> None:
    from app.agents.ia import service as module

    service = module.InsightsAgentService(session=SimpleNamespace())  # type: ignore[arg-type]
    resp = service._format_dropoffs(rows=[], start=datetime(2025, 1, 1), end=datetime(2025, 1, 2))

    assert resp.table == []
    assert resp.chart["type"] == "bar"


def test_format_sentiment_trends_builds_series() -> None:
    from app.agents.ia import service as module

    service = module.InsightsAgentService(session=SimpleNamespace())  # type: ignore[arg-type]
    rows = [
        ("2025-01-01", 0.2, 1, 1, 0, 0, 2),
        ("2025-01-02", 0.4, 0, 1, 1, 0, 2),
    ]
    resp = service._format_sentiment_trends(rows=rows, start=datetime(2025, 1, 1), end=datetime(2025, 1, 3))  # type: ignore[arg-type]

    assert resp.chart["type"] == "line"
    assert resp.table
