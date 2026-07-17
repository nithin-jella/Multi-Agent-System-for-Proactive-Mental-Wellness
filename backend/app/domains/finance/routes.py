"""
Finance API Routes

Endpoints for revenue reporting and financial operations:
- GET /reports - List all revenue reports
- GET /reports/{id} - Get specific report
- POST /reports - Create draft report
- PUT /reports/{id} - Update report
- POST /reports/{id}/submit - Submit to blockchain
- GET /analytics - Revenue analytics

Access: Admin-only (finance team)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime

from app.domains.finance.models import RevenueReport, ReportStatus
from app.domains.finance.schemas import (
    RevenueReportCreate,
    RevenueReportUpdate,
    RevenueReportResponse,
    RevenueReportListResponse,
    RevenueSubmissionResponse,
    RevenueBreakdownResponse
)
from app.domains.finance.revenue_tracker import revenue_tracker
from app.domains.finance.revenue_scheduler import trigger_now, get_scheduler_status
from app.database import get_async_db
from app.dependencies import get_current_active_user, get_admin_user
from app.models.user import User

router = APIRouter()


@router.get("/reports", response_model=RevenueReportListResponse)
async def list_revenue_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[ReportStatus] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    List all revenue reports with pagination
    
    Admin-only access
    """
    try:
        # Build query
        query = select(RevenueReport)
        
        if status:
            query = query.where(RevenueReport.status == status)
        
        # Count total
        count_query = select(RevenueReport)
        if status:
            count_query = count_query.where(RevenueReport.status == status)
        result = await db.execute(count_query)
        total = len(result.scalars().all())
        
        # Paginate
        query = query.order_by(desc(RevenueReport.month_yyyymm))
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        result = await db.execute(query)
        reports = result.scalars().all()
        
        return RevenueReportListResponse(
            reports=[RevenueReportResponse.model_validate(r) for r in reports],
            total=total,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {str(e)}")


@router.get("/reports/{report_id}", response_model=RevenueReportResponse)
async def get_revenue_report(
    report_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Get specific revenue report by ID
    
    Admin-only access
    """
    try:
        result = await db.execute(
            select(RevenueReport).where(RevenueReport.id == report_id)
        )
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return RevenueReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}")


@router.post("/reports", response_model=RevenueReportResponse)
async def create_revenue_report(
    report_data: RevenueReportCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Create a new draft revenue report
    
    Admin-only access
    """
    try:
        # Check if report already exists for this month
        month_yyyymm = report_data.year * 100 + report_data.month
        result = await db.execute(
            select(RevenueReport).where(RevenueReport.month_yyyymm == month_yyyymm)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Report for {report_data.year}-{report_data.month:02d} already exists"
            )
        
        # Calculate totals
        total_revenue = (
            report_data.wellness_fees +
            report_data.subscriptions +
            report_data.nft_sales +
            report_data.partner_fees +
            report_data.treasury_returns
        )
        net_profit = total_revenue - report_data.total_expenses
        
        # Create report
        report = RevenueReport(
            year=report_data.year,
            month=report_data.month,
            month_yyyymm=month_yyyymm,
            wellness_fees=report_data.wellness_fees,
            subscriptions=report_data.subscriptions,
            nft_sales=report_data.nft_sales,
            partner_fees=report_data.partner_fees,
            treasury_returns=report_data.treasury_returns,
            total_revenue=total_revenue,
            total_expenses=report_data.total_expenses,
            net_profit=net_profit,
            status=ReportStatus.DRAFT,
            notes=report_data.notes,
            extra_data=report_data.metadata,
            created_by=current_user.id
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        return RevenueReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@router.put("/reports/{report_id}", response_model=RevenueReportResponse)
async def update_revenue_report(
    report_id: int,
    report_data: RevenueReportUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Update a draft revenue report
    
    Only DRAFT reports can be updated
    Admin-only access
    """
    try:
        result = await db.execute(
            select(RevenueReport).where(RevenueReport.id == report_id)
        )
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.status != ReportStatus.DRAFT:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot update report with status {report.status}"
            )
        
        # Update fields
        update_data = report_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(report, field, value)
        
        # Recalculate totals if revenue/expense fields changed
        if any(k in update_data for k in ['wellness_fees', 'subscriptions', 'nft_sales', 'partner_fees', 'treasury_returns', 'total_expenses']):
            report.total_revenue = (
                report.wellness_fees +
                report.subscriptions +
                report.nft_sales +
                report.partner_fees +
                report.treasury_returns
            )
            report.net_profit = report.total_revenue - report.total_expenses
        
        await db.commit()
        await db.refresh(report)
        
        return RevenueReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")


@router.post("/reports/{report_id}/submit", response_model=RevenueSubmissionResponse)
async def submit_report_to_blockchain(
    report_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Submit revenue report to blockchain
    
    Submits to PlatformRevenueOracle smart contract
    Admin-only access
    """
    try:
        result = await db.execute(
            select(RevenueReport).where(RevenueReport.id == report_id)
        )
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.submitted_to_blockchain:
            raise HTTPException(
                status_code=400, 
                detail="Report already submitted to blockchain"
            )
        
        # Submit to blockchain
        success = await revenue_tracker.process_monthly_report(report.year, report.month)
        
        if success:
            # Refresh report from DB (should have tx_hash now)
            await db.refresh(report)
            
            return RevenueSubmissionResponse(
                success=True,
                report_id=report.id,
                transaction_hash=report.transaction_hash or "",
                block_number=report.block_number,
                submission_timestamp=report.submission_timestamp or datetime.utcnow(),
                message="Revenue report submitted successfully to blockchain"
            )
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to submit report to blockchain. Check logs for details."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain submission error: {str(e)}")


@router.post("/reports/generate/{year}/{month}", response_model=RevenueReportResponse)
async def generate_report_for_month(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Auto-generate revenue report for a specific month
    
    Aggregates data from transactions, subscriptions, NFT sales, etc.
    Admin-only access
    """
    try:
        # Check if report already exists
        month_yyyymm = year * 100 + month
        result = await db.execute(
            select(RevenueReport).where(RevenueReport.month_yyyymm == month_yyyymm)
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Report for {year}-{month:02d} already exists"
            )
        
        # Aggregate revenue
        breakdown, total_expenses = await revenue_tracker.aggregate_monthly_revenue(year, month)
        
        # Create report
        report = RevenueReport(
            year=year,
            month=month,
            month_yyyymm=month_yyyymm,
            wellness_fees=breakdown.wellness_fees,
            subscriptions=breakdown.subscriptions,
            nft_sales=breakdown.nft_sales,
            partner_fees=breakdown.partner_fees,
            treasury_returns=breakdown.treasury_returns,
            total_revenue=breakdown.total,
            total_expenses=total_expenses,
            net_profit=breakdown.total - total_expenses,
            status=ReportStatus.DRAFT,
            created_by=current_user.id
        )
        
        db.add(report)
        await db.commit()
        await db.refresh(report)
        
        return RevenueReportResponse.model_validate(report)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@router.get("/analytics/breakdown/{year}/{month}", response_model=RevenueBreakdownResponse)
async def get_revenue_breakdown(
    year: int,
    month: int,
    current_user: User = Depends(get_admin_user)
):
    """
    Get real-time revenue breakdown for a month (not from saved report)
    
    Queries database directly for current data
    Admin-only access
    """
    try:
        breakdown, _ = await revenue_tracker.aggregate_monthly_revenue(year, month)
        
        return RevenueBreakdownResponse(
            wellness_fees=breakdown.wellness_fees,
            subscriptions=breakdown.subscriptions,
            nft_sales=breakdown.nft_sales,
            partner_fees=breakdown.partner_fees,
            treasury_returns=breakdown.treasury_returns,
            total=breakdown.total
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get breakdown: {str(e)}")


@router.post("/scheduler/trigger", response_model=dict)
async def trigger_scheduler_now(
    current_user: User = Depends(get_admin_user)
):
    """
    Manually trigger the monthly revenue job (testing/debugging)
    
    Admin-only access
    """
    try:
        await trigger_now()
        return {
            "success": True,
            "message": "Monthly revenue job triggered successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger job: {str(e)}")


@router.get("/scheduler/status", response_model=dict)
async def get_scheduler_info(
    current_user: User = Depends(get_admin_user)
):
    """
    Get scheduler status and next run time
    
    Admin-only access
    """
    try:
        status = get_scheduler_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")
