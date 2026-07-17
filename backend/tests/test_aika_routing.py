import pytest

from app.agents.aika_orchestrator_graph import (
    _detect_crisis_keywords,
    _format_personal_memory_block,
    _is_smalltalk_message,
    _normalize_user_role,
    should_invoke_agents,
)


@pytest.mark.agents
@pytest.mark.unit
def test_normalize_user_role_maps_expected_values() -> None:
    assert _normalize_user_role("user") == "user"
    assert _normalize_user_role("admin") == "admin"
    assert _normalize_user_role("counselor") == "counselor"
    assert _normalize_user_role("unknown") == "user"   # fallback is 'user'
    # student is a legacy alias for user (lecturers also use the app)
    assert _normalize_user_role("student") == "user"
    # therapist is a legacy alias for counselor
    assert _normalize_user_role("therapist") == "counselor"
    # All admin aliases must resolve
    assert _normalize_user_role("administrator") == "admin"
    assert _normalize_user_role("superadmin") == "admin"


@pytest.mark.agents
@pytest.mark.unit
def test_format_personal_memory_block_empty_when_no_facts() -> None:
    state = {"personal_context": {"remembered_facts": []}}
    assert _format_personal_memory_block(state) == ""


@pytest.mark.agents
@pytest.mark.unit
def test_format_personal_memory_block_caps_at_20_and_strips() -> None:
    facts = ["  a ", "", "b"] + [f"x{i}" for i in range(50)]
    state = {"personal_context": {"remembered_facts": facts}}

    rendered = _format_personal_memory_block(state)

    assert rendered.startswith("User memory")
    assert "- a" in rendered
    assert "- b" in rendered
    # After stripping empties, the list is: a, b, x0..x17 (20 items total)
    assert "\n- x17" in rendered
    assert "x18" not in rendered  # capped at 20 items


@pytest.mark.agents
@pytest.mark.unit
def test_should_invoke_agents_routes_by_next_step() -> None:
    # High/critical risk: fan-out TCA ∥ CMA
    assert should_invoke_agents({"sta_context": {"next_step": "cma"}, "needs_agents": True}) == "invoke_crisis_parallel"
    # Moderate risk: TCA only
    assert should_invoke_agents({"sta_context": {"next_step": "tca"}, "needs_agents": True}) == "invoke_tca"
    # Analytics
    assert should_invoke_agents({"sta_context": {"next_step": "ia"}, "needs_agents": True}) == "invoke_ia"
    # STA no longer routes synchronously — next_step="sta" falls through to end
    assert should_invoke_agents({"sta_context": {"next_step": "sta"}, "needs_agents": True}) == "end"


@pytest.mark.agents
@pytest.mark.unit
def test_should_invoke_agents_fallbacks_to_tca_when_needs_agents_true() -> None:
    assert should_invoke_agents({"needs_agents": True}) == "end"


@pytest.mark.agents
@pytest.mark.unit
def test_should_invoke_agents_fallback_uses_risk_context() -> None:
    assert should_invoke_agents({"needs_agents": True, "immediate_risk_level": "moderate"}) == "invoke_tca"
    # High/critical falls through to parallel crisis fan-out
    assert should_invoke_agents({"needs_agents": True, "immediate_risk_level": "high"}) == "invoke_crisis_parallel"


@pytest.mark.agents
@pytest.mark.unit
def test_should_invoke_agents_fallback_uses_admin_analytics_context() -> None:
    result = should_invoke_agents(
        {
            "needs_agents": True,
            "sta_context": {"intent": "analytics_query"},
            "user_role": "admin",
            "immediate_risk_level": "none",
        }
    )
    assert result == "invoke_ia"


@pytest.mark.agents
@pytest.mark.unit
def test_should_invoke_agents_ends_when_needs_agents_false() -> None:
    assert should_invoke_agents({"needs_agents": False}) == "end"


@pytest.mark.agents
@pytest.mark.unit
def test_smalltalk_detector_matches_greetings() -> None:
    assert _is_smalltalk_message("hi")
    assert _is_smalltalk_message("Halo Aika")
    assert _is_smalltalk_message("terima kasih")
    assert not _is_smalltalk_message("aku panik banget dan nggak bisa napas")


@pytest.mark.agents
@pytest.mark.unit
def test_crisis_keyword_detector_captures_high_risk_phrases() -> None:
    hits = _detect_crisis_keywords("aku mau mati dan berpikir untuk bunuh diri")
    assert "mau mati" in hits
    assert "bunuh diri" in hits
