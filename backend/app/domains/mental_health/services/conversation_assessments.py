"""Helpers for persisting and retrieving STA conversation-level assessments."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sta.conversation_assessment import ConversationAssessment
from app.domains.mental_health.models.assessments import ConversationRiskAssessment
from app.domains.mental_health.models.conversations import Conversation


def _serialize_assessment(assessment: ConversationAssessment) -> dict:
    """Convert ConversationAssessment into ORM-friendly dict."""
    return {
        "overall_risk_level": assessment.overall_risk_level,
        "risk_trend": assessment.risk_trend,
        "conversation_summary": assessment.conversation_summary,
        "user_context": assessment.user_context or None,
        "protective_factors": assessment.protective_factors or None,
        "concerns": assessment.concerns or None,
        "recommended_actions": assessment.recommended_actions or None,
        "should_invoke_cma": assessment.should_invoke_cma,
        "reasoning": assessment.reasoning,
        "message_count": assessment.message_count_analyzed,
        "conversation_duration_seconds": assessment.conversation_duration_seconds,
        "analysis_timestamp": assessment.analysis_timestamp or datetime.utcnow(),
        "pleasure": assessment.pleasure,
        "arousal": assessment.arousal,
        "dominance": assessment.dominance,
        "raw_assessment": assessment.model_dump(mode='json'),
    }


async def upsert_conversation_assessment(
    db: AsyncSession,
    *,
    conversation_id: Optional[str],
    session_id: Optional[str],
    user_id: Optional[int],
    assessment: ConversationAssessment,
    force_refresh: bool = False,
) -> ConversationRiskAssessment:
    """Persist STA conversation-level assessment, updating existing record if present."""
    existing: Optional[ConversationRiskAssessment] = None
    if conversation_id and not force_refresh:
        result = await db.execute(
            select(ConversationRiskAssessment).where(
                ConversationRiskAssessment.conversation_id == conversation_id
            )
        )
        existing = result.scalars().first()

    data = _serialize_assessment(assessment)
    data.update(
        {
            "conversation_id": conversation_id,
            "session_id": session_id,
            "user_id": user_id,
            "updated_at": datetime.utcnow(),
        }
    )

    if existing:
        for field, value in data.items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return existing

    record = ConversationRiskAssessment(**data)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def fetch_conversation_history(
    db: AsyncSession,
    conversation_id: str,
    limit: Optional[int] = None,
) -> List[dict]:
    """Return ordered conversation history for given conversation_id as role/content pairs."""
    query = (
        select(Conversation)
        .where(Conversation.conversation_id == conversation_id)
        .order_by(Conversation.timestamp.asc())
    )
    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    conversation_rows: Iterable[Conversation] = result.scalars().all()

    history: List[dict] = []
    for row in conversation_rows:
        history.append({"role": "user", "content": row.message, "timestamp": row.timestamp})
        history.append({"role": "assistant", "content": row.response, "timestamp": row.timestamp})
    return history
