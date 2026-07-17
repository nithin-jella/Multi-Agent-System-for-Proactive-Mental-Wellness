from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models import (
    PlayerWellnessState,
    QuestDifficultyEnum,
    QuestInstance,
    RewardLedgerEntry,
)
from app.domains.mental_health.services.quest_analytics_service import record_quest_event

logger = logging.getLogger(__name__)


DIFFICULTY_XP_MULTIPLIERS: Dict[QuestDifficultyEnum, float] = {
    QuestDifficultyEnum.EASY: 0.8,
    QuestDifficultyEnum.STANDARD: 1.0,
    QuestDifficultyEnum.CHALLENGE: 1.25,
}

HARMONY_BONUS_PER_STREAK = 0.5


@dataclass
class RewardSummary:
    xp: int
    joy: int
    harmony: float
    care_pending: float


class RewardsCalculatorService:
    """Handles reward computation and persistence."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def ensure_not_awarded(self, quest_instance_id: int) -> bool:
        stmt = select(RewardLedgerEntry.id).where(RewardLedgerEntry.quest_instance_id == quest_instance_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none() is None

    async def award_for_completion(
        self,
        quest: QuestInstance,
        wellness_state: PlayerWellnessState,
        metadata: Optional[Dict[str, object]] = None,
    ) -> RewardSummary:
        if quest.template is None:
            await self.session.refresh(quest, attribute_names=["template"])

        if quest.template is None:
            raise ValueError("Quest template missing for reward calculation.")

        if quest.id and not await self.ensure_not_awarded(quest.id):
            logger.info("Quest %s already has a reward entry, skipping.", quest.id)
            return RewardSummary(0, 0, 0.0, 0.0)

        extra = dict(getattr(wellness_state, "extra_data", {}) or {})
        extra.setdefault("care_balance", 0.0)
        if hasattr(wellness_state, "extra_data"):
            wellness_state.extra_data = extra

        difficulty_multiplier = DIFFICULTY_XP_MULTIPLIERS.get(quest.template.difficulty, 1.0)
        base_xp = int(round(quest.template.base_xp * difficulty_multiplier))
        base_joy = int(round(quest.template.base_joy * difficulty_multiplier))
        base_harmony = float(quest.template.base_harmony * difficulty_multiplier)

        streak_snapshot = quest.streak_snapshot if quest.streak_snapshot is not None else 0
        streak_bonus = max(wellness_state.current_streak - streak_snapshot, 0)
        harmony_bonus = streak_bonus * HARMONY_BONUS_PER_STREAK

        total_harmony = base_harmony + harmony_bonus

        wellness_state.harmony_score = max(wellness_state.harmony_score + total_harmony, 0.0)
        wellness_state.joy_balance = max(wellness_state.joy_balance + base_joy, 0.0)

        reward_entry = RewardLedgerEntry(
            user_id=quest.user_id,
            quest_instance_id=quest.id,
            xp_awarded=base_xp,
            joy_awarded=base_joy,
            harmony_delta=total_harmony,
            care_pending=0.0,
            extra_data=metadata or {},
        )
        self.session.add(reward_entry)
        await self.session.flush()

        await record_quest_event(
            self.session,
            event_type="reward_recorded",
            user_id=quest.user_id,
            quest_instance=quest,
            payload={"xp": base_xp, "joy": base_joy, "harmony_delta": total_harmony},
        )

        return RewardSummary(
            xp=base_xp,
            joy=base_joy,
            harmony=total_harmony,
            care_pending=0.0,
        )
