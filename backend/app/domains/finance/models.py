"""
Finance Module Database Models

All database models for financial operations:
- RevenueReport: Monthly revenue reports submitted to blockchain
- RevenueApproval: Multi-sig approval tracking for revenue reports
- Transaction: Platform transactions (wellness fees, general payments)
- Subscription: Premium subscription payments
- NFTTransaction: NFT achievement badge sales
- PartnerTransaction: Partner institution fees (clinical partners, merchants)
"""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional

from app.database import Base


# --------------------- ENUMS --------------------- #

class ReportStatus(str, PyEnum):
    """Revenue report status enum"""
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    FINALIZED = "finalized"
    REJECTED = "rejected"


class TransactionType(str, PyEnum):
    """Transaction type categories"""
    WELLNESS_FEE = "wellness_fee"
    SUBSCRIPTION = "subscription"
    NFT_SALE = "nft_sale"
    PARTNER_FEE = "partner_fee"
    TREASURY_RETURN = "treasury_return"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class TransactionStatus(str, PyEnum):
    """Transaction processing status"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class SubscriptionStatus(str, PyEnum):
    """Subscription status"""
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"


# --------------------- MODELS --------------------- #

class RevenueReport(Base):
    """Monthly revenue report submitted to blockchain"""
    
    __tablename__ = "revenue_reports"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Time period
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)  # 1-12
    month_yyyymm = Column(Integer, nullable=False, unique=True, index=True)  # YYYYMM format
    
    # Revenue breakdown (stored in USDC, 6 decimals)
    wellness_fees = Column(Numeric(20, 6), nullable=False, default=0)
    subscriptions = Column(Numeric(20, 6), nullable=False, default=0)
    nft_sales = Column(Numeric(20, 6), nullable=False, default=0)
    partner_fees = Column(Numeric(20, 6), nullable=False, default=0)
    treasury_returns = Column(Numeric(20, 6), nullable=False, default=0)
    
    # Totals
    total_revenue = Column(Numeric(20, 6), nullable=False)
    total_expenses = Column(Numeric(20, 6), nullable=False)
    net_profit = Column(Numeric(20, 6), nullable=False)
    
    # Blockchain submission
    submitted_to_blockchain = Column(Boolean, default=False, nullable=False)
    transaction_hash = Column(String(66), nullable=True, index=True)  # 0x + 64 chars
    block_number = Column(Integer, nullable=True)
    submission_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Multi-sig approval tracking
    approvals_count = Column(Integer, default=0, nullable=False)
    required_approvals = Column(Integer, default=3, nullable=False)
    finalized = Column(Boolean, default=False, nullable=False)
    finalized_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.DRAFT, nullable=False)
    
    # Additional data (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    notes = Column(Text, nullable=True)
    extra_data = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(Integer, nullable=True)  # User ID of creator
    
    # Relationships
    approvals = relationship("RevenueApproval", back_populates="report", cascade="all, delete-orphan")


class RevenueApproval(Base):
    """Revenue report approval tracking (multi-sig workflow)"""
    
    __tablename__ = "revenue_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("revenue_reports.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Approver information
    approver_address = Column(String(42), nullable=False)  # Ethereum address
    approver_name = Column(String(100), nullable=True)
    
    # Approval status
    approved = Column(Boolean, nullable=False)
    
    # Blockchain transaction
    transaction_hash = Column(String(66), nullable=True)
    block_number = Column(Integer, nullable=True)
    
    # Metadata
    comment = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    report = relationship("RevenueReport", back_populates="approvals")


class Transaction(Base):
    """Platform transactions for revenue tracking"""
    
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User information
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Transaction details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False, index=True)
    amount = Column(Numeric(20, 6), nullable=False)  # Amount in USDC
    currency = Column(String(10), default="USDC", nullable=False)
    
    # Status
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False, index=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Payment details
    payment_method = Column(String(50), nullable=True)
    payment_gateway = Column(String(50), nullable=True)
    external_transaction_id = Column(String(255), nullable=True)
    
    # Blockchain (if applicable)
    blockchain_tx_hash = Column(String(66), nullable=True)
    
    # Additional data (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    extra_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", backref="transactions")


class Subscription(Base):
    """Premium subscription payments"""
    
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User information
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Subscription details
    plan_name = Column(String(100), nullable=False)
    amount = Column(Numeric(20, 6), nullable=False)  # Monthly fee in USDC
    currency = Column(String(10), default="USDC", nullable=False)
    
    # Billing
    billing_date = Column(DateTime(timezone=True), nullable=False, index=True)
    next_billing_date = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False, index=True)
    
    # Payment details
    payment_method = Column(String(50), nullable=True)
    external_subscription_id = Column(String(255), nullable=True)
    
    # Additional data (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    extra_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", backref="subscriptions")


class NFTTransaction(Base):
    """NFT achievement badge sales"""
    
    __tablename__ = "nft_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # User information
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # NFT details
    nft_contract_address = Column(String(42), nullable=False)
    token_id = Column(String(100), nullable=False)
    nft_name = Column(String(255), nullable=False)
    
    # Transaction details
    price = Column(Numeric(20, 6), nullable=False)  # Price in USDC
    currency = Column(String(10), default="USDC", nullable=False)
    
    # Status
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False, index=True)
    
    # Blockchain
    blockchain_tx_hash = Column(String(66), nullable=True)
    block_number = Column(Integer, nullable=True)
    
    # Additional data (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    extra_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", backref="nft_transactions")


class PartnerTransaction(Base):
    """Partner institution fees (clinical partners, merchants)"""
    
    __tablename__ = "partner_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Partner information
    partner_name = Column(String(255), nullable=False)
    partner_type = Column(String(50), nullable=False)  # "clinical", "merchant", "other"
    
    # Transaction details
    fee_amount = Column(Numeric(20, 6), nullable=False)  # Fee in USDC
    currency = Column(String(10), default="USDC", nullable=False)
    
    # Status
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False, index=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Payment details
    external_transaction_id = Column(String(255), nullable=True)
    
    # Additional data (renamed from 'metadata' to avoid SQLAlchemy reserved name)
    extra_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
