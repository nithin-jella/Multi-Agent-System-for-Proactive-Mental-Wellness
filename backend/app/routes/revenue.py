"""
Revenue Tracker API Routes

Endpoints for managing monthly revenue reports and submitting to blockchain.
Requires admin authentication.

Endpoints:
- GET /api/v1/revenue/current - Get current month's revenue (real-time)
- GET /api/v1/revenue/history - Get historical revenue reports
- POST /api/v1/revenue/submit - Manually submit monthly report
- GET /api/v1/revenue/pending-approvals - Get reports awaiting approval
- POST /api/v1/revenue/approve/{month} - Approve a report (multi-sig)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.database.session import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.domains.finance.revenue_tracker import revenue_tracker

router = APIRouter(prefix="/api/v1/revenue", tags=["Revenue Tracker"])


# ============ SCHEMAS ============

class RevenueBreakdownResponse(BaseModel):
    """Revenue breakdown by category"""
    wellness_fees: str = Field(..., description="Wellness service fees in USDC")
    subscriptions: str = Field(..., description="Premium subscription revenue in USDC")
    nft_sales: str = Field(..., description="NFT badge sales in USDC")
    partner_fees: str = Field(..., description="Partner institution fees in USDC")
    treasury_returns: str = Field(..., description="Treasury investment returns in USDC")
    total: str = Field(..., description="Total revenue in USDC")


class MonthlyReportResponse(BaseModel):
    """Monthly revenue report"""
    year: int
    month: int
    month_yyyymm: int
    revenue_breakdown: RevenueBreakdownResponse
    total_revenue: str
    total_expenses: str
    net_profit: str
    submitted_to_blockchain: bool
    transaction_hash: Optional[str] = None
    submission_timestamp: Optional[datetime] = None


class SubmitReportRequest(BaseModel):
    """Request to submit monthly report"""
    year: int = Field(..., description="Year (e.g., 2025)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")


class SubmitReportResponse(BaseModel):
    """Response after submitting report"""
    success: bool
    message: str
    transaction_hash: Optional[str] = None
    month_yyyymm: int


# ============ HELPER FUNCTIONS ============

def require_admin(current_user: User = Depends(get_current_active_user)):
    """Require admin role"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ============ ENDPOINTS ============

