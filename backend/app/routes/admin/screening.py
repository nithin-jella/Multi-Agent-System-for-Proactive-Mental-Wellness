"""Admin endpoints for viewing user screening profiles.

These endpoints allow counselors and admins to view the accumulated
mental health screening data gathered through conversational intelligence
extraction.

Security:
- Only accessible by counselors and admins
- Displays aggregated risk indicators
- Does not expose raw conversation content
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user, get_current_active_user
from app.models import User
from app.domains.mental_health.models.assessments import UserScreeningProfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/screening", tags=["Screening"])


# =============================================================================
# RESPONSE SCHEMAS
# =============================================================================

class DimensionScoreResponse(BaseModel):
    """Response schema for a single dimension score."""
    dimension: str
    current_score: float
    protective_score: float
    net_score: float = Field(description="current_score - protective_score * 0.5")
    indicator_count: int
    last_updated: Optional[datetime] = None
    trend: str = "stable"


class ScreeningProfileResponse(BaseModel):
    """Response schema for a user's screening profile."""
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    
    overall_risk: str
    requires_attention: bool
    risk_trajectory: str = "stable"
    
    total_messages_analyzed: int
    total_sessions_analyzed: int
    
    dimension_scores: List[DimensionScoreResponse] = Field(default_factory=list)
    primary_concerns: List[str] = Field(default_factory=list)
    protective_factors: List[str] = Field(default_factory=list)
    
    last_intervention_at: Optional[datetime] = None
    intervention_count: int = 0
    
    created_at: datetime
    updated_at: datetime


class ScreeningProfileListResponse(BaseModel):
    """Response schema for list of screening profiles."""
    total: int
    page: int
    limit: int
    profiles: List[ScreeningProfileResponse]


