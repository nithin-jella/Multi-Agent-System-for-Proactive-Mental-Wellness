from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.agents.cma.sla import compute_sla_deadline, notify_sla_breach
from app.agents.cma.service import CaseManagementService


def test_compute_sla_deadline() -> None:
    started_at = datetime(2025, 1, 1, 0, 0, 0)
    assert compute_sla_deadline(started_at, minutes=30) == datetime(2025, 1, 1, 0, 30, 0)


@pytest.mark.asyncio
async def test_notify_sla_breach_raises() -> None:
    with pytest.raises(NotImplementedError):
        await notify_sla_breach("case")


@pytest.mark.asyncio
async def test_case_management_get_case_or_404_invalid_uuid() -> None:
    service = CaseManagementService(session=SimpleNamespace())  # type: ignore[arg-type]
    with pytest.raises(HTTPException) as excinfo:
        await service._get_case_or_404("not-a-uuid")

    assert excinfo.value.status_code == 400


@pytest.mark.asyncio
async def test_cma_router_calls_service() -> None:
    from app.agents.cma.router import list_cases

    service = SimpleNamespace(list_cases=AsyncMock(return_value=SimpleNamespace(cases=[])))
    await list_cases(status=None, service=service)  # type: ignore[arg-type]
    service.list_cases.assert_awaited_once()
