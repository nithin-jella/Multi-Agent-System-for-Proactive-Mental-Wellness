"""Admin analytics API endpoints.

Provides metrics and analytics for:
- Intervention Plans (TCA)
- CBT Module Usage
- User Progress & Engagement
"""

from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc, case

from app.database import get_async_db
from app.core.auth import require_role
from app.models import RetentionCohortDaily, UserDailyActivity
from app.models.user import User
from app.domains.mental_health.models.interventions import InterventionPlanRecord
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/admin/analytics", tags=["admin-analytics"])


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class SCAAnalytics(BaseModel):
    """Analytics for TCA/TCA effectiveness."""
    # Overview
    total_plans: int
    active_plans: int
    completed_plans: int
    archived_plans: int
    
    # Engagement
    avg_completion_percentage: float
    avg_days_to_completion: Optional[float]
    plans_viewed_in_24h: int
    plans_not_viewed_in_7d: int
    
    # Risk distribution
    risk_level_distribution: dict[str, int]
    
    # Effectiveness
    completion_rate: float
    abandonment_rate: float
    
    # Timeframe
    timeframe_days: int
    generated_at: datetime


class CBTModuleUsage(BaseModel):
    """CBT module usage statistics."""
    module_name: str
    usage_count: int
    avg_completion_rate: float
    total_steps: int


class UserProgress(BaseModel):
    """Individual user progress summary."""
    user_hash: str
    total_plans: int
    active_plans: int
    completed_plans: int
    avg_completion_percentage: float
    last_plan_created: datetime
    engagement_score: float = Field(description="0-100 score based on activity")


class ActiveUsersSummary(BaseModel):
    """Top-level active user counters."""

    dau: int = Field(description="Daily active users (unique users today)")
    wau: int = Field(description="Weekly active users (unique users last 7 days, inclusive)")
    mau: int = Field(description="Monthly active users (unique users last 30 days, inclusive)")
    as_of: date


class DailyActiveUsersPoint(BaseModel):
    activity_date: date
    active_users: int
    total_requests: int


class DailyActiveUsersSeries(BaseModel):
    days: int
    generated_at: datetime
    points: List[DailyActiveUsersPoint]


class CohortRetentionPoint(BaseModel):
    cohort_date: date
    day_n: int
    cohort_size: int
    retained_users: int
    retention_rate: float


class CohortRetentionSeries(BaseModel):
    cohort_days: int
    day_n_values: List[int]
    generated_at: datetime
    points: List[CohortRetentionPoint]


class RetentionSummaryPoint(BaseModel):
    day_n: int
    cohort_size: int
    retained_users: int
    retention_rate: float


class RetentionSummary(BaseModel):
    cohort_date: date | None
    day_n_values: List[int]
    generated_at: datetime
    points: List[RetentionSummaryPoint]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def anonymize_user_id(user_id: int) -> str:
    """Convert user ID to anonymized hash for privacy."""
    import hashlib
    return hashlib.sha256(f"user_{user_id}".encode()).hexdigest()[:16]


