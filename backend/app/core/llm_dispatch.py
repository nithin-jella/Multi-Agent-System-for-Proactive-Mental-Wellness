"""Dispatch resolution helpers for unified LLM generate_response flow."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional


@dataclass(frozen=True)
class ResolvedDispatchRequest:
    """Normalized request context for provider dispatch."""

    model: str
    effective_preferred_model: Optional[str]


def resolve_dispatch_request(
    *,
    model: Optional[str],
    preferred_model: Optional[str],
    active_model: str,
    gemini_auto_alias: str,
    is_zai_direct: Callable[[Optional[str]], bool],
    is_zai_openrouter: Callable[[Optional[str]], bool],
) -> ResolvedDispatchRequest:
    """Resolve runtime model + preferred model using active-model defaults."""
    effective_preferred_model = (preferred_model or "").strip() or None
    requested_model = (model or "").strip()

    if requested_model in {"", "default", "auto"}:
        if is_zai_direct(active_model):
            return ResolvedDispatchRequest(model="zai_direct", effective_preferred_model=active_model)

        if is_zai_openrouter(active_model):
            return ResolvedDispatchRequest(model="zai_openrouter", effective_preferred_model=active_model)

        if active_model != gemini_auto_alias:
            return ResolvedDispatchRequest(model="gemini_google", effective_preferred_model=active_model)

        return ResolvedDispatchRequest(model="gemini_google", effective_preferred_model=None)

    if requested_model == "gemini_google" and effective_preferred_model is None and active_model != gemini_auto_alias:
        effective_preferred_model = active_model

    return ResolvedDispatchRequest(model=requested_model, effective_preferred_model=effective_preferred_model)


def classify_dispatch_target(
    *,
    model: str,
    preferred_model: Optional[str],
    is_zai_direct: Callable[[Optional[str]], bool],
    is_zai_openrouter: Callable[[Optional[str]], bool],
) -> tuple[bool, bool]:
    """Classify whether request should route to direct Z.AI or OpenRouter Z.AI."""
    requested_preferred_model = (preferred_model or "").strip()
    is_zai_direct_requested = model == "zai_direct" or is_zai_direct(requested_preferred_model)
    is_zai_openrouter_requested = model == "zai_openrouter" or is_zai_openrouter(requested_preferred_model)
    return is_zai_direct_requested and not is_zai_openrouter_requested, is_zai_openrouter_requested
