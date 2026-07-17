from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import User  # Core model
from app.domains.mental_health.models import (
    QuestTemplate,
    QuestInstance,
    QuestCategoryEnum,
    QuestDifficultyEnum,
    QuestStatusEnum,
    PlayerWellnessState,
)
from app.domains.mental_health.services.quest_analytics_service import record_quest_event

logger = logging.getLogger(__name__)


DEFAULT_DAILY_TEMPLATES: Sequence[Dict[str, object]] = (
    {
        "code": "daily_reflection",
        "name": "Morning Reflection",
        "short_description": "Write three sentences about how you feel today.",
        "long_description": "Spend a few minutes checking in with yourself. Describe how your mind and body feel this morning.",
        "category": QuestCategoryEnum.REFLECTION,
        "difficulty": QuestDifficultyEnum.EASY,
        "recommended_duration_minutes": 5,
        "base_xp": 15,
        "base_joy": 5,
        "base_harmony": 4,
    },
    {
        "code": "daily_connection",
        "name": "Share Encouragement",
        "short_description": "Send an encouraging message to a guildmate or friend.",
        "long_description": "Reach out to someone in your cohort or guild and let them know you’re thinking about them. Small gestures count.",
        "category": QuestCategoryEnum.SOCIAL,
        "difficulty": QuestDifficultyEnum.STANDARD,
        "recommended_duration_minutes": 5,
        "base_xp": 20,
        "base_joy": 6,
        "base_harmony": 5,
    },
    {
        "code": "daily_reset",
        "name": "Breathing Reset",
        "short_description": "Complete a guided 4-7-8 breathing exercise.",
        "long_description": "Follow the breathing pattern: inhale 4s, hold 7s, exhale 8s for at least four cycles. Notice how your body responds.",
        "category": QuestCategoryEnum.WELLNESS,
        "difficulty": QuestDifficultyEnum.STANDARD,
        "recommended_duration_minutes": 10,
        "base_xp": 25,
        "base_joy": 7,
        "base_harmony": 6,
    },
)


@dataclass
class QuestIssueResult:
    issued: List[QuestInstance]
    existing: List[QuestInstance]


