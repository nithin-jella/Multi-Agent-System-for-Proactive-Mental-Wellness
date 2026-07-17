"""Retention cohort materialization utilities."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable, Sequence
import logging

from sqlalchemy import Integer, cast, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RetentionCohortDaily, UserDailyActivity, UserEvent

logger = logging.getLogger(__name__)


def _normalize_day_ns(values: Sequence[int]) -> list[int]:
    normalized = sorted({int(v) for v in values if int(v) >= 0})
    return normalized or [1, 7, 30]


def _cohort_date_range(cohort_days: int) -> tuple[date, date]:
    today = date.today()
    days = max(int(cohort_days), 1)
    start = today - timedelta(days=days - 1)
    return start, today


async def compute_retention_cohorts(
    db: AsyncSession,
    *,
    cohort_days: int = 30,
    day_n_values: Sequence[int] = (1, 7, 30),
) -> int:
    """Compute cohort retention points into retention_cohort_daily.

    Cohorts are defined by each user's first chat event (UserEvent chat.first).
    Retention is computed for the requested day offsets.

    Returns the number of rows inserted.
    """
    day_ns = _normalize_day_ns(day_n_values)
    start, end = _cohort_date_range(cohort_days)

    first_chat = (
        select(
            UserEvent.user_id.label("user_id"),
            func.min(func.date(UserEvent.occurred_at)).label("cohort_date"),
        )
        .where(UserEvent.event_name == "chat.first")
        .group_by(UserEvent.user_id)
        .subquery()
    )

    size_stmt = (
        select(
            first_chat.c.cohort_date,
            func.count().label("cohort_size"),
        )
        .where(first_chat.c.cohort_date >= start)
        .where(first_chat.c.cohort_date <= end)
        .group_by(first_chat.c.cohort_date)
    )

    day_n_expr = cast(
        UserDailyActivity.activity_date - first_chat.c.cohort_date,
        Integer,
    ).label("day_n")

    retained_stmt = (
        select(
            first_chat.c.cohort_date,
            day_n_expr,
            func.count(func.distinct(UserDailyActivity.user_id)).label("retained_users"),
        )
        .join(first_chat, UserDailyActivity.user_id == first_chat.c.user_id)
        .where(first_chat.c.cohort_date >= start)
        .where(first_chat.c.cohort_date <= end)
        .where(day_n_expr.in_(day_ns))
        .group_by(first_chat.c.cohort_date, day_n_expr)
    )

    size_rows = (await db.execute(size_stmt)).all()
    sizes = {row[0]: int(row[1] or 0) for row in size_rows}

    if not sizes:
        logger.info("No cohort sizes found for %s..%s", start, end)
        return 0

    retained_rows = (await db.execute(retained_stmt)).all()
    retained_map = {(row[0], int(row[1])): int(row[2] or 0) for row in retained_rows}

    rows: list[dict[str, int | date]] = []
    for cohort_date, cohort_size in sizes.items():
        for day_n in day_ns:
            rows.append(
                {
                    "cohort_date": cohort_date,
                    "day_n": int(day_n),
                    "cohort_size": int(cohort_size),
                    "retained_users": int(retained_map.get((cohort_date, day_n), 0)),
                }
            )

    await db.execute(
        delete(RetentionCohortDaily)
        .where(RetentionCohortDaily.cohort_date >= start)
        .where(RetentionCohortDaily.cohort_date <= end)
        .where(RetentionCohortDaily.day_n.in_(day_ns))
    )

    await db.execute(RetentionCohortDaily.__table__.insert(), rows)
    return len(rows)
