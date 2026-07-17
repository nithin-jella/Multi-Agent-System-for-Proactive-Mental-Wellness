"""AI memory facts service.

This provides a minimal, privacy-oriented cross-conversation memory store:
- Facts are stored encrypted at rest.
- Facts are only *used by the agent* when `users.consent_ai_memory` is True.
- Users can list and delete facts via Profile endpoints.

The extractor is intentionally conservative (preferences/identity only).
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, List, Optional, cast

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserAIMemoryFact

logger = logging.getLogger(__name__)


async def _is_ai_memory_consented(db: AsyncSession, user_id: int) -> bool:
    """Return persisted consent flag using an explicit query.

    This avoids lazy-loading `User.consent_ai_memory` from potentially detached
    ORM instances passed across request-scoped dependencies.
    """
    stmt = select(User.consent_ai_memory).where(User.id == user_id)
    consent_value = (await db.execute(stmt)).scalar_one_or_none()
    return bool(consent_value)


@dataclass(frozen=True)
class CandidateFact:
    text: str
    category: str


def _normalize_fact_text(text: str) -> str:
    # Keep it stable for hashing/dedup.
    return re.sub(r"\s+", " ", text.strip()).lower()


def _hash_fact(user_id: int, normalized_fact_text: str) -> str:
    return hashlib.sha256(f"{user_id}:{normalized_fact_text}".encode("utf-8")).hexdigest()


_FACT_PATTERNS: list[tuple[str, str, re.Pattern[str]]] = [
    (
        "identity",
        "preferred_name",
        re.compile(r"\b(call me|please call me|i go by|my name is)\s+(?P<value>[A-Za-z][A-Za-z\-\s]{0,50})\b", re.IGNORECASE),
    ),
    (
        "identity",
        "pronouns",
        re.compile(r"\b(my pronouns are|pronouns:)\s*(?P<value>[A-Za-z/]{2,20})\b", re.IGNORECASE),
    ),
    (
        "preference",
        "language",
        re.compile(r"\b(i prefer|please use)\s+(?P<value>english|bahasa|indonesian)\b", re.IGNORECASE),
    ),
    (
        "preference",
        "timezone",
        re.compile(r"\b(my timezone is|timezone:)\s*(?P<value>[A-Za-z_]+/[A-Za-z_]+)\b", re.IGNORECASE),
    ),
]


def extract_candidate_facts(message: str) -> List[CandidateFact]:
    """Extract conservative, stable facts from a single user message."""
    candidates: List[CandidateFact] = []
    if not message or not message.strip():
        return candidates

    for category, fact_kind, pattern in _FACT_PATTERNS:
        match = pattern.search(message)
        if not match:
            continue
        value = match.group("value").strip()
        # Trim trailing punctuation
        value = value.rstrip(".!,;:")

        if fact_kind == "preferred_name":
            candidates.append(CandidateFact(text=f"Preferred name: {value}", category=category))
        elif fact_kind == "pronouns":
            candidates.append(CandidateFact(text=f"Pronouns: {value}", category=category))
        elif fact_kind == "language":
            candidates.append(CandidateFact(text=f"Preferred language: {value}", category=category))
        elif fact_kind == "timezone":
            candidates.append(CandidateFact(text=f"Preferred timezone: {value}", category=category))

    # De-dup within message
    seen = set()
    unique: List[CandidateFact] = []
    for cand in candidates:
        key = _normalize_fact_text(cand.text)
        if key in seen:
            continue
        seen.add(key)
        unique.append(cand)

    return unique


async def upsert_facts(
    db: AsyncSession,
    user_id: int,
    facts: Iterable[CandidateFact],
    *,
    source: Optional[str] = None,
) -> int:
    """Insert facts if missing (dedup via (user_id, fact_hash)). Returns inserted count."""
    inserted = 0
    for fact in facts:
        normalized = _normalize_fact_text(fact.text)
        fact_hash = _hash_fact(user_id, normalized)

        # Postgres fast-path: ON CONFLICT DO UPDATE to bump updated_at.
        try:
            stmt = (
                insert(UserAIMemoryFact)
                .values(
                    user_id=user_id,
                    fact_encrypted=fact.text,  # No longer encrypted, kept column name for compatibility
                    fact_hash=fact_hash,
                    category=fact.category,
                    source=source,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                .on_conflict_do_update(
                    constraint="uq_user_ai_memory_fact_hash",
                    set_={
                        "updated_at": datetime.utcnow(),
                        "source": source,
                        "category": fact.category,
                    },
                )
            )
            result = cast(CursorResult[Any], await db.execute(stmt))
            # rowcount is 1 on insert or update; we treat only insert as unknown.
            # We keep it simple and count attempts as inserted=+1 if succeeded.
            if result.rowcount:
                inserted += 1
        except Exception:
            # Fallback for non-Postgres (or if dialect insert isn't supported): do a select + insert
            try:
                exists_stmt = select(UserAIMemoryFact.id).where(
                    UserAIMemoryFact.user_id == user_id,
                    UserAIMemoryFact.fact_hash == fact_hash,
                )
                exists = (await db.execute(exists_stmt)).scalar_one_or_none()
                if exists:
                    continue
                db.add(
                    UserAIMemoryFact(
                        user_id=user_id,
                        fact_encrypted=fact.text,  # No longer encrypted
                        fact_hash=fact_hash,
                        category=fact.category,
                        source=source,
                    )
                )
                inserted += 1
            except Exception as exc:
                logger.warning("Failed to upsert AI memory fact", exc_info=True)

    return inserted


async def remember_from_user_message(
    db: AsyncSession,
    user: User,
    message: str,
    *,
    source: str = "conversation",
) -> None:
    """Extract + store candidate facts if user consented."""
    user_id = int(getattr(user, "id", 0) or 0)
    if user_id <= 0:
        return

    if not await _is_ai_memory_consented(db, user_id):
        return

    facts = extract_candidate_facts(message)
    if not facts:
        return

    try:
        await upsert_facts(db, user_id, facts, source=source)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Failed to remember AI memory facts", exc_info=True)


async def list_user_facts(db: AsyncSession, user_id: int, limit: int = 50) -> List[UserAIMemoryFact]:
    stmt = (
        select(UserAIMemoryFact)
        .where(UserAIMemoryFact.user_id == user_id)
        .order_by(UserAIMemoryFact.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_user_fact_texts_for_agent(db: AsyncSession, user: User, limit: int = 20) -> List[str]:
    """Return fact texts only if consent_ai_memory is enabled."""
    user_id = int(getattr(user, "id", 0) or 0)
    if user_id <= 0:
        return []

    if not await _is_ai_memory_consented(db, user_id):
        return []

    rows = await list_user_facts(db, user_id, limit=limit)
    texts: List[str] = []
    for row in rows:
        # fact_encrypted column now stores plaintext (encryption removed for performance)
        if row.fact_encrypted:
            texts.append(row.fact_encrypted)
    return texts


async def delete_user_fact(db: AsyncSession, user_id: int, fact_id: int) -> bool:
    stmt = delete(UserAIMemoryFact).where(UserAIMemoryFact.user_id == user_id, UserAIMemoryFact.id == fact_id)
    result = cast(CursorResult[Any], await db.execute(stmt))
    await db.commit()
    return bool(result.rowcount)
