"""Content resource and CBT module models."""

from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

class ContentResource(Base):
    """Educational and therapeutic content resources."""
    __tablename__ = "content_resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="text")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    resource_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=dict)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    storage_backend: Mapped[str] = mapped_column(String(50), nullable=False, default="database")
    object_storage_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    object_storage_bucket: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    embedding_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    embedding_last_processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

class CbtModule(Base):
    """Cognitive Behavioral Therapy modules."""
    __tablename__ = "cbt_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    steps: Mapped[List["CbtModuleStep"]] = relationship("CbtModuleStep", back_populates="module", cascade="all, delete-orphan")

class CbtModuleStep(Base):
    """Individual steps within CBT modules."""
    __tablename__ = "cbt_module_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    module_id: Mapped[int] = mapped_column(Integer, ForeignKey("cbt_modules.id"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    user_input_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_input_variable: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    feedback_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tool_to_run: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_skippable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delay_after_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("cbt_module_steps.id"), nullable=True)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    module: Mapped["CbtModule"] = relationship("CbtModule", back_populates="steps")
    parent: Mapped[Optional["CbtModuleStep"]] = relationship("CbtModuleStep", remote_side=[id], back_populates="children")
    children: Mapped[List["CbtModuleStep"]] = relationship("CbtModuleStep", back_populates="parent")