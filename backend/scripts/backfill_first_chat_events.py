from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.domains.mental_health.models import Conversation
from app.models import UserEvent
from app.services.retention_service import compute_retention_cohorts
from app.services.user_event_service import record_user_event


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill chat.first events from conversations")
    parser.add_argument("--dry-run", action="store_true", help="Report counts without writing changes")
    parser.add_argument("--recompute-cohorts", action="store_true", help="Recompute retention cohorts after backfill")
    parser.add_argument("--cohort-days", type=int, default=30, help="Cohort lookback window in days")
    parser.add_argument(
        "--day-n-values",
        type=str,
        default="1,7,30",
        help="Comma-separated day offsets to compute (e.g. 1,7,30)",
    )
    return parser.parse_args()


def _parse_day_n_values(raw: str) -> list[int]:
    values: list[int] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            value = int(item)
        except ValueError:
            continue
        if value >= 0:
            values.append(value)
    normalized = sorted(set(values))
    return normalized or [1, 7, 30]


async def _load_first_conversations(session: AsyncSession) -> list[tuple[int, str | None]]:
    ranked = (
        select(
            Conversation.user_id.label("user_id"),
            Conversation.session_id.label("session_id"),
            func.row_number()
            .over(
                partition_by=Conversation.user_id,
                order_by=(Conversation.timestamp.asc(), Conversation.id.asc()),
            )
            .label("rn"),
        )
        .subquery()
    )

    rows = (
        await session.execute(
            select(ranked.c.user_id, ranked.c.session_id).where(ranked.c.rn == 1)
        )
    ).all()

    return [(int(row[0]), row[1]) for row in rows]


async def _load_existing_first_chat_users(session: AsyncSession) -> set[int]:
    rows = (
        await session.execute(
            select(UserEvent.user_id)
            .where(UserEvent.event_name == "chat.first")
            .distinct()
        )
    ).all()

    return {int(row[0]) for row in rows}


async def _backfill_events(session: AsyncSession, *, dry_run: bool) -> int:
    first_conversations = await _load_first_conversations(session)
    existing_users = await _load_existing_first_chat_users(session)

    inserted = 0
    for user_id, session_id in first_conversations:
        if user_id in existing_users:
            continue
        inserted += 1
        if dry_run:
            continue
        await record_user_event(
            session,
            user_id=user_id,
            event_name="chat.first",
            session_id=session_id,
            request_id=None,
            ip_address=None,
            user_agent=None,
            metadata={
                "source": "backfill",
            },
        )

    return inserted


async def _main() -> int:
    args = _parse_args()
    day_ns = _parse_day_n_values(args.day_n_values)

    async with AsyncSessionLocal() as session:
        inserted = await _backfill_events(session, dry_run=args.dry_run)

        if args.dry_run:
            print(f"Dry run: would insert {inserted} chat.first events")
            return 0

        await session.commit()
        print(f"Inserted {inserted} chat.first events")

        if args.recompute_cohorts:
            updated = await compute_retention_cohorts(
                session,
                cohort_days=args.cohort_days,
                day_n_values=day_ns,
            )
            await session.commit()
            print(f"Recomputed retention cohorts: {updated} rows")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
