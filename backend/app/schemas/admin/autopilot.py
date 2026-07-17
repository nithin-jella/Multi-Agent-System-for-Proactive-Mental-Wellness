from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AutopilotActionResponse(BaseModel):
    id: int
    action_type: str
    risk_level: str
    policy_decision: str
    status: str
    idempotency_key: str
    payload_hash: str
    payload_json: dict[str, Any]
    tx_hash: Optional[str] = None
    explorer_tx_url: Optional[str] = None
    chain_id: Optional[int] = None
    error_message: Optional[str] = None
    approval_notes: Optional[str] = None
    retry_count: int
    next_retry_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AutopilotActionListResponse(BaseModel):
    items: list[AutopilotActionResponse]
    total: int


class AutopilotActionReviewRequest(BaseModel):
    """Request body for an admin reviewing a pending autopilot action.

    Admins can approve or reject actions that are in a 'pending_review' state.
    An optional ``reviewer_note`` can be attached for audit trail purposes.
    """

    decision: str  # "approve" | "reject"
    reviewer_note: Optional[str] = None


class AutopilotActionReviewResponse(BaseModel):
    """Response returned after an admin review is submitted."""

    id: int
    action_type: str
    status: str
    decision: str
    reviewer_note: Optional[str] = None
    reviewed_at: Optional[datetime] = None