class QuestEngineService:
    """Core quest lifecycle orchestration."""

    DAILY_QUEST_COUNT = 3
    DAILY_EXPIRATION_HOURS = 24

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ensure_default_templates(self) -> None:
        """Seed baseline quest templates if the table is empty."""
        count_stmt = select(func.count(QuestTemplate.id))
        template_count = (await self.session.execute(count_stmt)).scalar_one()
        if template_count > 0:
            return

        logger.info("Seeding default quest templates")
        for template_payload in DEFAULT_DAILY_TEMPLATES:
            quest = QuestTemplate(
                code=str(template_payload["code"]),
                name=str(template_payload["name"]),
                short_description=str(template_payload["short_description"]),
                long_description=str(template_payload["long_description"]),
                category=template_payload["category"],  # Pass enum directly
                difficulty=template_payload["difficulty"],  # Pass enum directly
                recommended_duration_minutes=int(str(template_payload["recommended_duration_minutes"])),
                base_xp=int(str(template_payload["base_xp"])),
                base_joy=int(str(template_payload["base_joy"])),
                base_harmony=int(str(template_payload["base_harmony"])),
            )
            self.session.add(quest)

    async def get_or_create_wellness_state(self, user_id: int) -> PlayerWellnessState:
        stmt = select(PlayerWellnessState).where(PlayerWellnessState.user_id == user_id)
        result = await self.session.execute(stmt)
        state = result.scalar_one_or_none()
        if state:
            return state

        state = PlayerWellnessState(user_id=user_id)
        self.session.add(state)
        await self.session.flush()
        return state

    async def get_today_quests(self, user_id: int) -> List[QuestInstance]:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = (
            select(QuestInstance)
            .options(selectinload(QuestInstance.template))
            .where(
                and_(
                    QuestInstance.user_id == user_id,
                    QuestInstance.issued_at >= today_start,
                )
            )
            .order_by(QuestInstance.issued_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().unique())

    async def issue_daily_quests(self, user: User) -> QuestIssueResult:
        await self.ensure_default_templates()
        existing = await self.get_today_quests(user.id)

        if len(existing) >= self.DAILY_QUEST_COUNT:
            return QuestIssueResult(issued=[], existing=existing)

        # Grab active templates
        template_stmt = select(QuestTemplate).where(QuestTemplate.is_active.is_(True))
        template_result = await self.session.execute(template_stmt)
        templates = list(template_result.scalars().unique())
        template_by_code = {tpl.code: tpl for tpl in templates}

        issued: List[QuestInstance] = []
        required_codes = [tpl["code"] for tpl in DEFAULT_DAILY_TEMPLATES]

        missing_codes = [
            code for code in required_codes if code not in {quest.template.code for quest in existing if quest.template}
        ]
        for code in missing_codes:
            # Ensure code is string for dict.get()
            template = template_by_code.get(str(code))
            if not template:
                logger.warning("Template %s not found, skipping issuance", code)
                continue
            issued.append(await self._create_instance(user, template))

        # Fill remaining slots with rotated templates
        available_templates = [tpl for tpl in templates if tpl.code not in required_codes]
        while len(existing) + len(issued) < self.DAILY_QUEST_COUNT and available_templates:
            template = available_templates.pop(0)
            issued.append(await self._create_instance(user, template))

        await self.session.flush()
        for quest in issued:
            await record_quest_event(
                self.session,
                event_type="quest_issued",
                user_id=user.id,
                quest_instance=quest,
                payload={"template_code": quest.template.code if quest.template else None},
            )
        return QuestIssueResult(issued=issued, existing=existing)

    async def _create_instance(self, user: User, template: QuestTemplate) -> QuestInstance:
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=self.DAILY_EXPIRATION_HOURS)
        state = await self.get_or_create_wellness_state(user.id)
        instance = QuestInstance(
            user_id=user.id,
            template_id=template.id,
            status=QuestStatusEnum.ACTIVE,
            issued_at=now,
            expires_at=expires_at,
            streak_snapshot=state.current_streak,
            compassion_mode=state.compassion_mode_active,
        )
        instance.template = template
        self.session.add(instance)
        return instance

    async def mark_completed(
        self,
        quest: QuestInstance,
        payload: Optional[Dict[str, object]] = None,
    ) -> QuestInstance:
        if quest.status != QuestStatusEnum.ACTIVE:
            raise ValueError("Quest is not active and cannot be completed.")

        quest.status = QuestStatusEnum.COMPLETED
        quest.completed_at = datetime.utcnow()
        quest.completion_payload = payload or {}

        state = await self.get_or_create_wellness_state(quest.user_id)
        # Ensure completed_at is datetime, not None
        completed_time = quest.completed_at
        if completed_time is not None:
            state.register_completion(completed_time)
        await self.session.flush()
        await record_quest_event(
            self.session,
            event_type="quest_completed",
            user_id=quest.user_id,
            quest_instance=quest,
            payload={"streak_after": state.current_streak},
        )
        return quest

    async def expire_overdue(self, user_id: int) -> int:
        """Expire quests past their expiration time."""
        now = datetime.utcnow()
        stmt = (
            select(QuestInstance)
            .where(
                and_(
                    QuestInstance.user_id == user_id,
                    QuestInstance.status == QuestStatusEnum.ACTIVE,
                    QuestInstance.expires_at < now,
                )
            )
        )
        result = await self.session.execute(stmt)
        affected = 0
        for quest in result.scalars():
            quest.status = QuestStatusEnum.EXPIRED
            affected += 1
        if affected:
            await self.session.flush()
            # Check if method exists before calling (may not be implemented yet)
            if hasattr(self, 'activate_compassion_mode') and callable(getattr(self, 'activate_compassion_mode')):
                await self.activate_compassion_mode(user_id)  # type: ignore
            else:
                logger.debug(f"activate_compassion_mode not available for user {user_id}")
        return affected

