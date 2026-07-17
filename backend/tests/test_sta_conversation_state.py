from __future__ import annotations

from datetime import datetime

from app.agents.sta.conversation_state import ConversationState


def test_conversation_state_cache_hit_rate_zero_total() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    assert state.cache_hit_rate == 0.0


def test_conversation_state_cache_hit_rate_ratio() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    state.assessments_performed = 3
    state.assessments_skipped = 1
    assert state.cache_hit_rate == 1 / 4


def test_conversation_state_efficiency_score_empty_message_count() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    assert state.efficiency_score == 1.0


def test_conversation_state_efficiency_score_penalizes_gemini_calls() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    state.message_count = 10
    state.gemini_calls_made = 5
    assert 0.0 <= state.efficiency_score <= 1.0
    assert state.efficiency_score < 1.0


def test_conversation_state_should_skip_intent_classification() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    state.intent_stable_count = 3
    state.last_risk_level = "low"
    state.message_count = 1
    assert state.should_skip_intent_classification() is True


def test_conversation_state_update_after_assessment_updates_trend_and_counters() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    before = datetime.now()

    state.update_after_assessment(
        risk_level="low",
        risk_score=0.2,
        intent="academic_stress",
        skipped=False,
        gemini_called=True,
    )

    assert state.message_count == 1
    assert state.assessments_performed == 1
    assert state.assessments_skipped == 0
    assert state.last_risk_level == "low"
    assert state.last_risk_score == 0.2
    assert state.last_assessment_time is not None
    assert state.last_assessment_time >= before
    assert state.risk_trend == [0.2]
    assert state.last_intent == "academic_stress"
    assert state.intent_stable_count == 1
    assert state.gemini_calls_made == 1


def test_conversation_state_update_after_assessment_skipped_does_not_update_risk_fields() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    state.last_risk_level = "moderate"
    state.last_risk_score = 0.6
    state.last_assessment_time = datetime(2025, 1, 1)

    state.update_after_assessment(
        risk_level="low",
        risk_score=0.2,
        intent="moderate",
        skipped=True,
        gemini_called=False,
    )

    assert state.message_count == 1
    assert state.assessments_performed == 0
    assert state.assessments_skipped == 1
    assert state.last_risk_level == "moderate"
    assert state.last_risk_score == 0.6
    assert state.last_assessment_time == datetime(2025, 1, 1)


def test_conversation_state_update_after_assessment_clamps_risk_trend_to_last_10() -> None:
    state = ConversationState(conversation_id="c1", user_id=1)
    for i in range(12):
        state.update_after_assessment(
            risk_level="low",
            risk_score=i / 10.0,
            intent="general_support",
            skipped=False,
            gemini_called=False,
        )

    assert len(state.risk_trend) == 10
    assert state.risk_trend[0] == 0.2
    assert state.risk_trend[-1] == 1.1
