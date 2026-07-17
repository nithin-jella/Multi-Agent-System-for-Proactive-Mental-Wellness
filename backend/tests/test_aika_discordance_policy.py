import pytest
from types import SimpleNamespace
from typing import Any, cast

from app.agents.aika.decision_node import (
    _apply_screening_discordance_policy,
    _compute_high_discordance_routing_override,
)
from app.agents.graph_state import AikaOrchestratorState


@pytest.mark.agents
@pytest.mark.unit
def test_high_discordance_with_concerning_context_escalates_to_tca() -> None:
    patch = _compute_high_discordance_routing_override(
        discordance_level="high",
        immediate_risk_level="none",
        needs_agents=False,
        next_step="none",
        intent="emotional_support",
        message="aku merasa kosong dan putus asa akhir-akhir ini",
        crisis_keywords=[],
    )

    assert patch["discordance_concerning_context"] is True
    assert patch["discordance_escalated"] is True
    assert patch["needs_agents"] is True
    assert patch["sta_context"]["next_step"] == "tca"


@pytest.mark.agents
@pytest.mark.unit
def test_high_discordance_without_concerning_context_keeps_direct_response() -> None:
    patch = _compute_high_discordance_routing_override(
        discordance_level="high",
        immediate_risk_level="none",
        needs_agents=False,
        next_step="none",
        intent="casual_chat",
        message="makasih ya, aku cuma mau ngobrol ringan",
        crisis_keywords=[],
    )

    assert patch["discordance_concerning_context"] is False
    assert patch["discordance_escalated"] is False
    assert "needs_agents" not in patch
    assert "sta_context" not in patch


@pytest.mark.agents
@pytest.mark.unit
def test_high_discordance_does_not_override_explicit_high_risk_path() -> None:
    patch = _compute_high_discordance_routing_override(
        discordance_level="high",
        immediate_risk_level="high",
        needs_agents=True,
        next_step="cma",
        intent="crisis",
        message="aku kepikiran melukai diri",
        crisis_keywords=["melukai diri"],
    )

    assert patch["discordance_concerning_context"] is True
    assert patch["discordance_escalated"] is False
    assert "needs_agents" not in patch
    assert "sta_context" not in patch


@pytest.mark.agents
@pytest.mark.unit
def test_non_high_discordance_never_escalates() -> None:
    patch = _compute_high_discordance_routing_override(
        discordance_level="medium",
        immediate_risk_level="none",
        needs_agents=False,
        next_step="none",
        intent="emotional_support",
        message="hari ini cukup berat",
        crisis_keywords=[],
    )

    assert patch["discordance_concerning_context"] is False
    assert patch["discordance_escalated"] is False
    assert "needs_agents" not in patch
    assert "sta_context" not in patch


@pytest.mark.agents
@pytest.mark.unit
@pytest.mark.asyncio
async def test_apply_screening_discordance_policy_promotes_to_tca(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.agents.aika.screening_awareness as screening_awareness

    async def fake_get_screening_aware_prompt_addition(**_: object) -> tuple[str, SimpleNamespace]:
        return (
            "# INTERNAL SYSTEM GUIDANCE",
            SimpleNamespace(discordance_level="high", discordance_reason="Large PAD gap"),
        )

    monkeypatch.setattr(
        screening_awareness,
        "get_screening_aware_prompt_addition",
        fake_get_screening_aware_prompt_addition,
    )

    state: dict[str, Any] = {
        "user_id": 42,
        "conversation_history": [],
        "message": "aku merasa kosong dan putus asa",
        "session_id": "sess-1",
        "needs_agents": False,
        "immediate_risk_level": "none",
        "crisis_keywords_detected": [],
        "agent_reasoning": "baseline",
        "sta_context": {
            "next_step": "none",
            "intent": "emotional_support",
        }
    }

    await _apply_screening_discordance_policy(
        cast(AikaOrchestratorState, state),
        "user",
        db=cast(Any, object()),
    )

    assert state["screening_prompt_addition"] == "# INTERNAL SYSTEM GUIDANCE"
    assert state["discordance_level"] == "high"
    assert state["discordance_reason"] == "Large PAD gap"
    assert state["discordance_concerning_context"] is True
    assert state["discordance_escalated"] is True
    assert state["needs_agents"] is True
    assert state.get("sta_context", {}).get("next_step") == "tca"
    assert "deterministic escalation to TCA" in state["agent_reasoning"]


@pytest.mark.agents
@pytest.mark.unit
@pytest.mark.asyncio
async def test_apply_screening_discordance_policy_keeps_explicit_high_risk_route(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.agents.aika.screening_awareness as screening_awareness

    async def fake_get_screening_aware_prompt_addition(**_: object) -> tuple[str, SimpleNamespace]:
        return (
            "# INTERNAL SYSTEM GUIDANCE",
            SimpleNamespace(discordance_level="high", discordance_reason="Large PAD gap"),
        )

    monkeypatch.setattr(
        screening_awareness,
        "get_screening_aware_prompt_addition",
        fake_get_screening_aware_prompt_addition,
    )

    state: dict[str, Any] = {
        "user_id": 7,
        "conversation_history": [],
        "message": "aku panik dan takut",
        "session_id": "sess-2",
        "needs_agents": True,
        "immediate_risk_level": "high",
        "crisis_keywords_detected": ["panic"],
        "agent_reasoning": "explicit high-risk route",
        "sta_context": {
            "next_step": "cma",
            "intent": "crisis",
        }
    }

    await _apply_screening_discordance_policy(
        cast(AikaOrchestratorState, state),
        "user",
        db=cast(Any, object()),
    )

    assert state["discordance_concerning_context"] is True
    assert state["discordance_escalated"] is False
    assert state.get("sta_context", {}).get("next_step") == "cma"
    assert state["needs_agents"] is True
