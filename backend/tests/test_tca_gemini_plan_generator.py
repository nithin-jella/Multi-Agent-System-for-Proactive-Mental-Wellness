from __future__ import annotations

import json

import pytest


def test_get_system_prompt_falls_back_to_general() -> None:
    from app.agents.tca.gemini_plan_generator import _get_system_prompt, GENERAL_COPING_SYSTEM_PROMPT

    assert _get_system_prompt("unknown") == GENERAL_COPING_SYSTEM_PROMPT


def test_build_user_prompt_includes_activity_context(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca.gemini_plan_generator import _build_user_prompt

    monkeypatch.setattr(
        "app.agents.tca.activities_catalog.get_all_activities_prompt_context",
        lambda: "ACTIVITIES_CONTEXT",
    )

    prompt = _build_user_prompt("msg", "intent", "calm_down", context={"risk_level": 2})
    assert "USER'S MESSAGE" in prompt
    assert "ACTIVITIES_CONTEXT" in prompt
    assert "RISK LEVEL" in prompt


def test_repair_truncated_json_salvages_plan_steps(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import gemini_plan_generator as module

    monkeypatch.setattr(module, "_get_default_resources", lambda _intent: [{"title": "x", "url": "u"}])

    response_text = '{"plan_steps": [{"title": "A", "description": "B", "duration_min": 1}]'  # truncated
    repaired = module._repair_truncated_json(response_text, intent="general")

    assert repaired is not None
    assert repaired["plan_steps"][0]["title"] == "A"
    assert repaired["resource_cards"]


def test_get_default_resources_includes_activities_then_links(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import gemini_plan_generator as module

    monkeypatch.setattr(
        "app.agents.tca.activities_catalog.get_recommended_activities",
        lambda _intent, max_activities=2, risk_level=None: [
            {"title": "Act", "description": "d", "url": "u", "resource_type": "activity"}
        ],
    )

    class FakeResource:
        def __init__(self, title: str, description: str, url: str):
            self.title = title
            self.description = description
            self.url = url

    monkeypatch.setattr(
        "app.agents.tca.resources.get_default_resources",
        lambda _intent: [FakeResource("Link", "desc", "https://x")],
    )

    resources = module._get_default_resources("academic_stress")
    assert resources[0]["resource_type"] == "activity"
    assert resources[1]["resource_type"] == "link"


def test_get_fallback_plan_returns_shape() -> None:
    from app.agents.tca.gemini_plan_generator import _get_fallback_plan

    plan = _get_fallback_plan("calm_down", "anxiety")
    assert "plan_steps" in plan
    assert "resource_cards" in plan


@pytest.mark.asyncio
async def test_generate_personalized_plan_parses_json_and_fills_resources(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import gemini_plan_generator as module

    async def fake_generate_gemini_response(**_kwargs):
        return json.dumps({"plan_steps": [{"title": "A", "description": "B", "duration_min": 1}]})

    monkeypatch.setattr(module, "generate_gemini_response", fake_generate_gemini_response)
    monkeypatch.setattr(module, "_get_default_resources", lambda _intent: [{"title": "R", "url": "u"}])

    result = await module.generate_personalized_plan(
        user_message="m",
        intent="academic_stress",
        plan_type="general_coping",
        context=None,
    )

    assert result["plan_steps"][0]["title"] == "A"
    assert result["resource_cards"][0]["title"] == "R"


@pytest.mark.asyncio
async def test_generate_personalized_plan_json_decode_error_repairs(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.agents.tca import gemini_plan_generator as module

    async def fake_generate_gemini_response(**_kwargs):
        return "{not-json"

    monkeypatch.setattr(module, "generate_gemini_response", fake_generate_gemini_response)
    monkeypatch.setattr(module, "_repair_truncated_json", lambda _text, _intent: {"plan_steps": [], "resource_cards": []})

    result = await module.generate_personalized_plan(
        user_message="m",
        intent="academic_stress",
        plan_type="general_coping",
        context=None,
    )

    assert "plan_steps" in result
