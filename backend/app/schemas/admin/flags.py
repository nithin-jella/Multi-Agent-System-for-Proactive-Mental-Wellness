"""Pydantic models for admin flag endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class FlagCreate(BaseModel):
    reason: str
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class FlagResponse(BaseModel):
    id: int
    session_id: str
    user_id: Optional[int]
    reason: Optional[str]
    notes: Optional[str]
    tags: Optional[List[str]]
    status: str
    flagged_by_admin_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class FlagUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class FlagsSummary(BaseModel):
    open_count: int
    recent: List[FlagResponse]


class FlagsBulkCloseRequest(BaseModel):
    ids: List[int]
    status: Optional[str] = "resolved"


class FlagsBulkTagRequest(BaseModel):
    ids: List[int]
    tags: List[str]
    mode: Optional[str] = "add"
