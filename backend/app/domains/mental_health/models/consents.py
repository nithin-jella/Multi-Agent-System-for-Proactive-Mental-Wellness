from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ConsentScopeEnum(str, enum.Enum):
    ops = "ops"
    followup = "followup"
    research = "research"


class Consent(Base):
    __tablename__ = "consents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subject_id = Column(String, nullable=False)
    scope = Column(Enum(ConsentScopeEnum, name="consent_scope_enum"), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    evidence_uri = Column(String, nullable=True)

    __table_args__ = (
        UniqueConstraint("subject_id", "scope", "revoked_at", name="uq_consents_active"),
    )
