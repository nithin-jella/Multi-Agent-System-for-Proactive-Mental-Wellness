"""Campaign management schemas for Phase 5."""

from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Campaign Schemas
# ============================================================================

class CampaignBase(BaseModel):
    """Base campaign schema with common fields."""
    
    name: str = Field(..., min_length=1, max_length=255, description="Campaign name")
    description: Optional[str] = Field(None, description="Campaign description")
    message_template: str = Field(..., min_length=1, description="Message template for TCA")
    trigger_rules: Optional[Dict[str, Any]] = Field(None, description="JSON trigger configuration")
    target_audience: Optional[Dict[str, Any]] = Field(None, description="JSON audience targeting")
    status: str = Field("draft", description="Campaign status (draft, active, paused, completed)")
    priority: str = Field("medium", description="Campaign priority (low, medium, high)")


class CampaignCreate(CampaignBase):
    """Schema for creating a new campaign."""
    pass


class CampaignUpdate(BaseModel):
    """Schema for updating a campaign."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    message_template: Optional[str] = Field(None, min_length=1)
    trigger_rules: Optional[Dict[str, Any]] = None
    target_audience: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class CampaignResponse(CampaignBase):
    """Schema for campaign response."""
    
    id: UUID
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    last_executed_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)


class CampaignListResponse(BaseModel):
    """Schema for paginated campaign list."""
    
    items: List[CampaignResponse]
    total: int
    skip: int
    limit: int


class CampaignSummary(BaseModel):
    """Schema for campaign statistics summary."""
    
    total: int
    draft: int
    active: int
    paused: int
    completed: int


# ============================================================================
# Campaign Trigger Schemas
# ============================================================================

class CampaignTriggerBase(BaseModel):
    """Base trigger schema."""
    
    condition_type: str = Field(..., description="Condition type (ia_insight, manual, scheduled, threshold_breach)")
    condition_value: Dict[str, Any] = Field(..., description="JSON condition definition")
    evaluation_frequency: str = Field("daily", description="Evaluation frequency (hourly, daily, weekly)")


class CampaignTriggerCreate(CampaignTriggerBase):
    """Schema for creating a trigger."""
    
    campaign_id: UUID


class CampaignTriggerResponse(CampaignTriggerBase):
    """Schema for trigger response."""
    
    id: UUID
    campaign_id: UUID
    last_evaluated_at: Optional[datetime]
    last_match_at: Optional[datetime]
    match_count: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Campaign Metrics Schemas
# ============================================================================

class CampaignMetricsResponse(BaseModel):
    """Schema for campaign metrics response."""
    
    id: UUID
    campaign_id: UUID
    execution_date: date
    messages_sent: int
    users_targeted: int
    users_engaged: int
    success_rate: Optional[float]
    avg_sentiment_before: Optional[float]
    avg_sentiment_after: Optional[float]
    
    model_config = ConfigDict(from_attributes=True)


class CampaignMetricsList(BaseModel):
    """Schema for campaign metrics list."""
    
    campaign_id: UUID
    metrics: List[CampaignMetricsResponse]
    total_messages_sent: int
    total_users_targeted: int
    total_users_engaged: int
    average_success_rate: Optional[float]


# ============================================================================
# Campaign Execution Schemas
# ============================================================================

class CampaignExecutionRequest(BaseModel):
    """Schema for campaign execution request."""
    
    campaign_id: UUID
    dry_run: bool = Field(False, description="If true, only preview targets without sending")


class CampaignExecutionResponse(BaseModel):
    """Schema for campaign execution response."""
    
    success: bool
    dry_run: bool = False
    targets_count: int
    messages_sent: int
    messages_failed: int = 0
    users_targeted: int = 0
    target_user_ids: List[int] = Field(default_factory=list)
    execution_time_seconds: float = Field(0.0, description="Execution duration in seconds")
    error: Optional[str] = None


class TargetAudiencePreviewRequest(BaseModel):
    """Schema for target audience preview request."""
    
    target_criteria: Optional[Dict[str, Any]]
    limit: int = Field(50, ge=1, le=500)


class TargetAudiencePreviewResponse(BaseModel):
    """Schema for target audience preview response."""
    
    total_targets: int
    preview_limit: int
    preview: List[Dict[str, Any]]


class UserEngagementRecord(BaseModel):
    """Schema for recording user engagement."""
    
    campaign_id: UUID
    user_id: int
    engaged: bool = True


# ============================================================================
# Campaign History/Execution Log Schemas
# ============================================================================

class CampaignExecutionHistoryResponse(BaseModel):
    """Schema for campaign execution history record."""
    
    id: UUID
    campaign_id: UUID
    campaign_name: str
    executed_at: datetime
    executed_by: Optional[int]
    total_targeted: int
    messages_sent: int
    messages_failed: int
    execution_time_seconds: float
    dry_run: bool
    targeted_user_ids: Optional[List[int]] = None
    message_content: str
    error_message: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class CampaignExecutionHistoryListResponse(BaseModel):
    """Schema for paginated campaign execution history."""
    
    items: List[CampaignExecutionHistoryResponse]
    total: int
    skip: int
    limit: int
