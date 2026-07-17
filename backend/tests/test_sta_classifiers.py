from __future__ import annotations

import pytest

from app.agents.sta.classifiers import SafetyTriageClassifier
from app.agents.sta.schemas import STAClassifyRequest


@pytest.mark.asyncio
async def test_safety_triage_classifier_check_crisis_patterns_matches() -> None:
    classifier = SafetyTriageClassifier()
    assert classifier._check_crisis_patterns("i want to die") is True


@pytest.mark.asyncio
async def test_safety_triage_classifier_check_crisis_patterns_not_match() -> None:
    classifier = SafetyTriageClassifier()
    assert classifier._check_crisis_patterns("i am stressed about exams") is False


@pytest.mark.asyncio
async def test_safety_triage_classifier_classify_crisis_keyword() -> None:
    classifier = SafetyTriageClassifier()
    payload = STAClassifyRequest(text="Saya ingin bunuh diri", session_id="s1")
    result = await classifier.classify(payload)

    assert result.risk_level == 3
    assert result.intent == "crisis_support"
    assert result.next_step == "human"
    assert result.handoff is True


@pytest.mark.asyncio
async def test_safety_triage_classifier_classify_high_distress() -> None:
    classifier = SafetyTriageClassifier()
    payload = STAClassifyRequest(text="I feel hopeless and empty inside", session_id="s1")
    result = await classifier.classify(payload)

    assert result.risk_level == 2
    assert result.intent == "acute_distress"
    assert result.handoff is True


@pytest.mark.asyncio
async def test_safety_triage_classifier_classify_academic_intent_routes_to_tca() -> None:
    classifier = SafetyTriageClassifier()
    payload = STAClassifyRequest(text="Saya stres skripsi dan tugas", session_id="s1")
    result = await classifier.classify(payload)

    assert result.intent == "academic_stress"
    assert result.next_step == "tca"
    assert result.needs_therapeutic_coach_plan is True
    assert result.therapeutic_plan_type in {"general_coping", "calm_down", "break_down_problem"}


@pytest.mark.asyncio
async def test_safety_triage_classifier_support_plan_break_down_problem_has_priority() -> None:
    classifier = SafetyTriageClassifier()
    payload = STAClassifyRequest(
        text="Aku panik dan bingung mulai dari mana, ini terlalu banyak",
        session_id="s1",
    )
    result = await classifier.classify(payload)

    assert result.needs_therapeutic_coach_plan is True
    assert result.therapeutic_plan_type == "break_down_problem"
