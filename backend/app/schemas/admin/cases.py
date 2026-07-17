from __future__ import annotations

from datetime import datetime
from typing import Any, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CaseNoteItem(BaseModel):
    id: int
    case_id: str
    created_at: datetime
    author_id: int | None
    note: str


class CaseNotesListResponse(BaseModel):
    items: List[CaseNoteItem]


class CaseNoteCreate(BaseModel):
    note: str


# New schemas for comprehensive case management

class TriageAssessmentSummary(BaseModel):
    """Summary of triage assessment for case list."""
    id: int
    risk_score: float
    severity_level: str
    confidence_score: float | None = None
    risk_factors: list[str] | None = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CaseAssignmentSummary(BaseModel):
    """Summary of case assignment."""
    id: str
    assigned_to: str | None
    assigned_by: int | None
    assigned_at: datetime
    previous_assignee: str | None = None
    reassignment_reason: str | None = None
    assignee_role: str | None = None
    
    model_config = ConfigDict(from_attributes=True)


class CaseListItem(BaseModel):
    """Case item for list view with essential details."""
    id: str
    status: str
    severity: str
    user_hash: str
    session_id: str | None
    conversation_id: int | None
    summary_redacted: str | None
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime
    sla_breach_at: datetime | None
    
    # Computed fields
    is_sla_breached: bool
    minutes_until_breach: int | None
    sla_status: str  # 'safe', 'warning', 'critical', 'breached'
    
    # Related data counts
    notes_count: int = 0
    assignments_count: int = 0
    
    # Latest triage assessment
    latest_triage: TriageAssessmentSummary | None = None


class CaseListResponse(BaseModel):
    """Paginated case list response."""
    cases: list[CaseListItem]
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class ConversationMessageSummary(BaseModel):
    """Summary of conversation message."""
    id: str  # Can be int or string (e.g., "123-user", "123-assistant")
    role: str
    content: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)


class CaseDetailResponse(BaseModel):
    """Detailed case view with all related data."""
    id: str
    status: str
    severity: str
    user_hash: str
    session_id: str | None
    conversation_id: int | None
    summary_redacted: str | None
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime
    sla_breach_at: datetime | None
    
    # Computed fields
    is_sla_breached: bool
    minutes_until_breach: int | None
    sla_status: str
    
    # Related data
    notes: list[CaseNoteItem]
    assignments: list[CaseAssignmentSummary]
    triage_assessments: list[TriageAssessmentSummary]
    
    # Conversation preview (if available)
    conversation_preview: list[ConversationMessageSummary] | None = None


class CaseStatusUpdate(BaseModel):
    """Request to update case status."""
    status: str = Field(..., description="New status: new, in_progress, waiting, resolved, closed")
    note: str | None = Field(None, description="Optional note explaining status change")


class CaseAssignmentUpdate(BaseModel):
    """Request to assign/reassign case."""
    assigned_to: str | None = Field(None, description="Agent user identifier to assign case to (None to unassign)")
    reason: str | None = Field(None, description="Optional reason for assignment/reassignment")


class CaseFilters(BaseModel):
    """Filters for case list endpoint."""
    status: str | None = None
    severity: str | None = None
    assigned_to: str | None = None
    unassigned: bool | None = None
    sla_breached: bool | None = None
    search: str | None = None  # Search in user_hash or summary


