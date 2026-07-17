"""
Conversation Tools - Chat History and Context Management

This module provides tools for accessing conversation history, summaries,
and message search capabilities. Used by all agents to understand context.

Tools:
- get_conversation_history: Get recent messages from a conversation
- get_conversation_summary: Get AI-generated summary of conversation
- search_conversations: Search across user's conversation history
- get_conversation_stats: Get conversation metrics (count, duration, etc.)

Privacy: Conversation data is SENSITIVE and requires consent.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy import select, desc, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User  # Core model
from app.domains.mental_health.models import Conversation
from app.agents.shared.tools.registry import register_tool

import logging

logger = logging.getLogger(__name__)

# Constants
MAX_MESSAGES = 50
MAX_CONVERSATIONS = 20
MAX_SEARCH_RESULTS = 20
MESSAGE_PREVIEW_LENGTH = 200


def _coerce_user_id(user_id: str) -> Optional[int]:
    try:
        return int(str(user_id).strip())
    except (TypeError, ValueError):
        return None


@register_tool(
    name="get_conversation_history",
    description="Get recent messages from a conversation in chronological order. Returns sender info and message content. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "conversation_id": {
                "type": "string",
                "description": "Conversation ID to retrieve messages from"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of messages to return (default 50, max 50)",
                "default": 50
            }
        },
        "required": ["conversation_id"]
    },
    category="conversation",
    requires_db=True,
    requires_user_id=False
)
async def get_conversation_history(
    db: AsyncSession,
    conversation_id: str,
    limit: int = MAX_MESSAGES,
    **kwargs
) -> Dict[str, Any]:
    """
    Get recent messages from a conversation.
    
    Returns messages in chronological order with sender info.
    SENSITIVE DATA - contains user messages.
    """
    try:
        if limit > MAX_MESSAGES:
            limit = MAX_MESSAGES
            
        # Query conversation turns by logical conversation_id
        query = (
            select(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .order_by(Conversation.timestamp.asc())
            .limit(limit)
        )

        result = await db.execute(query)
        turns = result.scalars().all()

        message_list = []
        for turn in turns:
            turn_ts = turn.timestamp.isoformat() if turn.timestamp else None
            message_list.append(
                {
                    "role": "user",
                    "content": turn.message,
                    "timestamp": turn_ts,
                    "session_id": turn.session_id,
                }
            )
            message_list.append(
                {
                    "role": "assistant",
                    "content": turn.response,
                    "timestamp": turn_ts,
                    "session_id": turn.session_id,
                }
            )

        conv_query = select(Conversation).where(Conversation.conversation_id == conversation_id).order_by(Conversation.timestamp.asc()).limit(1)
        conv_result = await db.execute(conv_query)
        conversation = conv_result.scalar_one_or_none()
        
        logger.info(f"✅ Retrieved {len(message_list)} messages from conversation {conversation_id}")
        
        return {
            "success": True,
            "conversation_id": conversation_id,
            "session_id": conversation.session_id if conversation else None,
            "total_messages": len(message_list),
            "messages": message_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting conversation history for {conversation_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "conversation_id": conversation_id
        }


@register_tool(
    name="get_conversation_summary",
    description="Get AI-generated summary of a conversation. Returns overview of conversation topics and key points. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "conversation_id": {
                "type": "string",
                "description": "Conversation ID to get summary for"
            }
        },
        "required": ["conversation_id"]
    },
    category="conversation",
    requires_db=True,
    requires_user_id=False
)
async def get_conversation_summary(
    db: AsyncSession,
    conversation_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Get AI-generated summary of a conversation.
    
    Returns summary stored in conversation metadata, or generates one
    from recent messages if not available.
    SENSITIVE DATA - conversation content.
    """
    try:
        # Get conversation turns
        query = (
            select(Conversation)
            .where(Conversation.conversation_id == conversation_id)
            .order_by(Conversation.timestamp.asc())
        )
        result = await db.execute(query)
        turns = result.scalars().all()
        
        if not turns:
            logger.warning(f"⚠️ Conversation {conversation_id} not found")
            return {
                "success": False,
                "error": f"Conversation {conversation_id} not found",
                "conversation_id": conversation_id
            }

        total_turns = len(turns)
        first_ts = turns[0].timestamp
        last_ts = turns[-1].timestamp
        latest_topic_hint = (turns[-1].message or "").strip()[:120]

        summary = (
            f"Conversation with {total_turns} turn(s). "
            f"Latest topic hint: {latest_topic_hint or 'n/a'}."
        )
        
        logger.info(f"✅ Retrieved summary for conversation {conversation_id}")
        
        return {
            "success": True,
            "conversation_id": conversation_id,
            "session_id": turns[0].session_id,
            "summary": summary,
            "created_at": first_ts.isoformat() if first_ts else None,
            "updated_at": last_ts.isoformat() if last_ts else None,
            "turn_count": total_turns,
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting conversation summary for {conversation_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "conversation_id": conversation_id
        }


@register_tool(
    name="search_conversations",
    description="Search across user's conversation history by keywords. Returns matching conversations with previews. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID to search conversations for"
            },
            "query": {
                "type": "string",
                "description": "Search query string to look for in messages"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results to return (default 20, max 20)",
                "default": 20
            }
        },
        "required": ["user_id", "query"]
    },
    category="conversation",
    requires_db=True,
    requires_user_id=False
)
async def search_conversations(
    db: AsyncSession,
    user_id: str,
    query: str,
    limit: int = MAX_SEARCH_RESULTS,
    **kwargs
) -> Dict[str, Any]:
    """
    Search across user's conversation history.
    
    Searches message content for keywords and returns matching conversations.
    SENSITIVE DATA - searches user messages.
    """
    try:
        if limit > MAX_SEARCH_RESULTS:
            limit = MAX_SEARCH_RESULTS
            
        normalized_user_id = _coerce_user_id(user_id)
        if normalized_user_id is None:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
                "query": query,
            }

        # Search conversation turns by content (case-insensitive)
        search_pattern = f"%{query}%"

        msg_query = (
            select(Conversation.conversation_id, func.count(Conversation.id).label("match_count"))
            .where(
                and_(
                    Conversation.user_id == normalized_user_id,
                    or_(
                        Conversation.message.ilike(search_pattern),
                        Conversation.response.ilike(search_pattern),
                    ),
                )
            )
            .group_by(Conversation.conversation_id)
            .order_by(desc("match_count"))
            .limit(limit)
        )
        
        result = await db.execute(msg_query)
        conversation_matches = result.all()
        
        search_results = []
        for conv_id, match_count in conversation_matches:
            # Get conversation details
            conv_query = (
                select(Conversation)
                .where(Conversation.conversation_id == conv_id)
                .order_by(desc(Conversation.timestamp))
                .limit(1)
            )
            conv_result = await db.execute(conv_query)
            conversation = conv_result.scalar_one_or_none()
            
            if conversation:
                preview_source = conversation.message or conversation.response or ""
                preview = preview_source[:MESSAGE_PREVIEW_LENGTH]
                if len(preview_source) > MESSAGE_PREVIEW_LENGTH:
                    preview += "..."
                
                search_results.append({
                    "conversation_id": str(conversation.conversation_id),
                    "session_id": conversation.session_id,
                    "match_count": match_count,
                    "preview": preview,
                    "created_at": conversation.timestamp.isoformat() if conversation.timestamp else None,
                })
        
        logger.info(f"✅ Found {len(search_results)} conversations matching '{query}' for user {user_id}")
        
        return {
            "success": True,
            "user_id": user_id,
            "query": query,
            "total_results": len(search_results),
            "results": search_results
        }
        
    except Exception as e:
        logger.error(f"❌ Error searching conversations for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id,
            "query": query
        }


