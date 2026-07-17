"""Shared Gemini fallback-chain policy helpers."""

from __future__ import annotations

import re
from typing import Sequence


def is_invalid_model_error(status_code: int, error_msg: str) -> bool:
    """Best-effort detection for model-not-available errors."""
    msg = (error_msg or "").lower()
    if status_code == 404:
        return True

    if status_code == 400:
        keywords = [
            "model",
            "not found",
            "not supported",
            "invalid model",
            "unknown model",
        ]
        return any(keyword in msg for keyword in keywords)

    return any(keyword in msg for keyword in ["model not found", "not supported", "unknown model", "not_found"])


def parse_retry_after_s(error_msg: str) -> float | None:
    """Best-effort parse for messages like: 'Please retry in 45.63s'."""
    msg = error_msg or ""
    match = re.search(r"retry in (\d+(?:\.\d+)?)s", msg)
    if not match:
        return None

    try:
        return float(match.group(1))
    except ValueError:
        return None


def extract_error_code(error: Exception) -> int:
    """Best-effort extract HTTP-like error code from SDK exceptions/messages."""
    try:
        status_code = getattr(error, "status_code", None)
        if isinstance(status_code, int):
            return status_code
    except Exception:
        pass

    try:
        code = getattr(error, "code", None)
        if isinstance(code, int):
            return code
    except Exception:
        pass

    match = re.search(r"\b(4\d\d|5\d\d)\b", str(error or ""))
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return 0

    return 0


def is_resource_exhausted_error(status_code: int, error_msg: str) -> bool:
    """Detect Gemini resource exhausted/quota errors."""
    msg = error_msg or ""
    return status_code == 429 or "RESOURCE_EXHAUSTED" in msg


def should_fallback_on_error(error_code: int, error_msg: str) -> bool:
    """Determine whether fallback model/key strategy should be attempted."""
    return (
        error_code == 429
        or error_code == 503
        or "RESOURCE_EXHAUSTED" in error_msg
        or "overloaded" in error_msg.lower()
    )


def build_fallback_model_chain(primary_model: str, fallback_chain: Sequence[str]) -> list[str]:
    """Build deduplicated model chain with requested model first."""
    return [primary_model] + [model for model in fallback_chain if model != primary_model]