@router.get("/current", response_model=MonthlyReportResponse)
async def get_current_month_revenue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get current month's revenue in real-time
    (Not yet submitted to blockchain)
    """
    now = datetime.utcnow()
    year = now.year
    month = now.month
    
    try:
        breakdown, expenses = await revenue_tracker.aggregate_monthly_revenue(year, month)
        
        net_profit = breakdown.total - expenses
        
        return MonthlyReportResponse(
            year=year,
            month=month,
            month_yyyymm=revenue_tracker.format_month_yyyymm(year, month),
            revenue_breakdown=RevenueBreakdownResponse(**breakdown.to_dict()),
            total_revenue=str(breakdown.total),
            total_expenses=str(expenses),
            net_profit=str(net_profit),
            submitted_to_blockchain=False,
            transaction_hash=None,
            submission_timestamp=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to aggregate revenue: {str(e)}")


@router.get("/month/{year}/{month}", response_model=MonthlyReportResponse)
async def get_month_revenue(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get revenue for specific month
    """
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    if year < 2024 or year > 2099:
        raise HTTPException(status_code=400, detail="Invalid year")
    
    try:
        breakdown, expenses = await revenue_tracker.aggregate_monthly_revenue(year, month)
        
        net_profit = breakdown.total - expenses
        
        # TODO: Check if report was already submitted to blockchain
        # Query database for submission record
        
        return MonthlyReportResponse(
            year=year,
            month=month,
            month_yyyymm=revenue_tracker.format_month_yyyymm(year, month),
            revenue_breakdown=RevenueBreakdownResponse(**breakdown.to_dict()),
            total_revenue=str(breakdown.total),
            total_expenses=str(expenses),
            net_profit=str(net_profit),
            submitted_to_blockchain=False,
            transaction_hash=None,
            submission_timestamp=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get revenue: {str(e)}")


@router.post("/submit", response_model=SubmitReportResponse)
async def submit_monthly_report(
    request: SubmitReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Submit monthly report to PlatformRevenueOracle smart contract
    
    Requires:
    - Admin role
    - FINANCE_TEAM_PRIVATE_KEY environment variable set
    - Finance team member has FINANCE_TEAM_ROLE in oracle contract
    
    Workflow:
    1. Aggregate revenue for specified month
    2. Submit to blockchain via submitMonthlyReport()
    3. Wait for 3-of-5 approvals from other finance team members
    4. After 48-hour challenge period, finalize report
    5. Triggers profit distribution to stakers
    """
    year = request.year
    month = request.month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    # Don't allow submitting future months
    now = datetime.utcnow()
    if year > now.year or (year == now.year and month > now.month):
        raise HTTPException(status_code=400, detail="Cannot submit report for future months")
    
    try:
        # Process report
        success = await revenue_tracker.process_monthly_report(year, month)
        
        if success:
            # Get transaction hash from service (last submission)
            # TODO: Return tx hash from process_monthly_report()
            
            return SubmitReportResponse(
                success=True,
                message=f"Report submitted successfully for {year}-{month:02d}. Awaiting 3-of-5 approvals.",
                transaction_hash="0x...",  # TODO: Get actual tx hash
                month_yyyymm=revenue_tracker.format_month_yyyymm(year, month)
            )
        else:
            return SubmitReportResponse(
                success=False,
                message="Failed to submit report to blockchain. Check logs for details.",
                transaction_hash=None,
                month_yyyymm=revenue_tracker.format_month_yyyymm(year, month)
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error submitting report: {str(e)}")


@router.post("/auto-submit")
async def auto_submit_last_month(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Auto-submit report for previous month
    (Called by scheduler or manually)
    """
    try:
        success = await revenue_tracker.auto_submit_last_month()
        
        if success:
            return {
                "success": True,
                "message": "Report auto-submitted successfully for last month"
            }
        else:
            return {
                "success": False,
                "message": "Failed to auto-submit report. Check logs."
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error auto-submitting: {str(e)}")


@router.get("/dashboard")
async def get_revenue_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get revenue dashboard summary
    - Current month revenue (real-time)
    - Last 6 months history
    - YTD totals
    """
    now = datetime.utcnow()
    current_year = now.year
    current_month = now.month
    
    try:
        # Current month (real-time)
        current_breakdown, current_expenses = await revenue_tracker.aggregate_monthly_revenue(
            current_year, current_month
        )
        
        # TODO: Fetch last 6 months from database
        # TODO: Calculate YTD totals
        
        return {
            "current_month": {
                "year": current_year,
                "month": current_month,
                "revenue": str(current_breakdown.total),
                "expenses": str(current_expenses),
                "net_profit": str(current_breakdown.total - current_expenses),
                "breakdown": current_breakdown.to_dict()
            },
            "last_6_months": [],  # TODO: Implement
            "ytd": {
                "total_revenue": "0",  # TODO: Calculate
                "total_expenses": "0",  # TODO: Calculate
                "net_profit": "0"  # TODO: Calculate
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard: {str(e)}")


@router.get("/health")
async def revenue_tracker_health():
    """
    Check revenue tracker service health
    - Web3 connection
    - Oracle contract
    - Finance wallet
    """
    try:
        is_connected = revenue_tracker.w3.is_connected()
        has_wallet = revenue_tracker.finance_account is not None
        
        if has_wallet:
            wallet_address = revenue_tracker.finance_account.address
            balance = revenue_tracker.w3.eth.get_balance(wallet_address)
            balance_eth = revenue_tracker.w3.from_wei(balance, 'ether')
        else:
            wallet_address = None
            balance_eth = 0
        
        return {
            "status": "healthy" if is_connected and has_wallet else "degraded",
            "web3_connected": is_connected,
            "finance_wallet_configured": has_wallet,
            "finance_wallet_address": wallet_address,
            "wallet_balance_eth": str(balance_eth),
            "oracle_address": revenue_tracker.oracle_address,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
