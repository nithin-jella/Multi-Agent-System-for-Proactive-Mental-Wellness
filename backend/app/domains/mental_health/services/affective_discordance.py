"""Utilities for comparing self-reported and AI-detected affective states."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional


DiscordanceLevel = Literal["none", "low", "medium", "high"]


@dataclass(frozen=True)
class AffectiveDiscordanceResult:
    score: Optional[float]
    level: DiscordanceLevel
    reason: Optional[str]


def compute_affective_discordance(
    *,
    journal_valence: Optional[float],
    journal_arousal: Optional[float],
    assessment_pleasure: Optional[float],
    assessment_arousal: Optional[float],
) -> AffectiveDiscordanceResult:
    """Return discordance score/level between journal self-report and STA PAD.

    The score is the average delta in valence and arousal on the normalized
    [-1, 1] axis. Arousal delta defaults to zero when either side is missing,
    while valence is required to compute any score.
    """
    if journal_valence is None or assessment_pleasure is None:
        return AffectiveDiscordanceResult(score=None, level="none", reason=None)

    valence_delta = abs(journal_valence - assessment_pleasure)
    arousal_delta = (
        abs(journal_arousal - assessment_arousal)
        if journal_arousal is not None and assessment_arousal is not None
        else 0.0
    )
    score = round((valence_delta + arousal_delta) / 2, 3)

    if score > 0.8:
        return AffectiveDiscordanceResult(
            score=score,
            level="high",
            reason=(
                "Significant mismatch between user self-report and AI-detected affect. "
                "Possible masking behavior."
            ),
        )
    if score > 0.4:
        return AffectiveDiscordanceResult(
            score=score,
            level="medium",
            reason="Moderate mismatch between self-report and detected affect.",
        )
    if score > 0.2:
        return AffectiveDiscordanceResult(
            score=score,
            level="low",
            reason="Mild mismatch between self-report and detected affect.",
        )

    return AffectiveDiscordanceResult(score=score, level="none", reason=None)
