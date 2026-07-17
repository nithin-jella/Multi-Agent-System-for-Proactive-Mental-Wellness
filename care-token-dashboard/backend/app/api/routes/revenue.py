"""
Revenue management API routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, extract, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.db.session import get_db
from app.models import User, RevenueReport, ReportStatus
from app.core.auth import get_current_active_user, require_role
from app.services.revenue_tracker import revenue_tracker

router = APIRouter()


class RevenueBreakdownResponse(BaseModel):
    wellness_fees: str
    subscriptions: str
    nft_sales: str
    partner_fees: str
    treasury_returns: str
    total: str


class RevenueReportResponse(BaseModel):
    id: int
    year: int
    month: int
    breakdown: RevenueBreakdownResponse
    total_revenue: str
    total_expenses: str
    net_profit: str
    status: str
    transaction_hash: Optional[str]
    block_number: Optional[int]
    approvals_count: int
    required_approvals: int
    is_challenged: bool
    submitted_at: Optional[datetime]
    finalized_at: Optional[datetime]
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_model(cls, report: RevenueReport):
        """Convert ORM model to response model"""
        return cls(
            id=report.id,
            year=report.year,
            month=report.month,
            breakdown=RevenueBreakdownResponse(
                wellness_fees=str(report.wellness_fees),
                subscriptions=str(report.subscriptions),
                nft_sales=str(report.nft_sales),
                partner_fees=str(report.partner_fees),
                treasury_returns=str(report.treasury_returns),
                total=str(report.total_revenue)
            ),
            total_revenue=str(report.total_revenue),
            total_expenses=str(report.total_expenses),
            net_profit=str(report.net_profit),
            status=report.status.value,
            transaction_hash=report.transaction_hash,
            block_number=report.block_number,
            approvals_count=report.approvals_count,
            required_approvals=report.required_approvals,
            is_challenged=report.is_challenged,
            submitted_at=report.submitted_at,
            finalized_at=report.finalized_at
        )


class SubmitReportRequest(BaseModel):
    year: int
    month: int


@router.get("/current")
async def get_current_revenue(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current month's real-time revenue
    
    Aggregates revenue streams for the current month (not yet submitted)
    """
    now = datetime.utcnow()
    year = now.year
    month = now.month
    
    breakdown, total_expenses = await revenue_tracker.aggregate_monthly_revenue(year, month)
    
    return {
        "success": True,
        "data": {
            "year": year,
            "month": month,
            "breakdown": breakdown.to_dict(),
            "total_revenue": str(breakdown.total),
            "total_expenses": str(total_expenses),
            "net_profit": str(breakdown.total - total_expenses),
            "status": "realtime"
        }
    }


@router.get("/month/{year}/{month}")
async def get_monthly_revenue(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get revenue report for specific month
    
    Returns saved report from database if exists, otherwise calculates on-the-fly
    """
    # Check database first
    result = await db.execute(
        select(RevenueReport).where(
            RevenueReport.year == year,
            RevenueReport.month == month
        )
    )
    report = result.scalar_one_or_none()
    
    if report:
        return {
            "success": True,
            "data": RevenueReportResponse.from_orm_model(report)
        }
    
    # Calculate on-the-fly
    breakdown, total_expenses = await revenue_tracker.aggregate_monthly_revenue(year, month)
    
    return {
        "success": True,
        "data": {
            "year": year,
            "month": month,
            "breakdown": breakdown.to_dict(),
            "total_revenue": str(breakdown.total),
            "total_expenses": str(total_expenses),
            "net_profit": str(breakdown.total - total_expenses),
            "status": "calculated"
        }
    }


@router.post("/submit")
async def submit_monthly_report(
    request: SubmitReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("finance_team"))
):
    """
    Submit monthly revenue report to blockchain
    
    Requires FINANCE_TEAM role
    """
    # Process report
    report = await revenue_tracker.process_monthly_report(
        request.year,
        request.month,
        submitted_by=current_user.id
    )
    
    if not report:
        raise HTTPException(
            status_code=500,
            detail="Failed to process monthly report"
        )
    
    return {
        "success": True,
        "data": RevenueReportResponse.from_orm_model(report),
        "message": "Report submitted successfully" if report.transaction_hash else "Report saved as draft"
    }


@router.get("/dashboard")
async def get_revenue_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get revenue dashboard with 6-month summary and YTD stats
    """
    # Get last 6 months of reports
    result = await db.execute(
        select(RevenueReport)
        .order_by(desc(RevenueReport.year), desc(RevenueReport.month))
        .limit(6)
    )
    recent_reports = result.scalars().all()
    
    # Calculate YTD stats
    current_year = datetime.utcnow().year
    ytd_result = await db.execute(
        select(
            func.sum(RevenueReport.total_revenue).label('total_revenue'),
            func.sum(RevenueReport.total_expenses).label('total_expenses'),
            func.sum(RevenueReport.net_profit).label('net_profit')
        ).where(RevenueReport.year == current_year)
    )
    ytd_stats = ytd_result.one()
    
    return {
        "success": True,
        "data": {
            "recent_reports": [
                RevenueReportResponse.from_orm_model(report)
                for report in recent_reports
            ],
            "ytd": {
                "year": current_year,
                "total_revenue": str(ytd_stats.total_revenue or Decimal(0)),
                "total_expenses": str(ytd_stats.total_expenses or Decimal(0)),
                "net_profit": str(ytd_stats.net_profit or Decimal(0))
            }
        }
    }


@router.get("/reports", response_model=List[RevenueReportResponse])
async def get_all_reports(
    year: Optional[int] = Query(None, description="Filter by year"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all revenue reports with optional filtering
    """
    query = select(RevenueReport)
    
    if year:
        query = query.where(RevenueReport.year == year)
    
    if status:
        query = query.where(RevenueReport.status == status)
    
    query = query.order_by(desc(RevenueReport.year), desc(RevenueReport.month))
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    return [RevenueReportResponse.from_orm_model(report) for report in reports]
