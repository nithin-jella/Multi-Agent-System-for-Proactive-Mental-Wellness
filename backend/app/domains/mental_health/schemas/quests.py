from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field
from pydantic.config import ConfigDict

from app.domains.mental_health.models import QuestDifficultyEnum, QuestCategoryEnum, QuestStatusEnum


class QuestTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    short_description: str
    category: QuestCategoryEnum
    difficulty: QuestDifficultyEnum
    recommended_duration_minutes: int


class QuestInstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: QuestStatusEnum
    issued_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime]
    compassion_mode: bool
    template: QuestTemplateResponse


class RewardSummaryResponse(BaseModel):
    xp: int
    joy: int
    harmony: float
    care_pending: float


class QuestCompletionRequest(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)
    mood: Optional[str] = Field(default=None, max_length=120)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QuestCompletionResponse(BaseModel):
    quest: QuestInstanceResponse
    reward: RewardSummaryResponse


class WellnessStateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    current_streak: int
    longest_streak: int
    harmony_score: float
    joy_balance: float
    care_balance: float
    compassion_mode_active: bool


class WellnessStateUpdate(BaseModel):
    """Schema for updating wellness state from CareQuest game."""
    joy_delta: float = 0.0
    care_delta: float = 0.0
    harmony_delta: float = 0.0
