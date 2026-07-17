"""
Finance Module Pydantic Schemas

Request/Response validation models for finance-related API endpoints.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
from enum import Enum


# --------------------- ENUMS --------------------- #

class ReportStatusEnum(str, Enum):
    """Revenue report status"""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    FINALIZED = "finalized"
    REJECTED = "rejected"


# --------------------- REQUEST MODELS --------------------- #

class RevenueReportCreate(BaseModel):
    """Create a new revenue report"""
    year: int = Field(..., ge=2020, le=2100)
    month: int = Field(..., ge=1, le=12)
    wellness_fees: Decimal = Field(default=Decimal("0"), ge=0)
    subscriptions: Decimal = Field(default=Decimal("0"), ge=0)
    nft_sales: Decimal = Field(default=Decimal("0"), ge=0)
    partner_fees: Decimal = Field(default=Decimal("0"), ge=0)
    treasury_returns: Decimal = Field(default=Decimal("0"), ge=0)
    total_expenses: Decimal = Field(..., ge=0)
    notes: Optional[str] = None
    # API uses 'metadata' but DB column is 'extra_data' (SQLAlchemy reserved name)
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="extra_data")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RevenueReportUpdate(BaseModel):
    """Update an existing revenue report"""
    wellness_fees: Optional[Decimal] = Field(None, ge=0)
    subscriptions: Optional[Decimal] = Field(None, ge=0)
    nft_sales: Optional[Decimal] = Field(None, ge=0)
    partner_fees: Optional[Decimal] = Field(None, ge=0)
    treasury_returns: Optional[Decimal] = Field(None, ge=0)
    total_expenses: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = None
    status: Optional[ReportStatusEnum] = None

    model_config = ConfigDict(from_attributes=True)


class RevenueApprovalCreate(BaseModel):
    """Create a revenue approval"""
    report_id: int
    approver_address: str = Field(..., min_length=42, max_length=42)
    approver_name: Optional[str] = None
    approved: bool
    comment: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------- RESPONSE MODELS --------------------- #

class RevenueBreakdownResponse(BaseModel):
    """Revenue breakdown response"""
    wellness_fees: Decimal
    subscriptions: Decimal
    nft_sales: Decimal
    partner_fees: Decimal
    treasury_returns: Decimal
    total: Decimal

    model_config = ConfigDict(from_attributes=True)


class RevenueApprovalResponse(BaseModel):
    """Revenue approval response"""
    id: int
    report_id: int
    approver_address: str
    approver_name: Optional[str] = None
    approved: bool
    comment: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RevenueReportResponse(BaseModel):
    """Revenue report response"""
    id: int
    year: int
    month: int
    month_yyyymm: int
    
    # Revenue breakdown
    wellness_fees: Decimal
    subscriptions: Decimal
    nft_sales: Decimal
    partner_fees: Decimal
    treasury_returns: Decimal
    
    # Totals
    total_revenue: Decimal
    total_expenses: Decimal
    net_profit: Decimal
    
    # Blockchain submission
    submitted_to_blockchain: bool
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    submission_timestamp: Optional[datetime] = None
    
    # Multi-sig approval
    approvals_count: int
    required_approvals: int
    finalized: bool
    finalized_timestamp: Optional[datetime] = None
    
    # Status
    status: ReportStatusEnum
    
    # Additional data (API uses 'metadata' but DB column is 'extra_data')
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default=None, alias="extra_data")
    
    # Audit
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    
    # Relationships
    approvals: list[RevenueApprovalResponse] = []

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class RevenueReportListResponse(BaseModel):
    """List of revenue reports"""
    reports: list[RevenueReportResponse]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(from_attributes=True)


class RevenueSubmissionResponse(BaseModel):
    """Response after submitting revenue to blockchain"""
    success: bool
    report_id: int
    transaction_hash: str
    block_number: Optional[int] = None
    submission_timestamp: datetime
    message: str

    model_config = ConfigDict(from_attributes=True)
