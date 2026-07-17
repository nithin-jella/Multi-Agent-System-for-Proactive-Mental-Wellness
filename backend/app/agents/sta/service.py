from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime
import hashlib
import math
from time import perf_counter
from typing import Any, Mapping, Optional

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sta.classifiers import SafetyTriageClassifier
from app.agents.sta.schemas import STAClassifyRequest, STAClassifyResponse
from app.agents.sta.gemini_classifier import GeminiSTAClassifier
from app.core.events import AgentEvent, AgentNameEnum, emit_agent_event
from app.core.redaction import extract_pii, prelog_redact
from app.database import get_async_db
from app.domains.mental_health.models import Case, CaseSeverityEnum, CaseStatusEnum, TriageAssessment
from app.domains.mental_health.services.agent_orchestrator import AgentOrchestrator
import logging

logger = logging.getLogger(__name__)

Severity = str
Recommendation = str

_SEVERITY_MAP: dict[int, Severity] = {
    0: "low",
    1: "moderate",
    2: "high",
    3: "critical",
}

_RECOMMENDATION_MAP: dict[str, Recommendation] = {
    "human": "escalate_manual_review",
    "tca": "schedule_therapeutic_coach",
    "resource": "deliver_self_help_pack",
}


class SafetyTriageService:
    """End-to-end Safety Triage service coordinating classification, storage, and telemetry."""

    def __init__(
        self,
        classifier: SafetyTriageClassifier,
        session: AsyncSession,
        orchestrator: AgentOrchestrator | None = None,
        event_emitter: Callable[[AgentEvent], Awaitable[None]] = emit_agent_event,
    ) -> None:
        self._classifier = classifier
        self._session = session
        self._orchestrator = orchestrator
        self._emit_event = event_emitter

    async def classify(self, payload: STAClassifyRequest) -> STAClassifyResponse:
        start = perf_counter()
        result = await self._classifier.classify(payload)
        processing_ms = int(math.floor((perf_counter() - start) * 1000))

        severity = _SEVERITY_MAP.get(result.risk_level, "low")
        recommendation = _RECOMMENDATION_MAP.get(result.next_step, "deliver_self_help_pack")
        confidence = self._estimate_confidence(result)
        risk_factors = self._build_risk_factors(payload.text, result.diagnostic_notes)

        meta = payload.meta or {}
        user_id = self._coerce_int(meta.get("user_id"))
        conversation_id = self._coerce_int(meta.get("conversation_id"))
        user_hash = self._resolve_user_hash(meta, user_id, payload.session_id)

        assessment = TriageAssessment(
            conversation_id=conversation_id,
            user_id=user_id,
            risk_score=self._normalize_risk(result.risk_level),
            confidence_score=confidence,
            severity_level=severity,
            risk_factors=risk_factors or None,
            recommended_action=recommendation,
            assessment_data={
                "intent": result.intent,
                "next_step": result.next_step,
                "diagnostic_notes": result.diagnostic_notes,
                "meta": meta,
            },
            processing_time_ms=processing_ms if processing_ms >= 0 else None,
        )

        try:
            self._session.add(assessment)
            # Use orchestrator for case creation if high/critical severity
            if self._orchestrator and severity in ('high', 'critical'):
                await self._session.flush()  # Ensure assessment has an ID
                # Ensure user_hash is not None before passing
                if user_hash is None:
                    logger.error("❌ user_hash is None, cannot proceed with orchestrator")
                    raise ValueError("user_hash cannot be None for high/critical severity")
                await self._orchestrator.handle_sta_classification(
                    triage_assessment=assessment,
                    user_hash=user_hash,
                    session_id=payload.session_id,
                    conversation_id=conversation_id
                )
            else:
                # Fallback to old behavior for backward compatibility
                await self._maybe_create_case(
                    user_hash=user_hash,
                    session_id=payload.session_id,
                    text=payload.text,
                    severity=severity,
                    should_handoff=result.handoff,
                )
            await self._session.commit()
            await self._session.refresh(assessment)
        except Exception:
            await self._session.rollback()
            raise

        # TODO: Event emission disabled due to schema mismatch between Event model and database
        # The events table in DB has: id, agent, event_type, user_id, conversation_id, metadata, created_at, updated_at
        # The Event model expects: id, created_at, user_hash, session_id, agent, intent, risk_flag, step, etc.
        # This needs to be resolved by either:
        # 1. Updating the Event model to match the database schema, OR
        # 2. Creating a migration to alter the events table to match the model
        # For now, event emission is disabled to allow STA classification to work
        # await self._maybe_emit_event(
        #     payload=payload,
        #     result=result,
        #     user_hash=user_hash,
        #     recommendation=recommendation,
        #     assessment_id=assessment.id,
        #     processing_ms=processing_ms,
        # )

        return result

    async def _maybe_create_case(
        self,
        *,
        user_hash: Optional[str],
        session_id: Optional[str],
        text: str,
        severity: Severity,
        should_handoff: bool,
    ) -> None:
        if not should_handoff or not user_hash:
            return

        existing_case = await self._session.execute(
            select(Case)
            .where(Case.user_hash == user_hash)
            .where(Case.status != CaseStatusEnum.closed)
            .where(Case.session_id == session_id)
        )
        if existing_case.scalar_one_or_none():
            return

        case = Case(
            status=CaseStatusEnum.new,
            severity=self._map_case_severity(severity),
            assigned_to=None,
            user_hash=user_hash,
            session_id=session_id,
            summary_redacted=prelog_redact(text),
        )
        self._session.add(case)
        await self._session.flush()  # Flush to get the case ID
        
        # Emit event for case creation
        from app.services.event_bus import EventType, publish_event
        try:
            await publish_event(
                event_type=EventType.CASE_CREATED,
                source_agent="sta",
                data={
                    "case_id": str(case.id),
                    "severity": severity,
                    "title": f"New {severity.capitalize()} Case Created",
                    "user_hash": user_hash,
                    "session_id": session_id,
                }
            )
        except Exception as e:
            # Log but don't fail the case creation
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to emit CASE_CREATED event: {e}", exc_info=True)

    async def _maybe_emit_event(
        self,
        *,
        payload: STAClassifyRequest,
        result: STAClassifyResponse,
        user_hash: Optional[str],
        recommendation: str,
        assessment_id: Optional[int],
        processing_ms: int,
    ) -> None:
        if not user_hash:
            return

        event_payload: Mapping[str, Any] = {
            "user_hash": user_hash,
            "session_id": payload.session_id,
            "intent": result.intent,
            "risk_flag": result.risk_level,
            "recommended_action": recommendation,
            "assessment_id": assessment_id,
            "latency_ms": processing_ms,
        }
        event = AgentEvent(
            agent=AgentNameEnum.STA,
            step="classify",
            payload=event_payload,
            ts=datetime.utcnow(),
        )
        await self._emit_event(event)

    @staticmethod
    def _normalize_risk(level: int) -> float:
        return round(max(0.0, min(level / 3.0, 1.0)), 4)

    @staticmethod
    def _estimate_confidence(result: STAClassifyResponse) -> float:
        base = 0.55 + (0.1 * max(0, min(result.risk_level, 3)))
        if result.diagnostic_notes:
            base += 0.05
        return round(min(base, 0.95), 4)

    @staticmethod
    def _build_risk_factors(text: str, diagnostic_notes: Optional[str]) -> list[str]:
        factors: list[str] = []
        if diagnostic_notes:
            factors.append(diagnostic_notes)
        pii = extract_pii(text)
        for key, values in pii.items():
            factors.append(f"pii::{key}:{len(values)}")
        return factors

    @staticmethod
    def _coerce_int(value: Any) -> Optional[int]:
        """Convert value to int, returning None for invalid FK values (0, negative, non-int)."""
        if value is None:
            return None
        try:
            result = int(value)
            # Reject 0 and negative numbers (invalid FK references)
            if result <= 0:
                return None
            return result
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _resolve_user_hash(meta: Mapping[str, Any], user_id: Optional[int], fallback: Optional[str]) -> Optional[str]:
        hash_candidate = meta.get("user_hash") if meta else None
        if isinstance(hash_candidate, str) and hash_candidate:
            return hash_candidate
        if user_id is not None:
            return hashlib.sha256(f"user:{user_id}".encode("utf-8")).hexdigest()[:16]
        if fallback:
            return hashlib.sha256(f"session:{fallback}".encode("utf-8")).hexdigest()[:16]
        return None

    @staticmethod
    def _map_case_severity(severity: Severity) -> CaseSeverityEnum:
        level = severity.lower()
        if level == "critical":
            return CaseSeverityEnum.critical
        if level == "high":
            return CaseSeverityEnum.high
        if level == "moderate":
            return CaseSeverityEnum.med
        return CaseSeverityEnum.low


