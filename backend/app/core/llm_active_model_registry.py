"""Active chat model registry and normalization helpers for LLM routing."""

from __future__ import annotations

from typing import Callable, List, Optional, Sequence


class ActiveChatModelRegistry:
    """Thread-safe in-memory holder for the runtime active chat model."""

    def __init__(self, initial_model: str) -> None:
        self._active_model = initial_model

    def get(self) -> str:
        return self._active_model

    def set(self, model_name: str) -> str:
        self._active_model = model_name
        return self._active_model


def normalize_openrouter_model_alias(model_name: str, default_model: str) -> str:
    """Normalize common Z.AI aliases into OpenRouter model IDs."""
    candidate = (model_name or "").strip()
    lower = candidate.lower()

    if lower in {"zai", "z-ai", "z.ai", "zai_coding", "z.ai coding"}:
        return default_model

    if lower.startswith("zai/"):
        return f"z-ai/{candidate[4:]}"

    if lower.startswith("zai:"):
        suffix = candidate[4:].strip()
        if not suffix:
            return default_model
        if "/" in suffix:
            return suffix
        return f"z-ai/{suffix}"

    if lower.startswith("z-ai:"):
        suffix = candidate[5:].strip()
        if not suffix:
            return default_model
        if "/" in suffix:
            return suffix
        return f"z-ai/{suffix}"

    return candidate


def is_zai_model_name(model_name: Optional[str], default_model: str) -> bool:
    """Return True when ``model_name`` points to a Z.AI model on OpenRouter."""
    if not model_name or not model_name.strip():
        return False
    normalized = normalize_openrouter_model_alias(model_name, default_model).lower()
    return normalized.startswith("z-ai/")


def normalize_zai_direct_model_alias(model_name: str, default_model: str) -> str:
    """Normalize direct Z.AI model aliases used by Coding endpoint."""
    candidate = (model_name or "").strip()
    lower = candidate.lower()

    if lower in {
        "zai-direct",
        "zai_direct",
        "zai-direct-coding",
        "zai coding",
        "glm",
        "z.ai coding",
    }:
        return default_model

    if lower.startswith("zai-direct/"):
        suffix = candidate.split("/", 1)[1].strip()
        return suffix or default_model

    if lower.startswith("zai_direct/"):
        suffix = candidate.split("/", 1)[1].strip()
        return suffix or default_model

    return candidate


def is_zai_direct_model_name(model_name: Optional[str], default_model: str) -> bool:
    """Return True when model name maps to a direct Z.AI Coding endpoint model."""
    if not model_name or not model_name.strip():
        return False
    normalized = normalize_zai_direct_model_alias(model_name, default_model).lower()
    return normalized.startswith("glm-")


def normalize_active_chat_model(
    model_name: Optional[str],
    *,
    has_zai_api_key: bool,
    direct_default_model: str,
    openrouter_default_model: str,
    gemini_auto_alias: str,
) -> str:
    """Normalize admin-selected active chat model into a canonical value."""
    candidate = (model_name or "").strip()
    if not candidate:
        return gemini_auto_alias

    lower = candidate.lower()
    if lower in {
        "gemini",
        "gemini_google",
        "gemini:auto",
        "gemini_auto",
        "gemini-default",
        "gemini_default",
    }:
        return gemini_auto_alias

    normalized_alias = normalize_openrouter_model_alias(candidate, openrouter_default_model)
    if is_zai_model_name(normalized_alias, openrouter_default_model):
        return normalized_alias

    normalized_direct = normalize_zai_direct_model_alias(candidate, direct_default_model)
    if is_zai_direct_model_name(normalized_direct, direct_default_model):
        return normalized_direct

    if lower.startswith("gemini-"):
        return candidate

    raise ValueError(
        f"Unsupported active chat model '{candidate}'. "
        "Use gemini:auto, a gemini-* model, glm-* direct models, or z-ai/* model IDs."
    )


def resolve_zai_model_name(
    preferred_model: Optional[str],
    *,
    active_model: str,
    openrouter_default_model: str,
) -> str:
    """Resolve target Z.AI model, falling back to configured default."""
    if preferred_model and preferred_model.strip():
        normalized = normalize_openrouter_model_alias(preferred_model, openrouter_default_model)
        if is_zai_model_name(normalized, openrouter_default_model):
            return normalized

    if is_zai_model_name(active_model, openrouter_default_model):
        return active_model

    return openrouter_default_model


def resolve_zai_direct_model_name(
    preferred_model: Optional[str],
    *,
    active_model: str,
    direct_default_model: str,
) -> str:
    """Resolve target direct Z.AI model for Coding endpoint usage."""
    if preferred_model and preferred_model.strip():
        normalized = normalize_zai_direct_model_alias(preferred_model, direct_default_model)
        if is_zai_direct_model_name(normalized, direct_default_model):
            return normalized

    if is_zai_direct_model_name(active_model, direct_default_model):
        return active_model

    return direct_default_model


def build_supported_chat_models(
    *,
    gemini_auto_alias: str,
    direct_default_model: str,
    supported_direct_models: Sequence[str],
    openrouter_default_model: str,
    supported_openrouter_models: Sequence[str],
    normalizer: Callable[[Optional[str]], str],
) -> List[str]:
    """Return deduplicated and normalized chat model candidates."""
    candidates = [
        gemini_auto_alias,
        direct_default_model,
        *supported_direct_models,
        openrouter_default_model,
        *supported_openrouter_models,
    ]

    normalized_models: List[str] = []
    for item in candidates:
        normalized = normalizer(item)
        if normalized not in normalized_models:
            normalized_models.append(normalized)

    return normalized_models
