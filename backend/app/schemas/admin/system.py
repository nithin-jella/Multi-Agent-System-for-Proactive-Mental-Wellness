from typing import Any, List, Optional
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class SystemSettingItem(BaseModel):
    key: str
    label: str
    value: Any
    value_preview: Optional[str] = None
    type: str = "text"
    editable: bool = False
    pending: bool = False
    help_text: Optional[str] = None


class SystemSettingsCategory(BaseModel):
    id: str
    title: str
    description: str
    settings: List[SystemSettingItem] = Field(default_factory=list)


class SystemSettingsResponse(BaseModel):
    generated_at: datetime
    categories: List[SystemSettingsCategory]
