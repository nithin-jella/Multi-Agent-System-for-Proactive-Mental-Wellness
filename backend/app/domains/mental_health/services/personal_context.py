"""Utilities to assemble personalized context for chat responses."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User  # Core model
from app.domains.mental_health.models import Appointment, JournalEntry, UserSummary
from app.core.cache import cached, get_cache_service
from app.core.settings import settings
from app.services.user_normalization import (
    allow_email_checkins as allow_email_checkins_for_user,
    display_name as display_name_for_user,
)

_CACHE_TTL = timedelta(minutes=5)
_PERSONAL_CONTEXT_TTL_SECONDS = int(_CACHE_TTL.total_seconds())


def _personal_context_cache_key(user_id: int) -> str:
    return f"cache:personal_context:{user_id}"


@cached(key_prefix="user_summary", ttl=settings.cache_user_summary_ttl)
async def _get_latest_summary(db: AsyncSession, user_id: int) -> Optional[str]:
    """Get latest user summary with Redis caching."""
    stmt = (
        select(UserSummary.summary_text)
        .where(UserSummary.user_id == user_id)
        .order_by(UserSummary.timestamp.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    summary_row = result.scalar_one_or_none()
    if summary_row:
        return summary_row.strip()
    return None


@cached(key_prefix="journal_highlights", ttl=settings.cache_journal_ttl)
async def _get_recent_journal_highlights(db: AsyncSession, user_id: int, limit: int = 2) -> List[str]:
    """Get recent journal highlights with Redis caching."""
    stmt = (
        select(JournalEntry.content)
        .where(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.entry_date.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    entries = [row.strip() for row in result.scalars().all() if row]

    highlights: List[str] = []
    for entry in entries:
        snippet = entry.replace("\n", " ").strip()
        if len(snippet) > 220:
            snippet = snippet[:217].rstrip() + "..."
        if snippet:
            highlights.append(snippet)
    return highlights


async def _get_upcoming_appointment(db: AsyncSession, user_id: int) -> Optional[str]:
    now = datetime.utcnow()
    stmt = (
        select(Appointment.appointment_datetime, Appointment.appointment_type_id)
        .where(Appointment.user_id == user_id)
        .where(Appointment.status != "cancelled")
        .where(Appointment.appointment_datetime >= now)
        .order_by(Appointment.appointment_datetime.asc())
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        return None

    appointment_dt, appointment_type_id = row
    time_until = appointment_dt - now
    days_until = time_until.days
    if days_until < 0:
        return None

    when_text = appointment_dt.strftime("%d %b %Y %H:%M")
    if days_until == 0:
        descriptor = "hari ini"
    elif days_until == 1:
        descriptor = "besok"
    else:
        descriptor = f"dalam {days_until} hari"

    if appointment_type_id:
        return f"Janji temu berikutnya {descriptor} pada {when_text}."
    return f"Janji temu berikutnya dijadwalkan {descriptor} pada {when_text}."


async def build_user_personal_context(db: AsyncSession, user: User) -> str:
    """Aggregate key information about the user to ground chatbot responses."""
    cache = get_cache_service()
    cache_key = _personal_context_cache_key(user.id)

    cached_value = await cache.get(cache_key)
    if isinstance(cached_value, str) and cached_value:
        return cached_value

    context = await _compute_personal_context(db, user)
    await cache.set(cache_key, context, ttl=_PERSONAL_CONTEXT_TTL_SECONDS)
    return context


async def invalidate_user_personal_context(user_id: int) -> None:
    """Invalidate user personal context cache in Redis."""
    cache = get_cache_service()
    await cache.delete(_personal_context_cache_key(user_id))

    from app.core.cache import invalidate_user_cache
    await invalidate_user_cache(user_id)


async def _compute_personal_context(db: AsyncSession, user: User) -> str:
    """Compute personal context for the user.
    
    Note: With tool calling enabled, this context serves as a base profile.
    The LLM can actively query for more detailed information using tools:
    - get_conversation_summaries: For past conversation details
    - get_journal_entries: For journal content with search
    - get_conversation_context: For specific session details
    """
    profile_lines: List[str] = []

    name = display_name_for_user(user)
    if name:
        profile_lines.append(f"Nama panggilan: {name}")

    profile = getattr(user, "profile", None)
    university = getattr(profile, "university", None) if profile is not None else None
    major = getattr(profile, "major", None) if profile is not None else None
    year_of_study = getattr(profile, "year_of_study", None) if profile is not None else None

    if university is None:
        university = getattr(user, "university", None)
    if major is None:
        major = getattr(user, "major", None)
    if year_of_study is None:
        year_of_study = getattr(user, "year_of_study", None)

    if university:
        profile_lines.append(f"Universitas: {university}")
    if major:
        profile_lines.append(f"Program studi: {major}")
    if year_of_study:
        profile_lines.append(f"Tahun studi: {year_of_study}")

    current_streak = getattr(profile, "current_streak", None) if profile is not None else None
    if current_streak is None:
        current_streak = getattr(user, "current_streak", 0)

    longest_streak = getattr(profile, "longest_streak", None) if profile is not None else None
    if longest_streak is None:
        longest_streak = getattr(user, "longest_streak", 0)

    if current_streak:
        profile_lines.append(f"Streak jurnal aktif: {int(current_streak)} hari")
    if longest_streak:
        profile_lines.append(f"Streak terpanjang: {int(longest_streak)} hari")

    sentiment_score = getattr(profile, "sentiment_score", None) if profile is not None else None
    if sentiment_score is None:
        sentiment_score = getattr(user, "sentiment_score", None)
    if sentiment_score is not None:
        score_pct = round(float(sentiment_score) * 100)
        profile_lines.append(f"Skor sentimen rata-rata: {score_pct}%")

    profile_lines.append(
        "Pengguna mengizinkan check-in email"
        if allow_email_checkins_for_user(user)
        else "Pengguna memilih tidak menerima check-in email"
    )

    # Get a lightweight summary instead of detailed content
    # (Tools can fetch detailed summaries when needed)
    latest_summary = await _get_latest_summary(db, user.id)
    upcoming_appointment = await _get_upcoming_appointment(db, user.id)

    # Count total entries for quick reference
    total_journals_stmt = select(func.count(JournalEntry.id)).where(JournalEntry.user_id == user.id)
    total_journals = (await db.execute(total_journals_stmt)).scalar() or 0
    
    # Count total summaries for quick reference
    total_summaries_stmt = select(func.count(UserSummary.id)).where(UserSummary.user_id == user.id)
    total_summaries = (await db.execute(total_summaries_stmt)).scalar() or 0

    sections: List[str] = []
    if profile_lines:
        sections.append("Profil Pengguna:\n- " + "\n- ".join(profile_lines))

    # Add quick stats
    quick_stats = []
    if total_journals > 0:
        quick_stats.append(f"Total catatan jurnal: {total_journals}")
    if total_summaries > 0:
        quick_stats.append(f"Total ringkasan percakapan: {total_summaries}")
    if quick_stats:
        sections.append("Statistik:\n- " + "\n- ".join(quick_stats))

    # Add lightweight summary (just the latest one)
    if latest_summary:
        # Truncate if too long - tools can fetch full summaries
        summary_preview = latest_summary[:200] + "..." if len(latest_summary) > 200 else latest_summary
        sections.append(f"Ringkasan percakapan terakhir (preview):\n{summary_preview}")

    if upcoming_appointment:
        sections.append("Agenda bantuan profesional:\n" + upcoming_appointment)

    context = "\n\n".join(section.strip() for section in sections if section.strip())
    
    if context:
        # Add tool usage guidance
        context += (
            "\n\n**Menggunakan Konteks:**"
            "\n- Gunakan informasi ini sebagai dasar untuk personalisasi"
            "\n- Jika perlu detail lebih, gunakan tools yang tersedia:"
            "\n  * get_conversation_summaries: Untuk mengakses ringkasan percakapan sebelumnya"
            "\n  * get_journal_entries: Untuk membaca catatan jurnal dengan pencarian kata kunci"
            "\n  * get_conversation_context: Untuk melihat detail percakapan spesifik"
            "\n- Integrasikan informasi dari tools secara natural tanpa menyebutkan sumbernya"
        )
    
    return context


async def fetch_relevant_journal_entries(
    db: AsyncSession,
    user_id: int,
    query_text: str,
    limit: int = 3,
) -> List[str]:
    """Return journal snippets that appear relevant to the current user query."""

    keywords = {
        word.lower()
        for word in query_text.split()
        if len(word) >= 4 and word.isalpha()
    }

    stmt = select(JournalEntry.entry_date, JournalEntry.content).where(JournalEntry.user_id == user_id)

    if keywords:
        like_clauses = [JournalEntry.content.ilike(f"%{kw}%") for kw in keywords]
        stmt = stmt.where(or_(*like_clauses))

    stmt = stmt.order_by(JournalEntry.entry_date.desc()).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()
    snippets: List[str] = []
    for entry_date, content in rows:
        if not content:
            continue
        cleaned = content.replace("\n", " ").strip()
        if len(cleaned) > 260:
            cleaned = cleaned[:257].rstrip() + "..."
        formatted_date = entry_date.strftime("%d %b %Y") if entry_date else "Tidak diketahui"
        snippets.append(f"[{formatted_date}] {cleaned}")

    return snippets