class ScreeningDashboardResponse(BaseModel):
    """Response schema for screening dashboard overview."""
    total_profiles: int
    profiles_requiring_attention: int
    
    risk_distribution: dict = Field(
        description="Count of profiles by risk level",
        default_factory=lambda: {
            "none": 0,
            "mild": 0,
            "moderate": 0,
            "severe": 0,
            "critical": 0,
        }
    )
    
    top_concerns: List[dict] = Field(
        description="Most common primary concerns across all profiles",
        default_factory=list
    )
    
    recent_high_risk: List[ScreeningProfileResponse] = Field(
        description="Recently flagged high-risk profiles",
        default_factory=list
    )


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/profiles", response_model=ScreeningProfileListResponse)
async def list_screening_profiles(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    requires_attention: Optional[bool] = Query(None, description="Filter by attention flag"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ScreeningProfileListResponse:
    """List all user screening profiles with optional filters.
    
    Only accessible by admins and counselors.
    """
    # Build query
    query = select(UserScreeningProfile)
    
    if risk_level:
        query = query.where(UserScreeningProfile.overall_risk == risk_level)
    if requires_attention is not None:
        query = query.where(UserScreeningProfile.requires_attention == requires_attention)
    
    # Count total
    from sqlalchemy import func
    count_query = select(func.count()).select_from(UserScreeningProfile)
    if risk_level:
        count_query = count_query.where(UserScreeningProfile.overall_risk == risk_level)
    if requires_attention is not None:
        count_query = count_query.where(UserScreeningProfile.requires_attention == requires_attention)
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Paginate
    offset = (page - 1) * limit
    query = query.order_by(desc(UserScreeningProfile.updated_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    profiles = result.scalars().all()
    
    # Build response
    profile_responses = []
    for profile in profiles:
        # Get user info
        user_query = select(User).where(User.id == profile.user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        profile_data = profile.profile_data or {}
        
        # Extract dimension scores
        dimension_scores = []
        for dim_key, dim_data in profile_data.get("dimension_scores", {}).items():
            current = dim_data.get("current_score", 0)
            protective = dim_data.get("protective_score", 0)
            dimension_scores.append(DimensionScoreResponse(
                dimension=dim_key,
                current_score=current,
                protective_score=protective,
                net_score=current - protective * 0.5,
                indicator_count=dim_data.get("indicator_count", 0),
                last_updated=dim_data.get("last_updated"),
                trend=dim_data.get("trend", "stable"),
            ))
        
        # Sort by net score descending
        dimension_scores.sort(key=lambda x: x.net_score, reverse=True)
        
        profile_responses.append(ScreeningProfileResponse(
            user_id=profile.user_id,
            user_name=user.name if user else None,
            user_email=user.email if user else None,
            overall_risk=profile.overall_risk,
            requires_attention=profile.requires_attention,
            risk_trajectory=profile_data.get("risk_trajectory", "stable"),
            total_messages_analyzed=profile.total_messages_analyzed,
            total_sessions_analyzed=profile.total_sessions_analyzed,
            dimension_scores=dimension_scores,
            primary_concerns=profile_data.get("primary_concerns", []),
            protective_factors=profile_data.get("protective_factors", []),
            last_intervention_at=profile.last_intervention_at,
            intervention_count=len(profile_data.get("intervention_history", [])),
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        ))
    
    return ScreeningProfileListResponse(
        total=total,
        page=page,
        limit=limit,
        profiles=profile_responses,
    )


@router.get("/profiles/{user_id}", response_model=ScreeningProfileResponse)
async def get_screening_profile(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ScreeningProfileResponse:
    """Get a specific user's screening profile.
    
    Only accessible by admins and counselors.
    """
    query = select(UserScreeningProfile).where(UserScreeningProfile.user_id == user_id)
    result = await db.execute(query)
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No screening profile found for user {user_id}"
        )
    
    # Get user info
    user_query = select(User).where(User.id == user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    profile_data = profile.profile_data or {}
    
    # Extract dimension scores
    dimension_scores = []
    for dim_key, dim_data in profile_data.get("dimension_scores", {}).items():
        current = dim_data.get("current_score", 0)
        protective = dim_data.get("protective_score", 0)
        dimension_scores.append(DimensionScoreResponse(
            dimension=dim_key,
            current_score=current,
            protective_score=protective,
            net_score=current - protective * 0.5,
            indicator_count=dim_data.get("indicator_count", 0),
            last_updated=dim_data.get("last_updated"),
            trend=dim_data.get("trend", "stable"),
        ))
    
    # Sort by net score descending
    dimension_scores.sort(key=lambda x: x.net_score, reverse=True)
    
    return ScreeningProfileResponse(
        user_id=profile.user_id,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        overall_risk=profile.overall_risk,
        requires_attention=profile.requires_attention,
        risk_trajectory=profile_data.get("risk_trajectory", "stable"),
        total_messages_analyzed=profile.total_messages_analyzed,
        total_sessions_analyzed=profile.total_sessions_analyzed,
        dimension_scores=dimension_scores,
        primary_concerns=profile_data.get("primary_concerns", []),
        protective_factors=profile_data.get("protective_factors", []),
        last_intervention_at=profile.last_intervention_at,
        intervention_count=len(profile_data.get("intervention_history", [])),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("/dashboard", response_model=ScreeningDashboardResponse)
async def get_screening_dashboard(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ScreeningDashboardResponse:
    """Get screening dashboard overview with aggregated statistics.
    
    Only accessible by admins and counselors.
    """
    from sqlalchemy import func
    
    # Count total profiles
    total_query = select(func.count()).select_from(UserScreeningProfile)
    total_result = await db.execute(total_query)
    total_profiles = total_result.scalar() or 0
    
    # Count requiring attention
    attention_query = select(func.count()).select_from(UserScreeningProfile).where(
        UserScreeningProfile.requires_attention == True
    )
    attention_result = await db.execute(attention_query)
    profiles_requiring_attention = attention_result.scalar() or 0
    
    # Get risk distribution
    risk_dist_query = select(
        UserScreeningProfile.overall_risk,
        func.count(UserScreeningProfile.id)
    ).group_by(UserScreeningProfile.overall_risk)
    risk_dist_result = await db.execute(risk_dist_query)
    risk_distribution = {
        "none": 0,
        "mild": 0,
        "moderate": 0,
        "severe": 0,
        "critical": 0,
    }
    for risk_level, count in risk_dist_result.all():
        if risk_level in risk_distribution:
            risk_distribution[risk_level] = count
    
    # Get recent high-risk profiles
    high_risk_query = select(UserScreeningProfile).where(
        UserScreeningProfile.overall_risk.in_(["moderate", "severe", "critical"])
    ).order_by(desc(UserScreeningProfile.updated_at)).limit(10)
    
    high_risk_result = await db.execute(high_risk_query)
    high_risk_profiles = high_risk_result.scalars().all()
    
    recent_high_risk = []
    for profile in high_risk_profiles:
        user_query = select(User).where(User.id == profile.user_id)
        user_result = await db.execute(user_query)
        user = user_result.scalar_one_or_none()
        
        profile_data = profile.profile_data or {}
        
        recent_high_risk.append(ScreeningProfileResponse(
            user_id=profile.user_id,
            user_name=user.name if user else None,
            user_email=user.email if user else None,
            overall_risk=profile.overall_risk,
            requires_attention=profile.requires_attention,
            total_messages_analyzed=profile.total_messages_analyzed,
            total_sessions_analyzed=profile.total_sessions_analyzed,
            dimension_scores=[],  # Simplified for dashboard
            primary_concerns=profile_data.get("primary_concerns", []),
            protective_factors=profile_data.get("protective_factors", []),
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        ))
    
    # Aggregate top concerns
    concern_counts: dict = {}
    all_profiles_query = select(UserScreeningProfile.profile_data)
    all_profiles_result = await db.execute(all_profiles_query)
    
    for (profile_data,) in all_profiles_result.all():
        if profile_data:
            for concern in profile_data.get("primary_concerns", []):
                concern_counts[concern] = concern_counts.get(concern, 0) + 1
    
    top_concerns = sorted(
        [{"concern": k, "count": v} for k, v in concern_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:10]
    
    return ScreeningDashboardResponse(
        total_profiles=total_profiles,
        profiles_requiring_attention=profiles_requiring_attention,
        risk_distribution=risk_distribution,
        top_concerns=top_concerns,
        recent_high_risk=recent_high_risk,
    )


@router.post("/profiles/{user_id}/mark-reviewed")
async def mark_profile_reviewed(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict:
    """Mark a screening profile as reviewed, clearing the attention flag.
    
    Only accessible by admins and counselors.
    """
    query = select(UserScreeningProfile).where(UserScreeningProfile.user_id == user_id)
    result = await db.execute(query)
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No screening profile found for user {user_id}"
        )
    
    profile.requires_attention = False
    profile.updated_at = datetime.utcnow()
    
    await db.commit()
    
    logger.info(f"Screening profile for user {user_id} marked as reviewed by admin {admin_user.id}")
    
    return {
        "status": "success",
        "message": f"Profile for user {user_id} marked as reviewed",
        "reviewed_by": admin_user.id,
        "reviewed_at": datetime.utcnow().isoformat(),
    }
