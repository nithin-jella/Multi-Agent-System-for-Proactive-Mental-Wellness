from __future__ import annotations

from fastapi import APIRouter, Depends

from app.agents.cma.schemas import (
    CMAAssignRequest,
    CMAAssignResponse,
    CMACloseRequest,
    CMACloseResponse,
    CMAListCasesResponse,
)
from app.agents.cma.service import CaseManagementService, get_case_management_service

router = APIRouter(prefix="/api/agents/sda", tags=["agents:sda"])


@router.get("/cases", response_model=CMAListCasesResponse)
async def list_cases(
    status: str | None = None,
    service: CaseManagementService = Depends(get_case_management_service),
) -> CMAListCasesResponse:
    return await service.list_cases(status_filter=status)


@router.post("/cases/assign", response_model=CMAAssignResponse)
async def assign_case(
    payload: CMAAssignRequest,
    service: CaseManagementService = Depends(get_case_management_service),
) -> CMAAssignResponse:
    return await service.assign_case(payload)


@router.post("/cases/close", response_model=CMACloseResponse)
async def close_case(
    payload: CMACloseRequest,
    service: CaseManagementService = Depends(get_case_management_service),
) -> CMACloseResponse:
    return await service.close_case(payload)
