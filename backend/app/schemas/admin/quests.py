from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.domains.mental_health.models import QuestCategoryEnum, QuestDifficultyEnum


class QuestTemplateBase(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    name: str = Field(..., min_length=3, max_length=120)
    short_description: str = Field(..., min_length=3, max_length=255)
    long_description: Optional[str] = Field(default=None, max_length=2000)
    category: QuestCategoryEnum
    difficulty: QuestDifficultyEnum
    recommended_duration_minutes: int = Field(default=10, ge=1, le=240)
    base_xp: int = Field(default=25, ge=0)
    base_joy: int = Field(default=5, ge=0)
    base_harmony: int = Field(default=5, ge=0)
    extra_data: Dict[str, Any] = Field(default_factory=dict)


class QuestTemplateCreate(QuestTemplateBase):
    pass


class QuestTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=3, max_length=120)
    short_description: Optional[str] = Field(default=None, min_length=3, max_length=255)
    long_description: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[QuestCategoryEnum] = None
    difficulty: Optional[QuestDifficultyEnum] = None
    recommended_duration_minutes: Optional[int] = Field(default=None, ge=1, le=240)
    base_xp: Optional[int] = Field(default=None, ge=0)
    base_joy: Optional[int] = Field(default=None, ge=0)
    base_harmony: Optional[int] = Field(default=None, ge=0)
    extra_data: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class QuestTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    short_description: str
    long_description: Optional[str]
    category: QuestCategoryEnum
    difficulty: QuestDifficultyEnum
    recommended_duration_minutes: int
    base_xp: int
    base_joy: int
    base_harmony: int
    extra_data: Dict[str, Any]
    requires_counselor: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class QuestTemplateListResponse(BaseModel):
    templates: list[QuestTemplateResponse]

