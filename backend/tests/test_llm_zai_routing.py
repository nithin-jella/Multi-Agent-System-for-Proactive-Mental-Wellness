from __future__ import annotations

import pytest

from app.core import llm


@pytest.mark.asyncio
async def test_generate_response_routes_preferred_zai_model(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_openrouter_response(**kwargs: object) -> str:
        captured["model"] = str(kwargs["model"])
        return "zai-ok"

    async def fake_gemini_response_with_fallback(**kwargs: object) -> str:
        raise AssertionError("Gemini fallback should not be called for Z.AI model requests")

    monkeypatch.setattr(llm, "generate_openrouter_response", fake_openrouter_response)
    monkeypatch.setattr(llm, "generate_gemini_response_with_fallback", fake_gemini_response_with_fallback)

    result = await llm.generate_response(
        history=[{"role": "user", "content": "halo"}],
        model="gemini_google",
        preferred_gemini_model="z-ai/glm-4.7",
    )

    assert result == "zai-ok"
    assert captured["model"] == "z-ai/glm-4.7"


@pytest.mark.asyncio
async def test_generate_response_routes_preferred_direct_zai_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_direct_response(**kwargs: object) -> str:
        captured["model"] = str(kwargs["model"])
        return "zai-direct-ok"

    async def fake_openrouter_response(**kwargs: object) -> str:
        raise AssertionError("OpenRouter should not be called for direct Z.AI coding models")

    async def fake_gemini_response_with_fallback(**kwargs: object) -> str:
        raise AssertionError("Gemini fallback should not be called for direct Z.AI coding models")

    monkeypatch.setattr(llm, "generate_zai_direct_response", fake_direct_response, raising=False)
    monkeypatch.setattr(llm, "generate_openrouter_response", fake_openrouter_response)
    monkeypatch.setattr(llm, "generate_gemini_response_with_fallback", fake_gemini_response_with_fallback)

    result = await llm.generate_response(
        history=[{"role": "user", "content": "halo"}],
        model="gemini_google",
        preferred_gemini_model="glm-4.7",
    )

    assert result == "zai-direct-ok"
    assert captured["model"] == "glm-4.7"


@pytest.mark.asyncio
async def test_generate_response_routes_explicit_zai_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, str] = {}

    async def fake_openrouter_response(**kwargs: object) -> str:
        captured["model"] = str(kwargs["model"])
        return "zai-provider-ok"

    monkeypatch.setattr(llm, "generate_openrouter_response", fake_openrouter_response)
    monkeypatch.setattr(llm, "OPENROUTER_ZAI_MODEL", "z-ai/glm-4.7")

    result = await llm.generate_response(
        history=[{"role": "user", "content": "halo"}],
        model="zai_openrouter",
    )

    assert result == "zai-provider-ok"
    assert captured["model"] == "z-ai/glm-4.7"


@pytest.mark.asyncio
async def test_generate_response_uses_active_zai_model_when_no_preferred(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_openrouter_response(**kwargs: object) -> str:
        captured["model"] = str(kwargs["model"])
        return "active-zai-ok"

    async def fake_gemini_response_with_fallback(**kwargs: object) -> str:
        raise AssertionError("Gemini fallback should not be called when active model is Z.AI")

    monkeypatch.setattr(llm, "generate_openrouter_response", fake_openrouter_response)
    monkeypatch.setattr(llm, "generate_gemini_response_with_fallback", fake_gemini_response_with_fallback)
    monkeypatch.setattr(llm, "_ACTIVE_CHAT_MODEL", "z-ai/glm-4.7")

    result = await llm.generate_response(
        history=[{"role": "user", "content": "tes active model"}],
        model="gemini_google",
    )

    assert result == "active-zai-ok"
    assert captured["model"] == "z-ai/glm-4.7"


def test_set_active_chat_model_accepts_gemini_auto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "_ACTIVE_CHAT_MODEL", "z-ai/glm-4.7")
    normalized = llm.set_active_chat_model("gemini:auto")
    assert normalized == llm.GEMINI_AUTO_MODEL_ALIAS
    assert llm.get_active_chat_provider() == "gemini_google"


def test_set_active_chat_model_accepts_direct_zai_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "_ACTIVE_CHAT_MODEL", llm.GEMINI_AUTO_MODEL_ALIAS)
    normalized = llm.set_active_chat_model("glm-4.7")
    assert normalized == "glm-4.7"
    assert llm.get_active_chat_provider() == "zai_coding_plan"


def test_set_active_chat_model_rejects_unsupported_model() -> None:
    with pytest.raises(ValueError):
        llm.set_active_chat_model("openai/gpt-4o")


def test_is_zai_model_name_aliases() -> None:
    assert llm.is_zai_model_name("z-ai/glm-4.7") is True
    assert llm.is_zai_model_name("zai/glm-4.7") is True
    assert llm.is_zai_model_name("gemini-2.5-flash") is False
