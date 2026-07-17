"""
Database models for CARE Token Dashboard
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Numeric, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.db.session import Base


class UserRole(str, enum.Enum):
    """User role enum"""
    ADMIN = "admin"
    FINANCE_TEAM = "finance_team"
    AUDITOR = "auditor"
    VIEWER = "viewer"


class User(Base):
    """User model for authentication"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.VIEWER)
    wallet_address = Column(String(42), nullable=True)  # Ethereum address
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    approvals = relationship("RevenueApproval", back_populates="user")


class ReportStatus(str, enum.Enum):
    """Revenue report status enum"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    CHALLENGED = "challenged"
    FINALIZED = "finalized"


class RevenueReport(Base):
    """Monthly revenue report model"""
    __tablename__ = "revenue_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    
    # Revenue breakdown (in USDC, 6 decimals)
    wellness_fees = Column(Numeric(20, 6), nullable=False, default=0)
    subscriptions = Column(Numeric(20, 6), nullable=False, default=0)
    nft_sales = Column(Numeric(20, 6), nullable=False, default=0)
    partner_fees = Column(Numeric(20, 6), nullable=False, default=0)
    treasury_returns = Column(Numeric(20, 6), nullable=False, default=0)
    
    total_revenue = Column(Numeric(20, 6), nullable=False, default=0)
    total_expenses = Column(Numeric(20, 6), nullable=False, default=0)
    net_profit = Column(Numeric(20, 6), nullable=False, default=0)
    
    # Blockchain data
    status = Column(Enum(ReportStatus), nullable=False, default=ReportStatus.DRAFT)
    transaction_hash = Column(String(66), nullable=True)  # 0x + 64 hex chars
    block_number = Column(Integer, nullable=True)
    approvals_count = Column(Integer, nullable=False, default=0)
    required_approvals = Column(Integer, nullable=False, default=3)
    is_challenged = Column(Boolean, nullable=False, default=False)
    challenge_reason = Column(Text, nullable=True)
    
    # Metadata
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    approvals = relationship("RevenueApproval", back_populates="report", cascade="all, delete-orphan")
    submitter = relationship("User", foreign_keys=[submitted_by])


class RevenueApproval(Base):
    """Revenue report approval tracking"""
    __tablename__ = "revenue_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("revenue_reports.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    wallet_address = Column(String(42), nullable=False)
    
    approved = Column(Boolean, nullable=False)
    transaction_hash = Column(String(66), nullable=True)
    signature = Column(Text, nullable=True)
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    report = relationship("RevenueReport", back_populates="approvals")
    user = relationship("User", back_populates="approvals")
