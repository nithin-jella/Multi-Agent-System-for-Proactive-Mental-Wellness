"""Schema for STA conversation-level risk assessment output.

This assessment is generated ONCE at the end of each conversation,
analyzing the full conversation history for risk patterns and trends.

Now also includes SCREENING EXTRACTION (merged from TCA) to capture
mental health dimension scores in a single LLM call.
"""
from typing import Dict, List, Any, Literal, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ScreeningDimensionScore(BaseModel):
    """Score for a single screening dimension extracted from conversation."""
    score: float = Field(
        ge=0.0, le=1.0,
        description="Indicator strength from 0 (none) to 1 (severe)"
    )
    evidence: List[str] = Field(
        default_factory=list,
        description="Brief quotes or paraphrases supporting this score"
    )
    is_protective: bool = Field(
        default=False,
        description="True if this dimension shows positive/protective factors"
    )


class ScreeningExtraction(BaseModel):
    """Screening data extracted from conversation (merged from TCA).
    
    Maps to validated instruments:
    - depression: PHQ-9 domains (mood, anhedonia, hopelessness)
    - anxiety: GAD-7 domains (worry, tension, panic)
    - stress: DASS-21 stress subscale (overwhelm, burnout)
    - sleep: PSQI indicators (insomnia, fatigue)
    - social: UCLA Loneliness Scale (isolation, relationships)
    - academic: University-specific academic pressure
    - self_worth: Rosenberg Self-Esteem indicators
    - substance: AUDIT/DAST screening indicators
    - crisis: Self-harm, suicidal ideation (CRITICAL)
    """
    depression: Optional[ScreeningDimensionScore] = None
    anxiety: Optional[ScreeningDimensionScore] = None
    stress: Optional[ScreeningDimensionScore] = None
    sleep: Optional[ScreeningDimensionScore] = None
    social: Optional[ScreeningDimensionScore] = None
    academic: Optional[ScreeningDimensionScore] = None
    self_worth: Optional[ScreeningDimensionScore] = None
    substance: Optional[ScreeningDimensionScore] = None
    crisis: Optional[ScreeningDimensionScore] = None
    
    # Protective factors detected across dimensions
    protective_dimensions: List[str] = Field(
        default_factory=list,
        description="Dimensions showing positive/protective indicators"
    )


class ConversationAssessment(BaseModel):
    """Output from STA conversation-level analysis.
    
    Generated at conversation end to provide comprehensive risk assessment
    based on the entire conversation context.
    
    Now also includes screening extraction (merged from TCA) to capture
    mental health dimension scores in the same analysis call.
    """
    
    overall_risk_level: Literal["low", "moderate", "high", "critical"] = Field(
        description="Overall risk level considering full conversation"
    )
    
    risk_trend: Literal["stable", "escalating", "de-escalating", "insufficient_data"] = Field(
        description="Pattern of risk changes throughout conversation"
    )
    
    conversation_summary: str = Field(
        description="2-3 sentence summary of main conversation themes and concerns"
    )
    
    user_context: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Extracted context about user's situation and environment"
    )
    # Example structure:
    # {
    #   "recent_stressors": ["exam pressure", "relationship conflict", "financial issues"],
    #   "coping_mechanisms": ["talks to friends", "exercise", "journaling"],
    #   "protective_factors": ["family support", "academic success", "hobbies"]
    # }
    
    protective_factors: List[str] = Field(
        default_factory=list,
        description="Positive factors that reduce risk (support systems, coping skills)"
    )
    
    concerns: List[str] = Field(
        default_factory=list,
        description="Specific concerning patterns identified in conversation"
    )
    
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Specific interventions or actions recommended for this user"
    )
    
    should_invoke_cma: bool = Field(
        default=False,
        description="Whether case management should be triggered for human counselor"
    )
    
    reasoning: str = Field(
        description="Detailed chain-of-thought explanation of the assessment"
    )
    
    # Affective State (PAD Model)
    pleasure: Optional[float] = Field(
        default=None, ge=-1.0, le=1.0,
        description="Pleasure/Valence: -1.0 (negative) to 1.0 (positive)"
    )
    arousal: Optional[float] = Field(
        default=None, ge=-1.0, le=1.0,
        description="Arousal: -1.0 (calm) to 1.0 (excited)"
    )
    dominance: Optional[float] = Field(
        default=None, ge=-1.0, le=1.0,
        description="Dominance: -1.0 (overwhelmed) to 1.0 (in control)"
    )
    
    # Metadata
    message_count_analyzed: int = Field(
        description="Number of messages included in this analysis"
    )
    
    analysis_timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When this assessment was performed"
    )
    
    conversation_duration_seconds: float = Field(
        default=0.0,
        description="Duration of conversation from start to end"
    )
    
    # =========================================================================
    # SCREENING EXTRACTION (Merged from TCA)
    # =========================================================================
    screening: Optional[ScreeningExtraction] = Field(
        default=None,
        description="Mental health dimension scores extracted from conversation"
    )
    
    crisis_detected: bool = Field(
        default=False,
        description="Whether immediate crisis indicators were detected"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "overall_risk_level": "moderate",
                "risk_trend": "escalating",
                "conversation_summary": "Student experiencing increasing academic stress with sleep deprivation over past week. Mentions feeling overwhelmed but has family support.",
                "user_context": {
                    "recent_stressors": ["final exams", "lack of sleep", "group project conflicts"],
                    "coping_mechanisms": ["talks to roommate", "listens to music"],
                    "protective_factors": ["family support", "good academic record", "close friends"]
                },
                "protective_factors": ["Family support", "Academic achievements", "Social connections"],
                "concerns": ["Progressive sleep deprivation (3 days)", "Escalating hopelessness", "Withdrawal from activities"],
                "recommended_actions": ["Sleep hygiene intervention", "Stress management CBT module", "Follow-up in 2 days"],
                "should_invoke_cma": False,
                "reasoning": "Risk is moderate due to academic stress and sleep issues, but strong protective factors present. Trend is escalating which warrants monitoring. No immediate crisis indicators, so CMA not needed yet.",
                "message_count_analyzed": 12,
                "conversation_duration_seconds": 847.3
            }
        }
