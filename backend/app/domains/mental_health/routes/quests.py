from __future__ import annotations

from datetime import datetime
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.models import User  # Core model
from app.domains.mental_health.models import QuestInstance, QuestStatusEnum
from app.domains.mental_health.schemas.quests import (
    QuestCompletionRequest,
    QuestCompletionResponse,
    QuestInstanceResponse,
    RewardSummaryResponse,
    WellnessStateResponse,
    WellnessStateUpdate,
)
from app.domains.mental_health.services.dialogue_orchestrator_service import DialogueOrchestratorService
from app.domains.mental_health.services.quest_engine_service import QuestEngineService
from app.domains.mental_health.services.rewards_calculator_service import RewardsCalculatorService
from app.services.achievement_service import trigger_achievement_check

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/quests", tags=["quests"])


def _today_start() -> datetime:
    now = datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/today", response_model=List[QuestInstanceResponse])
async def get_today_quests(
    session: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> List[QuestInstanceResponse]:
    engine = QuestEngineService(session)
    await engine.expire_overdue(current_user.id)
    await engine.issue_daily_quests(current_user)

    stmt = (
        select(QuestInstance)
        .options(selectinload(QuestInstance.template))
        .where(
            and_(
                QuestInstance.user_id == current_user.id,
                QuestInstance.issued_at >= _today_start(),
            )
        )
        .order_by(QuestInstance.issued_at.asc())
    )
    result = await session.execute(stmt)
    quests = list(result.scalars().unique())
    return [QuestInstanceResponse.from_orm(q) for q in quests]


@router.post("/{quest_id}/complete", response_model=QuestCompletionResponse, status_code=status.HTTP_200_OK)
async def complete_quest(
    quest_id: int,
    request: QuestCompletionRequest,
    session: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> QuestCompletionResponse:
    stmt = (
        select(QuestInstance)
        .options(selectinload(QuestInstance.template))
        .where(
            and_(
                QuestInstance.id == quest_id,
                QuestInstance.user_id == current_user.id,
            )
        )
    )
    result = await session.execute(stmt)
    quest = result.scalar_one_or_none()
    if quest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest not found.")
    if quest.status != QuestStatusEnum.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quest already resolved.")

    engine = QuestEngineService(session)
    rewards = RewardsCalculatorService(session)
    wellness_state = await engine.get_or_create_wellness_state(current_user.id)

    merged_metadata = dict(request.metadata)
    if request.notes:
        merged_metadata["notes"] = request.notes
    if request.mood:
        merged_metadata["mood"] = request.mood

    try:
        await engine.mark_completed(quest, payload=merged_metadata)
        reward_summary = await rewards.award_for_completion(
            quest,
            wellness_state,
            metadata=merged_metadata,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    try:
        await trigger_achievement_check(
            session,
            current_user,
            action="quest_completed",
            fail_on_config_error=False,
        )
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning(
            "Badge auto-sync failed after quest completion for user %s: %s",
            current_user.id,
            exc,
        )

    quest_response = QuestInstanceResponse.from_orm(quest)
    return QuestCompletionResponse(
        quest=quest_response,
        reward=RewardSummaryResponse(
            xp=reward_summary.xp,
            joy=reward_summary.joy,
            harmony=reward_summary.harmony,
            care_pending=reward_summary.care_pending,
        ),
    )


@router.get("/state", response_model=WellnessStateResponse)
async def get_wellness_state(
    session: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> WellnessStateResponse:
    engine = QuestEngineService(session)
    state = await engine.get_or_create_wellness_state(current_user.id)
    care_balance = 0.0
    extra = getattr(state, "extra_data", {}) or {}
    if isinstance(extra, dict):
        care_balance = float(extra.get("care_balance", 0.0))
    return WellnessStateResponse(
        current_streak=state.current_streak,
        longest_streak=state.longest_streak,
        harmony_score=state.harmony_score,
        joy_balance=state.joy_balance,
        care_balance=care_balance,
        compassion_mode_active=state.compassion_mode_active,
    )


@router.get("/daily-message")
async def get_daily_message(
    session: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    engine = QuestEngineService(session)
    state = await engine.get_or_create_wellness_state(current_user.id)
    orchestrator = DialogueOrchestratorService(session)
    quests = await orchestrator.fetch_recent_quests(current_user.id, limit=3)
    message = await orchestrator.build_daily_check_in(current_user, quests, state)
    if session.dirty:
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise
    return message


@router.patch("/state/update", response_model=WellnessStateResponse)
async def update_wellness_state(
    update: WellnessStateUpdate,
    session: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> WellnessStateResponse:
    """Update wellness state with deltas from CareQuest idle game."""
    engine = QuestEngineService(session)
    state = await engine.get_or_create_wellness_state(current_user.id)
    
    # Update joy and harmony (stored as columns)
    state.joy_balance = max(0.0, state.joy_balance + update.joy_delta)
    state.harmony_score = max(0.0, state.harmony_score + update.harmony_delta)
    
    # Update care (stored in extra_data)
    extra = dict(getattr(state, "extra_data", {}) or {})
    current_care = float(extra.get("care_balance", 0.0))
    extra["care_balance"] = max(0.0, current_care + update.care_delta)
    state.extra_data = extra
    
    try:
        await session.commit()
        await session.refresh(state)
    except Exception:
        await session.rollback()
        raise
    
    care_balance = float(extra.get("care_balance", 0.0))
    return WellnessStateResponse(
        current_streak=state.current_streak,
        longest_streak=state.longest_streak,
        harmony_score=state.harmony_score,
        joy_balance=state.joy_balance,
        care_balance=care_balance,
        compassion_mode_active=state.compassion_mode_active,
    )
