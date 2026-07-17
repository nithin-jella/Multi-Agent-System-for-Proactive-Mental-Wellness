"""Background tasks for the Aika orchestrator.

Functions here are fire-and-forget coroutines launched via
``asyncio.create_task()``.  They run after the user's response has been sent
and MUST NOT block the real-time request path.

All failures are caught and logged; they never propagate to the caller.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import AikaOrchestratorState

logger = logging.getLogger(__name__)


async def trigger_sta_conversation_analysis_background(
    state: AikaOrchestratorState,
    db: AsyncSession,
) -> None:
    """Analyse a finished conversation and persist the risk assessment.

    Runs as a background task (fire-and-forget) so it never blocks the
    response that was already delivered to the user.  Also updates the
    screening profile using dimensions extracted by the STA model, replacing
    a separate TCA pass to avoid redundant LLM calls.

    Args:
        state: A *copy* of the orchestrator state at conversation end.
        db:    Database session for persistence.
    """
    if state.get("sta_analysis_completed", False):
        logger.debug("STA analysis already completed for this conversation — skipping.")
        return

    conversation_id = state.get("conversation_id")
    user_id = state.get("user_id")

    try:
        from app.agents.sta.conversation_analyzer import analyze_conversation_risk
        from app.domains.mental_health.models.assessments import ConversationRiskAssessment
        from app.domains.mental_health.services.conversation_assessments import (
            upsert_conversation_assessment,
        )

        # Skip if an assessment already exists (idempotency guard).
        force_refresh = bool(state.get("force_sta_reanalysis", False))
        if conversation_id and not force_refresh:
            existing = (
                await db.execute(
                    select(ConversationRiskAssessment).where(
                        ConversationRiskAssessment.conversation_id == conversation_id
                    )
                )
            ).scalars().first()
            if existing:
                logger.info(
                    "STA assessment already exists for conversation %s (id=%s) — skipping.",
                    conversation_id,
                    existing.id,
                )
                return

        logger.info(
            "[BACKGROUND] Starting STA analysis: conversation_id=%s, user_id=%s",
            conversation_id,
            user_id,
        )

        from app.core.llm import DEFAULT_GEMINI_MODEL as _DEFAULT_MODEL

        conversation_start = state.get("started_at")
        start_ts = conversation_start.timestamp() if conversation_start else time.time()

        assessment = await analyze_conversation_risk(
            conversation_history=state.get("conversation_history", []),
            current_message=state.get("message", ""),
            user_context=state.get("personal_context") or {},
            conversation_start_time=start_ts,
            preferred_model=state.get("preferred_model") or _DEFAULT_MODEL,
        )

        if conversation_id:
            record = await upsert_conversation_assessment(
                db,
                conversation_id=conversation_id,
                session_id=state.get("session_id"),
                user_id=user_id,
                assessment=assessment,
                force_refresh=force_refresh,
            )
            logger.info(
                "[BACKGROUND] Assessment stored: id=%s, session_id=%s",
                record.id,
                record.session_id,
            )
        else:
            await db.flush()

        logger.info(
            "[BACKGROUND] STA complete — conversation=%s, user=%s, "
            "risk=%s, trend=%s, cma_recommended=%s, duration=%.0fs",
            conversation_id,
            user_id,
            assessment.overall_risk_level,
            assessment.risk_trend,
            assessment.should_invoke_cma,
            assessment.conversation_duration_seconds,
        )

        # ------------------------------------------------------------------
        # Screening profile update
        # Based on validated instruments: PHQ-9, GAD-7, DASS-21, PSQI,
        # UCLA-LS3, RSES, AUDIT, C-SSRS.
        # ------------------------------------------------------------------
        if user_id and assessment.screening:
            await _update_screening_profile_from_assessment(
                db=db,
                user_id=user_id,
                assessment=assessment,
                session_id=state.get("session_id"),
            )

        state["sta_analysis_completed"] = True
        state["conversation_assessment"] = assessment.model_dump()

        if assessment.should_invoke_cma:
            logger.warning(
                "[BACKGROUND] STA recommends CMA escalation for conversation %s: %.200s",
                conversation_id,
                assessment.reasoning,
            )

    except Exception as exc:
        logger.error("[BACKGROUND] STA analysis failed: %s", exc, exc_info=True)


async def _update_screening_profile_from_assessment(
    *,
    db: AsyncSession,
    user_id: int,
    assessment: Any,
    session_id: Any,
) -> None:
    """Map STA dimension scores onto the user's longitudinal screening profile.

    Extracted as a separate helper to keep ``trigger_sta_conversation_analysis_background``
    readable.  Failures are caught and logged without re-raising.
    """
    try:
        from app.domains.mental_health.screening import (
            ExtractionResult,
            update_screening_profile,
        )

        extraction = ExtractionResult()
        extraction.crisis_detected = assessment.crisis_detected
        extraction.confidence = 0.8  # High confidence — full conversation analysed.

        _DIMENSION_FIELDS = (
            "depression", "anxiety", "stress", "sleep",
            "social", "academic", "self_worth", "substance", "crisis",
        )

        for dim_name in _DIMENSION_FIELDS:
            dim_score = getattr(assessment.screening, dim_name, None)
            if dim_score is None:
                continue

            if dim_score.is_protective:
                extraction.protective_updates[dim_name] = dim_score.score
            else:
                extraction.dimension_updates[dim_name] = dim_score.score

            extraction.indicators_found.extend(
                {
                    "dimension": dim_name,
                    "weight": dim_score.score,
                    "is_protective": dim_score.is_protective,
                    "excerpt": evidence[:100],
                }
                for evidence in dim_score.evidence
            )

        if not (extraction.dimension_updates or extraction.protective_updates):
            logger.debug("[BACKGROUND] No screening indicators extracted for user %s.", user_id)
            return

        profile = await update_screening_profile(
            db=db,
            user_id=user_id,
            extraction_result=extraction,
            session_id=session_id,
            decay_factor=0.95,  # Slow decay for longitudinal tracking.
        )
        logger.info(
            "[BACKGROUND] Screening profile updated — user=%s, risk=%s, "
            "concerns=%s, requires_attention=%s",
            user_id,
            profile.overall_risk_level.value,
            profile.primary_concerns,
            profile.requires_attention,
        )

    except Exception as exc:
        logger.warning(
            "[BACKGROUND] Screening profile update failed (non-critical): %s", exc
        )
