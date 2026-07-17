"""Conversation and session endpoints for the admin panel."""
from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.sta.conversation_analyzer import analyze_conversation_risk
from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.mental_health.models import Conversation
from app.domains.mental_health.models.assessments import ConversationRiskAssessment
from app.domains.mental_health.models.journal import JournalEntry
from app.domains.mental_health.services.affective_discordance import compute_affective_discordance
from app.domains.mental_health.services.conversation_assessments import (
    upsert_conversation_assessment,
)
from app.models import FlaggedSession, User  # Core models
from app.schemas.admin import (
    ConversationAssessmentTriggerRequest,
    ConversationDetailResponse,
    ConversationListItem,
    ConversationRiskAssessmentListResponse,
    ConversationRiskAssessmentResponse,
    ConversationStats,
    ConversationsResponse,
    SessionDetailResponse,
    SessionListItem,
    SessionListResponse,
    SessionUser,
)
from .utils import decrypt_user_email, hash_user_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Conversations"])


async def _resolve_user_ids_for_hash(
    db: AsyncSession,
    user_id_hash: Optional[str],
) -> Optional[list[int]]:
    """Resolve hashed user identifier into concrete user IDs.

    The hash is privacy-preserving and non-reversible, so we match by hashing the
    set of distinct conversation user IDs and returning those that match.
    """
    if not user_id_hash:
        return None

    normalized_hash = user_id_hash.strip()
    if not normalized_hash:
        return None

    user_ids = (
        await db.execute(select(func.distinct(Conversation.user_id)).where(Conversation.user_id.isnot(None)))
    ).scalars().all()

    matched_ids = [
        int(uid)
        for uid in user_ids
        if uid is not None and hash_user_id(int(uid)) == normalized_hash
    ]
    return matched_ids


async def _fetch_latest_journal_entry(
    db: AsyncSession,
    user_id: Optional[int],
) -> Optional[JournalEntry]:
    if user_id is None:
        return None
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.user_id == user_id)
        .order_by(desc(JournalEntry.entry_date), desc(JournalEntry.created_at))
        .limit(1)
    )
    return result.scalars().first()


