"""Social media and gamification models."""

from typing import Optional, TYPE_CHECKING
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

if TYPE_CHECKING:
    from .user import User


class Tweet(Base):
    """Social media tweets for sentiment analysis."""
    __tablename__ = "tweets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tweet_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class UserBadge(Base):
    """User achievements and badges (multi-chain aware)."""
    __tablename__ = "user_badges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    badge_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # Multi-chain: which blockchain this badge was minted on
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False, server_default="656476", index=True)
    contract_address: Mapped[str] = mapped_column(String, nullable=False, index=True)
    transaction_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    user: Mapped["User"] = relationship("User")

    __table_args__ = (UniqueConstraint('user_id', 'badge_id', 'chain_id', name='_user_badge_chain_uc'),)


class PendingBadgeGrant(Base):
    """Tracks badge eligibility for users who have no linked wallet at qualification time.

    When a qualifying action fires but the user has no ``wallet_address``, a row is
    inserted here instead of attempting an on-chain mint.  The unique constraint
    prevents duplicate eligibility records for the same (user, badge) pair.

    On wallet linkage (``/api/v1/link-did``), these rows are drained and each
    badge is retroactively minted.
    """
    __tablename__ = "pending_badge_grants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    badge_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # Human-readable explanation stored for auditability (e.g. "7-day streak")
    reason: Mapped[str] = mapped_column(String, nullable=False)
    qualified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    # Which action triggered the eligibility evaluation
    action_context: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    user: Mapped["User"] = relationship("User")

    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="_user_pending_badge_uc"),)