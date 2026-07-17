from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.database import Base


class AgentDecisionEvent(Base):
    __tablename__ = "agent_decision_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    decision_source: Mapped[str] = mapped_column(String(32), nullable=False, index=True, default="aika_decision")
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    intent: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    next_step: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    needs_agents: Mapped[bool] = mapped_column(nullable=False, default=False, index=True)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="none", index=True)
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_decision_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    autopilot_action_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("autopilot_actions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    autopilot_action_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    autopilot_policy_decision: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    autopilot_requires_human_review: Mapped[bool] = mapped_column(nullable=False, default=False)

    attestation_record_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("attestation_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
