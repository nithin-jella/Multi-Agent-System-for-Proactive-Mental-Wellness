"""Agent execution tracking models."""

from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

if TYPE_CHECKING:
    from app.models.user import User

class AgentRun(Base):
    """Agent execution tracking."""
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), index=True, default="pending")  # pending|running|succeeded|failed|cancelled
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    triggered_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    triggered_by_user: Mapped[Optional["User"]] = relationship("User")
    messages: Mapped[List["AgentMessage"]] = relationship("AgentMessage", back_populates="run", cascade="all, delete-orphan")

class AgentMessage(Base):
    """Agent execution messages and logs."""
    __tablename__ = "agent_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("agent_runs.id"), index=True, nullable=False)
    agent_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="system")  # system|user|agent|tool|error
    message_type: Mapped[str] = mapped_column(String(32), nullable=False, default="event")  # event|token|chunk|final|error
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # 'metadata' is a reserved name in SQLAlchemy Declarative (Model.metadata). Use attribute 'meta' but keep
    # underlying column name 'metadata' for backward compatibility.
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False, index=True)

    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="messages")