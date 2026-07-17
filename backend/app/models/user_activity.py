"""User activity + retention tracking models.

These tables support:
- Daily active user calculations (DAU/WAU/MAU)
- Cohort retention (D1/D7/D30)
- Optional event instrumentation for product analytics

Design constraints:
- Avoid storing sensitive content (no message text, no clinical notes).
- Keep writes lightweight and idempotent.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class UserDailyActivity(Base):
    """One row per user per day (Asia/Jakarta date) indicating activity."""

    __tablename__ = "user_daily_activity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    source: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="api|web|mobile|unknown",
    )
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    __table_args__ = (
        UniqueConstraint("user_id", "activity_date", name="uq_user_daily_activity_user_date"),
        Index("ix_user_daily_activity_date_user", "activity_date", "user_id"),
    )


class UserEvent(Base):
    """Optional event log for coarse product analytics."""

    __tablename__ = "user_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    event_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    request_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    event_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)


class RetentionCohortDaily(Base):
    """Pre-computed cohort retention points for faster dashboards."""

    __tablename__ = "retention_cohort_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    cohort_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    day_n: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    cohort_size: Mapped[int] = mapped_column(Integer, nullable=False)
    retained_users: Mapped[int] = mapped_column(Integer, nullable=False)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("cohort_date", "day_n", name="uq_retention_cohort_date_day"),
        Index("ix_retention_cohort_date_day", "cohort_date", "day_n"),
    )
