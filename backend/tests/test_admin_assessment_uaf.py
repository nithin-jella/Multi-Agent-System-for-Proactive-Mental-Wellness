import pytest

from app.domains.mental_health.services.affective_discordance import compute_affective_discordance


@pytest.mark.unit
@pytest.mark.mental_health
def test_compute_affective_discordance_requires_core_valence_data() -> None:
    result = compute_affective_discordance(
        journal_valence=None,
        journal_arousal=0.2,
        assessment_pleasure=0.8,
        assessment_arousal=0.2,
    )
    assert result.score is None
    assert result.level == "none"
    assert result.reason is None


@pytest.mark.unit
@pytest.mark.mental_health
def test_compute_affective_discordance_classifies_thresholds() -> None:
    low = compute_affective_discordance(
        journal_valence=0.1,
        journal_arousal=0.0,
        assessment_pleasure=0.55,
        assessment_arousal=0.0,
    )
    assert low.level == "low"

    medium = compute_affective_discordance(
        journal_valence=0.7,
        journal_arousal=0.1,
        assessment_pleasure=-0.1,
        assessment_arousal=0.0,
    )
    assert medium.level == "medium"

    high = compute_affective_discordance(
        journal_valence=0.9,
        journal_arousal=0.8,
        assessment_pleasure=-0.2,
        assessment_arousal=-0.3,
    )
    assert high.level == "high"
    assert high.score is not None
    assert high.score > 0.8
    assert high.reason is not None
