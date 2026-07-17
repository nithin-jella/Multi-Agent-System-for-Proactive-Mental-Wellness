from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_ingest_escalation_node_rejects_low_severity(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    state = {"sta_context": {"severity": "low"}, "errors": [], "execution_path": []}
    out = await module.ingest_escalation_node(state)

    assert out["errors"]


@pytest.mark.asyncio
async def test_create_case_node_sets_case_id(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    class Severity:
        low = SimpleNamespace(value="low")
        med = SimpleNamespace(value="med")
        high = SimpleNamespace(value="high")
        critical = SimpleNamespace(value="critical")

    class Status:
        new = "new"
        in_progress = "in_progress"
        waiting = "waiting"

    class DummyCase:
        def __init__(self, **_kwargs):
            self.id = "case-1"

    monkeypatch.setattr(module, "CaseSeverityEnum", Severity)
    monkeypatch.setattr(module, "CaseStatusEnum", Status)
    monkeypatch.setattr(module, "Case", DummyCase)

    db = AsyncMock()
    config = {"configurable": {"db": db}}
    state = {
        "sta_context": {"severity": "high", "risk_score": 0.9, "intent": "crisis"},
        "user_hash": "u",
        "session_id": "s",
        "conversation_id": 1,
        "errors": [],
        "execution_path": [],
        "execution_id": None,
    }

    out = await module.create_case_node(state, config=config)

    assert out["cma_context"]["case_id"] == "case-1"
    assert out["cma_context"]["case_created"] is True


@pytest.mark.asyncio
async def test_calculate_sla_node_requires_case_id(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    db = AsyncMock()
    config = {"configurable": {"db": db}}
    state = {"errors": [], "execution_path": [], "execution_id": None}

    out = await module.calculate_sla_node(state, config=config)
    assert out["errors"]


@pytest.mark.asyncio
async def test_auto_assign_node_no_counsellors(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    class FakeResult:
        def scalars(self):
            return self

        def all(self):
            return []

    async def fake_execute(*_args, **_kwargs):
        return FakeResult()

    db = AsyncMock()
    db.execute.side_effect = fake_execute
    config = {"configurable": {"db": db}}

    state = {"cma_context": {"case_id": "case-1"}, "errors": [], "execution_path": [], "execution_id": None}
    out = await module.auto_assign_node(state, config=config)

    assert out["cma_context"]["assigned_to"] is None
    assert out["cma_context"]["assignment_reason"] == "no_counsellors_available"


@pytest.mark.asyncio
async def test_schedule_appointment_node_skips_when_not_requested(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    db = AsyncMock()
    config = {"configurable": {"db": db}}
    state = {"cma_context": {"schedule_appointment": False}, "errors": [], "execution_path": [], "execution_id": None}

    out = await module.schedule_appointment_node(state, config=config)
    assert out["errors"] == []


@pytest.mark.asyncio
async def test_cma_graph_service_severity_validation() -> None:
    from app.agents.cma.cma_graph_service import CMAGraphService

    service = CMAGraphService(db=AsyncMock())
    with pytest.raises(ValueError):
        await service.execute(
            user_id=1,
            session_id="s",
            user_hash="u",
            message="m",
            severity="low",
        )


@pytest.mark.asyncio
async def test_cma_graph_service_execute(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.cma import cma_graph_service as module

    graph = SimpleNamespace(ainvoke=AsyncMock(return_value={"errors": [], "execution_path": ["x"], "cma_context": {"case_created": True}}))
    monkeypatch.setattr(module, "get_cma_graph", lambda: graph)

    tracker = SimpleNamespace(
        start_execution=lambda **_kwargs: "exec-1",
        complete_execution=lambda *_a, **_k: None,
    )
    monkeypatch.setattr(module, "execution_tracker", tracker)

    service = module.CMAGraphService(db=AsyncMock())
    out = await service.execute(
        user_id=1,
        session_id="s",
        user_hash="u",
        message="m",
        severity="high",
    )

    assert out["execution_path"] == ["x"]
    assert "completed_at" in out


@pytest.mark.asyncio
async def test_get_cma_graph_service_returns_instance() -> None:
    from app.agents.cma.cma_graph_service import get_cma_graph_service

    service = await get_cma_graph_service(db=AsyncMock())
    assert service is not None
