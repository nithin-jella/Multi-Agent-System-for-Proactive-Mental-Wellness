from __future__ import annotations

import pytest

from app.core import llm
from app.core.llm_active_model_registry import normalize_active_chat_model


def test_default_gemini_model_prioritizes_gemma_4_31b() -> None:
    assert llm.DEFAULT_GEMINI_MODEL == llm.GEMMA_4_31B_MODEL


def test_gemini_fallback_chain_prioritizes_gemma_and_ends_with_gemini() -> None:
    assert llm.GEMINI_FALLBACK_CHAIN[:2] == [
        llm.GEMMA_4_31B_MODEL,
        llm.GEMMA_4_26B_MODEL,
    ]
    assert llm.GEMINI_FALLBACK_CHAIN[-1] == llm.GEMINI_BACKSTOP_MODEL
    assert all("gemma-3" not in model.lower() for model in llm.GEMINI_FALLBACK_CHAIN)


def test_gemini_pro_model_points_to_gemma_4_31b() -> None:
    assert llm.GEMINI_PRO_MODEL == "gemma-4-31b-it"


def test_default_active_chat_model_is_gemini_auto() -> None:
    assert llm.default_active_chat_model == llm.GEMINI_AUTO_MODEL_ALIAS


def test_normalize_active_chat_model_defaults_to_gemini_auto() -> None:
    assert normalize_active_chat_model(
        None,
        has_zai_api_key=True,
        direct_default_model="glm-4.7",
        openrouter_default_model="z-ai/glm-4.7",
        gemini_auto_alias=llm.GEMINI_AUTO_MODEL_ALIAS,
    ) == llm.GEMINI_AUTO_MODEL_ALIAS


def test_select_gemini_model_defaults_to_gemma_lite(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "_ACTIVE_CHAT_MODEL", llm.GEMINI_AUTO_MODEL_ALIAS)
    assert llm.select_gemini_model(intent=None, role=None, has_tools=False) == llm.GEMINI_LITE_MODEL
