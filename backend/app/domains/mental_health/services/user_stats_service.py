# backend/app/services/user_stats_service.py
"""
Service for calculating and updating user statistics (streaks, sentiment score).
Ensures dashboard and profile always show current data.
"""

import logging
from datetime import date, timedelta, datetime
from typing import Set, Optional, Any, cast
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

from app.models import User  # Core model
from app.domains.mental_health.models import JournalEntry, Conversation
from app.domains.mental_health.models.assessments import TriageAssessment
from app.schemas.user import UserStatsResponse
from app.services.user_normalization import ensure_user_normalized_tables

logger = logging.getLogger(__name__)


class UserStatsService:
    """Service for calculating and updating user statistics."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def refresh_user_stats(self, user: User) -> UserStatsResponse:
        """
        Refresh and update all user statistics:
        - Current streak (consecutive days of activity)
        - Longest streak (best streak ever achieved)
        - Sentiment score (based on recent conversations and journal entries)
        
        Args:
            user: The User object to update
            
        Returns:
            UserStatsResponse with updated statistics
        """
        logger.info(f"Refreshing stats for user {user.id}")
        
        try:
            # 1. Calculate streaks
            current_streak, longest_streak, last_activity = await self._calculate_streaks(user.id)
            
            # 2. Calculate sentiment score
            sentiment_score = await self._calculate_sentiment_score(user.id)
            
            # 3. Update user model
            await ensure_user_normalized_tables(self.db, user)

            if user.profile:
                user.profile.current_streak = current_streak
                user.profile.longest_streak = longest_streak
                user.profile.last_activity_date = last_activity
                user.profile.sentiment_score = sentiment_score
                self.db.add(user.profile)

            # Keep legacy columns in sync during migration window.
            user_any = cast(Any, user)
            user_any.current_streak = current_streak
            user_any.longest_streak = longest_streak
            user_any.last_activity_date = last_activity
            user_any.sentiment_score = sentiment_score
            
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            if user.profile:
                await self.db.refresh(user.profile)
            
            logger.info(
                f"User {user.id} stats updated: "
                f"Current streak={current_streak}, Longest streak={longest_streak}, "
                f"Sentiment={sentiment_score:.2f}"
            )

            # Streak has been freshly written; evaluate streak-based badge rules now
            # so users don't have to manually sync or complete a quest to receive them.
            try:
                from app.services.achievement_service import trigger_achievement_check  # local import avoids circular
                await trigger_achievement_check(
                    self.db,
                    user,
                    action="wellness_state_updated",
                    fail_on_config_error=False,
                )
            except Exception as badge_exc:
                logger.warning(
                    "Badge check failed after stat refresh for user %s: %s", user.id, badge_exc
                )
            
            return UserStatsResponse(
                current_streak=current_streak,
                longest_streak=longest_streak,
                sentiment_score=sentiment_score,
                last_activity_date=last_activity
            )
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to refresh stats for user {user.id}: {e}", exc_info=True)
            raise
    
    async def _calculate_streaks(self, user_id: int) -> tuple[int, int, Optional[date]]:
        """
        Calculate current and longest streaks for a user.
        
        Returns:
            tuple: (current_streak, longest_streak, last_activity_date)
        """
        # Fetch all journal entry dates
        journal_stmt = select(func.distinct(JournalEntry.entry_date))\
            .where(JournalEntry.user_id == user_id, JournalEntry.entry_date.isnot(None))
        journal_result = await self.db.execute(journal_stmt)
        
        journal_dates: Set[date] = set()
        for r in journal_result.all():
            if isinstance(r[0], str):
                try:
                    journal_dates.add(datetime.strptime(r[0], "%Y-%m-%d").date())
                except ValueError:
                    logger.warning(f"Invalid journal date format: {r[0]}")
            elif isinstance(r[0], date):
                journal_dates.add(r[0])
        
        # Fetch all conversation dates
        conv_stmt = select(func.distinct(func.date(Conversation.timestamp)))\
            .where(Conversation.user_id == user_id, Conversation.timestamp.isnot(None))
        conv_result = await self.db.execute(conv_stmt)
        
        conv_dates: Set[date] = set()
        for r in conv_result.all():
            if isinstance(r[0], str):
                try:
                    conv_dates.add(datetime.strptime(r[0], "%Y-%m-%d").date())
                except ValueError:
                    logger.warning(f"Invalid conversation date format: {r[0]}")
            elif isinstance(r[0], date):
                conv_dates.add(r[0])
        
        # Combine all activity dates
        all_activity_dates = journal_dates.union(conv_dates)
        
        if not all_activity_dates:
            return 0, 0, None
        
        # Sort dates
        sorted_dates = sorted(all_activity_dates)
        last_activity = sorted_dates[-1]
        
        # Calculate current streak
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        current_streak = 0
        if today in all_activity_dates or yesterday in all_activity_dates:
            # Start from today or yesterday
            check_date = today if today in all_activity_dates else yesterday
            current_streak = 1
            
            # Count backwards
            while True:
                prev_date = check_date - timedelta(days=1)
                if prev_date in all_activity_dates:
                    current_streak += 1
                    check_date = prev_date
                else:
                    break
        
        # Calculate longest streak ever
        longest_streak = 0
        temp_streak = 0
        prev_date = None
        
        for current_date in sorted_dates:
            if prev_date is None:
                temp_streak = 1
            elif (current_date - prev_date).days == 1:
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
            prev_date = current_date
        
        longest_streak = max(longest_streak, temp_streak)
        
        # Ensure longest_streak is at least as long as current_streak
        longest_streak = max(longest_streak, current_streak)
        
        return current_streak, longest_streak, last_activity
    
    async def _calculate_sentiment_score(self, user_id: int) -> float:
        """
        Calculate sentiment score based on recent triage assessments.
        Score ranges from 0.0 (very negative) to 1.0 (very positive).
        
        Uses severity_level from TriageAssessment:
        - critical -> 0.2
        - high -> 0.35
        - moderate -> 0.5
        - low -> 0.7
        - minimal -> 0.85
        
        Factors:
        - Recent assessment severity (lower severity = higher sentiment)
        - Activity frequency (more assessments = slightly better sentiment)
        - Default neutral is 0.5
        """
        try:
            # Get triage assessments from last 30 days
            thirty_days_ago = datetime.now() - timedelta(days=30)
            
            assessment_stmt = select(TriageAssessment.severity_level)\
                .where(
                    TriageAssessment.user_id == user_id,
                    TriageAssessment.created_at >= thirty_days_ago,
                    TriageAssessment.severity_level.isnot(None)
                )\
                .order_by(TriageAssessment.created_at.desc())\
                .limit(20)  # Last 20 assessments
            
            result = await self.db.execute(assessment_stmt)
            severity_levels = [r[0] for r in result.all()]
            
            if not severity_levels:
                # No recent assessments - return neutral
                return 0.5
            
            # Map severity to numeric values (lower is worse)
            severity_map = {
                'critical': 0,
                'high': 1,
                'moderate': 2,
                'low': 3,
                'minimal': 4
            }
            
            # Convert severity levels to numeric scores
            numeric_severities = [severity_map.get(s.lower(), 2) for s in severity_levels]
            avg_severity = sum(numeric_severities) / len(numeric_severities)
            
            # Map severity (0-4) to sentiment (0.0-1.0)
            # 0 (critical) -> 0.2, 1 (high) -> 0.35, 2 (moderate) -> 0.5,
            # 3 (low) -> 0.7, 4 (minimal) -> 0.85
            sentiment_score = 0.2 + (avg_severity / 4.0) * 0.65
            
            # Activity bonus: having recent activity slightly boosts sentiment
            if len(numeric_severities) >= 10:
                sentiment_score += 0.05  # Active user bonus
            
            # Clamp to [0.0, 1.0]
            sentiment_score = max(0.0, min(1.0, sentiment_score))
            
            return round(sentiment_score, 2)
            
        except Exception as e:
            logger.error(f"Failed to calculate sentiment score for user {user_id}: {e}", exc_info=True)
            return 0.5  # Return neutral on error
