from __future__ import annotations

import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class AutopilotActionType(str, enum.Enum):
    create_checkin = "create_checkin"
    create_case = "create_case"
    mint_badge = "mint_badge"
    publish_attestation = "publish_attestation"


class AutopilotPolicyDecision(str, enum.Enum):
    allow = "allow"
    require_approval = "require_approval"
    deny = "deny"


class AutopilotActionStatus(str, enum.Enum):
    queued = "queued"
    awaiting_approval = "awaiting_approval"
    approved = "approved"
    rejected = "rejected"
    running = "running"
    confirmed = "confirmed"
    failed = "failed"
    dead_letter = "dead_letter"


class AutopilotAction(Base):
    __tablename__ = "autopilot_actions"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_autopilot_actions_idempotency_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    action_type: Mapped[AutopilotActionType] = mapped_column(
        SAEnum(AutopilotActionType, name="autopilot_action_type", native_enum=False),
        nullable=False,
        index=True,
    )
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    policy_decision: Mapped[AutopilotPolicyDecision] = mapped_column(
        SAEnum(AutopilotPolicyDecision, name="autopilot_policy_decision", native_enum=False),
        nullable=False,
        index=True,
    )
    status: Mapped[AutopilotActionStatus] = mapped_column(
        SAEnum(AutopilotActionStatus, name="autopilot_action_status", native_enum=False),
        nullable=False,
        default=AutopilotActionStatus.queued,
        index=True,
    )

    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    requires_human_review: Mapped[bool] = mapped_column(nullable=False, default=False, index=True)
    approved_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approval_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tx_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    chain_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
