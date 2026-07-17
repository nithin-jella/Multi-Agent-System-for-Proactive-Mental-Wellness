import asyncio
import time
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional
import sys
import os

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, Integer, String, DateTime, Float, Enum as SQLEnum, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

# Mocking models to avoid dependency hell in standalone script if needed,
# but let's try to use the real ones first.
from app.domains.mental_health.models.assessments import TriageAssessment
from app.domains.mental_health.models.cases import Case, CaseStatusEnum, CaseSeverityEnum
from app.database import Base

# Test Database URL
DATABASE_URL = "sqlite+aiosqlite:///./test_benchmark.db"

async def setup_db():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    return engine

async def seed_data(engine):
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        now = datetime.utcnow()
        # Seed TriageAssessments
        for i in range(1000):
            created_at = now - timedelta(days=i % 90, hours=i % 24)
            # Some with risk factors, some without
            risk_factors = ["anxiety", "depression"] if i % 2 == 0 else []
            if i % 5 == 0: risk_factors.append("stress")

            assessment = TriageAssessment(
                risk_score=0.1 + (i % 10) / 10.0,
                confidence_score=0.8,
                severity_level="low" if i % 3 == 0 else "medium",
                risk_factors=risk_factors,
                created_at=created_at
            )
            session.add(assessment)

        # Seed Cases
        for i in range(1000):
            created_at = now - timedelta(days=i % 90, hours=i % 24)
            updated_at = created_at + timedelta(hours=i % 48)
            status = CaseStatusEnum.closed if i % 2 == 0 else CaseStatusEnum.in_progress

            case = Case(
                created_at=created_at,
                updated_at=updated_at,
                status=status,
                severity=CaseSeverityEnum.low if i % 4 == 0 else CaseSeverityEnum.med,
                user_hash=f"user_{i}"
            )
            session.add(case)

        await session.commit()

# The original unoptimized logic
async def original_get_trends(db: AsyncSession, time_range: int):
    from app.schemas.admin.dashboard import HistoricalDataPoint, TrendsResponse

    now = datetime.utcnow()
    window_days = min(max(time_range, 1), 365)
    start = now - timedelta(days=window_days)

    if window_days <= 7:
        bucket_size_days = 1
    elif window_days <= 30:
        bucket_size_days = 3
    else:
        bucket_size_days = 7

    # ===== Sentiment Trends =====
    sentiment_data: List[HistoricalDataPoint] = []
    current_date = start
    while current_date < now:
        bucket_end = current_date + timedelta(days=bucket_size_days)
        avg_risk_stmt = (
            select(func.avg(TriageAssessment.risk_score))
            .where(TriageAssessment.created_at >= current_date)
            .where(TriageAssessment.created_at < bucket_end)
        )
        avg_risk = (await db.execute(avg_risk_stmt)).scalar()
        sentiment_score = None
        if avg_risk is not None:
            sentiment_score = round(max(0.0, min(1.0, 1.0 - float(avg_risk))) * 100, 2)
        sentiment_data.append(HistoricalDataPoint(date=current_date.date(), value=sentiment_score))
        current_date = bucket_end

    # ===== Case Volume Trends =====
    cases_opened_data: List[HistoricalDataPoint] = []
    cases_closed_data: List[HistoricalDataPoint] = []
    current_date = start
    while current_date < now:
        bucket_end = current_date + timedelta(days=bucket_size_days)
        opened_stmt = (
            select(func.count()).select_from(Case)
            .where(Case.created_at >= current_date).where(Case.created_at < bucket_end)
        )
        opened_count = int((await db.execute(opened_stmt)).scalar() or 0)
        closed_stmt = (
            select(func.count()).select_from(Case)
            .where(Case.status == CaseStatusEnum.closed)
            .where(Case.updated_at >= current_date).where(Case.updated_at < bucket_end)
        )
        closed_count = int((await db.execute(closed_stmt)).scalar() or 0)
        cases_opened_data.append(HistoricalDataPoint(date=current_date.date(), value=opened_count))
        cases_closed_data.append(HistoricalDataPoint(date=current_date.date(), value=closed_count))
        current_date = bucket_end

    # ===== Topic Trends (Simplified for benchmark - skip PostgreSQL specific JSON for now as we use SQLite) =====
    # In SQLite dialect_name won't be "postgresql"
    top_topics = ["anxiety", "depression", "stress"] # Mock top topics
    topic_trends = {}
    for topic in top_topics:
        topic_data: List[HistoricalDataPoint] = []
        current_date = start
        while current_date < now:
            bucket_end = current_date + timedelta(days=bucket_size_days)
            # SQLite fallback in original code is 'count = 0'
            # Let's make it actually do something to represent the N+1 issue
            # Even if it returns 0, the query overhead is what we want to measure
            sql = text("SELECT 0")
            count = (await db.execute(sql)).scalar()
            topic_data.append(HistoricalDataPoint(date=current_date.date(), value=int(count or 0)))
            current_date = bucket_end
        topic_trends[topic] = topic_data

    return {
        "sentiment_trend": sentiment_data,
        "cases_opened_trend": cases_opened_data,
        "cases_closed_trend": cases_closed_data,
        "topic_trends": topic_trends
    }

async def run_benchmark():
    engine = await setup_db()
    await seed_data(engine)

    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    ranges = [7, 30, 90]
    for r in ranges:
        async with async_session() as session:
            start_time = time.time()
            result = await original_get_trends(session, r)
            end_time = time.time()
            print(f"Original logic - Range {r}d: {end_time - start_time:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
