from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Index,
    Float,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from sqlalchemy.ext.mutable import MutableDict

from app.database import Base


class QuestCategoryEnum(str, Enum):
    WELLNESS = "wellness"
    REFLECTION = "reflection"
    SOCIAL = "social"
    SUPPORT = "support"
    LEARNING = "learning"


class QuestDifficultyEnum(str, Enum):
    EASY = "easy"
    STANDARD = "standard"
    CHALLENGE = "challenge"


class QuestStatusEnum(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AttestationStatusEnum(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class QuestTemplate(Base):
    __tablename__ = "quest_templates"
    __table_args__ = (UniqueConstraint("code", name="uq_quest_templates_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_description: Mapped[str] = mapped_column(String(255), nullable=False)
    long_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[QuestCategoryEnum] = mapped_column(
        SqlEnum(QuestCategoryEnum, values_callable=lambda x: [e.value for e in x]), default=QuestCategoryEnum.WELLNESS, nullable=False
    )
    difficulty: Mapped[QuestDifficultyEnum] = mapped_column(
        SqlEnum(QuestDifficultyEnum, values_callable=lambda x: [e.value for e in x]), default=QuestDifficultyEnum.STANDARD, nullable=False
    )
    recommended_duration_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    base_xp: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    base_joy: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    base_harmony: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    extra_data: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)
    requires_counselor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    instances: Mapped["QuestInstance"] = relationship("QuestInstance", back_populates="template")


class QuestInstance(Base):
    __tablename__ = "quest_instances"
    __table_args__ = (
        Index("ix_quest_instances_user_status", "user_id", "status"),
        Index("ix_quest_instances_expires_at", "expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    template_id: Mapped[int] = mapped_column(ForeignKey("quest_templates.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[QuestStatusEnum] = mapped_column(
        SqlEnum(QuestStatusEnum, values_callable=lambda x: [e.value for e in x]), default=QuestStatusEnum.ACTIVE, nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completion_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    streak_snapshot: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compassion_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship("User")
    template: Mapped[QuestTemplate] = relationship("QuestTemplate", back_populates="instances")
    reward_entries: Mapped["RewardLedgerEntry"] = relationship(
        "RewardLedgerEntry", back_populates="quest_instance", cascade="all, delete-orphan"
    )

    @property
    def is_active(self) -> bool:
        return self.status == QuestStatusEnum.ACTIVE and self.expires_at >= datetime.utcnow()


class PlayerWellnessState(Base):
    __tablename__ = "player_wellness_state"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compassion_mode_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    compassion_activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    harmony_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    joy_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extra_data: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User")

    def register_completion(self, completed_at: datetime) -> None:
        if self.last_completed_at and (completed_at.date() == self.last_completed_at.date()):
            # already counted today
            return

        previous_completion = self.last_completed_at
        self.last_completed_at = completed_at

        if previous_completion and (completed_at.date() - previous_completion.date()).days == 1:
            self.current_streak += 1
        else:
            self.current_streak = 1

        if self.current_streak > self.longest_streak:
            self.longest_streak = self.current_streak

        self.compassion_mode_active = False
        self.compassion_activated_at = None


class RewardLedgerEntry(Base):
    __tablename__ = "reward_ledger_entries"
    __table_args__ = (
        UniqueConstraint("quest_instance_id", name="uq_reward_ledger_quest_instance"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quest_instance_id: Mapped[int] = mapped_column(
        ForeignKey("quest_instances.id", ondelete="CASCADE"), nullable=True, index=True
    )
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    joy_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    harmony_delta: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    care_pending: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extra_data: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    quest_instance: Mapped[Optional[QuestInstance]] = relationship("QuestInstance", back_populates="reward_entries")
    user: Mapped["User"] = relationship("User")


class AttestationRecord(Base):
    __tablename__ = "attestation_records"
    __table_args__ = (
        Index("ix_attestation_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quest_instance_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("quest_instances.id", ondelete="SET NULL"), nullable=True
    )
    counselor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    hashed_payload: Mapped[str] = mapped_column(String(256), nullable=False)
    status: Mapped[AttestationStatusEnum] = mapped_column(
        SqlEnum(AttestationStatusEnum, values_callable=lambda x: [e.value for e in x]), default=AttestationStatusEnum.PENDING, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra_data: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)

    quest_instance: Mapped[Optional[QuestInstance]] = relationship("QuestInstance")
    counselor: Mapped["User"] = relationship("User", foreign_keys=[counselor_id])


class ComplianceAuditLog(Base):
    __tablename__ = "compliance_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    extra_data: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    actor: Mapped[Optional["User"]] = relationship("User")


class QuestAnalyticsEvent(Base):
    __tablename__ = "quest_analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quest_instance_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("quest_instances.id", ondelete="SET NULL"), nullable=True, index=True
    )
    payload: Mapped[Dict[str, Any]] = mapped_column(MutableDict.as_mutable(JSON), default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User")
    quest_instance: Mapped[Optional[QuestInstance]] = relationship("QuestInstance")
