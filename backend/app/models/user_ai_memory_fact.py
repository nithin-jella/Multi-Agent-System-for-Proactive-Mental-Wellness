"""User-controlled AI memory facts.

This table stores explicit, user-reviewable facts that the agent may use
across conversations when the user has opted in via `users.consent_ai_memory`.

Facts are stored encrypted at rest.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserAIMemoryFact(Base):
    __tablename__ = "user_ai_memory_facts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    fact_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    fact_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "fact_hash", name="uq_user_ai_memory_fact_hash"),
    )
