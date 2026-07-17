"""Journal and reflection models."""

from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Date, UniqueConstraint, Float
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime

if TYPE_CHECKING:
    from app.models.user import User

from app.models.user import User

class JournalPrompt(Base):
    """Journal writing prompts."""
    __tablename__ = "journal_prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class JournalEntry(Base):
    """User journal entries."""
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    entry_date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    prompt_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("journal_prompts.id"), nullable=True)
    mood: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # 1-5 scale (1: very negative, 5: very positive)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Unified Affective Framework (2.5D PAD Model)
    valence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    arousal: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    inferred_dominance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="journal_entries")
    prompt: Mapped["JournalPrompt"] = relationship("JournalPrompt")
    reflection_points: Mapped[List["JournalReflectionPoint"]] = relationship("JournalReflectionPoint", back_populates="journal_entry", cascade="all, delete-orphan")
    tags: Mapped[List["JournalTag"]] = relationship("JournalTag", back_populates="journal_entry", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint('user_id', 'entry_date', name='_user_entry_date_uc'),)

class JournalTag(Base):
    """Custom tags for journal entries."""
    __tablename__ = "journal_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    journal_entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("journal_entries.id"), nullable=False, index=True)
    tag_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="tags")

class JournalReflectionPoint(Base):
    """Reflection points within journal entries."""
    __tablename__ = "journal_reflection_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    journal_entry_id: Mapped[int] = mapped_column(Integer, ForeignKey("journal_entries.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reflection_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="reflection_points")
    user: Mapped["User"] = relationship("User")