from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_db
from app.models import User  # Core model
from app.domains.mental_health.models import Conversation, UserSummary
from app.dependencies import get_current_active_user # If you want to ensure only an authenticated user can end their own session
from app.domains.mental_health.services.summarization_service import summarize_and_save
from sqlalchemy import select, desc
import logging

logger = logging.getLogger(__name__)
session_event_router = APIRouter(prefix="/api/v1/chat", tags=["Chat Session Events"])

class SessionEndRequest(BaseModel):
    session_id: str

class NewSessionRequest(BaseModel):
    force_summarize_current: bool = True

@session_event_router.post("/end-session", status_code=status.HTTP_202_ACCEPTED)
async def end_chat_session(
    request: SessionEndRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db), # For querying user_id
    # current_user: User = Depends(get_current_active_user) # Optional: ensure user matches session
):
    logger.info(f"Received request to end session: {request.session_id}")

    # Find the user_id associated with this session_id
    # This assumes that the session_id is unique enough or you might need
    # current_user.id to scope the query if session_ids are not globally unique.
    stmt = select(Conversation).where(Conversation.session_id == request.session_id).order_by(desc(Conversation.timestamp))
    result = await db.execute(stmt)
    last_message_in_session = result.first()

    if not last_message_in_session:
        logger.warning(f"No conversation found for session_id: {request.session_id} to end and summarize.")
        # Still return 202 not to block client, or 404 if strictness is needed
        return {"message": "Session end acknowledged, no active conversation found to summarize."}

    user_id = last_message_in_session.user_id

    # Optional: Verify current_user.id matches user_id from session if auth is used
    # if current_user.id != user_id:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to end this session")

    logger.info(f"Scheduling summarization for user {user_id}, session {request.session_id} due to explicit end.")
    background_tasks.add_task(summarize_and_save, user_id, request.session_id)
    return {"message": "Session end acknowledged, summarization scheduled."}

@session_event_router.post("/new-session", status_code=status.HTTP_200_OK)
async def start_new_session(
    request: NewSessionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user)
):
    """Force create a new session and optionally summarize the current one."""
    logger.info(f"Starting new session for user {current_user.id}")
    
    latest_session = None
    if request.force_summarize_current:
        # Find the user's most recent session
        stmt = (
            select(Conversation.session_id)
            .where(Conversation.user_id == current_user.id)
            .order_by(desc(Conversation.timestamp))
            .limit(1)
        )
        result = await db.execute(stmt)
        latest_session = result.scalar_one_or_none()
        
        if latest_session:
            logger.info(f"Scheduling summarization for current session: {latest_session}")
            background_tasks.add_task(summarize_and_save, current_user.id, latest_session)
    
    # Get current memory status
    summary_count = await db.execute(
        select(UserSummary).where(UserSummary.user_id == current_user.id)
    )
    total_summaries = len(summary_count.scalars().all())
    
    return {
        "message": "New session will start on next chat request",
        "user_id": current_user.id,
        "total_summaries": total_summaries,
        "summarization_scheduled": request.force_summarize_current and latest_session is not None
    }