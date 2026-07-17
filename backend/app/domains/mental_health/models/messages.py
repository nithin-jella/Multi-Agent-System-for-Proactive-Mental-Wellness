from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.database.types import JSONBCompat


class MessageRoleEnum(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String, nullable=False, index=True)
    role = Column(Enum(MessageRoleEnum, name="message_role_enum"), nullable=False)
    content_redacted = Column(Text, nullable=False)
    tools_used = Column(JSONBCompat, nullable=True)
    trace_id = Column(String, nullable=True)
    ts = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("ix_messages_tools_used", tools_used, postgresql_using="gin"),
    )
