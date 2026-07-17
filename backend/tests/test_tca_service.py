from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.tca.schemas import TCAInterveneRequest
from app.agents.tca.service import TherapeuticCoachService


def test_resolve_followup_window_uses_options() -> None:
    payload = TCAInterveneRequest(
        intent="general_support",
        user_hash="u",
        session_id="s",
        options={"check_in_hours": 12},
    )

    assert TherapeuticCoachService._resolve_followup_window(payload, default_hours=24) == 12


def test_coerce_resources_falls_back_general() -> None:
    resources = TherapeuticCoachService._coerce_resources("unknown")
    assert resources


@pytest.mark.asyncio
async def test_intervene_emits_event(monkeypatch: pytest.MonkeyPatch) -> None:
    emitted = []

    async def fake_emit(event):
        emitted.append(event)

    service = TherapeuticCoachService(event_emitter=fake_emit)

    payload = TCAInterveneRequest(intent="academic_stress", user_hash="u", session_id="s")
    result = await service.intervene(payload)

    assert result.plan_steps
    assert emitted


@pytest.mark.asyncio
async def test_followup_emits_event() -> None:
    emitted = []

    async def fake_emit(event):
        emitted.append(event)

    service = TherapeuticCoachService(event_emitter=fake_emit)

    payload = SimpleNamespace(session_id="s", last_plan_id=None, check_in={"mood": "better", "stress": "low", "user_hash": "u"})

    result = await service.followup(payload)  # type: ignore[arg-type]
    assert result.acknowledged is True
    assert emitted
