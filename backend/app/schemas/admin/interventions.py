from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class CampaignMetrics(BaseModel):
    total: int
    scheduled: int
    pending_review: int
    active: int
    completed: int
    failed: int


class CampaignSummary(BaseModel):
    total: int
    active: int
    paused: int
    draft: int
    completed: int


class ExecutionSummary(BaseModel):
    total: int
    scheduled: int
    pending_review: int
    approved: int
    completed: int
    failed: int


class QueueItem(BaseModel):
    execution_id: Optional[int]
    user_id: Optional[int]
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    status: str
    scheduled_at: datetime
    campaign_id: Optional[int] = None
    priority: Optional[str] = None
    risk_score: Optional[float] = None
    severity_level: Optional[str] = None
    recommended_action: Optional[str] = None
    delivery_method: Optional[str] = None
    notes: Optional[str] = None


class InterventionOverview(BaseModel):
    campaign_summary: CampaignSummary
    execution_summary: ExecutionSummary
    queue_size: int
    automation_enabled: bool
    human_review_required: bool
    risk_score_threshold: float
    daily_send_limit: int
    channels_enabled: List[str] = Field(default_factory=list)
    last_updated: datetime
    top_risk_cases: List[QueueItem] = Field(default_factory=list)


class CampaignBase(BaseModel):
    campaign_type: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "draft"
    content: Dict[str, Any] = Field(default_factory=dict)
    target_criteria: Optional[Dict[str, Any]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class InterventionCampaignResponse(CampaignBase):
    id: int
    target_audience_size: int
    executions_delivered: int
    executions_failed: int
    created_at: datetime
    updated_at: datetime
    metrics: CampaignMetrics

    model_config = ConfigDict(from_attributes=True)


class InterventionCampaignListResponse(BaseModel):
    items: List[InterventionCampaignResponse]
    total: int


class InterventionCampaignCreate(CampaignBase):
    content: Dict[str, Any] = Field(default_factory=dict)


class InterventionCampaignUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    target_criteria: Optional[Dict[str, Any]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    content: Optional[Dict[str, Any]] = None


class ManualInterventionCreate(BaseModel):
    user_id: int
    campaign_id: Optional[int] = None
    title: Optional[str] = None
    message: Optional[str] = None
    delivery_method: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    intent: Optional[str] = Field(default=None, description="Optional intent identifier for TCA preview")
    options: Optional[Dict[str, Any]] = Field(default=None, description="Optional intervention tuning options")
    consent_followup: Optional[bool] = Field(default=None, description="Whether the user consented to follow-up")


class InterventionExecutionResponse(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    status: str
    scheduled_at: datetime
    executed_at: Optional[datetime]
    delivery_method: Optional[str]
    notes: Optional[str]
    engagement_score: Optional[float]
    is_manual: bool
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    campaign_title: Optional[str] = None
    priority: Optional[str] = None
    plan_preview: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class InterventionExecutionListResponse(BaseModel):
    items: List[InterventionExecutionResponse]
    total: int


class InterventionExecutionUpdate(BaseModel):
    status: str
    executed_at: Optional[datetime] = None
    notes: Optional[str] = None
    delivery_method: Optional[str] = None
    engagement_score: Optional[float] = None


class InterventionSettings(BaseModel):
    auto_mode_enabled: bool
    human_review_required: bool
    risk_score_threshold: float
    daily_send_limit: int
    channels_enabled: List[str]
    escalation_email: Optional[str] = None
    office_hours_start: Optional[str] = None
    office_hours_end: Optional[str] = None
    manual_notes: Optional[str] = None
    updated_at: datetime


class InterventionSettingsUpdate(BaseModel):
    auto_mode_enabled: Optional[bool] = None
    human_review_required: Optional[bool] = None
    risk_score_threshold: Optional[float] = None
    daily_send_limit: Optional[int] = None
    channels_enabled: Optional[List[str]] = None
    escalation_email: Optional[str] = None
    office_hours_end: Optional[str] = None
    manual_notes: Optional[str] = None


class InterventionPlanResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    plan_title: str
    risk_level: Optional[int]
    status: str
    total_steps: int
    completed_steps: int
    created_at: datetime
    updated_at: datetime
    plan_data: Dict[str, Any]
    completion_tracking: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class InterventionPlanListResponse(BaseModel):
    items: List[InterventionPlanResponse]
    total: int