@register_tool(
    name="get_conversation_stats",
    description="Get conversation statistics for user (total conversations, message count, averages). Used for engagement tracking.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "User ID to get conversation stats for"
            },
            "days": {
                "type": "integer",
                "description": "Number of days to analyze (default 30)",
                "default": 30
            }
        },
        "required": ["user_id"]
    },
    category="conversation",
    requires_db=True,
    requires_user_id=False
)
async def get_conversation_stats(
    db: AsyncSession,
    user_id: str,
    days: int = 30,
    **kwargs
) -> Dict[str, Any]:
    """
    Get conversation statistics for user.
    
    Returns metrics like total conversations, message count, avg length, etc.
    Used for engagement tracking.
    """
    try:
        normalized_user_id = _coerce_user_id(user_id)
        if normalized_user_id is None:
            return {
                "success": False,
                "error": "Invalid user_id",
                "user_id": user_id,
            }

        # Calculate date range
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Count conversations
        conv_query = (
            select(func.count(func.distinct(Conversation.conversation_id)))
            .where(
                and_(
                    Conversation.user_id == normalized_user_id,
                    Conversation.timestamp >= start_date
                )
            )
        )
        conv_result = await db.execute(conv_query)
        conversation_count = conv_result.scalar()
        
        # Count total turns (each row stores user+assistant text)
        msg_query = (
            select(func.count(Conversation.id))
            .where(
                and_(
                    Conversation.user_id == normalized_user_id,
                    Conversation.timestamp >= start_date
                )
            )
        )
        msg_result = await db.execute(msg_query)
        turn_count = msg_result.scalar()
        
        # Calculate averages (handle None values)
        conversation_count = conversation_count or 0
        turn_count = turn_count or 0
        user_message_count = turn_count
        assistant_message_count = turn_count
        message_count = user_message_count + assistant_message_count
        
        avg_messages_per_conversation = (
            message_count / conversation_count if conversation_count > 0 else 0
        )
        
        logger.info(f"✅ Retrieved conversation stats for user {user_id}: {conversation_count} conversations, {message_count} messages")
        
        return {
            "success": True,
            "user_id": user_id,
            "period_days": days,
            "total_conversations": conversation_count,
            "total_messages": message_count,
            "user_messages": user_message_count,
            "assistant_messages": assistant_message_count,
            "avg_messages_per_conversation": round(avg_messages_per_conversation, 1)
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting conversation stats for user {user_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "user_id": user_id
        }


# =============================================================================
# STA MANUAL TRIGGER TOOL
# =============================================================================

@register_tool(
    name="trigger_conversation_analysis",
    description="""Manually trigger a full clinical analysis of a past conversation using the Safety Triage Agent (STA).

\u2705 CALL WHEN (Counselor/Admin only):
- Asked to analyse or assess a specific conversation: "analyze conversation #xyz", "run risk assessment on user X's last session"
- Need deep clinical insights about a student's conversation: risk trend, symptoms, psychologist report
- Want to check screening dimensions (PHQ-9/GAD-7/DASS-21 alignment) for a past session
- Want to force-refresh an existing assessment with updated model

Returns a structured clinical report including:
- Overall risk level and trend (stable / escalating / de-escalating)
- Detected mental health indicators (depression, anxiety, stress, sleep quality, social isolation, etc.)
- Conversation summary and key themes for psychologist review
- Recommendation on whether a Case Management (CMA) referral is warranted
- Assessment record ID for dashboard reference
""",
    parameters={
        "type": "object",
        "properties": {
            "conversation_id": {
                "type": "string",
                "description": "The conversation ID to analyse. Either this or user_id must be provided."
            },
            "user_id": {
                "type": "integer",
                "description": "Analyse the most recent conversation for this user ID. Used when conversation_id is unknown."
            },
            "force_refresh": {
                "type": "boolean",
                "description": "If true, re-analyses even if an assessment already exists. Default false.",
                "default": False
            }
        },
        "required": []
    },
    category="conversation",
    requires_db=True,
    requires_user_id=False,
)
async def trigger_conversation_analysis(
    db: AsyncSession,
    conversation_id: Optional[str] = None,
    user_id: Optional[int] = None,
    force_refresh: bool = False,
    **kwargs,
) -> Dict[str, Any]:
    """Manually trigger STA conversation analysis and return the clinical report.

    Fetches the conversation from the database, runs analyze_conversation_risk(),
    persists the result, and returns a structured clinical summary.
    """
    try:
        from app.agents.sta.conversation_analyzer import analyze_conversation_risk
        from app.domains.mental_health.services.conversation_assessments import (
            upsert_conversation_assessment,
        )

        if not conversation_id and not user_id:
            return {
                "success": False,
                "error": "Provide at least one of: conversation_id or user_id.",
            }

        # Resolve conversation_id from user_id if not supplied directly.
        resolved_conversation_id = conversation_id
        if not resolved_conversation_id and user_id:
            latest_query = (
                select(Conversation.conversation_id)
                .where(Conversation.user_id == user_id)
                .order_by(desc(Conversation.timestamp))
                .limit(1)
            )
            result = await db.execute(latest_query)
            resolved_conversation_id = result.scalar_one_or_none()
            if not resolved_conversation_id:
                return {
                    "success": False,
                    "error": f"No conversations found for user {user_id}.",
                }

        # Fetch all turns for the conversation.
        turns_query = (
            select(Conversation)
            .where(Conversation.conversation_id == resolved_conversation_id)
            .order_by(Conversation.timestamp.asc())
        )
        turns_result = await db.execute(turns_query)
        turns = turns_result.scalars().all()

        if not turns:
            return {
                "success": False,
                "error": f"No messages found for conversation {resolved_conversation_id}.",
            }

        # Reconstruct history in the format expected by analyze_conversation_risk.
        # All turns except the last go into history; the last becomes current_message.
        history: List[Dict[str, Any]] = []
        for turn in turns[:-1]:
            history.append({"role": "user", "content": turn.message or ""})
            history.append({"role": "assistant", "content": turn.response or ""})

        last_turn = turns[-1]
        current_message = last_turn.message or ""
        conversation_start = turns[0].timestamp.timestamp() if turns[0].timestamp else None

        if not history and not current_message:
            return {
                "success": False,
                "error": "Conversation has insufficient content for analysis.",
            }

        # Run STA deep analysis.
        assessment = await analyze_conversation_risk(
            conversation_history=history,
            current_message=current_message,
            user_context={},
            conversation_start_time=conversation_start,
        )

        # Persist (or force-refresh) the assessment record.
        resolved_user_id = user_id or (turns[0].user_id if turns else None)
        assessment_record = await upsert_conversation_assessment(
            db,
            conversation_id=resolved_conversation_id,
            session_id=turns[0].session_id if turns else None,
            user_id=resolved_user_id,
            assessment=assessment,
            force_refresh=force_refresh,
        )

        logger.info(
            "\u2705 Manual STA analysis complete for conversation=%s: risk=%s, trend=%s",
            resolved_conversation_id,
            assessment.overall_risk_level,
            assessment.risk_trend,
        )

        # Build a compact screening summary from dimension scores.
        screening_summary: Dict[str, Any] = {}
        if assessment.screening:
            for dim in (
                "depression", "anxiety", "stress", "sleep",
                "social", "academic", "self_worth", "substance", "crisis",
            ):
                dim_score = getattr(assessment.screening, dim, None)
                if dim_score is not None:
                    screening_summary[dim] = {
                        "score": round(dim_score.score, 2),
                        "is_protective": dim_score.is_protective,
                        "evidence_count": len(dim_score.evidence),
                    }

        return {
            "success": True,
            "conversation_id": resolved_conversation_id,
            "messages_analyzed": assessment.message_count_analyzed,
            "overall_risk_level": assessment.overall_risk_level,
            "risk_trend": assessment.risk_trend,
            "crisis_detected": assessment.crisis_detected,
            "conversation_summary": assessment.conversation_summary,
            "reasoning": assessment.reasoning,
            "should_invoke_cma": assessment.should_invoke_cma,
            "duration_seconds": round(assessment.conversation_duration_seconds, 0),
            "screening_dimensions": screening_summary,
            "assessment_id": assessment_record.id if assessment_record else None,
        }

    except Exception as e:
        logger.error("\u274c trigger_conversation_analysis failed: %s", e, exc_info=True)
        return {"success": False, "error": str(e)}
