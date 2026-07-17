"""System configuration and agent health monitoring models."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from .cases import Case
    from .user import User
    from .agent_user import AgentUser


class SystemSettings(Base):
    """System-wide configuration settings for agents and services.
    
    Stores thresholds, schedules, and operational parameters
    that admins can adjust through the dashboard.
    """
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # Categories: 'sta', 'sda', 'sca', 'ia', 'general'
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Audit trail
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    updater: Mapped[Optional["User"]] = relationship("User", foreign_keys=[updated_by])

    def __repr__(self) -> str:
        return f"<SystemSettings(key={self.key}, category={self.category})>"


class AgentHealthLog(Base):
    """Health monitoring and execution logs for safety agents.
    
    Tracks agent status, performance metrics, and error details
    for system monitoring and debugging.
    """
    __tablename__ = "agent_health_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # 'sta', 'sda', 'sca', 'ia'
    
    # Health status
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # 'healthy', 'degraded', 'down', 'warning'
    
    # Execution timestamps
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Performance and error tracking
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    performance_metrics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Example: {"avg_response_time_ms": 250, "requests_per_minute": 10, "cache_hit_rate": 0.85}
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    def __repr__(self) -> str:
        return f"<AgentHealthLog(id={self.id}, agent={self.agent_name}, status={self.status})>"


class CaseAssignment(Base):
    """Audit trail for case assignments and reassignments.
    
    Tracks who assigned cases to whom, when, and why (for reassignments).
    Provides accountability and history for case management.
    """
    __tablename__ = "case_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('cases.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Assignment details
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String(255),
        ForeignKey("agent_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    
    # Reassignment tracking
    reassignment_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    previous_assignee: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relationships
    case: Mapped["Case"] = relationship(
        "Case",
        foreign_keys=[case_id],
        back_populates="assignments",
    )
    assigner: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_by])
    assignee: Mapped[Optional["AgentUser"]] = relationship(
        "AgentUser",
        foreign_keys=[assigned_to],
    )

    def __repr__(self) -> str:
        return f"<CaseAssignment(id={self.id}, case_id={self.case_id}, assigned_to={self.assigned_to})>"
