# backend/app/schemas/summary.py
from pydantic import BaseModel, Field, ConfigDict
from typing import Dict, Optional
from datetime import datetime

class SummarizeRequest(BaseModel):
    session_id: str 
    user_identifier: str = Field(description="Google sub for the user")

#? --- Summary Schemas ---
class ActivityData(BaseModel):
    '''Daily activity data'''
    hasJournal: bool = False
    hasConversation: bool = False

class ActivitySummaryResponse(BaseModel):
    '''Dictionary where key is "YYYY-MM-DD" string'''
    summary: Dict[str, ActivityData]
    currentStreak: int = 0 # Streak count. At least 1 day of activity is needed to count as a streak.
    longestStreak: int = 0 # Longest streak count. At least 1 day of activity is needed to count as a streak.

#? --- Pydantic Model for Summary ---
class LatestSummaryResponse(BaseModel):
    summary_text: Optional[str] = None
    timestamp: Optional[datetime] = None

#? --- Pydantic Model for Greeting Hook ---
class GreetingHookRequest(BaseModel):
    detailed_summary_text: str

class GreetingHookResponse(BaseModel):
    greeting_hook: Optional[str] = None