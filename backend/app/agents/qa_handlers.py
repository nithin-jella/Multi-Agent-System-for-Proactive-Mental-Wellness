import re
from datetime import datetime, timedelta
from typing import Dict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User  # Core model
from app.domains.mental_health.models import TriageAssessment

__all__ = [
    "extract_timeframe_days",
    "answer_triage_question",
    "answer_analytics_question",
]

def extract_timeframe_days(question: str, default: int = 7) -> int:
    if not question:
        return default
    match = re.search(r"(?:last|past)\s+(\d{1,3})\s+day", question, re.IGNORECASE)
    if match:
        try:
            val = int(match.group(1))
            if 1 <= val <= 365:
                return val
        except ValueError:
            pass
    if re.search(r"last\s+week", question, re.IGNORECASE):
        return 7
    if re.search(r"last\s+month", question, re.IGNORECASE):
        return 30
    return default

async def answer_triage_question(db: AsyncSession, question: str) -> Dict:
    days = extract_timeframe_days(question, 7)
    cutoff = datetime.utcnow() - timedelta(days=days)
    high_severity_stmt = (
        select(func.count(TriageAssessment.id))
        .where(TriageAssessment.created_at >= cutoff)
        .where(
            func.lower(TriageAssessment.severity_level).in_(["high", "critical", "severe"]) | (TriageAssessment.risk_score >= 0.85)
        )
    )
    total_stmt = select(func.count(TriageAssessment.id)).where(TriageAssessment.created_at >= cutoff)
    high_count = (await db.execute(high_severity_stmt)).scalar() or 0
    total_count = (await db.execute(total_stmt)).scalar() or 0
    pct = (high_count / total_count * 100.0) if total_count else 0.0
    answer = (
        f"There were {high_count} high-risk triage assessments (out of {total_count}, {pct:.1f}% ) in the last {days} days."
    )
    return {
        "answer": answer,
        "metrics": {
            "high_risk_count": high_count,
            "total": total_count,
            "percentage_high": round(pct, 2),
            "timeframe_days": days,
        },
    }

async def answer_analytics_question(db: AsyncSession, question: str) -> Dict:
    days = extract_timeframe_days(question, 30)
    cutoff = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(
            TriageAssessment.user_id,
            func.count(TriageAssessment.id).label("cnt"),
            func.max(TriageAssessment.created_at).label("last_at"),
        )
        .where(TriageAssessment.user_id.isnot(None))
        .where(TriageAssessment.created_at >= cutoff)
        .where(
            func.lower(TriageAssessment.severity_level).in_(["high", "critical", "severe", "medium"]) | (TriageAssessment.risk_score >= 0.75)
        )
        .group_by(TriageAssessment.user_id)
        .order_by(func.count(TriageAssessment.id).desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        return {
            "answer": f"No flagged behaviours detected in the last {days} days.",
            "metrics": {"timeframe_days": days, "flagged_users": 0},
        }
    user_id, count, last_at = row
    user_stmt = select(User).where(User.id == user_id)
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    identifier = (user.name or user.email or f"user:{user_id}") if user else f"user:{user_id}"
    answer = (
        f"The user with the most flagged behaviours in the last {days} days is {identifier} with {count} concerning assessments (last at {last_at:%Y-%m-%d %H:%M UTC})."
    )
    return {
        "answer": answer,
        "metrics": {
            "user_id": user_id,
            "count": count,
            "last_at": last_at.isoformat() if last_at else None,
            "timeframe_days": days,
        },
    }