def get_safety_triage_service(
    session: AsyncSession = Depends(get_async_db),
) -> "SafetyTriageService":
    """FastAPI dependency factory for :class:`SafetyTriageService`.
    
    Uses Gemini-based classifier with efficient tiered assessment:
    1. Rule-based pre-screening (instant) - catches obvious cases
    2. Gemini assessment (as-needed) - for nuanced analysis  
    3. Conversation caching (future) - reduces redundant calls
    
    Why Gemini-based?
    - No ML dependencies (PyTorch/ONNX removed)
    - Better semantic understanding with context
    - Explainable chain-of-thought reasoning
    - Efficient with smart triggering (75% fewer API calls)
    - Culturally aware (Indonesian context)
    
    Performance:
    - Rule-based path: 0-5ms (crisis keywords)
    - Gemini path: 200-500ms (ambiguous cases)
    - Average: ~100ms (most messages skip Gemini)
    
    Returns SafetyTriageService with Gemini classifier.
    """
    
    try:
        # Use Gemini-based classifier (no ML dependencies)
        classifier = GeminiSTAClassifier()
        
        if not classifier.is_available():
            raise RuntimeError("Gemini classifier not available")
        
        logger.info("🤖 Using Gemini-based STA classifier (efficient tiered approach)")
        
    except Exception as e:
        # Fallback to pure rule-based if Gemini fails
        logger.warning(f"Gemini classifier unavailable, falling back to rule-based: {e}")
        classifier = SafetyTriageClassifier()  # type: ignore
        logger.info("📋 Using rule-based classifier (keyword patterns)")
    
    # Initialize orchestrator for this request
    orchestrator = AgentOrchestrator(session)
    return SafetyTriageService(
        classifier=classifier,  # type: ignore
        session=session,
        orchestrator=orchestrator
    )

