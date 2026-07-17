"""
Approval workflow API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models import User, RevenueReport, RevenueApproval, ReportStatus
from app.core.auth import get_current_active_user, require_role

router = APIRouter()


class ApproveRequest(BaseModel):
    comment: Optional[str] = None


class ChallengeRequest(BaseModel):
    reason: str


@router.post("/approve/{report_id}")
async def approve_report(
    report_id: int,
    request: ApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("finance_team"))
):
    """
    Approve a monthly revenue report
    
    Requires FINANCE_TEAM role
    """
    # Get report
    result = await db.execute(select(RevenueReport).where(RevenueReport.id == report_id))
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status != ReportStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Report must be in submitted status")
    
    # Check if user already approved
    existing_approval = await db.execute(
        select(RevenueApproval).where(
            RevenueApproval.report_id == report_id,
            RevenueApproval.user_id == current_user.id
        )
    )
    if existing_approval.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already approved this report")
    
    # Create approval
    approval = RevenueApproval(
        report_id=report_id,
        user_id=current_user.id,
        wallet_address=current_user.wallet_address or "",
        approved=True,
        comment=request.comment
    )
    db.add(approval)
    
    # Update report approval count
    report.approvals_count += 1
    
    # Check if enough approvals
    if report.approvals_count >= report.required_approvals:
        report.status = ReportStatus.APPROVED
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Report approved ({report.approvals_count}/{report.required_approvals} approvals)",
        "data": {
            "report_id": report_id,
            "approvals_count": report.approvals_count,
            "status": report.status.value
        }
    }


@router.post("/challenge/{report_id}")
async def challenge_report(
    report_id: int,
    request: ChallengeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("auditor"))
):
    """
    Challenge a monthly revenue report
    
    Requires AUDITOR role
    """
    # Get report
    result = await db.execute(select(RevenueReport).where(RevenueReport.id == report_id))
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report.status == ReportStatus.FINALIZED:
        raise HTTPException(status_code=400, detail="Cannot challenge finalized report")
    
    if report.is_challenged:
        raise HTTPException(status_code=400, detail="Report already challenged")
    
    # Mark as challenged
    report.is_challenged = True
    report.challenge_reason = request.reason
    report.status = ReportStatus.CHALLENGED
    
    await db.commit()
    
    return {
        "success": True,
        "message": "Report challenged successfully",
        "data": {
            "report_id": report_id,
            "status": report.status.value,
            "challenge_reason": report.challenge_reason
        }
    }


@router.get("/pending")
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get reports pending approval
    
    Shows reports that need approvals and user hasn't approved yet
    """
    # Get reports in submitted status
    result = await db.execute(
        select(RevenueReport).where(
            RevenueReport.status == ReportStatus.SUBMITTED
        )
    )
    pending_reports = result.scalars().all()
    
    # Filter out reports user already approved
    filtered_reports = []
    for report in pending_reports:
        approval_check = await db.execute(
            select(RevenueApproval).where(
                RevenueApproval.report_id == report.id,
                RevenueApproval.user_id == current_user.id
            )
        )
        if not approval_check.scalar_one_or_none():
            filtered_reports.append({
                "id": report.id,
                "year": report.year,
                "month": report.month,
                "total_revenue": str(report.total_revenue),
                "total_expenses": str(report.total_expenses),
                "net_profit": str(report.net_profit),
                "approvals_count": report.approvals_count,
                "required_approvals": report.required_approvals,
                "submitted_at": report.submitted_at
            })
    
    return {
        "success": True,
        "data": filtered_reports
    }
