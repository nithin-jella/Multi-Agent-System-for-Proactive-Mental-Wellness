from __future__ import annotations

from datetime import datetime
from typing import cast
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.cma.schemas import (
    CMAAssignRequest,
    CMAAssignResponse,
    CMACase,
    CMACloseRequest,
    CMACloseResponse,
    CMAListCasesResponse,
)
from app.database import get_async_db
from app.models import CaseAssignment  # Core infrastructure model
from app.domains.mental_health.models import Case, CaseNote, CaseSeverityEnum, CaseStatusEnum
from app.models.agent_user import AgentUser
from app.services.event_bus import EventType, publish_event


class CaseManagementService:
    """Queue management utilities for the Safety Desk Agent."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_cases(self, status_filter: str | None = None) -> CMAListCasesResponse:
        query = select(Case).order_by(Case.created_at.desc())
        if status_filter:
            try:
                status_enum = CaseStatusEnum(status_filter)
            except ValueError as exc:  # pragma: no cover - validated upstream
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid case status") from exc
            query = query.where(Case.status == status_enum)

        result = await self._session.execute(query)
        cases = result.scalars().all()
        payload = [self._to_schema(case) for case in cases]
        return CMAListCasesResponse(cases=payload)

    async def assign_case(self, payload: CMAAssignRequest) -> CMAAssignResponse:
        case = await self._get_case_or_404(payload.case_id)

        previous_assignee = cast(str | None, getattr(case, "assigned_to", None))

        assignee_result = await self._session.execute(
            select(AgentUser).where(AgentUser.id == payload.assignee_id)
        )
        assignee = assignee_result.scalar_one_or_none()
        if assignee is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown assignee '{payload.assignee_id}'",
            )

        case.assigned_to = assignee.id  # type: ignore[assignment]
        if case.status in {CaseStatusEnum.new, CaseStatusEnum.waiting}:
            case.status = CaseStatusEnum.in_progress  # type: ignore[assignment]
        self._session.add(case)

        self._session.add(
            CaseAssignment(
                case_id=case.id,
                assigned_to=assignee.id,
                assigned_by=None,
                previous_assignee=previous_assignee,
            )
        )
        self._session.add(
            CaseNote(
                case_id=case.id,
                note=f"Case auto-assigned to {assignee.id} by Safety Desk Agent",
                author_id=None,
            )
        )

        await self._session.commit()
        await self._session.refresh(case)

        await publish_event(
            event_type=EventType.CASE_ASSIGNED,
            source_agent="cma",
            data={
                "case_id": str(case.id),
                "assigned_to": assignee.id,
                "assigned_by": None,
                "is_reassignment": previous_assignee is not None,
                "previous_assignee": previous_assignee,
            },
        )

        return CMAAssignResponse(case_id=str(case.id), assigned_to=assignee.id)

    async def close_case(self, payload: CMACloseRequest) -> CMACloseResponse:
        case = await self._get_case_or_404(payload.case_id)
        case.status = CaseStatusEnum.closed  # type: ignore[assignment]
        case.closure_reason = payload.closure_reason  # type: ignore[assignment]
        self._session.add(case)
        await self._session.commit()
        await self._session.refresh(case)
        status_value = case.status.value if isinstance(case.status, CaseStatusEnum) else CaseStatusEnum.new.value
        closed_at = cast(datetime, case.updated_at)
        return CMACloseResponse(case_id=str(case.id), status=status_value, closed_at=closed_at)

    async def _get_case_or_404(self, case_id: str) -> Case:
        try:
            uuid = UUID(case_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid case_id") from exc

        result = await self._session.execute(select(Case).where(Case.id == uuid))
        case = result.scalar_one_or_none()
        if case is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety case not found")
        return case

    @staticmethod
    def _to_schema(case: Case) -> CMACase:
        created_at = cast(datetime, case.created_at)
        updated_at = cast(datetime, case.updated_at)
        status_value = case.status.value if isinstance(case.status, CaseStatusEnum) else CaseStatusEnum.new.value
        severity_value = case.severity.value if isinstance(case.severity, CaseSeverityEnum) else CaseSeverityEnum.low.value
        assigned_to = cast(str | None, getattr(case, "assigned_to", None))
        user_hash = cast(str, getattr(case, "user_hash", ""))
        session_id = cast(str | None, getattr(case, "session_id", None))
        summary_redacted = cast(str | None, getattr(case, "summary_redacted", None))
        sla_breach_at = cast(datetime | None, getattr(case, "sla_breach_at", None))

        return CMACase(
            id=str(case.id),
            created_at=created_at,
            updated_at=updated_at,
            status=status_value,
            severity=severity_value,
            assigned_to=assigned_to,
            user_hash=user_hash,
            session_id=session_id,
            summary_redacted=summary_redacted,
            sla_breach_at=sla_breach_at,
        )


def get_case_management_service(
    session: AsyncSession = Depends(get_async_db),
) -> "CaseManagementService":
    """FastAPI dependency factory for :class:`CaseManagementService`."""

    return CaseManagementService(session=session)
