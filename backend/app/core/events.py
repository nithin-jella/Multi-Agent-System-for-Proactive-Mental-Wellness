from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Optional, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redaction import prelog_redact
from app.database import AsyncSessionLocal
from app.domains.mental_health.models import (
    AgentNameEnum,
    Case,
    CaseSeverityEnum,
    CaseStatusEnum,
    Event,
    Message,
    MessageRoleEnum,
)


@dataclass()
class AgentEvent:
    agent: AgentNameEnum
    step: str
    payload: Mapping[str, Any]
    ts: datetime


@dataclass()
class AgentMessageRecord:
    session_id: str
    role: MessageRoleEnum
    content: str
    tools_used: Optional[Mapping[str, Any]] = None
    trace_id: Optional[str] = None
    ts: Optional[datetime] = None


@dataclass()
class SafetyCaseRecord:
    user_hash: str
    session_id: Optional[str]
    summary: Optional[str]
    severity: CaseSeverityEnum
    created_at: datetime
    assigned_to: Optional[str] = None


async def emit_agent_event(event: AgentEvent) -> None:
    async with AsyncSessionLocal() as session:
        # cast to give type-checkers the correct type without using an inline type comment
        session = cast(AsyncSession, session)
        record = Event(
            created_at=event.ts,
            user_hash=_require_user_hash(event.payload),
            session_id=event.payload.get("session_id"),
            agent=event.agent,
            intent=_coerce_optional_str(event.payload.get("intent"), max_len=128),
            risk_flag=_coerce_optional_int(event.payload.get("risk_flag")),
            step=event.step,
            resource_id=event.payload.get("resource_id"),
            trace_id=_coerce_optional_str(event.payload.get("trace_id"), max_len=128),
            latency_ms=_coerce_optional_int(event.payload.get("latency_ms")),
            tokens_in=_coerce_optional_int(event.payload.get("tokens_in")),
            tokens_out=_coerce_optional_int(event.payload.get("tokens_out")),
            cost_cents=_coerce_optional_int(event.payload.get("cost_cents")),
            outcome=_coerce_optional_str(event.payload.get("outcome"), max_len=512, redact=True),
            consent_scope=_coerce_optional_str(event.payload.get("consent_scope"), max_len=128),
        )
        session.add(record)
        await session.commit()


async def log_agent_message(record: AgentMessageRecord) -> None:
    async with AsyncSessionLocal() as session:
        session = cast(AsyncSession, session)
        message = Message(
            session_id=record.session_id,
            role=record.role,
            content_redacted=prelog_redact(record.content),
            tools_used=dict(record.tools_used) if record.tools_used else None,
            trace_id=record.trace_id,
            ts=record.ts or datetime.utcnow(),
        )
        session.add(message)
        await session.commit()


async def create_safety_case(case: SafetyCaseRecord) -> Case:
    async with AsyncSessionLocal() as session:
        session = cast(AsyncSession, session)
        db_case = Case(
            status=CaseStatusEnum.new,
            severity=case.severity,
            assigned_to=case.assigned_to,
            user_hash=case.user_hash,
            session_id=case.session_id,
            summary_redacted=prelog_redact(case.summary),
            created_at=case.created_at,
            updated_at=case.created_at,
        )
        session.add(db_case)
        await session.commit()
        await session.refresh(db_case)
        return db_case


def _require_user_hash(payload: Mapping[str, Any]) -> str:
    value = payload.get("user_hash")
    if value in (None, ""):
        raise ValueError("AgentEvent payload must include user_hash")
    return str(value)


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _coerce_optional_str(value: Any, *, max_len: int, redact: bool = False) -> Optional[str]:
    if value in (None, ""):
        return None
    text = str(value)
    if redact:
        text = prelog_redact(text)
    text = text.strip()
    if not text:
        return None
    if len(text) > max_len:
        return text[:max_len]
    return text
