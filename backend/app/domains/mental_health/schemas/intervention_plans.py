"""Pydantic schemas for intervention plan records."""

from datetime import datetime
from typing import Optional, List, Sequence, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class PlanStep(BaseModel):
    """Single step in an intervention plan."""
    title: str
    description: str
    completed: bool = False


class ResourceCard(BaseModel):
    """Resource card with external link."""
    title: str
    url: str
    description: str


class NextCheckIn(BaseModel):
    """Next check-in information."""
    timeframe: str
    method: str


class InterventionPlanData(BaseModel):
    """Full intervention plan structure from TCA.
    
    All fields have defaults to handle legacy plans with empty/incomplete data.
    """
    plan_steps: List[PlanStep] = Field(default_factory=list)
    resource_cards: List[ResourceCard] = Field(default_factory=list)
    next_check_in: Optional[NextCheckIn] = None


class CompletionTracking(BaseModel):
    """Progress tracking for intervention plan."""
    completed_steps: List[int] = Field(default_factory=list, description="Indices of completed steps")
    completion_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    last_updated: Optional[datetime] = None


class InterventionPlanRecordBase(BaseModel):
    """Base schema for intervention plan records."""
    plan_title: str
    risk_level: Optional[int] = None
    plan_data: InterventionPlanData
    total_steps: int


class InterventionPlanRecordCreate(InterventionPlanRecordBase):
    """Schema for creating a new intervention plan record."""
    user_id: int
    session_id: Optional[str] = None
    conversation_id: Optional[int] = None


class InterventionPlanRecordUpdate(BaseModel):
    """Schema for updating intervention plan."""
    status: Optional[str] = None
    is_active: Optional[bool] = None
    completion_tracking: Optional[CompletionTracking] = None
    completed_steps: Optional[int] = None
    last_viewed_at: Optional[datetime] = None


class InterventionPlanRecordResponse(InterventionPlanRecordBase):
    """Schema for intervention plan response."""
    id: int
    user_id: int
    session_id: Optional[str]
    conversation_id: Optional[int]
    
    completion_tracking: CompletionTracking
    completed_steps: int
    status: str
    is_active: bool
    
    created_at: datetime
    updated_at: datetime
    last_viewed_at: Optional[datetime]
    archived_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

    @field_validator('plan_data', mode='before')
    @classmethod
    def ensure_plan_data_model(cls, v: Union[dict, InterventionPlanData]) -> InterventionPlanData:
        """Convert raw dict to InterventionPlanData, handling empty/malformed data."""
        if isinstance(v, InterventionPlanData):
            return v
        if v is None or v == {}:
            return InterventionPlanData()
        if isinstance(v, dict):
            return InterventionPlanData(**v)
        return InterventionPlanData()

    @field_validator('completion_tracking', mode='before')
    @classmethod
    def ensure_completion_tracking_model(cls, v: Union[dict, CompletionTracking]) -> CompletionTracking:
        """Convert raw dict to CompletionTracking, handling empty/malformed data."""
        if isinstance(v, CompletionTracking):
            return v
        if v is None or v == {}:
            return CompletionTracking()
        if isinstance(v, dict):
            return CompletionTracking(**v)
        return CompletionTracking()


class InterventionPlanListResponse(BaseModel):
    """Schema for list of intervention plans."""
    plans: Sequence[InterventionPlanRecordResponse]
    total: int


class StepCompletionRequest(BaseModel):
    """Schema for marking a step as complete."""
    step_index: int
    completed: bool
    notes: Optional[str] = None


class StepCompletionResponse(BaseModel):
    """Schema for step completion response."""
    plan_id: int
    step_index: int
    completed: bool
    completed_at: Optional[datetime]
    updated_plan: InterventionPlanRecordResponse
