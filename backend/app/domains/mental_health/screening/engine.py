"""Screening Engine for Covert Mental Health Assessment.

This module implements the core screening logic for extracting mental health
indicators from natural conversation. It uses validated psychological instruments
as the theoretical foundation.

The engine is used by STA (Safety Triage Agent) during conversation analysis
to extract screening data alongside risk assessment in a single LLM call.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum
from dataclasses import dataclass, field

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# =============================================================================
# SCREENING DIMENSIONS (Based on validated instruments)
# =============================================================================

class ScreeningDimension(str, Enum):
    """Mental health dimensions tracked through conversation.
    
    Each dimension maps to a validated psychological screening instrument:
    - DEPRESSION: PHQ-9 (Patient Health Questionnaire-9)
    - ANXIETY: GAD-7 (Generalized Anxiety Disorder-7)
    - STRESS: DASS-21 Stress Subscale
    - SLEEP: PSQI (Pittsburgh Sleep Quality Index)
    - SOCIAL: UCLA Loneliness Scale Version 3
    - ACADEMIC: Student Stress Inventory (university context)
    - SELF_WORTH: RSES (Rosenberg Self-Esteem Scale)
    - SUBSTANCE: AUDIT (Alcohol Use Disorders Identification Test)
    - CRISIS: C-SSRS (Columbia Suicide Severity Rating Scale)
    """
    DEPRESSION = "depression"       # PHQ-9: Mood, anhedonia, hopelessness
    ANXIETY = "anxiety"             # GAD-7: Worry, tension, panic
    STRESS = "stress"               # DASS-21: Overwhelm, pressure, burnout
    SLEEP = "sleep"                 # PSQI: Sleep quality, insomnia, fatigue
    SOCIAL = "social"               # UCLA: Isolation, loneliness, relationships
    ACADEMIC = "academic"           # SSI: Academic pressure, performance anxiety
    SELF_WORTH = "self_worth"       # RSES: Self-esteem, self-criticism
    SUBSTANCE = "substance"         # AUDIT: Alcohol, drugs, coping substance use
    CRISIS = "crisis"               # C-SSRS: Self-harm, suicidal ideation


class IndicatorSeverity(str, Enum):
    """Severity levels for extracted indicators.
    
    These map to standardized instrument scoring thresholds:
    - NONE: Score below clinical threshold
    - MILD: Score in mild range (e.g., PHQ-9: 5-9)
    - MODERATE: Score in moderate range (e.g., PHQ-9: 10-14)
    - SEVERE: Score in severe range (e.g., PHQ-9: 15-19)
    - CRITICAL: Score indicates immediate risk (e.g., PHQ-9: 20+ or item 9 positive)
    """
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


# =============================================================================
# INSTRUMENT REFERENCES
# =============================================================================

INSTRUMENT_REFERENCES: Dict[str, Dict[str, str]] = {
    "depression": {
        "instrument": "PHQ-9",
        "full_name": "Patient Health Questionnaire-9",
        "reference": "Kroenke et al. (2001). Journal of General Internal Medicine, 16(9), 606-613",
        "domains": "anhedonia, depressed_mood, sleep, fatigue, appetite, worthlessness, concentration, psychomotor, suicidal_ideation",
    },
    "anxiety": {
        "instrument": "GAD-7",
        "full_name": "Generalized Anxiety Disorder-7",
        "reference": "Spitzer et al. (2006). Archives of Internal Medicine, 166(10), 1092-1097",
        "domains": "nervous, uncontrollable_worry, excessive_worry, trouble_relaxing, restlessness, irritability, fear_of_awful",
    },
    "stress": {
        "instrument": "DASS-21 Stress",
        "full_name": "Depression Anxiety Stress Scales - Stress Subscale",
        "reference": "Lovibond & Lovibond (1995). Behaviour Research and Therapy, 33(3), 335-343",
        "domains": "difficulty_relaxing, nervous_energy, agitation, irritable_overreactive, impatience, overwhelm, intolerance",
    },
    "sleep": {
        "instrument": "PSQI",
        "full_name": "Pittsburgh Sleep Quality Index",
        "reference": "Buysse et al. (1989). Psychiatry Research, 28(2), 193-213",
        "domains": "sleep_quality, sleep_latency, sleep_duration, sleep_efficiency, sleep_disturbances, sleep_medication, daytime_dysfunction",
    },
    "social": {
        "instrument": "UCLA-LS3",
        "full_name": "UCLA Loneliness Scale Version 3",
        "reference": "Russell (1996). Journal of Personality Assessment, 66(1), 20-40",
        "domains": "social_loneliness, emotional_loneliness, perceived_isolation, social_withdrawal, companionship",
    },
    "academic": {
        "instrument": "SSI",
        "full_name": "Student Stress Inventory (Adapted)",
        "reference": "Lakaev (2009). Adapted for Indonesian university context",
        "domains": "academic_pressure, fear_of_failure, thesis_stress, academic_comparison, future_anxiety",
    },
    "self_worth": {
        "instrument": "RSES",
        "full_name": "Rosenberg Self-Esteem Scale",
        "reference": "Rosenberg (1965). Society and the adolescent self-image",
        "domains": "self_worth, self_acceptance, self_competence, comparative_worth, self_respect",
    },
    "substance": {
        "instrument": "AUDIT",
        "full_name": "Alcohol Use Disorders Identification Test",
        "reference": "Saunders et al. (1993). Addiction, 88(6), 791-804",
        "domains": "hazardous_use, dependence_symptoms, harmful_use, coping_drinking",
    },
    "crisis": {
        "instrument": "C-SSRS",
        "full_name": "Columbia Suicide Severity Rating Scale",
        "reference": "Posner et al. (2011). American Journal of Psychiatry, 168(12), 1266-1277",
        "domains": "wish_to_be_dead, suicidal_thoughts, suicidal_intent, suicidal_plan, self_harm, preparatory_behavior",
    },
}


# =============================================================================
# SCORING THRESHOLDS (Based on instrument cutoffs)
# =============================================================================

DIMENSION_SCORING_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "depression": {  # PHQ-9 scoring (normalized 0-1 scale)
        "mild": 0.19,       # 5/27 ≈ 0.19
        "moderate": 0.37,   # 10/27 ≈ 0.37
        "severe": 0.56,     # 15/27 ≈ 0.56
        "critical": 0.74,   # 20/27 ≈ 0.74
    },
    "anxiety": {  # GAD-7 scoring (normalized 0-1 scale)
        "mild": 0.24,       # 5/21 ≈ 0.24
        "moderate": 0.48,   # 10/21 ≈ 0.48
        "severe": 0.71,     # 15/21 ≈ 0.71
        "critical": 0.90,   # Extreme anxiety
    },
    "stress": {  # DASS-21 Stress (normalized 0-1 scale)
        "mild": 0.19,       # 8/42 ≈ 0.19
        "moderate": 0.29,   # 12/42 ≈ 0.29
        "severe": 0.38,     # 16/42 ≈ 0.38
        "critical": 0.60,   # Extreme stress
    },
    "sleep": {  # PSQI scoring
        "mild": 0.24,       # 5/21 ≈ 0.24
        "moderate": 0.48,   # 10/21 ≈ 0.48
        "severe": 0.71,     # 15/21 ≈ 0.71
        "critical": 0.90,
    },
    "social": {  # UCLA Loneliness (normalized)
        "mild": 0.25,
        "moderate": 0.44,
        "severe": 0.63,
        "critical": 0.83,
    },
    "academic": {  # University-specific thresholds
        "mild": 0.25,
        "moderate": 0.50,
        "severe": 0.70,
        "critical": 0.85,
    },
    "self_worth": {  # RSES (inverted - lower = worse)
        "mild": 0.25,
        "moderate": 0.50,
        "severe": 0.70,
        "critical": 0.85,
    },
    "substance": {  # AUDIT scoring
        "mild": 0.20,       # 8/40 = 0.20 (hazardous)
        "moderate": 0.40,   # 16/40 = 0.40 (harmful)
        "severe": 0.50,     # 20/40 = 0.50 (dependence likely)
        "critical": 0.70,
    },
    "crisis": {  # C-SSRS - any positive is concerning
        "mild": 0.20,       # Wish to be dead
        "moderate": 0.40,   # Suicidal thoughts
        "severe": 0.60,     # Intent without plan
        "critical": 0.80,   # Plan or preparatory behavior
    },
}


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class ExtractionResult:
    """Result of extracting indicators from a conversation."""
    indicators_found: List[Dict[str, Any]] = field(default_factory=list)
    dimension_updates: Dict[str, float] = field(default_factory=dict)
    protective_updates: Dict[str, float] = field(default_factory=dict)
    crisis_detected: bool = False
    confidence: float = 0.0


class DimensionScore(BaseModel):
    """Score for a single screening dimension."""
    dimension: ScreeningDimension
    current_score: float = Field(default=0.0, ge=0.0, le=1.0)
    protective_score: float = Field(default=0.0, ge=0.0, le=1.0)
    indicator_count: int = 0
    last_indicators: List[str] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    trend: str = "stable"  # "improving", "stable", "worsening"
    
    # Instrument-based metadata
    instrument: str = ""
    severity_label: str = "none"


class ScreeningProfile(BaseModel):
    """Accumulated screening profile from conversation analysis.
    
    This profile is built gradually over multiple conversations,
    providing a longitudinal view of mental health state based on
    validated psychological instruments.
    """
    user_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_analyzed: datetime = Field(default_factory=datetime.utcnow)
    total_messages_analyzed: int = 0
    total_sessions_analyzed: int = 0
    
    # Dimension scores
    dimension_scores: Dict[str, DimensionScore] = Field(default_factory=dict)
    
    # Aggregated risk
    overall_risk_level: IndicatorSeverity = IndicatorSeverity.NONE
    risk_trajectory: str = "stable"
    
    # Flags
    requires_attention: bool = False
    last_intervention_suggested: Optional[datetime] = None
    intervention_history: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Context
    primary_concerns: List[str] = Field(default_factory=list)
    protective_factors: List[str] = Field(default_factory=list)
    
    def get_severity(self) -> IndicatorSeverity:
        """Calculate overall severity from dimension scores."""
        if not self.dimension_scores:
            return IndicatorSeverity.NONE
        
        # Check for crisis first - any crisis indicator is critical
        crisis_score = self.dimension_scores.get(ScreeningDimension.CRISIS.value)
        if crisis_score and crisis_score.current_score > 0.3:
            return IndicatorSeverity.CRITICAL
        
        # Calculate weighted average based on instrument importance
        weights = {
            ScreeningDimension.CRISIS.value: 3.0,
            ScreeningDimension.DEPRESSION.value: 2.0,
            ScreeningDimension.ANXIETY.value: 1.5,
            ScreeningDimension.SELF_WORTH.value: 1.5,
            ScreeningDimension.STRESS.value: 1.0,
            ScreeningDimension.SLEEP.value: 1.0,
            ScreeningDimension.SOCIAL.value: 1.0,
            ScreeningDimension.ACADEMIC.value: 0.8,
            ScreeningDimension.SUBSTANCE.value: 1.2,
        }
        
        total_weighted = 0.0
        total_weight = 0.0
        
        for dim_key, score in self.dimension_scores.items():
            weight = weights.get(dim_key, 1.0)
            net_score = max(0, score.current_score - score.protective_score * 0.5)
            total_weighted += net_score * weight
            total_weight += weight
        
        if total_weight == 0:
            return IndicatorSeverity.NONE
        
        avg_score = total_weighted / total_weight
        
        if avg_score >= 0.7:
            return IndicatorSeverity.SEVERE
        elif avg_score >= 0.5:
            return IndicatorSeverity.MODERATE
        elif avg_score >= 0.25:
            return IndicatorSeverity.MILD
        else:
            return IndicatorSeverity.NONE
    
    def get_severity_label(self, dimension: str, score: float) -> str:
        """Get severity label based on instrument-specific thresholds."""
        thresholds = DIMENSION_SCORING_THRESHOLDS.get(dimension, {})
        
        if score >= thresholds.get("critical", 0.85):
            return "critical"
        elif score >= thresholds.get("severe", 0.70):
            return "severe"
        elif score >= thresholds.get("moderate", 0.50):
            return "moderate"
        elif score >= thresholds.get("mild", 0.25):
            return "mild"
        return "none"


# =============================================================================
# PROFILE UPDATE SERVICE
# =============================================================================

async def update_screening_profile(
    db: AsyncSession,
    user_id: int,
    extraction_result: ExtractionResult,
    session_id: Optional[str] = None,
    decay_factor: float = 0.95
) -> ScreeningProfile:
    """Update user's screening profile with new extraction results.
    
    Uses exponential decay to weight recent indicators more heavily
    while maintaining longitudinal history.
    
    Args:
        db: Database session
        user_id: User ID
        extraction_result: Results from indicator extraction
        session_id: Current session ID for tracking
        decay_factor: How much to decay old scores (0.95 = slow decay)
        
    Returns:
        Updated ScreeningProfile
    """
    from app.domains.mental_health.models.assessments import UserScreeningProfile
    
    # Fetch or create profile
    stmt = select(UserScreeningProfile).where(UserScreeningProfile.user_id == user_id)
    result = await db.execute(stmt)
    db_profile = result.scalar_one_or_none()
    
    if db_profile:
        profile_data = db_profile.profile_data or {}
        profile = ScreeningProfile(
            user_id=user_id,
            **{k: v for k, v in profile_data.items() if k != "user_id"}
        )
    else:
        profile = ScreeningProfile(user_id=user_id)
    
    # Apply decay to existing scores
    for dim_key, score in profile.dimension_scores.items():
        score.current_score *= decay_factor
        score.protective_score *= decay_factor
    
    # Update with new indicators
    for dim_key, weight in extraction_result.dimension_updates.items():
        if dim_key not in profile.dimension_scores:
            instrument_info = INSTRUMENT_REFERENCES.get(dim_key, {})
            profile.dimension_scores[dim_key] = DimensionScore(
                dimension=ScreeningDimension(dim_key),
                instrument=instrument_info.get("instrument", ""),
            )
        
        score = profile.dimension_scores[dim_key]
        # Weighted update: new = old * decay + new * (1 - decay)
        score.current_score = min(1.0, score.current_score + weight * 0.3)
        score.indicator_count += 1
        score.last_updated = datetime.utcnow()
        score.severity_label = profile.get_severity_label(dim_key, score.current_score)
        
        # Track excerpts for context
        for indicator in extraction_result.indicators_found:
            if indicator.get("dimension") == dim_key and not indicator.get("is_protective"):
                if len(score.last_indicators) >= 5:
                    score.last_indicators.pop(0)
                score.last_indicators.append(indicator.get("excerpt", "")[:100])
    
    # Update protective factors
    for dim_key, weight in extraction_result.protective_updates.items():
        if dim_key not in profile.dimension_scores:
            instrument_info = INSTRUMENT_REFERENCES.get(dim_key, {})
            profile.dimension_scores[dim_key] = DimensionScore(
                dimension=ScreeningDimension(dim_key),
                instrument=instrument_info.get("instrument", ""),
            )
        
        score = profile.dimension_scores[dim_key]
        score.protective_score = min(1.0, score.protective_score + weight * 0.3)
    
    # Update metadata
    profile.total_messages_analyzed += 1
    profile.last_analyzed = datetime.utcnow()
    profile.overall_risk_level = profile.get_severity()
    
    # Update primary concerns (top 3 dimensions by score)
    sorted_dims = sorted(
        [(k, v.current_score - v.protective_score * 0.5) for k, v in profile.dimension_scores.items()],
        key=lambda x: x[1],
        reverse=True
    )
    profile.primary_concerns = [d[0] for d in sorted_dims[:3] if d[1] > 0.2]
    
    # Update protective factors
    protective_dims = [
        k for k, v in profile.dimension_scores.items()
        if v.protective_score > 0.3
    ]
    profile.protective_factors = protective_dims
    
    # Check if intervention is needed
    profile.requires_attention = (
        profile.overall_risk_level in (IndicatorSeverity.MODERATE, IndicatorSeverity.SEVERE, IndicatorSeverity.CRITICAL)
        or extraction_result.crisis_detected
    )
    
    # Persist to database
    profile_dict = profile.model_dump(mode="json")
    
    if db_profile:
        db_profile.profile_data = profile_dict
        db_profile.updated_at = datetime.utcnow()
        db_profile.overall_risk = profile.overall_risk_level.value
        db_profile.requires_attention = profile.requires_attention
    else:
        db_profile = UserScreeningProfile(
            user_id=user_id,
            profile_data=profile_dict,
            overall_risk=profile.overall_risk_level.value,
            requires_attention=profile.requires_attention,
        )
        db.add(db_profile)
    
    await db.flush()
    
    logger.info(
        f"📊 Screening profile updated for user {user_id}: "
        f"risk={profile.overall_risk_level.value}, "
        f"concerns={profile.primary_concerns}, "
        f"requires_attention={profile.requires_attention}"
    )
    
    return profile
