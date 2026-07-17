from __future__ import annotations

import json

import pytest


@pytest.mark.asyncio
async def test_analyze_conversation_risk_requires_history() -> None:
    from app.agents.sta.conversation_analyzer import analyze_conversation_risk

    with pytest.raises(ValueError):
        await analyze_conversation_risk(conversation_history=[], current_message="end")


@pytest.mark.asyncio
async def test_analyze_conversation_risk_parses_json(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta.conversation_analyzer import analyze_conversation_risk

    response = {
        "overall_risk_level": "low",
        "risk_trend": "stable",
        "conversation_summary": "Mahasiswa menyampaikan stres akademik ringan.",
        "user_context": {
            "recent_stressors": ["tugas"],
            "coping_mechanisms": ["istirahat"],
            "protective_factors": ["teman"],
        },
        "protective_factors": ["dukungan teman"],
        "concerns": ["tekanan akademik"],
        "recommended_actions": ["beri sumber daya self-help"],
        "should_invoke_cma": False,
        "reasoning": "Indikator risiko rendah dan stabil.",
        "pleasure": 0.5,
        "arousal": -0.2,
        "dominance": 0.8,
        "screening": {
            "anxiety": {
                "score": 0.3,
                "evidence": ["Saya merasa cemas"],
                "is_protective": False,
            },
            "protective_dimensions": [],
        }
    }

    async def fake_generate_response_with_fallback(**_kwargs):
        return json.dumps(response)

    monkeypatch.setattr(
        "app.agents.sta.conversation_analyzer.generate_gemini_response_with_fallback",
        fake_generate_response_with_fallback,
    )

    result = await analyze_conversation_risk(
        conversation_history=[
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ],
        current_message="bye",
    )

    assert result.overall_risk_level == "low"
    assert result.risk_trend == "stable"
    assert result.pleasure == 0.5
    assert result.arousal == -0.2
    assert result.dominance == 0.8
    assert result.screening is not None
    assert result.screening.anxiety is not None
    assert result.screening.anxiety.score == 0.3


@pytest.mark.asyncio
async def test_analyze_conversation_risk_rejects_empty_llm_response(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.sta.conversation_analyzer import analyze_conversation_risk

    async def fake_generate_response_with_fallback(**_kwargs):
        return None

    monkeypatch.setattr(
        "app.agents.sta.conversation_analyzer.generate_gemini_response_with_fallback",
        fake_generate_response_with_fallback,
    )

    with pytest.raises(ValueError, match="empty response"):
        await analyze_conversation_risk(
            conversation_history=[
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "hello"},
            ],
            current_message="bye",
        )
