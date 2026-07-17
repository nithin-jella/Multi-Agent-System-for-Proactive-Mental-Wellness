"""Shared helpers for admin routes."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserBadge, UserProfile  # Core models
from app.domains.mental_health.models import Conversation, JournalEntry
from app.schemas.admin import UserStats

logger = logging.getLogger(__name__)


def decrypt_user_field(value: Optional[str]) -> Optional[str]:
    """Return field value as-is (encryption removed for performance)."""
    return value


def decrypt_user_email(email: Optional[str]) -> Optional[str]:
    """Return email value as-is (encryption removed for performance)."""
    return email


def hash_user_id(user_id: int) -> str:
    """Return a deterministic but anonymous hash for user identifiers."""
    return hashlib.md5(f"user_{user_id}_salt".encode()).hexdigest()[:8]


def build_avatar_url(email: Optional[str], user_id: int, size: int = 128) -> str:
    """Construct a deterministic avatar URL for a user."""
    if email:
        normalized = email.strip().lower()
        if normalized:
            email_hash = hashlib.md5(normalized.encode("utf-8")).hexdigest()
            return f"https://www.gravatar.com/avatar/{email_hash}?s={size}&d=identicon"

    seed = hash_user_id(user_id)
    return f"https://api.dicebear.com/7.x/identicon/png?seed={seed}&size={size}"


async def get_user_stats(db: AsyncSession) -> UserStats:
    """Calculate dashboard-level user statistics."""
    today = datetime.now().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    total_users = (
        await db.execute(
            select(func.count(User.id)).select_from(User)
        )
    ).scalar() or 0
    active_30d = (
        await db.execute(
            select(func.count(User.id))
            .select_from(User)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .filter(func.coalesce(UserProfile.last_activity_date, User.last_activity_date) >= month_ago)
        )
    ).scalar() or 0
    active_7d = (
        await db.execute(
            select(func.count(User.id))
            .select_from(User)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
            .filter(func.coalesce(UserProfile.last_activity_date, User.last_activity_date) >= week_ago)
        )
    ).scalar() or 0
    new_today = (
        await db.execute(
            select(func.count(User.id))
            .select_from(User)
            .filter(func.date(User.created_at) == today)
        )
    ).scalar() or 0
    avg_sentiment = (
        await db.execute(
            select(func.avg(func.coalesce(UserProfile.sentiment_score, User.sentiment_score)))
            .select_from(User)
            .outerjoin(UserProfile, User.id == UserProfile.user_id)
        )
    ).scalar() or 0
    total_journals = (
        await db.execute(select(func.count(JournalEntry.id)))
    ).scalar() or 0
    total_conversations = (
        await db.execute(select(func.count(Conversation.id)))
    ).scalar() or 0
    total_badges = (
        await db.execute(select(func.count(UserBadge.id)))
    ).scalar() or 0

    return UserStats(
        total_users=total_users,
        active_users_30d=active_30d,
        active_users_7d=active_7d,
        new_users_today=new_today,
        avg_sentiment_score=float(avg_sentiment),
        total_journal_entries=total_journals,
        total_conversations=total_conversations,
        total_badges_awarded=total_badges,
    )
