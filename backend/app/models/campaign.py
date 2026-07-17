"""Campaign management models for proactive outreach (TCA control)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from .user import User


class Campaign(Base):
    """Proactive outreach campaigns managed by admins.
    
    Campaigns can be triggered manually or automatically based on IA insights.
    Each campaign targets a specific audience with customized messages via TCA.
    """
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Trigger configuration (JSON DSL for conditions)
    trigger_rules: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Example: {"type": "ia_insight", "condition": "topic_frequency", "topic": "financial stress", "threshold": 20}
    
    # Message and targeting
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    target_audience: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Example: {"segment": "first_year_students", "risk_level": "high"}
    
    # Campaign status and priority
    status: Mapped[str] = mapped_column(String(50), nullable=False, default='draft', index=True)
    # 'draft', 'active', 'paused', 'completed'
    priority: Mapped[str] = mapped_column(String(50), nullable=False, default='medium')
    # 'low', 'medium', 'high'
    
    # Ownership and timestamps
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default='now()')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default='now()', onupdate=datetime.utcnow)
    last_executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])
    triggers: Mapped[list["CampaignTrigger"]] = relationship("CampaignTrigger", back_populates="campaign", cascade="all, delete-orphan")
    metrics: Mapped[list["CampaignMetrics"]] = relationship("CampaignMetrics", back_populates="campaign", cascade="all, delete-orphan")
    executions: Mapped[list["SCACampaignExecution"]] = relationship("SCACampaignExecution", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Campaign(id={self.id}, name={self.name}, status={self.status})>"


class CampaignTrigger(Base):
    """Trigger conditions for automated campaign execution.
    
    Evaluated periodically (daily/weekly) against IA insights.
    When conditions match, the associated campaign is executed.
    """
    __tablename__ = "campaign_triggers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Condition definition
    condition_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # 'ia_insight', 'manual', 'scheduled', 'threshold_breach'
    condition_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Example: {"metric": "high_risk_count", "operator": ">=", "value": 10}
    
    # Evaluation schedule
    evaluation_frequency: Mapped[str] = mapped_column(String(50), nullable=False, default='daily')
    # 'hourly', 'daily', 'weekly'
    
    # Execution tracking
    last_evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_match_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    match_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="triggers")

    def __repr__(self) -> str:
        return f"<CampaignTrigger(id={self.id}, campaign_id={self.campaign_id}, type={self.condition_type})>"


class CampaignMetrics(Base):
    """Daily metrics for campaign performance tracking.
    
    Tracks engagement, sentiment changes, and success rates
    to evaluate campaign effectiveness.
    """
    __tablename__ = "campaign_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False, index=True)
    execution_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    
    # Outreach metrics
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    users_targeted: Mapped[int] = mapped_column(Integer, default=0)
    users_engaged: Mapped[int] = mapped_column(Integer, default=0)  # Users who replied
    
    # Performance metrics
    success_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_sentiment_before: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_sentiment_after: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="metrics")

    def __repr__(self) -> str:
        return f"<CampaignMetrics(id={self.id}, campaign_id={self.campaign_id}, date={self.execution_date})>"


class SCACampaignExecution(Base):
    """Detailed execution history for TCA campaign sends.
    
    Tracks each TCA campaign execution with target users and message content
    for audit trail and history review.
    """
    __tablename__ = "sca_campaign_executions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Execution details
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default='now()', index=True)
    executed_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    
    # Campaign snapshot (capture current state at execution time)
    campaign_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message_content: Mapped[str] = mapped_column(Text, nullable=False)  # Actual message template used
    
    # Execution results
    total_targeted: Mapped[int] = mapped_column(Integer, default=0)
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    messages_failed: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=False)  # Was this a test run?
    
    # Target users (store user IDs for audit trail)
    targeted_user_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # List of user IDs
    
    # Error tracking
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="executions")
    executor: Mapped[Optional["User"]] = relationship("User", foreign_keys=[executed_by])

    def __repr__(self) -> str:
        return f"<SCACampaignExecution(id={self.id}, campaign_id={self.campaign_id}, executed_at={self.executed_at})>"
