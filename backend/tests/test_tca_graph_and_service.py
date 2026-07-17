from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.tca.schemas import PlanStep, ResourceCard, TCAInterveneRequest


@pytest.mark.asyncio
async def test_ingest_triage_signal_node_missing_sta_data(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    state = {"errors": [], "execution_path": [], "sta_context": {"severity": None, "intent": None}}
    out = await module.ingest_triage_signal_node(state)

    assert out["errors"]


@pytest.mark.asyncio
async def test_determine_intervention_type_node_maps_intent(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    state = {"errors": [], "execution_path": [], "sta_context": {"intent": "panic", "severity": "low"}}
    out = await module.determine_intervention_type_node(state)
    assert out["tca_context"]["intervention_type"] == "calm_down"


@pytest.mark.asyncio
async def test_generate_plan_node_calls_service(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    class FakeService:
        async def intervene(self, *args, **kwargs):
            return SimpleNamespace(
                plan_steps=[PlanStep(title="A", description="B", duration_min=1)],
                resource_cards=[ResourceCard(resource_id="r1", title="R", description="D", url="u")],
            )

    monkeypatch.setattr(module, "TherapeuticCoachService", lambda: FakeService())

    state = {
        "errors": [],
        "execution_path": [],
        "sta_context": {"intent": "general_support", "severity": "low"},
        "user_hash": "u",
        "session_id": "s",
        "message": "m",
    }

    out = await module.generate_plan_node(state)
    assert out["tca_context"]["intervention_plan"]["plan_steps"][0]["title"] == "A"
    assert out["tca_context"]["intervention_plan"]["resource_cards"][0]["resource_id"] == "r1"


@pytest.mark.asyncio
async def test_safety_review_blocks_high_severity(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    state = {"errors": [], "execution_path": [], "sta_context": {"severity": "high"}, "tca_context": {"should_intervene": True}}
    out = await module.safety_review_node(state)

    assert out["tca_context"]["should_intervene"] is False
    assert out["errors"]


@pytest.mark.asyncio
async def test_persist_plan_node_skips_when_should_not_intervene(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    db = AsyncMock()
    state = {"errors": [], "execution_path": [], "tca_context": {"should_intervene": False}}

    out = await module.persist_plan_node(state, config={"configurable": {"db": db}})

    assert "persist_plan" in out["execution_path"]
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_tca_graph_service_execute(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import tca_graph_service as module

    graph = SimpleNamespace(ainvoke=AsyncMock(return_value={"errors": [], "execution_path": ["x"], "tca_context": {"intervention_type": "general_coping"}}))
    monkeypatch.setattr(module, "get_tca_graph", lambda: graph)

    tracker = SimpleNamespace(
        start_execution=lambda **_kwargs: "exec-1",
        complete_execution=lambda *_a, **_k: None,
    )
    monkeypatch.setattr(module, "execution_tracker", tracker)

    service = module.TCAGraphService(db=AsyncMock())
    out = await service.execute(
        user_id=1,
        session_id="s",
        user_hash="u",
        message="m",
        conversation_id=1,
        severity="low",
        intent="panic",
    )

    assert out["execution_path"] == ["x"]
    assert "completed_at" in out


@pytest.mark.asyncio
async def test_tca_router_intervene_passes_use_gemini_flag() -> None:
    from app.agents.tca.router import intervene

    service = SimpleNamespace(intervene=AsyncMock(return_value=SimpleNamespace(plan_steps=[], resource_cards=[], next_check_in=None)))
    payload = TCAInterveneRequest(
        intent="general_support",
        user_hash="u",
        session_id="s",
        options={"use_gemini_plan": "true", "plan_type": "calm_down", "original_prompt": "hello"},
    )

    current_user = SimpleNamespace(id=1)
    db = AsyncMock()

    await intervene(payload=payload, service=service, current_user=current_user, db=db)  # type: ignore[arg-type]

    service.intervene.assert_awaited_once()
    _, kwargs = service.intervene.call_args
    assert kwargs["use_gemini_plan"] is True


@pytest.mark.asyncio
async def test_get_tca_graph_service_returns_instance() -> None:
    from app.agents.tca.tca_graph_service import get_tca_graph_service

    service = await get_tca_graph_service(db=AsyncMock())
    assert service is not None
