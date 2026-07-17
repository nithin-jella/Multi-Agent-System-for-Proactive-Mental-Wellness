from __future__ import annotations

from typing import Iterable

from app.core.settings import settings


class PolicyViolation(RuntimeError):
    """Raised when policy checks fail."""


def ensure_k_anon(counts: Iterable[int]) -> None:
    if any(value < settings.k_anon for value in counts):
        raise PolicyViolation("k-anonymity threshold not met")


def ensure_no_crisis_experiments(tag: str | None) -> None:
    if settings.policy_deny_experiments_on_crisis and tag:
        raise PolicyViolation("Experiments disabled for crisis flows")
