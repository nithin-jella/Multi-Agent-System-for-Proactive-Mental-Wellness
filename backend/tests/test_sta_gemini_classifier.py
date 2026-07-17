from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.sta.gemini_classifier import GeminiSTAClassifier
from app.agents.sta.schemas import STAClassifyRequest, STAClassifyResponse


@pytest.mark.asyncio
async def test_gemini_sta_classifier_rule_based_crisis_keyword_short_circuits() -> None:
    classifier = GeminiSTAClassifier()
    payload = STAClassifyRequest(text="I want to kill myself", session_id="s1")

    result = await classifier.classify(payload)

    assert result.risk_level == 3
    assert result.intent == "crisis_support"
    assert result.next_step == "human"
    assert result.handoff is True


@pytest.mark.asyncio
async def test_gemini_sta_classifier_rule_based_safe_short_ack() -> None:
    classifier = GeminiSTAClassifier()
    payload = STAClassifyRequest(text="ok", session_id="s1")

    result = await classifier.classify(payload)

    assert result.risk_level == 0
    assert result.handoff is False


@pytest.mark.asyncio
async def test_gemini_sta_classifier_uses_cached_assessment(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()
    cached = STAClassifyResponse(
        risk_level=0,
        intent="general_support",
        next_step="resource",
        handoff=False,
        diagnostic_notes="cached",
        needs_support_coach_plan=False,
        support_plan_type="none",
    )

    monkeypatch.setattr(classifier, "_rule_based_prescreen", lambda _t: {"skip_gemini": False})
    monkeypatch.setattr(classifier, "_get_cached_assessment", AsyncMock(return_value=cached))

    payload = STAClassifyRequest(text="some ambiguous text", session_id="s1")
    result = await classifier.classify(payload)

    assert result.diagnostic_notes == "cached"


@pytest.mark.asyncio
async def test_gemini_sta_classifier_calls_gemini_and_caches_low_risk(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    monkeypatch.setattr(classifier, "_rule_based_prescreen", lambda _t: {"skip_gemini": False})
    monkeypatch.setattr(classifier, "_get_cached_assessment", AsyncMock(return_value=None))

    gemini_result = STAClassifyResponse(
        risk_level=1,
        intent="general_support",
        next_step="tca",
        handoff=False,
        diagnostic_notes="gemini",
        needs_support_coach_plan=False,
        support_plan_type="none",
    )
    monkeypatch.setattr(classifier, "_gemini_chain_of_thought_assessment", AsyncMock(return_value=gemini_result))
    cache_spy = AsyncMock()
    monkeypatch.setattr(classifier, "_cache_assessment", cache_spy)

    payload = STAClassifyRequest(text="ambiguous", session_id="s1")
    result = await classifier.classify(payload)

    assert result.diagnostic_notes == "gemini"
    cache_spy.assert_awaited_once()


@pytest.mark.asyncio
async def test_gemini_chain_of_thought_parses_json_code_block(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    response_payload = {
        "step7_support_needs": "calm_down",
        "step8_classification": {
            "risk_level": 1,
            "intent": "general_support",
            "next_step": "tca",
            "confidence": 0.9,
            "reasoning": "some reasoning"
        },
        "step1_crisis_keywords": [],
        "step2_linguistic_patterns": "none",
        "step3_emotional_tone": {"score": 1, "evidence": "ok"},
        "step4_urgency_signals": [],
        "step5_protective_factors": [],
        "step6_cultural_context": "",
    }

    async def fake_generate_response(**_kwargs):
        return "```json\n" + json.dumps(response_payload) + "\n```"

    monkeypatch.setattr("app.agents.sta.gemini_classifier.generate_response", fake_generate_response)

    result = await classifier._gemini_chain_of_thought_assessment("hello", context={})

    assert result.risk_level == 1
    assert result.needs_support_coach_plan is True
    assert result.support_plan_type == "calm_down"


@pytest.mark.asyncio
async def test_gemini_chain_of_thought_json_decode_error_falls_back_high_risk(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    async def fake_generate_response(**_kwargs):
        return "{not-json"

    monkeypatch.setattr("app.agents.sta.gemini_classifier.generate_response", fake_generate_response)

    result = await classifier._gemini_chain_of_thought_assessment("hello", context={})

    assert result.risk_level == 2
    assert result.handoff is True


@pytest.mark.asyncio
async def test_gemini_chain_of_thought_exception_falls_back_moderate(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    async def fake_generate_response(**_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr("app.agents.sta.gemini_classifier.generate_response", fake_generate_response)

    result = await classifier._gemini_chain_of_thought_assessment("hello", context={})

    assert result.risk_level == 1
    assert result.handoff is False


@pytest.mark.asyncio
async def test_get_cached_assessment_redis_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    cached = STAClassifyResponse(
        risk_level=0,
        intent="general_support",
        next_step="resource",
        handoff=False,
        diagnostic_notes="cached",
        needs_support_coach_plan=False,
        support_plan_type="none",
    )

    class FakeRedis:
        async def get(self, _key: str):
            return json.dumps({**cached.model_dump(), "cached_at": "now"})

    async def fake_get_redis_client():
        return FakeRedis()

    monkeypatch.setattr("app.agents.sta.gemini_classifier.get_redis_client", fake_get_redis_client)

    payload = STAClassifyRequest(text="hello", session_id="sess")
    result = await classifier._get_cached_assessment(payload, context={})

    assert result is not None
    assert result.risk_level == 0


@pytest.mark.asyncio
async def test_get_cached_assessment_in_memory_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    class FakeRedis:
        async def get(self, _key: str):
            return None

    async def fake_get_redis_client():
        return FakeRedis()

    monkeypatch.setattr("app.agents.sta.gemini_classifier.get_redis_client", fake_get_redis_client)

    payload = STAClassifyRequest(text="short message", session_id="sess")
    context = {
        "conversation_state": {
            "messages_since_last_assessment": 1,
            "last_risk_level": "low",
        }
    }

    result = await classifier._get_cached_assessment(payload, context=context)
    assert result is not None
    assert result.diagnostic_notes is not None
    assert "Cached low-risk" in result.diagnostic_notes


@pytest.mark.asyncio
async def test_cache_assessment_only_caches_low_risk(monkeypatch: pytest.MonkeyPatch) -> None:
    classifier = GeminiSTAClassifier()

    setex = AsyncMock()

    class FakeRedis:
        async def setex(self, *_args, **_kwargs):
            await setex()

    async def fake_get_redis_client():
        return FakeRedis()

    monkeypatch.setattr("app.agents.sta.gemini_classifier.get_redis_client", fake_get_redis_client)

    payload = STAClassifyRequest(text="hello", session_id="sess")
    high = STAClassifyResponse(
        risk_level=2,
        intent="crisis_support",
        next_step="human",
        handoff=True,
        diagnostic_notes="",
        needs_support_coach_plan=False,
        support_plan_type="none",
    )

    await classifier._cache_assessment(payload, high, context={})
    setex.assert_not_awaited()

    low = STAClassifyResponse(
        risk_level=1,
        intent="general_support",
        next_step="tca",
        handoff=False,
        diagnostic_notes="",
        needs_support_coach_plan=False,
        support_plan_type="none",
    )

    await classifier._cache_assessment(payload, low, context={})
    setex.assert_awaited_once()
