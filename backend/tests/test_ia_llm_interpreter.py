from __future__ import annotations

import pytest

from app.agents.ia.llm_interpreter import InsightsInterpreter


def test_summarize_data_empty() -> None:
    interpreter = InsightsInterpreter()
    assert "Tidak ada data" in interpreter._summarize_data([])


def test_summarize_data_limits_to_10() -> None:
    interpreter = InsightsInterpreter()
    data = [{"a": i} for i in range(12)]
    summary = interpreter._summarize_data(data)
    assert "... dan" in summary


def test_parse_trend_line_structured() -> None:
    interpreter = InsightsInterpreter()
    trend = interpreter._parse_trend_line("- Tren: X | Signifikansi: high | Implikasi: Y")
    assert trend is not None
    assert trend["trend"] == "X"


def test_parse_recommendation_line_structured() -> None:
    interpreter = InsightsInterpreter()
    rec = interpreter._parse_recommendation_line("- Rekomendasi: A | Prioritas: low | Aksi: B")
    assert rec is not None
    assert rec["recommendation"] == "A"


def test_parse_interpretation_extracts_sections() -> None:
    interpreter = InsightsInterpreter()
    response = """1. RINGKASAN EKSEKUTIF\n- something\n2. INTERPRETASI UTAMA\nSome analysis\n3. TREN\n- Tren: X | Signifikansi: high | Implikasi: Y\n4. REKOMENDASI\n- Rekomendasi: A | Prioritas: low | Aksi: B\n"""
    parsed = interpreter._parse_interpretation(response)

    assert parsed["trends"]
    assert parsed["recommendations"]


@pytest.mark.asyncio
async def test_interpret_analytics_calls_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    interpreter = InsightsInterpreter()

    async def fake_generate_gemini_response(**_kwargs):
        return "RINGKASAN\nOk\nTREN\n- Tren: X | Signifikansi: high | Implikasi: Y\nREKOMENDASI\n- Rekomendasi: A | Prioritas: low | Aksi: B"

    monkeypatch.setattr("app.agents.ia.llm_interpreter.generate_gemini_response", fake_generate_gemini_response)

    result = await interpreter.interpret_analytics(
        question_id="crisis_trend",
        data=[{"date": "2025-01-01", "crisis_count": 5}],
        chart={"type": "line"},
        notes=["n"],
        start_date=__import__("datetime").datetime(2025, 1, 1),
        end_date=__import__("datetime").datetime(2025, 1, 2),
    )

    assert result["trends"]
    assert result["recommendations"]
