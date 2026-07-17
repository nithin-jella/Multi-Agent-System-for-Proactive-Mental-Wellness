from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

CaseStatus = Literal['new', 'in_progress', 'waiting', 'closed']
CaseSeverity = Literal['low', 'med', 'high', 'critical']


class CMACase(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    status: CaseStatus
    severity: CaseSeverity
    assigned_to: Optional[str] = None
    user_hash: str
    session_id: Optional[str] = None
    summary_redacted: Optional[str] = None
    sla_breach_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    telegram_username: Optional[str] = None


class CMAListCasesResponse(BaseModel):
    cases: list[CMACase]


class CMAAssignRequest(BaseModel):
    case_id: str = Field(..., min_length=1)
    assignee_id: str = Field(..., min_length=1)


class CMAAssignResponse(BaseModel):
    case_id: str
    assigned_to: str


class CMACloseRequest(BaseModel):
    case_id: str
    closure_reason: Optional[str] = None


class CMACloseResponse(BaseModel):
    case_id: str
    status: CaseStatus
    closed_at: datetime
