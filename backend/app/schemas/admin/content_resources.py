from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ContentResourceBase(BaseModel):
    title: str
    type: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source: Optional[str] = None


class ContentResourceCreate(ContentResourceBase):
    content: Optional[str] = None


class ContentResourceItem(ContentResourceBase):
    id: int
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="resource_metadata")
    mime_type: Optional[str] = None
    embedding_status: str
    embedding_last_processed_at: Optional[datetime]
    chunk_count: int
    storage_backend: str
    object_storage_key: Optional[str] = None
    object_storage_bucket: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ContentResourceResponse(BaseModel):
    items: List[ContentResourceItem]
    total_count: int
