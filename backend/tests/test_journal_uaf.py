import pytest
from pydantic import ValidationError
from datetime import date

from app.domains.mental_health.services.journal_affective import (
    bucket_pad_value as _bucket_pad_value,
    infer_dominance_from_content as _infer_dominance_from_content,
)
from app.domains.mental_health.schemas.journal import JournalEntryCreate, JournalEntryFilter


@pytest.mark.unit
@pytest.mark.mental_health
def test_infer_dominance_returns_none_for_empty_content() -> None:
    assert _infer_dominance_from_content("", valence=None, arousal=None) is None


@pytest.mark.unit
@pytest.mark.mental_health
def test_infer_dominance_detects_empowerment_language() -> None:
    score = _infer_dominance_from_content(
        "Aku bisa melewati ini. Aku merasa lebih in control dan percaya diri.",
        valence=0.5,
        arousal=0.1,
    )
    assert score is not None
    assert score > 0.2


@pytest.mark.unit
@pytest.mark.mental_health
def test_infer_dominance_detects_overwhelmed_language() -> None:
    score = _infer_dominance_from_content(
        "Aku panik, overwhelmed, dan merasa kehilangan kendali.",
        valence=-0.6,
        arousal=0.8,
    )
    assert score is not None
    assert score < -0.4


@pytest.mark.unit
@pytest.mark.mental_health
def test_bucket_pad_value_boundaries() -> None:
    assert _bucket_pad_value(-0.9) == "very_low"
    assert _bucket_pad_value(-0.6) == "very_low"
    assert _bucket_pad_value(-0.4) == "low"
    assert _bucket_pad_value(0.0) == "neutral"
    assert _bucket_pad_value(0.4) == "high"
    assert _bucket_pad_value(0.8) == "very_high"


@pytest.mark.unit
@pytest.mark.mental_health
def test_journal_filter_accepts_inferred_dominance_bounds() -> None:
    model = JournalEntryFilter(inferred_dominance_min=-0.5, inferred_dominance_max=0.7)
    assert model.inferred_dominance_min == -0.5
    assert model.inferred_dominance_max == 0.7


@pytest.mark.unit
@pytest.mark.mental_health
def test_journal_create_rejects_out_of_range_pad() -> None:
    with pytest.raises(ValidationError):
        JournalEntryCreate(
            entry_date=date(2026, 4, 6),
            content="test",
            valence=1.5,
            arousal=0.2,
            tags=[],
        )