def calculate_engagement_score(
    total_plans: int,
    completed_plans: int,
    avg_completion: float,
    days_since_last: Optional[int]
) -> float:
    """Calculate user engagement score (0-100)."""
    score = 0.0
    
    # Plans created (max 30 points)
    score += min(total_plans * 10, 30)
    
    # Completion rate (max 40 points)
    if total_plans > 0:
        completion_rate = completed_plans / total_plans
        score += completion_rate * 40
    
    # Progress on active plans (max 20 points)
    score += (avg_completion / 100) * 20
    
    # Recency bonus (max 10 points)
    if days_since_last is not None:
        if days_since_last <= 1:
            score += 10
        elif days_since_last <= 7:
            score += 5
        elif days_since_last <= 30:
            score += 2
    
    return min(score, 100.0)


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/interventions", response_model=SCAAnalytics)
async def get_intervention_analytics(
    days: int = Query(30, ge=1, le=365, description="Timeframe in days"),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get analytics on intervention plan effectiveness (admin only).
    
    Provides metrics on:
    - Total plans created
    - Completion rates
    - Engagement metrics
    - Risk level distribution
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Total plans in timeframe
    total_query = select(func.count()).select_from(InterventionPlanRecord).where(
        InterventionPlanRecord.created_at >= cutoff_date
    )
    total_result = await db.execute(total_query)
    total_plans = total_result.scalar() or 0
    
    # Active plans
    active_query = select(func.count()).select_from(InterventionPlanRecord).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.status == "active",
            InterventionPlanRecord.is_active == True
        )
    )
    active_result = await db.execute(active_query)
    active_plans = active_result.scalar() or 0
    
    # Completed plans
    completed_query = select(func.count()).select_from(InterventionPlanRecord).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.status == "completed"
        )
    )
    completed_result = await db.execute(completed_query)
    completed_plans = completed_result.scalar() or 0
    
    # Archived plans
    archived_query = select(func.count()).select_from(InterventionPlanRecord).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.status == "archived"
        )
    )
    archived_result = await db.execute(archived_query)
    archived_plans = archived_result.scalar() or 0
    
    # Average completion percentage
    avg_completion_query = select(
        func.avg(
            case(
                (InterventionPlanRecord.total_steps > 0, 
                 InterventionPlanRecord.completed_steps * 100.0 / InterventionPlanRecord.total_steps),
                else_=0
            )
        )
    ).where(InterventionPlanRecord.created_at >= cutoff_date)
    avg_completion_result = await db.execute(avg_completion_query)
    avg_completion_pct = avg_completion_result.scalar() or 0.0
    
    # Plans viewed in last 24h
    viewed_24h_query = select(func.count()).select_from(InterventionPlanRecord).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.last_viewed_at >= datetime.now() - timedelta(hours=24)
        )
    )
    viewed_24h_result = await db.execute(viewed_24h_query)
    plans_viewed_24h = viewed_24h_result.scalar() or 0
    
    # Plans not viewed in 7 days
    not_viewed_7d_query = select(func.count()).select_from(InterventionPlanRecord).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.is_active == True,
            func.coalesce(InterventionPlanRecord.last_viewed_at, InterventionPlanRecord.created_at) 
                < datetime.now() - timedelta(days=7)
        )
    )
    not_viewed_7d_result = await db.execute(not_viewed_7d_query)
    plans_not_viewed_7d = not_viewed_7d_result.scalar() or 0
    
    # Risk level distribution
    risk_distribution_query = select(
        InterventionPlanRecord.risk_level,
        func.count()
    ).where(
        InterventionPlanRecord.created_at >= cutoff_date
    ).group_by(InterventionPlanRecord.risk_level)
    risk_distribution_result = await db.execute(risk_distribution_query)
    risk_distribution = {}
    risk_labels = {0: "low", 1: "medium", 2: "high", 3: "critical", None: "unknown"}
    for risk_level, count in risk_distribution_result:
        risk_distribution[risk_labels.get(risk_level, "unknown")] = count
    
    # Calculate rates
    completion_rate = (completed_plans / total_plans * 100) if total_plans > 0 else 0.0
    abandonment_rate = (archived_plans / total_plans * 100) if total_plans > 0 else 0.0
    
    # Average days to completion (for completed plans)
    avg_days_query = select(
        func.avg(
            func.extract('epoch', InterventionPlanRecord.updated_at - InterventionPlanRecord.created_at) / 86400
        )
    ).where(
        and_(
            InterventionPlanRecord.created_at >= cutoff_date,
            InterventionPlanRecord.status == "completed"
        )
    )
    avg_days_result = await db.execute(avg_days_query)
    avg_days_to_completion = avg_days_result.scalar()
    
    return SCAAnalytics(
        total_plans=total_plans,
        active_plans=active_plans,
        completed_plans=completed_plans,
        archived_plans=archived_plans,
        avg_completion_percentage=round(avg_completion_pct, 2),
        avg_days_to_completion=round(avg_days_to_completion, 2) if avg_days_to_completion else None,
        plans_viewed_in_24h=plans_viewed_24h,
        plans_not_viewed_in_7d=plans_not_viewed_7d,
        risk_level_distribution=risk_distribution,
        completion_rate=round(completion_rate, 2),
        abandonment_rate=round(abandonment_rate, 2),
        timeframe_days=days,
        generated_at=datetime.now()
    )


