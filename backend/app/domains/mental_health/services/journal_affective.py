"""Affective helper utilities for journal PAD processing.

This module is intentionally dependency-light so it can be imported by unit tests
without pulling in API routes and their runtime wiring.
"""

from __future__ import annotations

from typing import Optional

PAD_MIN = -1.0
PAD_MAX = 1.0

DOMINANCE_POSITIVE_HINTS = {
    "aku bisa",
    "saya bisa",
    "mampu",
    "siap",
    "tenang",
    "optimis",
    "percaya diri",
    "in control",
    "control",
    "manageable",
    "progress",
}

DOMINANCE_NEGATIVE_HINTS = {
    "tidak bisa",
    "nggak bisa",
    "ga bisa",
    "panik",
    "takut",
    "overwhelmed",
    "kehilangan kendali",
    "gak sanggup",
    "putus asa",
    "burnout",
    "stuck",
}


def clip_pad_axis(value: float) -> float:
    return max(PAD_MIN, min(PAD_MAX, value))


def bucket_pad_value(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    if value <= -0.6:
        return "very_low"
    if value <= -0.2:
        return "low"
    if value < 0.2:
        return "neutral"
    if value < 0.6:
        return "high"
    return "very_high"


def empty_pad_distribution() -> dict[str, int]:
    return {
        "very_low": 0,
        "low": 0,
        "neutral": 0,
        "high": 0,
        "very_high": 0,
    }


def infer_dominance_from_content(
    content: str,
    valence: Optional[float],
    arousal: Optional[float],
) -> Optional[float]:
    """Infer dominance in [-1, 1] as a best-effort signal from journal text."""
    text = (content or "").strip().lower()
    if not text:
        return None

    score = 0.0
    for hint in DOMINANCE_POSITIVE_HINTS:
        if hint in text:
            score += 0.2
    for hint in DOMINANCE_NEGATIVE_HINTS:
        if hint in text:
            score -= 0.2

    if valence is not None:
        score += 0.25 * valence
    if arousal is not None:
        if arousal > 0.6 and (valence is None or valence < 0):
            score -= 0.15
        elif arousal < -0.4:
            score += 0.05

    return round(clip_pad_axis(score), 3)
