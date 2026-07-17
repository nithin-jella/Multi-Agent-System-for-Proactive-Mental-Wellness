"""Conversation and user summary models."""

from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

if TYPE_CHECKING:
    from app.models.user import User

class Conversation(Base):
    """User conversation history."""
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    session_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    conversation_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    # Per-user-prompt LLM accounting (includes tool-call followups)
    llm_prompt_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    llm_request_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    llm_requests_by_model: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships - use string references to avoid circular imports
    user: Mapped["User"] = relationship("User", back_populates="conversations")

class UserSummary(Base):
    """User conversation summaries."""
    __tablename__ = "user_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    summarized_session_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User")