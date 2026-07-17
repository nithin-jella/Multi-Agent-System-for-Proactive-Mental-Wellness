from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class JournalPromptBase(BaseModel):
    text: str
    category: Optional[str] = None
    is_active: bool = True


class JournalPromptCreate(JournalPromptBase):
    pass


class JournalPromptUpdate(BaseModel):
    text: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class JournalPromptResponse(JournalPromptBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class JournalEntryBase(BaseModel):
    entry_date: date
    content: str
    prompt_id: Optional[int] = None
    mood: Optional[int] = Field(default=None, ge=1, le=5, description="Legacy mood scale (1-5)")
    valence: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    arousal: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    tags: List[str] = Field(default_factory=list)


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntryUpdate(BaseModel):
    content: Optional[str] = None
    prompt_id: Optional[int] = None
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    valence: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    arousal: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    tags: Optional[List[str]] = None


class JournalEntryFilter(BaseModel):
    search_query: Optional[str] = None
    mood_min: Optional[int] = Field(default=None, ge=1, le=5)
    mood_max: Optional[int] = Field(default=None, ge=1, le=5)
    valence_min: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    valence_max: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    arousal_min: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    arousal_max: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    inferred_dominance_min: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    inferred_dominance_max: Optional[float] = Field(default=None, ge=-1.0, le=1.0)
    tags: Optional[List[str]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=500)


class JournalReflectionPointBase(BaseModel):
    reflection_text: str


class JournalReflectionPointCreate(JournalReflectionPointBase):
    journal_entry_id: int
    user_id: int


class JournalReflectionPointResponse(JournalReflectionPointBase):
    id: int
    journal_entry_id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JournalTagResponse(BaseModel):
    id: int
    journal_entry_id: int
    tag_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JournalEntryResponse(JournalEntryBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    prompt: Optional[JournalPromptResponse] = None
    reflection_points: List[JournalReflectionPointResponse] = Field(default_factory=list)
    tags: List[JournalTagResponse] = Field(default_factory=list)
    word_count: int
    inferred_dominance: Optional[float] = Field(default=None, ge=-1.0, le=1.0)

    model_config = ConfigDict(from_attributes=True)


class PadAxisDistribution(BaseModel):
    very_low: int
    low: int
    neutral: int
    high: int
    very_high: int


class PadDistribution(BaseModel):
    valence: PadAxisDistribution
    arousal: PadAxisDistribution
    inferred_dominance: PadAxisDistribution


class JournalMoodTrendPoint(BaseModel):
    date: str
    mood: int


class JournalPadTrendPoint(BaseModel):
    date: str
    valence: Optional[float] = None
    arousal: Optional[float] = None
    inferred_dominance: Optional[float] = None


class WritingFrequencyPoint(BaseModel):
    date: str
    count: int


class JournalTagUsage(BaseModel):
    tag: str
    count: int


class JournalAnalyticsResponse(BaseModel):
    total_entries: int
    total_word_count: int
    avg_word_count: float
    mood_distribution: dict[int, int]
    most_used_tags: List[JournalTagUsage]
    mood_trend: List[JournalMoodTrendPoint]
    writing_frequency: List[WritingFrequencyPoint]
    pad_distribution: PadDistribution
    pad_trend: List[JournalPadTrendPoint]


class JournalExportResponse(BaseModel):
    export_url: str
    filename: str
    total_entries: int