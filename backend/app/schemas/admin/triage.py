"""Admin schemas for triage agent management."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SeverityBreakdown(BaseModel):
    """Summary of assessments grouped by severity."""

    severity: str
    count: int


class ProcessingMetrics(BaseModel):
    """Processing time statistics for triage assessments."""

    average_ms: Optional[float] = None
    max_ms: Optional[int] = None


class RiskTrendPoint(BaseModel):
    """Daily risk trend summary."""

    date: str
    total: int
    high: int
    medium: int
    low: int
    average_risk_score: Optional[float] = None


class SlaMetrics(BaseModel):
    """Service-level performance for triage processing."""

    target_ms: int
    records: int
    average_ms: Optional[float] = None
    p90_ms: Optional[int] = None
    p95_ms: Optional[int] = None
    within_target_percent: Optional[float] = None


class TriageCasePreview(BaseModel):
    """High-level view of a notable triage assessment."""

    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    email: Optional[str] = None
    risk_score: float
    severity_level: str
    recommended_action: Optional[str] = None
    created_at: datetime


class TriageOverview(BaseModel):
    """Aggregated triage insights for the admin dashboard."""

    timeframe_days: int = Field(default=7)
    total_assessments: int
    severity_breakdown: List[SeverityBreakdown] = Field(default_factory=list)
    average_risk_score: Optional[float] = None
    high_severity_count: int
    last_assessment_at: Optional[datetime] = None
    processing: Optional[ProcessingMetrics] = None
    risk_trend: List[RiskTrendPoint] = Field(default_factory=list)
    sla_metrics: Optional[SlaMetrics] = None
    recent_high_risk: List[TriageCasePreview] = Field(default_factory=list)


class TriageAssessmentItem(BaseModel):
    """Detailed triage assessment row for tables."""

    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    email: Optional[str] = None
    severity_level: str
    risk_score: float
    confidence_score: float
    recommended_action: Optional[str] = None
    risk_factors: Optional[List[str]] = None
    created_at: datetime
    processing_time_ms: Optional[int] = None
    conversation_id: Optional[int] = None
    message_excerpt: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TriageAssessmentListResponse(BaseModel):
    """Paginated triage assessment collection."""

    items: List[TriageAssessmentItem]
    total: int


class TriageTestRequest(BaseModel):
    """Payload for manual triage classification tests."""

    message: str


class TriageTestResponse(BaseModel):
    """Result returned by a manual triage classification."""

    classification: str
    recommended_resources: List[dict[str, Any]] = Field(default_factory=list)
