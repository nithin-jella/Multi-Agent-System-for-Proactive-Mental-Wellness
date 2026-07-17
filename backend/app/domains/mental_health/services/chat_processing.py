"""Chat message processing helpers shared by internal evaluation routes."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.aika_orchestrator_graph import get_aika_agent
from app.core import llm
from app.core.llm_request_tracking import get_stats, prompt_context
from app.domains.mental_health.schemas.chat import ChatRequest, ConversationHistoryItem
from app.models import User
from app.services.ai_memory_facts_service import list_user_fact_texts_for_agent, remember_from_user_message

logger = logging.getLogger(__name__)


@dataclass
class ChatProcessingResult:
    response_text: str
    provider_used: str = "google"
    model_used: str = "gemini_google"
    final_history: List[ConversationHistoryItem] = field(default_factory=list)
    module_completed_id: Optional[int] = None
    intervention_plan: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


async def process_chat_message(
    request: ChatRequest,
    current_user: User,
    db: AsyncSession,
    session_id: str,
    conversation_id: int,
    active_system_prompt: Optional[str] = None,
    schedule_summary: Any = None,
    summarize_now: bool = False,
    llm_responder: Any = None,
    activity_callback: Optional[Callable] = None,
) -> ChatProcessingResult:
    del conversation_id, active_system_prompt, schedule_summary, summarize_now, llm_responder, activity_callback

    if request.message is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'message' is required for chat message processing.",
        )

    user_role = "user"
    if hasattr(current_user, "role"):
        if current_user.role == "admin":
            user_role = "admin"
        elif current_user.role == "counselor":
            user_role = "counselor"

    conversation_history: List[Dict[str, str]] = []
    if request.history:
        for index, item in enumerate(request.history):
            if index == len(request.history) - 1 and item.get("content") == request.message:
                continue
            conversation_history.append(item)

    prompt_id = str(uuid4())
    logger.info(
        "Invoking Aika agent for user_id=%s role=%s",
        current_user.id,
        user_role,
        extra={"user_id": current_user.id, "session_id": session_id, "prompt_id": prompt_id},
    )

    aika_agent = get_aika_agent()
    if aika_agent is None:
        raise RuntimeError(
            "Aika agent is not initialised yet. "
            "The FastAPI lifespan startup may still be in progress."
        )

    remembered_facts = await list_user_fact_texts_for_agent(db, current_user, limit=20)
    initial_state = {
        "user_id": current_user.id,
        "user_role": user_role,
        "message": request.message,
        "conversation_history": conversation_history,
        "session_id": session_id,
        "personal_context": {
            "remembered_facts": remembered_facts,
        },
    }

    llm_stats = None
    with prompt_context(prompt_id=prompt_id, user_id=current_user.id, session_id=session_id):
        result = await aika_agent.ainvoke(
            initial_state,
            config={
                "configurable": {
                    "thread_id": f"user_{current_user.id}_session_{session_id}",
                    "db": db,
                }
            },
        )
        llm_stats = get_stats()

    final_response = result.get("final_response", "Maaf, terjadi kesalahan.")
    response_source = result.get("response_source", "unknown")
    agents_invoked = result.get("agents_invoked", [])

    updated_history = conversation_history + [
        {"role": "user", "content": request.message},
        {"role": "assistant", "content": final_response},
    ]

    now = datetime.now()
    history_items = [
        ConversationHistoryItem(
            role=item["role"],
            content=item["content"],
            timestamp=now,
            session_id=session_id,
        )
        for item in updated_history
    ]

    metadata: Dict[str, Any] = {
        "agents_invoked": agents_invoked,
        "response_source": response_source,
        "execution_path": result.get("execution_path", []),
        "intent": result.get("intent"),
        "risk_level": result.get("sta_risk_assessment", {}).get("risk_level") or result.get("severity"),
        "risk_score": result.get("sta_risk_assessment", {}).get("risk_score") or result.get("risk_score"),
        "is_fallback": result.get("is_fallback", False),
        "fallback_type": result.get("fallback_type"),
        "retry_after_ms": result.get("retry_after_ms", 0),
    }

    if llm_stats is not None:
        metadata["llm_request_count"] = llm_stats.total_requests
        metadata["llm_requests_by_model"] = llm_stats.requests_by_model
    metadata["llm_prompt_id"] = prompt_id

    await remember_from_user_message(db, current_user, request.message, source="conversation")

    return ChatProcessingResult(
        response_text=final_response,
        provider_used="aika-langgraph",
        model_used=getattr(llm, "DEFAULT_GEMINI_MODEL", "gemini-2.5-flash"),
        final_history=history_items,
        module_completed_id=None,
        intervention_plan=result.get("intervention_plan"),
        metadata=metadata,
    )
