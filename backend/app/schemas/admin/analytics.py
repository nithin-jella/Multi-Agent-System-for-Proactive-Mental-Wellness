"""Admin analytics schemas."""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.admin.conversations import ConversationStats
from app.schemas.admin.triage import RiskTrendPoint, SlaMetrics
from app.schemas.admin.users import UserStats


class AnalyticsResponse(BaseModel):
    user_stats: UserStats
    conversation_stats: ConversationStats


class SeverityDelta(BaseModel):
    current: Dict[str, int]
    previous: Dict[str, int]
    delta: Dict[str, int]
    delta_pct: Dict[str, Optional[float]]


class TriageMetricsInsight(BaseModel):
    timeframe_days: int
    window_start: str
    window_end: str
    risk_trend: List[RiskTrendPoint]
    severity_delta: SeverityDelta
    sla_metrics: Optional[SlaMetrics] = None


class CohortHotspot(BaseModel):
    label: str
    current_high: int
    previous_high: int
    delta: int
    delta_pct: Optional[float] = None
    cohort_population: int


class CohortHotspotsResponse(BaseModel):
    dimension: str
    timeframe_days: int
    window_start: str
    window_end: str
    items: List[CohortHotspot]


class PredictiveSignalPayload(BaseModel):
    metric: str
    topic: Optional[str] = None
    current_value: float
    moving_average: float
    forecast: float
    direction: str
    confidence: float
    window: str


class PredictiveSignalsResponse(BaseModel):
    generated_at: str
    source: str
    timeframe_days: int
    trace_id: str
    signals: List[PredictiveSignalPayload]
    warning: Optional[str] = None


class TopCampaignSummary(BaseModel):
    campaign_id: int
    title: str
    executed: int
    failed: int
    success_rate: Optional[float] = None


class InterventionTotals(BaseModel):
    overall: int
    by_status: Dict[str, int]
    success_rate: Optional[float] = None
    failure_rate: Optional[float] = None
    avg_engagement_score: Optional[float] = None


class InterventionSummary(BaseModel):
    timeframe_days: int
    window_start: str
    window_end: str
    totals: InterventionTotals
    top_campaigns: List[TopCampaignSummary]
