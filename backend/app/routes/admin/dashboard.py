"""Unified Admin Dashboard endpoints."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select, text, desc, bindparam
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import InsightsReport  # Core infrastructure model
from app.domains.mental_health.models import (
    Appointment,
    Case,
    CaseSeverityEnum,
    CaseStatusEnum,
    TriageAssessment,
)
from app.schemas.admin.dashboard import (
    AlertItem,
    DashboardKPIs,
    DashboardOverview,
    InsightsPanel,
    PatternInsight,
    RecommendationItem,
    SeverityDistribution,
    TrendingTopic,
    TrendsResponse,
    HistoricalDataPoint,
)


router = APIRouter(prefix="/dashboard", tags=["Admin - Dashboard"])
logger = logging.getLogger(__name__)


@router.get("/overview", response_model=DashboardOverview)
async def get_overview(
    time_range: int = Query(7, description="Time range in days (7, 30, 90)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> DashboardOverview:
    """
    Get comprehensive dashboard overview with KPIs, insights, and alerts.
    
    Supports time range filtering: 7d, 30d, 90d for trend analysis.
    """
    now = datetime.utcnow()
    start_week = now - timedelta(days=now.weekday())
    end_week = start_week + timedelta(days=7)
    
    # Time window for trends (user-configurable)
    window_days = min(max(time_range, 1), 365)  # Clamp between 1-365 days
    start = now - timedelta(days=window_days)
    prev_start = start - timedelta(days=window_days)

    # ===== KPI 1: Active critical cases =====
    active_critical_stmt = select(func.count()).where(
        and_(
            Case.status != CaseStatusEnum.closed,
            Case.severity.in_((CaseSeverityEnum.high, CaseSeverityEnum.critical)),
        )
    )
    active_critical = int((await db.execute(active_critical_stmt)).scalar() or 0)

    # ===== KPI 2: Cases opened this week =====
    cases_opened_stmt = (
        select(func.count())
        .select_from(Case)
        .where(Case.created_at >= start_week)
        .where(Case.created_at < end_week)
    )
    cases_opened_this_week = int((await db.execute(cases_opened_stmt)).scalar() or 0)

    # ===== KPI 3: Cases closed this week =====
    cases_closed_stmt = (
        select(func.count())
        .select_from(Case)
        .where(Case.status == CaseStatusEnum.closed)
        .where(Case.updated_at >= start_week)
        .where(Case.updated_at < end_week)
    )
    cases_closed_this_week = int((await db.execute(cases_closed_stmt)).scalar() or 0)

    # ===== KPI 4: Appointments this week =====
    appt_stmt = (
        select(func.count())
        .select_from(Appointment)
        .where(Appointment.appointment_datetime >= start_week)
        .where(Appointment.appointment_datetime < end_week)
    )
    appointments_this_week = int((await db.execute(appt_stmt)).scalar() or 0)

    # ===== KPI 5: Average case resolution time (in hours) =====
    # Calculate for cases closed in the selected time range
    resolution_time_stmt = select(
        func.avg(
            func.extract('epoch', Case.updated_at - Case.created_at) / 3600.0
        )
    ).where(
        and_(
            Case.status == CaseStatusEnum.closed,
            Case.updated_at >= start,
            Case.updated_at <= now,
        )
    )
    avg_resolution_hours = (await db.execute(resolution_time_stmt)).scalar()
    avg_case_resolution_time = round(float(avg_resolution_hours), 2) if avg_resolution_hours else None

    # ===== KPI 6: SLA breach count =====
    # Cases where sla_breach_at < now and status != closed
    sla_breach_stmt = select(func.count()).where(
        and_(
            Case.sla_breach_at < now,
            Case.status != CaseStatusEnum.closed,
        )
    )
    sla_breach_count = int((await db.execute(sla_breach_stmt)).scalar() or 0)

    # ===== KPI 7: Active campaigns count =====
    # TODO: Implement when campaigns table exists (Phase 5)
    active_campaigns_count = 0

    # ===== Sentiment calculation (proxy from triage risk) =====
    avg_risk_stmt = (
        select(func.avg(TriageAssessment.risk_score))
        .where(TriageAssessment.created_at >= start)
        .where(TriageAssessment.created_at <= now)
    )
    prev_avg_risk_stmt = (
        select(func.avg(TriageAssessment.risk_score))
        .where(TriageAssessment.created_at >= prev_start)
        .where(TriageAssessment.created_at < start)
    )
    avg_risk = (await db.execute(avg_risk_stmt)).scalar()
    prev_avg_risk = (await db.execute(prev_avg_risk_stmt)).scalar()

    overall_sentiment = None
    sentiment_delta = None
    if avg_risk is not None:
        overall_sentiment = round(max(0.0, min(1.0, 1.0 - float(avg_risk))) * 100, 2)
    if avg_risk is not None and prev_avg_risk is not None:
        curr_idx = 1.0 - float(avg_risk)
        prev_idx = 1.0 - float(prev_avg_risk)
        sentiment_delta = round((curr_idx - prev_idx) * 100, 2)

    kpis = DashboardKPIs(
        active_critical_cases=active_critical,
        overall_sentiment=overall_sentiment,
        sentiment_delta=sentiment_delta,
        appointments_this_week=appointments_this_week,
        cases_opened_this_week=cases_opened_this_week,
        cases_closed_this_week=cases_closed_this_week,
        avg_case_resolution_time=avg_case_resolution_time,
        sla_breach_count=sla_breach_count,
        active_campaigns_count=active_campaigns_count,
    )

    # ===== Insights Panel: Use stored IA reports =====
    # Try to get the latest insights report from database
    latest_report_stmt = (
        select(InsightsReport)
        .order_by(desc(InsightsReport.generated_at))
        .limit(1)
    )
    latest_report = (await db.execute(latest_report_stmt)).scalar_one_or_none()

    if latest_report:
        # Use stored IA report data
        ia_summary = latest_report.summary or "No summary available"
        
        # Extract trending topics from stored report
        trending = []
        if latest_report.trending_topics and isinstance(latest_report.trending_topics, dict):
            topics_list = latest_report.trending_topics.get("topics", [])
            trending = [
                TrendingTopic(topic=t.get("topic", ""), count=t.get("count", 0))
                for t in topics_list
            ]
    else:
        # Fallback: Generate on-the-fly trending topics (old behavior)
        trending: List[TrendingTopic] = []
        try:
            bind = db.get_bind()
            dialect_name = getattr(getattr(bind, "dialect", None), "name", None)
        except Exception:
            dialect_name = None

        if dialect_name == "postgresql":
            # Try to extract trending topics from risk_factors JSON array
            sql = text(
                """
                SELECT lower(trim(elem)) AS topic, COUNT(*) AS cnt
                FROM (
                  SELECT jsonb_array_elements_text(
                    CASE 
                      WHEN jsonb_typeof(triage_assessments.risk_factors::jsonb) = 'array' 
                      THEN triage_assessments.risk_factors::jsonb
                      ELSE '[]'::jsonb
                    END
                  ) AS elem
                  FROM triage_assessments
                  WHERE triage_assessments.created_at >= :start 
                    AND triage_assessments.created_at <= :end
                    AND triage_assessments.risk_factors IS NOT NULL
                ) t
                WHERE elem IS NOT NULL AND trim(elem) != ''
                GROUP BY lower(trim(elem))
                ORDER BY cnt DESC
                LIMIT 5
                """
            )
            try:
                rows = (await db.execute(sql, {"start": start, "end": now})).all()
                trending = [TrendingTopic(topic=str(t).strip('"'), count=int(c or 0)) for t, c in rows]
            except Exception as e:
                # Fallback if JSON parsing fails - rollback and use empty list
                logger.warning(f"Failed to extract trending topics from risk_factors: {e}")
                await db.rollback()
                trending = []
        else:
            hc_stmt = (
                select(TriageAssessment.severity_level, func.count())
                .where(TriageAssessment.created_at >= start)
                .where(TriageAssessment.created_at <= now)
                .group_by(TriageAssessment.severity_level)
                .order_by(func.count().desc())
                .limit(5)
            )
            rows = (await db.execute(hc_stmt)).all()
            trending = [TrendingTopic(topic=str(level), count=int(count)) for level, count in rows]

        # Generate summary from current data
        high_crit_stmt = (
            select(func.count())
            .select_from(TriageAssessment)
            .where(TriageAssessment.created_at >= start)
            .where(TriageAssessment.created_at <= now)
            .where(TriageAssessment.severity_level.in_(("high", "critical")))
        )
        high_crit = int((await db.execute(high_crit_stmt)).scalar() or 0)
        trend_dir = "up" if (sentiment_delta or 0) >= 0 else "down"
        sentiment_txt = (
            f"Sentiment {trend_dir} by {abs(sentiment_delta or 0):.2f} points; current {overall_sentiment:.2f}%"
            if overall_sentiment is not None
            else "Sentiment unavailable"
        )
        top_topics = ", ".join([t.topic.strip('"') for t in trending]) if trending else "no dominant topics"
        ia_summary = (
            f"Past {window_days} days: {high_crit} high/critical triage findings; "
            f"{sentiment_txt}. Active critical cases: {active_critical}. Trending: {top_topics}."
        )

    # ===== Extract LLM data from sentiment_data if available =====
    llm_patterns = None
    llm_recommendations = None
    llm_severity_dist = None
    llm_powered = None

    if latest_report and latest_report.sentiment_data and isinstance(latest_report.sentiment_data, dict):
        sd = latest_report.sentiment_data
        llm_powered = sd.get("llm_powered", None)

        raw_patterns = sd.get("patterns")
        if raw_patterns and isinstance(raw_patterns, list):
            llm_patterns = [
                PatternInsight(
                    title=p.get("title", ""),
                    description=p.get("description", ""),
                    severity=p.get("severity", "medium"),
                    trend=p.get("trend", "stable"),
                )
                for p in raw_patterns
                if isinstance(p, dict)
            ]

        raw_recs = sd.get("recommendations")
        if raw_recs and isinstance(raw_recs, list):
            llm_recommendations = [
                RecommendationItem(
                    title=r.get("title", ""),
                    description=r.get("description", ""),
                    priority=r.get("priority", "medium"),
                    category=r.get("category", "monitoring"),
                )
                for r in raw_recs
                if isinstance(r, dict)
            ]

        raw_sev = sd.get("severity_distribution")
        if raw_sev and isinstance(raw_sev, dict):
            llm_severity_dist = SeverityDistribution(
                low=int(raw_sev.get("low", 0)),
                medium=int(raw_sev.get("medium", 0)),
                high=int(raw_sev.get("high", 0)),
                critical=int(raw_sev.get("critical", 0)),
            )

    insights = InsightsPanel(
        trending_topics=trending,
        ia_summary=ia_summary,
        report_generated_at=latest_report.generated_at if latest_report else None,
        report_period=f"{latest_report.period_start.strftime('%Y-%m-%d')} to {latest_report.period_end.strftime('%Y-%m-%d')}" if latest_report else None,
        patterns=llm_patterns,
        recommendations=llm_recommendations,
        severity_distribution=llm_severity_dist,
        llm_powered=llm_powered,
    )

    # Recent alerts from cases
    alerts_stmt = (
        select(Case)
        .where(Case.severity.in_((CaseSeverityEnum.high, CaseSeverityEnum.critical)))
        .where(Case.status != CaseStatusEnum.closed)
        .order_by(Case.created_at.desc())
        .limit(10)
    )
    alerts_rows = (await db.execute(alerts_stmt)).scalars().all()
    alerts = [
        AlertItem(
            case_id=str(item.id),
            severity=item.severity.value if hasattr(item.severity, "value") else str(item.severity),
            created_at=item.created_at,  # type: ignore[arg-type]
            session_id=getattr(item, "session_id", None),
            user_hash=getattr(item, "user_hash", ""),
            summary=getattr(item, "summary_redacted", None),
        )
        for item in alerts_rows
    ]

    return DashboardOverview(kpis=kpis, insights=insights, alerts=alerts)


@router.get("/trends", response_model=TrendsResponse)
async def get_trends(
    time_range: int = Query(30, description="Time range in days (7, 30, 90)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> TrendsResponse:
    """
    Get historical trend data for dashboard charts.
    
    Returns time-series data for:
    - Sentiment trends over time
    - Case volume (opened/closed) over time
    - Trending topics over time
    
    Time range: 7d, 30d, or 90d
    """
    now = datetime.utcnow()
    window_days = min(max(time_range, 1), 365)  # Clamp between 1-365 days
    start = now - timedelta(days=window_days)
    
    # Determine bucket size based on time range
    if window_days <= 7:
        bucket_size_days = 1  # Daily buckets
    elif window_days <= 30:
        bucket_size_days = 3  # 3-day buckets
    else:
        bucket_size_days = 7  # Weekly buckets
    
    # ===== Sentiment Trends =====
    sentiment_data: List[HistoricalDataPoint] = []
    
    # Optimized: Fetch all relevant risk scores in one query to avoid N+1
    sentiment_stmt = (
        select(TriageAssessment.created_at, TriageAssessment.risk_score)
        .where(TriageAssessment.created_at >= start)
        .where(TriageAssessment.created_at < now)
        .order_by(TriageAssessment.created_at.asc())
    )
    sentiment_rows = (await db.execute(sentiment_stmt)).all()

    # Group into buckets in memory
    current_date = start
    row_idx = 0
    num_rows = len(sentiment_rows)

    while current_date < now:
        bucket_end = current_date + timedelta(days=bucket_size_days)
        
        bucket_risks = []
        while row_idx < num_rows and sentiment_rows[row_idx].created_at < bucket_end:
            if sentiment_rows[row_idx].risk_score is not None:
                bucket_risks.append(float(sentiment_rows[row_idx].risk_score))
            row_idx += 1
        
        sentiment_score = None
        if bucket_risks:
            avg_risk = sum(bucket_risks) / len(bucket_risks)
            sentiment_score = round(max(0.0, min(1.0, 1.0 - avg_risk)) * 100, 2)
        
        sentiment_data.append(
            HistoricalDataPoint(
                date=current_date.date(),
                value=sentiment_score,
            )
        )
        
        current_date = bucket_end
    
    # ===== Case Volume Trends =====
    cases_opened_data: List[HistoricalDataPoint] = []
    cases_closed_data: List[HistoricalDataPoint] = []
    
    # Optimized: Fetch all relevant case timestamps in two queries to avoid 2N queries
    opened_stmt = (
        select(Case.created_at)
        .where(Case.created_at >= start)
        .where(Case.created_at < now)
        .order_by(Case.created_at.asc())
    )
    closed_stmt = (
        select(Case.updated_at)
        .where(Case.status == CaseStatusEnum.closed)
        .where(Case.updated_at >= start)
        .where(Case.updated_at < now)
        .order_by(Case.updated_at.asc())
    )

    opened_rows = (await db.execute(opened_stmt)).scalars().all()
    closed_rows = (await db.execute(closed_stmt)).scalars().all()

    # Group into buckets in memory
    current_date = start
    o_idx, c_idx = 0, 0
    num_opened, num_closed = len(opened_rows), len(closed_rows)

    while current_date < now:
        bucket_end = current_date + timedelta(days=bucket_size_days)
        
        opened_count = 0
        while o_idx < num_opened and opened_rows[o_idx] < bucket_end:
            opened_count += 1
            o_idx += 1

        closed_count = 0
        while c_idx < num_closed and closed_rows[c_idx] < bucket_end:
            closed_count += 1
            c_idx += 1

        cases_opened_data.append(
            HistoricalDataPoint(date=current_date.date(), value=opened_count)
        )
        cases_closed_data.append(
            HistoricalDataPoint(date=current_date.date(), value=closed_count)
        )
        
        current_date = bucket_end
    
    # ===== Topic Trends (top 5 topics over time) =====
    # Get top 5 topics overall for the period
    try:
        bind = db.get_bind()
        dialect_name = getattr(getattr(bind, "dialect", None), "name", None)
    except Exception:
        dialect_name = None
    
    top_topics: List[str] = []
    if dialect_name == "postgresql":
        sql = text(
            """
            SELECT lower(trim(elem)) AS topic, COUNT(*) AS cnt
            FROM (
              SELECT jsonb_array_elements_text(
                CASE 
                  WHEN jsonb_typeof(triage_assessments.risk_factors::jsonb) = 'array' 
                  THEN triage_assessments.risk_factors::jsonb
                  ELSE '[]'::jsonb
                END
              ) AS elem
              FROM triage_assessments
              WHERE triage_assessments.created_at >= :start 
                AND triage_assessments.created_at <= :end
                AND triage_assessments.risk_factors IS NOT NULL
            ) t
            WHERE elem IS NOT NULL AND trim(elem) != ''
            GROUP BY lower(trim(elem))
            ORDER BY cnt DESC
            LIMIT 5
            """
        )
        try:
            rows = (await db.execute(sql, {"start": start, "end": now})).all()
            top_topics = [str(t).strip('"') for t, _ in rows]
        except Exception as e:
            logger.warning(f"Failed to extract top topics: {e}")
            await db.rollback()
    
    # Now get counts for each topic over time (Optimized: single query for PostgreSQL, efficient fallback)
    topic_trends = {topic: [] for topic in top_topics}

    if dialect_name == "postgresql" and top_topics:
        # Optimized for PostgreSQL: Fetch all topic counts per bucket in one query
        # We group by date_trunc and topic
        interval = f"{bucket_size_days} days"
        sql = text(
            f"""
            SELECT
                date_trunc('day', created_at) - (CAST(EXTRACT(day FROM created_at - :start) AS integer) % :bucket_size) * interval '1 day' AS bucket_start,
                lower(trim(elem)) AS topic,
                COUNT(*) AS cnt
            FROM (
              SELECT
                created_at,
                jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(triage_assessments.risk_factors::jsonb) = 'array'
                    THEN triage_assessments.risk_factors::jsonb
                    ELSE '[]'::jsonb
                  END
                ) AS elem
              FROM triage_assessments
              WHERE triage_assessments.created_at >= :start
                AND triage_assessments.created_at < :now
                AND triage_assessments.risk_factors IS NOT NULL
            ) t
            WHERE lower(trim(elem)) IN :top_topics
            GROUP BY bucket_start, topic
            ORDER BY bucket_start ASC
            """
        ).bindparams(bindparam("top_topics", expanding=True))
        try:
            rows = (await db.execute(sql, {
                "start": start,
                "now": now,
                "bucket_size": bucket_size_days,
                "top_topics": tuple(top_topics)
            })).all()

            # Map results back to topic_trends
            results_map = {(r.bucket_start.date(), r.topic): r.cnt for r in rows}

            for topic in top_topics:
                current_date = start
                while current_date < now:
                    count = results_map.get((current_date.date(), topic), 0)
                    topic_trends[topic].append(
                        HistoricalDataPoint(date=current_date.date(), value=count)
                    )
                    current_date = current_date + timedelta(days=bucket_size_days)
        except Exception as e:
            logger.warning(f"Failed to fetch optimized topic trends: {e}")
            await db.rollback()
            # Fallback: ensure data contract is satisfied with zero-valued points
            for topic in top_topics:
                topic_trends[topic] = []
                current_date = start
                while current_date < now:
                    topic_trends[topic].append(HistoricalDataPoint(date=current_date.date(), value=0))
                    current_date = current_date + timedelta(days=bucket_size_days)

    elif top_topics:
        # Fallback for non-PostgreSQL (efficient in-memory processing)
        assessments_stmt = (
            select(TriageAssessment.created_at, TriageAssessment.risk_factors)
            .where(TriageAssessment.created_at >= start)
            .where(TriageAssessment.created_at < now)
            .where(TriageAssessment.risk_factors.is_not(None))
            .order_by(TriageAssessment.created_at.asc())
        )
        rows = (await db.execute(assessments_stmt)).all()

        current_date = start
        row_idx = 0
        num_rows = len(rows)
        
        while current_date < now:
            bucket_end = current_date + timedelta(days=bucket_size_days)
            bucket_topic_counts = {topic: 0 for topic in top_topics}
            
            while row_idx < num_rows and rows[row_idx].created_at < bucket_end:
                factors = rows[row_idx].risk_factors
                if isinstance(factors, list):
                    for factor in factors:
                        normalized = str(factor).strip().lower()
                        if normalized in bucket_topic_counts:
                            bucket_topic_counts[normalized] += 1
                row_idx += 1

            for topic in top_topics:
                topic_trends[topic].append(
                    HistoricalDataPoint(date=current_date.date(), value=bucket_topic_counts[topic])
                )
            current_date = bucket_end
    
    return TrendsResponse(
        sentiment_trend=sentiment_data,
        cases_opened_trend=cases_opened_data,
        cases_closed_trend=cases_closed_data,
        topic_trends=topic_trends,
        time_range_days=window_days,
        bucket_size_days=bucket_size_days,
    )
