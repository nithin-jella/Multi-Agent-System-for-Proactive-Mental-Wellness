from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


def test_ingest_query_node_validates_range() -> None:
    from app.agents.ia.ia_graph import ingest_query_node

    state = {
        "ia_context": {
            "question_id": "crisis_trend",
            "start_date": datetime(2025, 1, 1),
            "end_date": datetime(2025, 1, 2),
        },
        "errors": [],
        "execution_path": [],
    }

    out = ingest_query_node(state)
    assert out.get("ia_context", {}).get("query_validated") is True


def test_ingest_query_node_rejects_large_range() -> None:
    from app.agents.ia.ia_graph import ingest_query_node

    state = {
        "ia_context": {
            "question_id": "crisis_trend",
            "start_date": datetime(2020, 1, 1),
            "end_date": datetime(2025, 1, 1),
        },
        "errors": [],
        "execution_path": [],
    }

    out = ingest_query_node(state)
    assert out.get("errors")


def test_validate_consent_node_sets_flag() -> None:
    from app.agents.ia.ia_graph import validate_consent_node

    state = {"ia_context": {"question_id": "crisis_trend"}, "errors": [], "execution_path": []}
    out = validate_consent_node(state)
    assert out.get("ia_context", {}).get("consent_validated") is True


def test_apply_k_anonymity_node_sets_k() -> None:
    from app.agents.ia.ia_graph import apply_k_anonymity_node

    state = {"errors": [], "execution_path": []}
    out = apply_k_anonymity_node(state)
    assert out.get("ia_context", {}).get("k_threshold") == 5


@pytest.mark.asyncio
async def test_execute_analytics_node_uses_service(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia import ia_graph as module

    class FakeService:
        async def query(self, _request):
            return SimpleNamespace(table=[{"x": 1}], chart={"type": "bar"}, notes=["n"])

    monkeypatch.setattr(module, "InsightsAgentService", lambda _db: FakeService())

    state = {
        "ia_context": {
            "question_id": "crisis_trend",
            "start_date": datetime(2025, 1, 1),
            "end_date": datetime(2025, 1, 2),
        },
        "errors": [],
        "execution_path": [],
        "execution_id": None,
    }

    config = {"configurable": {"db": AsyncMock()}}
    out = await module.execute_analytics_node(state, config=config)
    assert out.get("ia_context", {}).get("query_completed") is True
    assert out.get("ia_context", {}).get("analytics_result")


@pytest.mark.asyncio
async def test_interpret_results_node_calls_interpreter(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia import ia_graph as module

    class FakeInterpreter:
        async def interpret_analytics(self, **_kwargs):
            return {"interpretation": "i", "trends": [], "summary": "s", "recommendations": []}

    monkeypatch.setattr(module, "InsightsInterpreter", lambda: FakeInterpreter())

    state = {
        "ia_context": {
            "question_id": "crisis_trend",
            "start_date": datetime(2025, 1, 1),
            "end_date": datetime(2025, 1, 2),
            "query_completed": True,
            "analytics_result": {"data": [{"x": 1}], "chart": {}, "notes": []},
        },
        "errors": [],
        "execution_path": [],
        "execution_id": None,
    }

    out = await module.interpret_results_node(state)
    assert out.get("ia_context", {}).get("interpretation_completed") is True
    assert out.get("ia_context", {}).get("interpretation") == "i"


@pytest.mark.asyncio
async def test_export_pdf_node_calls_generator(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia import ia_graph as module

    monkeypatch.setattr("app.agents.ia.pdf_generator.generate_pdf_report", lambda _state: "/static/reports/x.pdf")

    state = {"errors": [], "execution_path": [], "execution_id": None}
    out = await module.export_pdf_node(state)

    assert out.get("ia_context", {}).get("pdf_url") == "/static/reports/x.pdf"


def test_generate_pdf_report_writes_file(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia.pdf_generator import generate_pdf_report

    base = tmp_path / "base"
    base.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("os.getcwd", lambda: str(base))

    url = generate_pdf_report({"question_id": "crisis_trend", "summary": "s"})
    assert url is not None
    assert url.startswith("/static/reports/")


@pytest.mark.asyncio
async def test_ia_graph_service_execute(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.ia import ia_graph_service as module

    graph = SimpleNamespace(ainvoke=AsyncMock(return_value={"errors": [], "execution_path": ["x"], "ia_context": {"query_completed": True}}))
    monkeypatch.setattr(module, "get_ia_graph", lambda: graph)

    tracker = SimpleNamespace(
        start_execution=lambda **_kwargs: "exec-1",
        complete_execution=lambda *_a, **_k: None,
    )
    monkeypatch.setattr(module, "execution_tracker", tracker)

    service = module.IAGraphService(db=AsyncMock())
    out = await service.execute(
        question_id="crisis_trend",
        start_date=datetime(2025, 1, 1),
        end_date=datetime(2025, 1, 2),
        user_hash="analyst",
    )

    assert out["execution_path"] == ["x"]
    assert "completed_at" in out


@pytest.mark.asyncio
async def test_get_ia_graph_service_returns_instance() -> None:
    from app.agents.ia.ia_graph_service import get_ia_graph_service

    service = await get_ia_graph_service(db=AsyncMock())
    assert service is not None
