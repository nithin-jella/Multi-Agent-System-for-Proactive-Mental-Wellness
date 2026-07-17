"""Admin insights API endpoints.

Provides access to IA-generated reports and analytics.

# pyright: reportArgumentType=false, reportGeneralTypeIssues=false
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.database import get_async_db
from app.models import User
from app.domains.mental_health.services.insights_service import InsightsService, get_insights_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/insights", tags=["admin", "insights"])


# Pydantic schemas
class TrendingTopicSchema(BaseModel):
    """Trending topic with count."""
    topic: str
    count: int


class SentimentDataSchema(BaseModel):
    """Sentiment trend data."""
    avg_sentiment: float
    avg_risk: float
    period_start: str
    period_end: str


class InsightsReportSchema(BaseModel):
    """IA insights report response."""
    id: str
    report_type: str
    period_start: str
    period_end: str
    summary: str | None = None  # Allow None as some reports may not have summaries yet
    trending_topics: dict[str, Any] | None = None  # Can be dict or list depending on report type
    sentiment_data: dict[str, Any] | None = None
    high_risk_count: int
    assessment_count: int
    generated_at: str
    
    model_config = ConfigDict(from_attributes=True)


class ReportsListResponse(BaseModel):
    """Paginated reports list."""
    reports: list[InsightsReportSchema]
    total: int
    limit: int
    offset: int


class GenerateReportRequest(BaseModel):
    """Request to manually generate a report."""
    report_type: str = Field(default='ad_hoc', description="Report type: weekly, monthly, or ad_hoc")
    period_start: datetime | None = Field(default=None, description="Start of reporting period")
    period_end: datetime | None = Field(default=None, description="End of reporting period")
    use_llm: bool = Field(default=True, description="Use Gemini LLM for intelligent analysis")


# Helper function to check admin permissions
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user has admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/reports", response_model=ReportsListResponse)
async def list_reports(
    report_type: str | None = Query(None, description="Filter by report type"),
    limit: int = Query(10, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
) -> ReportsListResponse:
    """List IA insights reports with pagination.
    
    **Admin only** - Requires admin role.
    """
    try:
        insights_service = InsightsService(db)
        reports = await insights_service.list_reports(
            report_type=report_type,
            limit=limit,
            offset=offset
        )
        
        # Convert to schema
        report_schemas = [
            InsightsReportSchema(  # type: ignore[call-arg]
                id=str(r.id),
                report_type=r.report_type,
                period_start=r.period_start.isoformat(),
                period_end=r.period_end.isoformat(),
                summary=r.summary,
                trending_topics=r.trending_topics,
                sentiment_data=r.sentiment_data,
                high_risk_count=r.high_risk_count,
                assessment_count=r.assessment_count,
                generated_at=r.generated_at.isoformat()
            )
            for r in reports
        ]
        
        return ReportsListResponse(
            reports=report_schemas,
            total=len(report_schemas),  # TODO: Add count query for accurate total
            limit=limit,
            offset=offset
        )
    
    except Exception as e:
        logger.error(f"Failed to list insights reports: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reports"
        )


@router.get("/reports/{report_id}", response_model=InsightsReportSchema)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
) -> InsightsReportSchema:
    """Get a specific IA insights report by ID.
    
    **Admin only** - Requires admin role.
    """
    try:
        insights_service = InsightsService(db)
        report = await insights_service.get_report_by_id(report_id)
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report {report_id} not found"
            )
        
        return InsightsReportSchema(  # type: ignore[call-arg]
            id=str(report.id),
            report_type=report.report_type,
            period_start=report.period_start.isoformat(),
            period_end=report.period_end.isoformat(),
            summary=report.summary,
            trending_topics=report.trending_topics,
            sentiment_data=report.sentiment_data,
            high_risk_count=report.high_risk_count,
            assessment_count=report.assessment_count,
            generated_at=report.generated_at.isoformat()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get report {report_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve report"
        )


@router.get("/reports/latest/{report_type}", response_model=InsightsReportSchema | None)
async def get_latest_report(
    report_type: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
) -> InsightsReportSchema | None:
    """Get the latest report of a specific type.
    
    **Admin only** - Requires admin role.
    
    Args:
        report_type: Type of report (weekly, monthly, ad_hoc)
    """
    try:
        insights_service = InsightsService(db)
        report = await insights_service.get_latest_report(report_type=report_type)
        
        if not report:
            return None
        
        return InsightsReportSchema(  # type: ignore[call-arg]
            id=str(report.id),
            report_type=report.report_type,
            period_start=report.period_start.isoformat(),
            period_end=report.period_end.isoformat(),
            summary=report.summary,
            trending_topics=report.trending_topics,
            sentiment_data=report.sentiment_data,
            high_risk_count=report.high_risk_count,
            assessment_count=report.assessment_count,
            generated_at=report.generated_at.isoformat()
        )
    
    except Exception as e:
        logger.error(f"Failed to get latest {report_type} report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve latest report"
        )


@router.post("/reports/generate", response_model=InsightsReportSchema, status_code=status.HTTP_201_CREATED)
async def generate_report(
    request: GenerateReportRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
) -> InsightsReportSchema:
    """Manually trigger generation of an IA insights report.
    
    **Admin only** - Requires admin role.
    
    This endpoint allows admins to generate reports on-demand rather than
    waiting for the scheduled job. When use_llm=true (default), the report
    will include:
    - Intelligent natural language summary (Gemini-powered)
    - Pattern recognition insights
    - Actionable recommendations for administrators
    """
    try:
        logger.info(
            f"Manual report generation triggered by user {current_user.id}: "
            f"type={request.report_type}, use_llm={request.use_llm}"
        )
        
        insights_service = InsightsService(db)
        
        # Generate report based on type
        if request.report_type == 'weekly':
            report = await insights_service.generate_weekly_report(
                period_start=request.period_start,
                period_end=request.period_end,
                use_llm=request.use_llm
            )
        elif request.report_type == 'monthly':
            report = await insights_service.generate_monthly_report(
                period_start=request.period_start,
                period_end=request.period_end,
                use_llm=request.use_llm
            )
        else:  # ad_hoc
            # For ad_hoc, use weekly logic with custom period
            report = await insights_service.generate_weekly_report(
                period_start=request.period_start,
                period_end=request.period_end,
                use_llm=request.use_llm
            )
            # Update type to ad_hoc (already done in service if we add that branch)
        
        logger.info(f"Successfully generated report {report.id} (LLM: {request.use_llm})")
        
        return InsightsReportSchema(  # type: ignore[call-arg]
            id=str(report.id),
            report_type=report.report_type,
            period_start=report.period_start.isoformat(),
            period_end=report.period_end.isoformat(),
            summary=report.summary,
            trending_topics=report.trending_topics,
            sentiment_data=report.sentiment_data,
            high_risk_count=report.high_risk_count,
            assessment_count=report.assessment_count,
            generated_at=report.generated_at.isoformat()
        )
    
    except Exception as e:
        logger.error(f"Failed to generate report: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )
