from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.sta.sta_graph import ingest_message_node, decide_routing
from app.agents.sta.schemas import STAClassifyRequest, STAClassifyResponse


@pytest.mark.asyncio
async def test_ingest_message_node_adds_execution_path() -> None:
    state = {
        "message": "hello",
        "errors": [],
        "execution_path": [],
    }

    result = await ingest_message_node(state)
    assert result["execution_path"] == ["ingest_message"]


def test_decide_routing_routes_human_for_high_severity() -> None:
    state = {"sta_context": {"severity": "high"}}
    assert decide_routing(state) == "escalate_sda"


def test_decide_routing_routes_sca_for_tca_next_step() -> None:
    state = {"sta_context": {"severity": "low", "next_step": "tca"}}
    assert decide_routing(state) == "route_sca"


def test_decide_routing_routes_resources_by_default() -> None:
    state = {"sta_context": {"severity": "low", "next_step": "resource"}}
    assert decide_routing(state) == "end"


@pytest.mark.asyncio
async def test_apply_redaction_node_uses_redaction(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta import sta_graph as module

    def fake_redact(text: str):
        return (text.replace("secret", "[REDACTED]"), {"email": 0})

    monkeypatch.setattr(module, "redact_pii_regex", fake_redact)
    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    state = {
        "message": "my secret",
        "errors": [],
        "execution_path": [],
        "execution_id": None,
    }

    result = await module.apply_redaction_node(state, db=AsyncMock())

    assert result.get("sta_context", {}).get("redacted_message") == "my [REDACTED]"
    assert "apply_redaction" in result["execution_path"]


@pytest.mark.asyncio
async def test_assess_risk_node_calls_service(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta import sta_graph as module

    monkeypatch.setattr(module, "execution_tracker", SimpleNamespace(start_node=lambda *_a, **_k: None, complete_node=lambda *_a, **_k: None, fail_node=lambda *_a, **_k: None))

    class FakeService:
        async def classify(self, _payload: STAClassifyRequest):
            return STAClassifyResponse(
                risk_level=2,
                intent="acute_distress",
                next_step="tca",
                handoff=True,
                diagnostic_notes="x",
                needs_therapeutic_coach_plan=False,
                therapeutic_plan_type="none",
            )

    monkeypatch.setattr(module, "get_safety_triage_service", lambda _db: FakeService())

    state = {
        "message": "help",
        "redacted_message": "help",
        "errors": [],
        "execution_path": [],
        "session_id": "s1",
        "user_hash": "u1",
        "execution_id": None,
    }

    result = await module.assess_risk_node(state, db=AsyncMock())

    assert result.get("sta_context", {}).get("severity") in {"high", "critical"}
    assert result.get("sta_context", {}).get("intent") == "acute_distress"
    assert "assess_risk" in result["execution_path"]


@pytest.mark.asyncio
async def test_sta_router_classify_calls_service(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta.router import classify

    service = SimpleNamespace(
        classify=AsyncMock(
            return_value=STAClassifyResponse(
                risk_level=0,
                intent="general_support",
                next_step="resource",
                handoff=False,
                diagnostic_notes=None,
                needs_therapeutic_coach_plan=False,
                therapeutic_plan_type="none",
            )
        )
    )

    payload = STAClassifyRequest(text="hi", session_id="s1")
    response = await classify(payload=payload, service=service)  # type: ignore[arg-type]

    assert response.risk_level == 0
    service.classify.assert_awaited_once()


@pytest.mark.asyncio
async def test_sta_graph_service_execute_success(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta import sta_graph_service as module

    graph = SimpleNamespace(ainvoke=AsyncMock(return_value={"errors": [], "execution_path": ["x"]}))
    monkeypatch.setattr(module, "create_sta_graph", lambda _db: graph)

    tracker = SimpleNamespace(
        start_execution=lambda **_kwargs: "exec-1",
        complete_execution=lambda *_a, **_k: None,
    )
    monkeypatch.setattr(module, "execution_tracker", tracker)

    service = module.STAGraphService(db=AsyncMock())

    result = await service.execute(
        user_id=1,
        session_id="s",
        user_hash="u",
        message="m",
        conversation_id=1,
    )

    assert result["execution_path"] == ["x"]
    assert "completed_at" in result


@pytest.mark.asyncio
async def test_get_sta_graph_service_returns_instance() -> None:
    from app.agents.sta.sta_graph_service import get_sta_graph_service

    service = await get_sta_graph_service(db=AsyncMock())
    assert service is not None
