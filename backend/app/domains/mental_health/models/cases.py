from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.system import CaseAssignment
    from app.models.agent_user import AgentUser


class CaseStatusEnum(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    waiting = "waiting"
    resolved = "resolved"
    closed = "closed"


class CaseSeverityEnum(str, enum.Enum):
    low = "low"
    med = "med"
    high = "high"
    critical = "critical"


class Case(Base):
    __tablename__ = "cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    status = Column(Enum(CaseStatusEnum, name="case_status_enum"), nullable=False)
    severity = Column(Enum(CaseSeverityEnum, name="case_severity_enum"), nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("agent_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_hash = Column(String, nullable=False)
    session_id = Column(String, nullable=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    summary_redacted = Column(Text, nullable=True)
    sla_breach_at = Column(DateTime(timezone=True), nullable=True)
    closure_reason = Column(Text, nullable=True)

    # Relationships
    notes: Mapped[List["CaseNote"]] = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[List["CaseAssignment"]] = relationship(
        "CaseAssignment",
        back_populates="case",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CaseAssignment.assigned_at.desc()",
    )
    assignee: Mapped[Optional["AgentUser"]] = relationship(
        "AgentUser",
        foreign_keys=[assigned_to],
    )


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    author_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)

    case: Mapped["Case"] = relationship("Case", back_populates="notes")
