from __future__ import annotations

import asyncio
import hashlib
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redaction import prelog_redact
from app.database import AsyncSessionLocal
from app.models import (
    AgentMessage,
    AgentRun,
    AgentNameEnum,
    Case,
    CaseSeverityEnum,
    CaseStatusEnum,
    ConsentScopeEnum,
    Event,
    Message,
    MessageRoleEnum,
)


def _hash_identifier(value: Any) -> str:
    token = "anonymous" if value is None else str(value)
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _find_user_hash(run: AgentRun) -> str:
    for payload in (run.input_payload, run.output_payload):
        if isinstance(payload, Mapping):
            candidate = payload.get("user_hash")
            if isinstance(candidate, str) and candidate:
                return candidate
    return _hash_identifier(run.triggered_by_user_id)


def _derive_intent(payload: Optional[Mapping[str, Any]]) -> Optional[str]:
    if not isinstance(payload, Mapping):
        return None
    for key in ("intent", "classification", "category"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _derive_session_id(run: AgentRun) -> Optional[str]:
    for payload in (run.input_payload, run.output_payload):
        if isinstance(payload, Mapping):
            candidate = payload.get("session_id") or payload.get("conversation_id")
            if isinstance(candidate, str) and candidate:
                return candidate
    return run.correlation_id


def _derive_risk_flag(payload: Optional[Mapping[str, Any]]) -> Optional[int]:
    if not isinstance(payload, Mapping):
        return None
    value = payload.get("risk") or payload.get("risk_level")
    if isinstance(value, int):
        return max(0, min(3, value))
    if isinstance(value, str) and value.isdigit():
        return max(0, min(3, int(value)))
    return None


def _derive_int_value(payload: Optional[Mapping[str, Any]], key: str) -> Optional[int]:
    if not isinstance(payload, Mapping):
        return None
    value = payload.get(key)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _map_role(role: str) -> MessageRoleEnum:
    mapping = {
        "user": MessageRoleEnum.user,
        "system": MessageRoleEnum.system,
        "assistant": MessageRoleEnum.assistant,
        "agent": MessageRoleEnum.assistant,
        "tool": MessageRoleEnum.assistant,
        "error": MessageRoleEnum.assistant,
    }
    return mapping.get(role.lower(), MessageRoleEnum.assistant)


def _infer_consent(run: AgentRun) -> Optional[ConsentScopeEnum]:
    for payload in (run.input_payload, run.output_payload):
        if isinstance(payload, Mapping):
            scope = payload.get("consent_scope")
            if isinstance(scope, str):
                try:
                    return ConsentScopeEnum(scope)
                except ValueError:
                    continue
    return None


def _build_case(run: AgentRun, user_hash: str) -> Optional[Case]:
    if run.agent_name.lower() != "triage":
        return None

    severity = CaseSeverityEnum.med
    payload = run.output_payload if isinstance(run.output_payload, Mapping) else {}
    raw_severity = payload.get("severity") or payload.get("risk_level")
    if isinstance(raw_severity, str):
        normalized = raw_severity.lower()
        severity_lookup = {
            "low": CaseSeverityEnum.low,
            "medium": CaseSeverityEnum.med,
            "med": CaseSeverityEnum.med,
            "high": CaseSeverityEnum.high,
            "critical": CaseSeverityEnum.critical,
        }
        severity = severity_lookup.get(normalized, severity)

    summary = payload.get("summary") if isinstance(payload, Mapping) else None

    return Case(
        created_at=run.started_at,
        updated_at=run.completed_at or run.started_at,
        status=CaseStatusEnum.new,
        severity=severity,
        assigned_to=None,
        user_hash=user_hash,
        session_id=_derive_session_id(run),
        summary_redacted=prelog_redact(summary),
        sla_breach_at=None,
        closure_reason=None,
    )


def _map_agent_name(agent_name: str) -> AgentNameEnum:
    alternatives = {
        "TRIAGE": AgentNameEnum.STA,
        "STA": AgentNameEnum.STA,
        "INTERVENTION": AgentNameEnum.TCA,
        "TCA": AgentNameEnum.TCA,
        "ANALYTICS": AgentNameEnum.IA,
        "IA": AgentNameEnum.IA,
        "SAFETY_DESK": AgentNameEnum.CMA,
        "CMA": AgentNameEnum.CMA,
    }
    return alternatives.get(agent_name.upper(), AgentNameEnum.STA)


async def _backfill_events(session: AsyncSession) -> int:
    runs: Iterable[AgentRun] = (await session.execute(select(AgentRun))).scalars().all()
    inserted = 0
    for run in runs:
        user_hash = _find_user_hash(run)
        consent = _infer_consent(run)
        latency_ms: Optional[int] = None
        if run.completed_at:
            latency_ms = int((run.completed_at - run.started_at).total_seconds() * 1000)

        event = Event(
            ts=run.completed_at or run.started_at,
            user_hash=user_hash,
            session_id=_derive_session_id(run),
            agent=_map_agent_name(run.agent_name),
            intent=_derive_intent(run.output_payload),
            risk_flag=_derive_risk_flag(run.output_payload),
            step=run.action,
            resource_id=None,
            latency_ms=latency_ms,
            tokens_in=_derive_int_value(run.input_payload, "tokens_in"),
            tokens_out=_derive_int_value(run.output_payload, "tokens_out"),
            cost_cents=_derive_int_value(run.output_payload, "cost_cents"),
            outcome=run.status,
            consent_scope=consent.value if consent else None,
        )
        session.add(event)
        inserted += 1

        case = _build_case(run, user_hash)
        if case:
            session.add(case)

    await session.commit()
    return inserted


async def _backfill_messages(session: AsyncSession) -> int:
    legacy_messages: Iterable[AgentMessage] = (await session.execute(select(AgentMessage))).scalars().all()
    inserted = 0
    for legacy in legacy_messages:
        trace_id = None
        if isinstance(legacy.meta, Mapping):
            trace_id = legacy.meta.get("trace_id")
        record = Message(
            session_id=str(legacy.run_id),
            role=_map_role(legacy.role),
            content_redacted=prelog_redact(legacy.content),
            tools_used=legacy.meta if isinstance(legacy.meta, Mapping) else None,
            trace_id=trace_id,
            ts=legacy.created_at,
        )
        session.add(record)
        inserted += 1
    await session.commit()
    return inserted


async def run_backfill() -> None:
    async with AsyncSessionLocal() as session:
        event_count = await _backfill_events(session)
        message_count = await _backfill_messages(session)
        print(f"Events inserted: {event_count}")
        print(f"Messages inserted: {message_count}")


if __name__ == "__main__":
    asyncio.run(run_backfill())