@router.get("/cbt-modules/usage", response_model=List[CBTModuleUsage])
async def get_cbt_module_usage(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get CBT module usage statistics from intervention plans (admin only).
    
    Analyzes plan_data JSON to extract module mentions and completion rates.
    """
    cutoff_date = datetime.now() - timedelta(days=days)
    
    # Get all plans in timeframe
    query = select(InterventionPlanRecord).where(
        InterventionPlanRecord.created_at >= cutoff_date
    )
    result = await db.execute(query)
    plans = result.scalars().all()
    
    # Analyze module usage
    module_stats: dict[str, dict] = {}
    
    for plan in plans:
        plan_data = plan.plan_data or {}
        plan_steps = plan_data.get("plan_steps", [])
        
        # Extract module names from steps and resources
        for step in plan_steps:
            step_title = step.get("title", "")
            # Simple heuristic: look for "CBT" or module-like titles
            if "CBT" in step_title or "Cognitive" in step_title or "Behavioral" in step_title:
                module_name = step_title
                if module_name not in module_stats:
                    module_stats[module_name] = {"count": 0, "total_steps": 0, "completed": 0}
                module_stats[module_name]["count"] += 1
                module_stats[module_name]["total_steps"] += 1
                if step.get("completed", False):
                    module_stats[module_name]["completed"] += 1
    
    # Convert to response format
    usage_list = []
    for module_name, stats in module_stats.items():
        avg_completion = (stats["completed"] / stats["total_steps"] * 100) if stats["total_steps"] > 0 else 0.0
        usage_list.append(CBTModuleUsage(
            module_name=module_name,
            usage_count=stats["count"],
            avg_completion_rate=round(avg_completion, 2),
            total_steps=stats["total_steps"]
        ))
    
    # Sort by usage count
    usage_list.sort(key=lambda x: x.usage_count, reverse=True)
    
    return usage_list


@router.get("/users/progress", response_model=List[UserProgress])
async def get_user_progress_summary(
    limit: int = Query(50, ge=1, le=200),
    min_plans: int = Query(1, ge=1, description="Minimum number of plans to include user"),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get aggregated user progress across intervention plans (admin only).
    
    Returns anonymized user summaries with engagement scores.
    """
    # Aggregate by user_id
    query = select(
        InterventionPlanRecord.user_id,
        func.count(InterventionPlanRecord.id).label("total_plans"),
        func.sum(case((InterventionPlanRecord.status == "active", 1), else_=0)).label("active_plans"),
        func.sum(case((InterventionPlanRecord.status == "completed", 1), else_=0)).label("completed_plans"),
        func.avg(
            case(
                (InterventionPlanRecord.total_steps > 0,
                 InterventionPlanRecord.completed_steps * 100.0 / InterventionPlanRecord.total_steps),
                else_=0
            )
        ).label("avg_completion"),
        func.max(InterventionPlanRecord.created_at).label("last_plan_created"),
        func.max(InterventionPlanRecord.last_viewed_at).label("last_viewed")
    ).group_by(
        InterventionPlanRecord.user_id
    ).having(
        func.count(InterventionPlanRecord.id) >= min_plans
    ).order_by(
        desc("total_plans")
    ).limit(limit)
    
    result = await db.execute(query)
    user_stats = result.all()
    
    # Convert to response format
    now = datetime.now()
    progress_list = []
    for stat in user_stats:
        days_since_last_viewed = None
        if stat.last_viewed:
            days_since_last_viewed = (now - stat.last_viewed).days
        
        engagement_score = calculate_engagement_score(
            total_plans=stat.total_plans,
            completed_plans=stat.completed_plans or 0,
            avg_completion=stat.avg_completion or 0.0,
            days_since_last=days_since_last_viewed
        )
        
        progress_list.append(UserProgress(
            user_hash=anonymize_user_id(stat.user_id),
            total_plans=stat.total_plans,
            active_plans=stat.active_plans or 0,
            completed_plans=stat.completed_plans or 0,
            avg_completion_percentage=round(stat.avg_completion or 0.0, 2),
            last_plan_created=stat.last_plan_created,
            engagement_score=round(engagement_score, 2)
        ))
    
    return progress_list


# ============================================================================
# RETENTION / ACTIVITY ANALYTICS
# ============================================================================


@router.get("/retention/active", response_model=ActiveUsersSummary)
async def get_active_users_summary(
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db),
) -> ActiveUsersSummary:
    """Return DAU/WAU/MAU based on `user_daily_activity`."""

    today = date.today()

    dau = (
        await db.execute(
            select(func.count())
            .select_from(UserDailyActivity)
            .where(UserDailyActivity.activity_date == today)
        )
    ).scalar() or 0

    wau_start = today - timedelta(days=6)
    wau = (
        await db.execute(
            select(func.count(func.distinct(UserDailyActivity.user_id)))
            .select_from(UserDailyActivity)
            .where(UserDailyActivity.activity_date >= wau_start)
            .where(UserDailyActivity.activity_date <= today)
        )
    ).scalar() or 0

    mau_start = today - timedelta(days=29)
    mau = (
        await db.execute(
            select(func.count(func.distinct(UserDailyActivity.user_id)))
            .select_from(UserDailyActivity)
            .where(UserDailyActivity.activity_date >= mau_start)
            .where(UserDailyActivity.activity_date <= today)
        )
    ).scalar() or 0

    return ActiveUsersSummary(dau=int(dau), wau=int(wau), mau=int(mau), as_of=today)


