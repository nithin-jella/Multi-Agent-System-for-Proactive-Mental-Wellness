from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AIMemoryFactResponse(BaseModel):
    id: int
    fact: str
    category: Optional[str] = None
    source: Optional[str] = None
    created_at: datetime
    updated_at: datetime
