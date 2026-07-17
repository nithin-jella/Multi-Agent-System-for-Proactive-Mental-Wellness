# app/routes/feedback.py
from fastapi import APIRouter, Depends, HTTPException, status, Body # type: ignore
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal, Optional, Any
from datetime import datetime

from app.database import get_async_db
from app.models import User  # Core model
from app.domains.mental_health.models import Feedback
from app.dependencies import get_current_active_user
from app.domains.mental_health.schemas.feedback import FeedbackCreate, FeedbackResponse
import logging

logger = logging.getLogger(__name__)

# --- Router Setup ---
router = APIRouter(
    prefix="/api/v1/feedback",  # Normalize API prefix
    tags=["Feedback"]
)

# --- API Endpoint ---
@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback_data: FeedbackCreate = Body(...), 
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Receives feedback submission from the frontend and saves it to the database.
    Optionally links feedback to a user based on the provided user_identifier hash.
    """
    logger.info(f"Received feedback: ease={feedback_data.ease_of_use_rating}, understand={feedback_data.chatbot_understanding_rating}, felt_heard={feedback_data.felt_understood_rating}, nps={feedback_data.nps_rating}, goal='{feedback_data.goal_achieved}', improvement='{feedback_data.improvement_suggestion[:50]}...'")
    
    try:
        new_feedback = Feedback(
            user_id=current_user.id, # Link feedback to the logged-in user
            session_id=feedback_data.session_id,

            # Map data from request to model columns
            ease_of_use_rating=feedback_data.ease_of_use_rating,
            chatbot_understanding_rating=feedback_data.chatbot_understanding_rating,
            felt_understood_rating=feedback_data.felt_understood_rating,
            nps_rating=feedback_data.nps_rating,
            goal_achieved=feedback_data.goal_achieved,
            improvement_suggestion=feedback_data.improvement_suggestion,
            category=feedback_data.category
        )
        db.add(new_feedback)
        await db.commit()
        await db.refresh(new_feedback)

        any_feedback: Any = new_feedback
        logger.info(f"Successfully saved feedback with ID: {any_feedback.id} for user ID: {current_user.id}")

        return FeedbackResponse(id=any_feedback.id, timestamp=any_feedback.timestamp)

    except Exception as e:
        await db.rollback()
        logger.error(f"Database error saving feedback for user ID {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving your feedback. Please try again later."
        )