@router.get("/retention/dau", response_model=DailyActiveUsersSeries)
async def get_daily_active_users_series(
    days: int = Query(30, ge=1, le=365, description="How many trailing days to return"),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db),
) -> DailyActiveUsersSeries:
    """Return daily active users time series."""

    today = date.today()
    start = today - timedelta(days=days - 1)

    rows = (
        await db.execute(
            select(
                UserDailyActivity.activity_date,
                func.count().label("active_users"),
                func.coalesce(func.sum(UserDailyActivity.request_count), 0).label("total_requests"),
            )
            .where(UserDailyActivity.activity_date >= start)
            .where(UserDailyActivity.activity_date <= today)
            .group_by(UserDailyActivity.activity_date)
            .order_by(UserDailyActivity.activity_date.asc())
        )
    ).all()

    points = [
        DailyActiveUsersPoint(
            activity_date=row[0],
            active_users=int(row[1] or 0),
            total_requests=int(row[2] or 0),
        )
        for row in rows
    ]

    return DailyActiveUsersSeries(days=days, generated_at=datetime.utcnow(), points=points)


@router.get("/retention/cohorts", response_model=CohortRetentionSeries)
async def get_cohort_retention(
    cohort_days: int = Query(30, ge=1, le=365, description="How many cohort start dates to include"),
    day_n_values: List[int] = Query([1, 7, 30], description="Retention day offsets"),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db),
) -> CohortRetentionSeries:
    """Return cohort retention points from precomputed `retention_cohort_daily`.

    Cohorts are based on the first chat event per user.
    """

    today = date.today()
    start = today - timedelta(days=cohort_days - 1)

    normalized_day_ns = sorted({int(x) for x in day_n_values if int(x) >= 0})
    if not normalized_day_ns:
        normalized_day_ns = [1, 7, 30]

    rows = (
        await db.execute(
            select(
                RetentionCohortDaily.cohort_date,
                RetentionCohortDaily.day_n,
                RetentionCohortDaily.cohort_size,
                RetentionCohortDaily.retained_users,
            )
            .where(RetentionCohortDaily.cohort_date >= start)
            .where(RetentionCohortDaily.cohort_date <= today)
            .where(RetentionCohortDaily.day_n.in_(normalized_day_ns))
            .order_by(RetentionCohortDaily.cohort_date.asc(), RetentionCohortDaily.day_n.asc())
        )
    ).all()

    points: List[CohortRetentionPoint] = []
    for cohort_date, day_n, cohort_size, retained_users in rows:
        denom = int(cohort_size or 0)
        retained = int(retained_users or 0)
        rate = (retained / denom) if denom > 0 else 0.0
        points.append(
            CohortRetentionPoint(
                cohort_date=cohort_date,
                day_n=int(day_n),
                cohort_size=denom,
                retained_users=retained,
                retention_rate=rate,
            )
        )

    return CohortRetentionSeries(
        cohort_days=cohort_days,
        day_n_values=normalized_day_ns,
        generated_at=datetime.utcnow(),
        points=points,
    )


@router.get("/retention/summary", response_model=RetentionSummary)
async def get_retention_summary(
    day_n_values: List[int] = Query([1, 7, 30], description="Retention day offsets"),
    current_user: User = Depends(require_role(["admin"])),
    db: AsyncSession = Depends(get_async_db),
) -> RetentionSummary:
    """Return the latest cohort's D1/D7/D30 retention summary."""

    normalized_day_ns = sorted({int(x) for x in day_n_values if int(x) >= 0})
    if not normalized_day_ns:
        normalized_day_ns = [1, 7, 30]

    latest_date = (
        await db.execute(
            select(func.max(RetentionCohortDaily.cohort_date)).select_from(RetentionCohortDaily)
        )
    ).scalar()

    if latest_date is None:
        return RetentionSummary(
            cohort_date=None,
            day_n_values=normalized_day_ns,
            generated_at=datetime.utcnow(),
            points=[],
        )

    rows = (
        await db.execute(
            select(
                RetentionCohortDaily.day_n,
                RetentionCohortDaily.cohort_size,
                RetentionCohortDaily.retained_users,
            )
            .where(RetentionCohortDaily.cohort_date == latest_date)
            .where(RetentionCohortDaily.day_n.in_(normalized_day_ns))
            .order_by(RetentionCohortDaily.day_n.asc())
        )
    ).all()

    points: List[RetentionSummaryPoint] = []
    for day_n, cohort_size, retained_users in rows:
        denom = int(cohort_size or 0)
        retained = int(retained_users or 0)
        rate = (retained / denom) if denom > 0 else 0.0
        points.append(
            RetentionSummaryPoint(
                day_n=int(day_n),
                cohort_size=denom,
                retained_users=retained,
                retention_rate=rate,
            )
        )

    return RetentionSummary(
        cohort_date=latest_date,
        day_n_values=normalized_day_ns,
        generated_at=datetime.utcnow(),
        points=points,
    )
