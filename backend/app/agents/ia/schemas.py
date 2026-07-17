from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

QuestionId = Literal[
    "crisis_trend",
    "dropoffs",
    "resource_reuse",
    "fallback_reduction",
    "cost_per_helpful",
    "coverage_windows",
]


class IAQueryParams(BaseModel):
    start: datetime = Field(..., alias="from")
    end: datetime = Field(..., alias="to")


class IAQueryRequest(BaseModel):
    question_id: QuestionId
    params: IAQueryParams


class IAQueryResponse(BaseModel):
    """Response model for Insights Agent queries.
    
    Includes both raw analytics data and LLM-generated insights.
    """
    # Raw analytics data (Phase 1 - always present)
    chart: dict[str, Any]
    table: list[dict[str, Any]]
    notes: list[str] = Field(default_factory=list)
    
    # LLM-generated insights (Phase 2 - optional for backward compatibility)
    interpretation: Optional[str] = Field(
        None, 
        description="Natural language interpretation of analytics results"
    )
    trends: Optional[list[dict[str, Any]]] = Field(
        None,
        description="Identified patterns and trends in the data"
    )
    summary: Optional[str] = Field(
        None,
        description="Executive summary of key findings"
    )
    recommendations: Optional[list[dict[str, Any]]] = Field(
        None,
        description="Actionable recommendations for administrators"
    )
    pdf_url: Optional[str] = Field(
        None,
        description="URL to downloadable PDF report"
    )
