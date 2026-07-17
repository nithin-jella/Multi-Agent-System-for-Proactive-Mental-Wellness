from __future__ import annotations

import enum

from sqlalchemy import Column, DateTime, Enum, String
from sqlalchemy.sql import func

from app.database import Base


class AgentRoleEnum(str, enum.Enum):
    admin = "admin"
    counselor = "counselor"
    operator = "operator"
    student = "student"


class AgentUser(Base):
    __tablename__ = "agent_users"

    id = Column(String, primary_key=True)
    role = Column(Enum(AgentRoleEnum, name="agent_role_enum"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

