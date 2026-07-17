# backend/app/schemas/feedback.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from datetime import datetime

#? --- Feedback Schemas ---
class FeedbackCreate(BaseModel):
    # Optional context fields from frontend
    user_identifier: Optional[str] = None # Hashed ID 
    session_id: Optional[str] = None      # Set to null/omit if general feedback
    
    # --- Fields corresponding to the specific questions ---
    # Scales (Allow null if not answered)
    ease_of_use_rating: Optional[int] = Field(None, ge=1, le=5, description="Q1: 1=Very Difficult, 5=Very Easy")
    chatbot_understanding_rating: Optional[int] = Field(None, ge=1, le=5, description="Q2: 1=Not at all, 5=Very Well")
    felt_understood_rating: Optional[int] = Field(None, ge=1, le=5, description="Q3: 1=Not at all, 5=Very Much")
    nps_rating: Optional[int] = Field(None, ge=0, le=10, description="Q5: 0-10 Likelihood to Recommend")

    # MCQ (Allow null if not answered)
    goal_achieved: Optional[Literal['Yes', 'No', 'Partially']] = Field(None, description="Q4: Did you accomplish goal?")

    # Open-Ended (Make this mandatory as requested)
    improvement_suggestion: str = Field(..., min_length=5, description="Q6: What one thing can we improve?") # Set a min_length

    # Optional category (can keep or remove)
    category: Optional[str] = None 

    # Ensure Pydantic V2 compatibility if needed
    class Config:
       from_attributes = True

class FeedbackResponse(BaseModel):
    id: int
    message: str = "Feedback submitted successfully."
    timestamp: datetime