from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AgentUserSummary(BaseModel):
    """Lightweight view of an internal agent/counselor account."""

    id: str = Field(..., description="Unique identifier for the agent user")
    role: str = Field(..., description="Role assigned to the agent (admin, counselor, etc.)")
    created_at: datetime = Field(..., description="Timestamp when the agent account was created")

    model_config = ConfigDict(from_attributes=True)


class AgentUserCreate(BaseModel):
    """Payload for creating a new agent user."""

    id: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., description="Role to assign to the agent user")


class AgentUserUpdateRole(BaseModel):
    """Payload for updating the role of an existing agent user."""

    role: str = Field(..., description="New role to assign to the agent user")