def _build_assessment_response(
    record: ConversationRiskAssessment,
    latest_journal: Optional[JournalEntry],
) -> ConversationRiskAssessmentResponse:
    discordance = compute_affective_discordance(
        journal_valence=latest_journal.valence if latest_journal else None,
        journal_arousal=latest_journal.arousal if latest_journal else None,
        assessment_pleasure=record.pleasure,
        assessment_arousal=record.arousal,
    )

    return ConversationRiskAssessmentResponse(
        id=record.id,
        conversation_id=record.conversation_id,
        session_id=record.session_id,
        user_id=record.user_id,
        overall_risk_level=record.overall_risk_level,
        risk_trend=record.risk_trend,
        conversation_summary=record.conversation_summary,
        user_context=record.user_context,
        protective_factors=record.protective_factors,
        concerns=record.concerns,
        recommended_actions=record.recommended_actions,
        should_invoke_cma=record.should_invoke_cma,
        reasoning=record.reasoning,
        pleasure=record.pleasure,
        arousal=record.arousal,
        dominance=record.dominance,
        journal_valence=latest_journal.valence if latest_journal else None,
        journal_arousal=latest_journal.arousal if latest_journal else None,
        journal_inferred_dominance=latest_journal.inferred_dominance if latest_journal else None,
        discordance_score=discordance.score,
        discordance_level=discordance.level,
        discordance_reason=discordance.reason,
        message_count=record.message_count,
        conversation_duration_seconds=record.conversation_duration_seconds,
        analysis_timestamp=record.analysis_timestamp,
        raw_assessment=record.raw_assessment,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("/conversations", response_model=ConversationsResponse)
async def get_conversations(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in message or response content"),
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    date_from: Optional[date] = Query(None, description="Filter conversations from this date"),
    date_to: Optional[date] = Query(None, description="Filter conversations to this date"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationsResponse:
    """List conversations with pagination and privacy-preserving fields."""
    logger.info(
        "Admin %s requesting conversations list (page=%s, limit=%s)",
        admin_user.id,
        page,
        limit,
    )

    query = select(Conversation).order_by(desc(Conversation.timestamp))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Conversation.message.ilike(pattern),
                Conversation.response.ilike(pattern),
            )
        )

    if session_id:
        query = query.filter(Conversation.session_id == session_id)

    if date_from:
        query = query.filter(func.date(Conversation.timestamp) >= date_from)

    if date_to:
        query = query.filter(func.date(Conversation.timestamp) <= date_to)

    total_count = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    offset = (page - 1) * limit
    conversations = (
        await db.execute(query.offset(offset).limit(limit))
    ).scalars().all()

    session_counts: Dict[str, int] = {}
    last_role: Dict[str, str] = {}
    last_text: Dict[str, str] = {}

    if conversations:
        session_ids = list({conv.session_id for conv in conversations})
        session_count_query = (
            select(Conversation.session_id, func.count(Conversation.id))
            .filter(Conversation.session_id.in_(session_ids))
            .group_by(Conversation.session_id)
        )
        session_counts = {
            sid: cnt for sid, cnt in await db.execute(session_count_query)
        }

        last_subq = (
            select(
                Conversation.session_id.label("sid"),
                func.max(Conversation.timestamp).label("max_ts"),
            )
            .filter(Conversation.session_id.in_(session_ids))
            .group_by(Conversation.session_id)
            .subquery()
        )
        role_expr = case((Conversation.response.isnot(None), "assistant"), else_="user")
        last_rows = await db.execute(
            select(
                Conversation.session_id,
                Conversation.message,
                Conversation.response,
                role_expr,
            ).join(
                last_subq,
                (Conversation.session_id == last_subq.c.sid)
                & (Conversation.timestamp == last_subq.c.max_ts),
            )
        )
        for sid, msg, resp, role in last_rows.all():
            last_text[str(sid)] = resp or msg or ""
            last_role[str(sid)] = role

    conversation_items = [
        ConversationListItem(
            id=conv.id,
            user_id_hash=hash_user_id(conv.user_id),
            session_id=conv.session_id,
            conversation_id=conv.conversation_id,
            message_preview=(conv.message or "")[:100],
            response_preview=(conv.response or "")[:100],
            timestamp=conv.timestamp,
            message_length=len(conv.message or ""),
            response_length=len(conv.response or ""),
            session_message_count=int(session_counts.get(conv.session_id, 1)),
            last_role=last_role.get(conv.session_id),
            last_text=last_text.get(conv.session_id),
        )
        for conv in conversations
    ]

    total_conversations = (
        await db.execute(select(func.count(Conversation.id)))
    ).scalar() or 0
    total_sessions = (
        await db.execute(select(func.count(func.distinct(Conversation.session_id))))
    ).scalar() or 0
    total_users_with_conversations = (
        await db.execute(select(func.count(func.distinct(Conversation.user_id))))
    ).scalar() or 0

    avg_stats = (
        await db.execute(
            select(
                func.avg(func.length(Conversation.message)).label("avg_message_length"),
                func.avg(func.length(Conversation.response)).label("avg_response_length"),
            )
        )
    ).first()

    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    conversations_today = (
        await db.execute(
            select(func.count(Conversation.id)).filter(
                func.date(Conversation.timestamp) == today
            )
        )
    ).scalar() or 0
    conversations_this_week = (
        await db.execute(
            select(func.count(Conversation.id)).filter(
                func.date(Conversation.timestamp) >= week_ago
            )
        )
    ).scalar() or 0

    hour_stats = (
        await db.execute(
            select(
                func.extract("hour", Conversation.timestamp).label("hour"),
                func.count(Conversation.id).label("count"),
            ).group_by("hour")
        )
    ).all()
    most_active_hour = int(max(hour_stats, key=lambda x: x[1])[0]) if hour_stats else 0

    session_counts_subq = (
        select(Conversation.session_id, func.count(Conversation.id).label("count"))
        .group_by(Conversation.session_id)
        .subquery()
    )
    session_stats = (
        await db.execute(
            select(func.avg(session_counts_subq.c.count).label("avg_messages_per_session"))
        )
    ).first()

    stats = ConversationStats(
        total_conversations=total_conversations,
        total_sessions=total_sessions,
        total_users_with_conversations=total_users_with_conversations,
        avg_messages_per_session=
            float(session_stats.avg_messages_per_session) if session_stats and session_stats.avg_messages_per_session else 0.0,
        avg_message_length=float(avg_stats.avg_message_length) if avg_stats and avg_stats.avg_message_length else 0.0,
        avg_response_length=float(avg_stats.avg_response_length) if avg_stats and avg_stats.avg_response_length else 0.0,
        conversations_today=conversations_today,
        conversations_this_week=conversations_this_week,
        most_active_hour=most_active_hour,
    )

    return ConversationsResponse(conversations=conversation_items, total_count=total_count, stats=stats)


@router.get("/conversations/summary", response_model=ConversationStats)
async def get_conversations_summary(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationStats:
    """Return aggregate conversation stats for dashboards."""
    total_conversations = (
        await db.execute(select(func.count(Conversation.id)))
    ).scalar() or 0
    total_sessions = (
        await db.execute(select(func.count(func.distinct(Conversation.session_id))))
    ).scalar() or 0
    total_users_with_conversations = (
        await db.execute(select(func.count(func.distinct(Conversation.user_id))))
    ).scalar() or 0

    avg_stats = (
        await db.execute(
            select(
                func.avg(func.length(Conversation.message)).label("avg_message_length"),
                func.avg(func.length(Conversation.response)).label("avg_response_length"),
            )
        )
    ).first()

    session_counts_subq = (
        select(Conversation.session_id, func.count(Conversation.id).label("count"))
        .group_by(Conversation.session_id)
        .subquery()
    )
    session_stats = (
        await db.execute(
            select(func.avg(session_counts_subq.c.count).label("avg_messages_per_session"))
        )
    ).first()

    today = datetime.now().date()
    week_ago = today - timedelta(days=7)

    conversations_today = (
        await db.execute(
            select(func.count(Conversation.id)).filter(
                func.date(Conversation.timestamp) == today
            )
        )
    ).scalar() or 0
    conversations_this_week = (
        await db.execute(
            select(func.count(Conversation.id)).filter(
                func.date(Conversation.timestamp) >= week_ago
            )
        )
    ).scalar() or 0

    hour_stats = (
        await db.execute(
            select(
                func.extract("hour", Conversation.timestamp).label("hour"),
                func.count(Conversation.id).label("count"),
            ).group_by("hour")
        )
    ).all()
    most_active_hour = int(max(hour_stats, key=lambda x: x[1])[0]) if hour_stats else 0

    return ConversationStats(
        total_conversations=total_conversations,
        total_sessions=total_sessions,
        total_users_with_conversations=total_users_with_conversations,
        avg_messages_per_session=
            float(session_stats.avg_messages_per_session) if session_stats and session_stats.avg_messages_per_session else 0.0,
        avg_message_length=float(avg_stats.avg_message_length) if avg_stats and avg_stats.avg_message_length else 0.0,
        avg_response_length=float(avg_stats.avg_response_length) if avg_stats and avg_stats.avg_response_length else 0.0,
        conversations_today=conversations_today,
        conversations_this_week=conversations_this_week,
        most_active_hour=most_active_hour,
    )


@router.get("/conversation-assessments", response_model=ConversationRiskAssessmentListResponse)
async def list_conversation_assessments(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session_id: Optional[str] = Query(None, description="Filter by session id"),
    conversation_id: Optional[str] = Query(None, description="Filter by conversation id"),
    user_id: Optional[int] = Query(None, description="Filter by user id"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationRiskAssessmentListResponse:
    """List stored STA conversation-level assessments with optional filters."""

    filters = []
    if conversation_id:
        filters.append(ConversationRiskAssessment.conversation_id == conversation_id)
    if session_id:
        filters.append(ConversationRiskAssessment.session_id == session_id)
    if user_id:
        filters.append(ConversationRiskAssessment.user_id == user_id)

    base_query = select(ConversationRiskAssessment)
    count_query = select(func.count(ConversationRiskAssessment.id))
    if filters:
        base_query = base_query.where(*filters)
        count_query = count_query.where(*filters)

    total_count = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit

    records = (
        await db.execute(
            base_query
            .order_by(desc(ConversationRiskAssessment.analysis_timestamp))
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    enriched_records: List[ConversationRiskAssessmentResponse] = []
    for record in records:
        latest_journal = await _fetch_latest_journal_entry(db, record.user_id)
        enriched_records.append(_build_assessment_response(record, latest_journal))

    return ConversationRiskAssessmentListResponse(assessments=enriched_records, total_count=total_count)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation_detail(
    conversation_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationDetailResponse:
    """Detailed information for a single conversation."""
    conversation = await db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    sentiment_score = None
    try:
        pos_words = {"good", "great", "happy", "calm", "relief", "thanks", "helpful", "better", "improve", "manage"}
        neg_words = {"bad", "sad", "anxious", "anxiety", "panic", "stress", "stressed", "overwhelmed", "angry", "depress", "hopeless"}
        tokens = re.findall(r"[a-zà-öø-ÿ\-']+", f"{conversation.message or ''} {conversation.response or ''}".lower())
        pos = sum(1 for t in tokens if t in pos_words)
        neg = sum(1 for t in tokens if t in neg_words)
        total = pos + neg
        sentiment_score = (pos - neg) / total if total else None
    except Exception:  # pragma: no cover
        sentiment_score = None

    return ConversationDetailResponse(
        id=conversation.id,
        user_id_hash=hash_user_id(conversation.user_id),
        session_id=conversation.session_id,
        conversation_id=conversation.conversation_id,
        message=conversation.message or "",
        response=conversation.response or "",
        timestamp=conversation.timestamp,
        sentiment_score=sentiment_score,
    )


@router.get(
    "/conversation-assessments/{conversation_id}",
    response_model=ConversationRiskAssessmentResponse,
)
async def get_conversation_assessment(
    conversation_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationRiskAssessmentResponse:
    """Return the most recent STA conversation assessment for a conversation."""

    record = (
        await db.execute(
            select(ConversationRiskAssessment)
            .where(ConversationRiskAssessment.conversation_id == conversation_id)
            .order_by(desc(ConversationRiskAssessment.analysis_timestamp))
        )
    ).scalars().first()

    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found")

    latest_journal = await _fetch_latest_journal_entry(db, record.user_id)
    return _build_assessment_response(record, latest_journal)


@router.post(
    "/conversation-assessments/{conversation_id}/trigger",
    response_model=ConversationRiskAssessmentResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_conversation_assessment(
    conversation_id: str,
    payload: ConversationAssessmentTriggerRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ConversationRiskAssessmentResponse:
    """Run STA analysis manually for a conversation and persist the result."""

    if not payload.force_refresh:
        existing = (
            await db.execute(
                select(ConversationRiskAssessment)
                .where(ConversationRiskAssessment.conversation_id == conversation_id)
                .order_by(desc(ConversationRiskAssessment.analysis_timestamp))
            )
        ).scalars().first()
        if existing:
            logger.info(
                "Admin %s requested STA assessment for %s; returning cached record %s",
                admin_user.id,
                conversation_id,
                existing.id,
            )
            latest_journal = await _fetch_latest_journal_entry(db, existing.user_id)
            return _build_assessment_response(existing, latest_journal)

    conversations = (
        await db.execute(
            select(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .order_by(asc(Conversation.timestamp))
        )
    ).scalars().all()

    if not conversations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation history not found")

    history: List[Dict[str, str]] = []
    for conv in conversations:
        history.append({"role": "user", "content": conv.message})
        history.append({"role": "assistant", "content": conv.response})

    last_user_idx = next((idx for idx in range(len(history) - 1, -1, -1) if history[idx]["role"] == "user"), None)
    if last_user_idx is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Conversation has no user messages")

    current_message = history[last_user_idx]["content"]
    context_history = history[:last_user_idx]
    if not context_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation does not have enough turns prior to the closing message to run STA assessment",
        )

    sanitized_history = [{"role": entry["role"], "content": entry["content"]} for entry in context_history]
    conversation_start = conversations[0].timestamp.timestamp() if conversations[0].timestamp else None

    try:
        assessment = await analyze_conversation_risk(
            conversation_history=sanitized_history,
            current_message=current_message,
            user_context={},
            conversation_start_time=conversation_start,
            preferred_model=payload.preferred_model,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"STA assessment failed: {exc}",
        ) from exc

    record = await upsert_conversation_assessment(
        db,
        conversation_id=conversation_id,
        session_id=conversations[0].session_id,
        user_id=conversations[0].user_id,
        assessment=assessment,
        force_refresh=True,
    )

    logger.info(
        "Admin %s stored STA conversation assessment %s for conversation %s",
        admin_user.id,
        record.id,
        conversation_id,
    )

    latest_journal = await _fetch_latest_journal_entry(db, record.user_id)
    return _build_assessment_response(record, latest_journal)


@router.get("/conversation-session/{session_id}", response_model=SessionDetailResponse)
async def get_conversation_session_detail(
    session_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SessionDetailResponse:
    """Detailed information for a conversation session."""
    conversations = (
        await db.execute(
            select(Conversation).filter(Conversation.session_id == session_id).order_by(asc(Conversation.timestamp))
        )
    ).scalars().all()
    if not conversations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    first_conv, last_conv = conversations[0], conversations[-1]
    user_id = first_conv.user_id

    duration_minutes = 0.0
    if len(conversations) > 1 and first_conv.timestamp and last_conv.timestamp:
        duration = last_conv.timestamp - first_conv.timestamp
        duration_minutes = duration.total_seconds() / 60

    details = []
    for conv in conversations:
        sentiment_score = None
        try:
            text = f"{conv.message or ''} {conv.response or ''}".lower()
            tokens = re.findall(r"[a-zà-öø-ÿ\-']+", text)
            pos_words = {"good", "great", "happy", "calm", "relief", "thanks", "helpful", "better", "improve", "manage"}
            neg_words = {"bad", "sad", "anxious", "anxiety", "panic", "stress", "stressed", "overwhelmed", "angry", "depress", "hopeless"}
            pos = sum(1 for t in tokens if t in pos_words)
            neg = sum(1 for t in tokens if t in neg_words)
            total = pos + neg
            sentiment_score = (pos - neg) / total if total else None
        except Exception:  # pragma: no cover
            sentiment_score = None

        details.append(
            ConversationDetailResponse(
                id=conv.id,
                user_id_hash=hash_user_id(conv.user_id),
                session_id=conv.session_id,
                conversation_id=conv.conversation_id,
                message=conv.message or "",
                response=conv.response or "",
                timestamp=conv.timestamp,
                sentiment_score=sentiment_score,
            )
        )

    total_user_chars = sum(len(conv.message or "") for conv in conversations)
    total_ai_chars = sum(len(conv.response or "") for conv in conversations)
    msg_count = len(conversations)
    avg_user_len = total_user_chars / msg_count if msg_count else 0.0
    avg_ai_len = total_ai_chars / msg_count if msg_count else 0.0

    all_text = " ".join((conv.message or "") + " " + (conv.response or "") for conv in conversations)
    tokens = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ\-']{4,}", all_text.lower())
    freq: Dict[str, int] = {}
    for token in tokens:
        freq[token] = freq.get(token, 0) + 1
    top_keywords = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]

    analysis = {
        "message_pairs": msg_count,
        "total_user_chars": total_user_chars,
        "total_ai_chars": total_ai_chars,
        "avg_user_message_length": round(avg_user_len, 2),
        "avg_ai_message_length": round(avg_ai_len, 2),
        "top_keywords": top_keywords,
    }

    session_user: Optional[SessionUser] = None
    user_row = (
        await db.execute(
            select(
                User.id,
                User.email,
                User.role,
                User.is_active,
                User.created_at,
                User.last_login,
                User.sentiment_score,
            ).where(User.id == user_id)
        )
    ).first()
    if user_row:
        (
            user_row_id,
            user_row_email,
            user_row_role,
            user_row_is_active,
            user_row_created_at,
            user_row_last_login,
            user_row_sentiment_score,
        ) = user_row
        session_user = SessionUser(
            id=user_row_id,
            email=decrypt_user_email(user_row_email),
            role=user_row_role,
            is_active=user_row_is_active,
            created_at=user_row_created_at,
            last_login=user_row_last_login,
            sentiment_score=user_row_sentiment_score,
        )

    return SessionDetailResponse(
        session_id=session_id,
        user_id_hash=hash_user_id(user_id),
        user=session_user,
        conversation_count=len(conversations),
        first_message_time=first_conv.timestamp,
        last_message_time=last_conv.timestamp,
        total_duration_minutes=duration_minutes,
        conversations=details,
        analysis=analysis,
    )


@router.get("/conversation-sessions", response_model=SessionListResponse)
async def list_conversation_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session_search: Optional[str] = Query(None),
    user_id_hash: Optional[str] = Query(None, description="Filter by privacy-preserving user hash"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SessionListResponse:
    base = select(
        Conversation.session_id,
        func.count(Conversation.id).label("message_count"),
        func.min(Conversation.timestamp).label("first_time"),
        func.max(Conversation.timestamp).label("last_time"),
        func.max(Conversation.id).label("last_id"),
        func.max(Conversation.user_id).label("user_id"),
    )

    if session_search:
        base = base.filter(Conversation.session_id.ilike(f"%{session_search}%"))

    matched_user_ids = await _resolve_user_ids_for_hash(db, user_id_hash)
    if matched_user_ids is not None:
        if not matched_user_ids:
            return SessionListResponse(sessions=[], total_count=0)
        base = base.filter(Conversation.user_id.in_(matched_user_ids))

    if date_from:
        base = base.filter(func.date(Conversation.timestamp) >= date_from)
    if date_to:
        base = base.filter(func.date(Conversation.timestamp) <= date_to)

    base = base.group_by(Conversation.session_id)
    total_count = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

    offset = (page - 1) * limit
    rows = await db.execute(base.order_by(desc("last_time")).offset(offset).limit(limit))

    sessions = []
    open_flags_map: Dict[str, int] = {}

    session_rows = rows.all()
    if session_rows:
        session_ids = [row.session_id for row in session_rows]
        flags_q = (
            select(FlaggedSession.session_id, func.count(FlaggedSession.id))
            .filter(FlaggedSession.session_id.in_(session_ids), FlaggedSession.status == "open")
            .group_by(FlaggedSession.session_id)
        )
        open_flags_map = {sid: cnt for sid, cnt in await db.execute(flags_q)}

    # Load last message previews
    last_ids = [row.last_id for row in session_rows if row.last_id]
    last_messages_map: Dict[int, Conversation] = {}
    if last_ids:
        conv_rows = await db.execute(select(Conversation).filter(Conversation.id.in_(last_ids)))
        last_messages_map = {conv.id: conv for conv in conv_rows.scalars().all()}

    for row in session_rows:
        conv = last_messages_map.get(row.last_id)
        last_preview = ""
        last_role = None
        last_text = None
        if conv:
            last_preview = (conv.message or conv.response or "")[:200]
            last_role = "assistant" if conv.response else "user"
            last_text = conv.response or conv.message or ""

        sessions.append(
            SessionListItem(
                session_id=row.session_id,
                user_id_hash=hash_user_id(int(row.user_id)) if row.user_id is not None else "unknown",
                message_count=int(row.message_count or 0),
                first_time=row.first_time,
                last_time=row.last_time,
                last_preview=last_preview,
                last_role=last_role,
                last_text=last_text,
                open_flag_count=open_flags_map.get(row.session_id, 0),
            )
        )

    return SessionListResponse(sessions=sessions, total_count=total_count)


@router.get("/conversation-sessions/export.csv")
async def export_sessions_csv(
    user_id_hash: Optional[str] = Query(None, description="Optional user hash filter"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> Response:
    """Export all conversation sessions as CSV (lightweight)."""
    import csv
    from io import StringIO

    stmt = select(
        Conversation.session_id,
        Conversation.user_id,
        func.count(Conversation.id).label("message_count"),
        func.min(Conversation.timestamp).label("first_time"),
        func.max(Conversation.timestamp).label("last_time"),
    ).group_by(Conversation.session_id, Conversation.user_id)

    matched_user_ids = await _resolve_user_ids_for_hash(db, user_id_hash)
    if matched_user_ids is not None:
        if not matched_user_ids:
            headers = {"Content-Disposition": "attachment; filename=sessions.csv"}
            return Response(
                content="session_id,user_hash,message_count,first_time,last_time\n",
                media_type="text/csv",
                headers=headers,
            )
        stmt = stmt.filter(Conversation.user_id.in_(matched_user_ids))

    rows = await db.execute(stmt)

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["session_id", "user_hash", "message_count", "first_time", "last_time"])
    for sid, uid, cnt, first_t, last_t in rows.all():
        writer.writerow(
            [
                sid,
                hash_user_id(int(uid)) if uid is not None else "unknown",
                int(cnt),
                first_t.isoformat() if first_t else "",
                last_t.isoformat() if last_t else "",
            ]
        )

    buf.seek(0)
    headers = {"Content-Disposition": "attachment; filename=sessions.csv"}
    return Response(content=buf.getvalue(), media_type="text/csv", headers=headers)


@router.get("/conversation-session/{session_id}/export.csv")
async def export_session_csv(
    session_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> Response:
    """Export a single conversation session as CSV."""
    import csv
    from io import StringIO

    conversations = (
        await db.execute(
            select(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(asc(Conversation.timestamp))
        )
    ).scalars().all()
    if not conversations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "role", "text"])

    for conv in conversations:
        writer.writerow(
            [
                conv.timestamp.isoformat() if conv.timestamp else "",
                "assistant" if conv.response else "user",
                (conv.response or conv.message or "").replace("\n", " "),
            ]
        )

    buf.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=session_{session_id}.csv"}
    return Response(content=buf.getvalue(), media_type="text/csv", headers=headers)


@router.get("/conversation-session/{session_id}/export")
async def export_session_text(
    session_id: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> Response:
    """Export a session transcript as plain text."""
    conversations = (
        await db.execute(
            select(Conversation)
            .filter(Conversation.session_id == session_id)
            .order_by(asc(Conversation.timestamp))
        )
    ).scalars().all()
    if not conversations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    lines: List[str] = []
    for conv in conversations:
        ts = conv.timestamp.isoformat() if conv.timestamp else ""
        if conv.message:
            lines.append(f"[{ts}] USER: {conv.message}")
        if conv.response:
            lines.append(f"[{ts}] AI: {conv.response}")
        lines.append("")

    headers = {"Content-Disposition": f"attachment; filename=session_{session_id}.txt"}
    return Response(content="\n".join(lines), media_type="text/plain; charset=utf-8", headers=headers)


@router.get("/conversations/{conversation_id}/export")
async def export_conversation_turn(
    conversation_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> Response:
    """Export a single conversation exchange as plain text."""
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    ts = conv.timestamp.isoformat() if conv.timestamp else ""
    parts = []
    if conv.message:
        parts.append(f"[{ts}] USER: {conv.message}")
    if conv.response:
        parts.append(f"[{ts}] AI: {conv.response}")

    headers = {"Content-Disposition": f"attachment; filename=conversation_{conversation_id}.txt"}
    return Response(content="\n".join(parts) + "\n", media_type="text/plain; charset=utf-8", headers=headers)
