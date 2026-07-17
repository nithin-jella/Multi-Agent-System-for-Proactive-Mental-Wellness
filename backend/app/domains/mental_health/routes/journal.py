# backend/app/routes/journal.py
import csv
import logging
import os
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from io import StringIO
from typing import Any, Optional, cast as typing_cast

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.llm import generate_response
from app.database import AsyncSessionLocal, get_async_db
from app.dependencies import get_current_active_user
from app.domains.mental_health.models import JournalEntry, JournalReflectionPoint, JournalTag
from app.domains.mental_health.schemas.journal import (
    JournalAnalyticsResponse,
    JournalEntryCreate,
    JournalEntryFilter,
    JournalMoodTrendPoint,
    JournalPadTrendPoint,
    JournalEntryResponse,
    JournalExportResponse,
    JournalReflectionPointCreate,
    JournalTagUsage,
    PadAxisDistribution,
    PadDistribution,
    WritingFrequencyPoint,
)
from app.domains.mental_health.services.journal_affective import (
    bucket_pad_value as _bucket_pad_value,
    empty_pad_distribution as _empty_pad_distribution,
    infer_dominance_from_content as _infer_dominance_from_content,
)
from app.domains.mental_health.services.personal_context import invalidate_user_personal_context
from app.models import User
from app.services.achievement_service import trigger_achievement_check

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/journal",
    tags=["Journal"],
    dependencies=[Depends(get_current_active_user)],
)


def _normalize_tags(raw_tags: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_tag in raw_tags:
        tag = raw_tag.strip()
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(tag)
    return normalized


async def analyze_journal_entry_for_insights(
    user_id: int,
    journal_entry_id: int,
    journal_content: str,
    valence: Optional[float],
    arousal: Optional[float],
) -> None:
    """Run best-effort post-save analysis (reflection + inferred dominance)."""
    async with AsyncSessionLocal() as db:
        logger.info(
            "Starting AI analysis for journal entry ID: %s (user=%s)",
            journal_entry_id,
            user_id,
        )

        result = await db.execute(
            select(JournalEntry).where(
                JournalEntry.id == journal_entry_id,
                JournalEntry.user_id == user_id,
            )
        )
        journal_entry = result.scalar_one_or_none()
        if journal_entry is None:
            logger.warning(
                "Skipping journal analysis because entry %s for user %s was not found",
                journal_entry_id,
                user_id,
            )
            return

        reflection_text: Optional[str] = None
        inferred_dominance = _infer_dominance_from_content(journal_content, valence, arousal)

        if inferred_dominance is not None:
            journal_entry.inferred_dominance = inferred_dominance
            db.add(journal_entry)

        try:
            system_prompt_for_reflection = """
You are a compassionate AI assistant. Your role is to gently analyze the following journal entry.
Identify 1-2 potential underlying emotional themes, recurring patterns, or core beliefs that the user might be expressing, possibly related to unresolved feelings or past experiences.
Frame your observations as gentle, open-ended questions or soft reflections that could encourage deeper self-understanding.
DO NOT diagnose, give advice, or use clinical jargon. Focus on empathy and curiosity.
Example observations:
- "It sounds like there's a strong feeling of 'not being good enough' that comes up in different situations. I wonder where that might stem from?"
- "There's a recurring theme of seeking external validation. What might it feel like to find that validation from within?"
- "You mentioned a memory from childhood. How do you feel that experience might be echoing in your present feelings?"
Keep the reflection concise (1-2 sentences).
"""
            history = [{"role": "user", "content": journal_content}]
            ai_reflection_text = await generate_response(
                history=history,
                model="gemini_google",
                system_prompt=system_prompt_for_reflection,
                max_tokens=512,
                temperature=0.5,
            )
            if ai_reflection_text and not ai_reflection_text.startswith("Error:"):
                reflection_text = ai_reflection_text.strip()
        except Exception as exc:  # pragma: no cover - best effort background path
            logger.warning(
                "Journal reflection generation failed for entry %s: %s",
                journal_entry_id,
                exc,
            )

        if reflection_text:
            reflection_data = JournalReflectionPointCreate(
                journal_entry_id=journal_entry_id,
                user_id=user_id,
                reflection_text=reflection_text,
            )
            db.add(JournalReflectionPoint(**reflection_data.model_dump()))

        if not db.new and not db.dirty:
            return

        try:
            await db.commit()
            logger.info(
                "Journal analysis persisted for entry %s (dominance=%s, reflection=%s)",
                journal_entry_id,
                inferred_dominance,
                bool(reflection_text),
            )
        except Exception as exc:  # pragma: no cover - best effort background path
            await db.rollback()
            logger.error(
                "Error persisting journal analysis for entry %s: %s",
                journal_entry_id,
                exc,
                exc_info=True,
            )


@router.post("/", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_journal_entry(
    entry_data: JournalEntryCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create or update a journal entry for the authenticated user/date."""
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date == entry_data.entry_date,
        )
    )
    existing_entry = result.scalar_one_or_none()
    normalized_tags = _normalize_tags(entry_data.tags)
    word_count = len(entry_data.content.split())

    saved_entry: JournalEntry
    try:
        if existing_entry:
            existing_entry.content = entry_data.content
            existing_entry.prompt_id = entry_data.prompt_id
            existing_entry.mood = entry_data.mood
            existing_entry.valence = entry_data.valence
            existing_entry.arousal = entry_data.arousal
            existing_entry.inferred_dominance = None
            existing_entry.word_count = word_count
            existing_entry.updated_at = datetime.now()
            db.add(existing_entry)

            await db.execute(
                delete(JournalTag).where(JournalTag.journal_entry_id == existing_entry.id)
            )
            for tag_name in normalized_tags:
                db.add(JournalTag(journal_entry_id=existing_entry.id, tag_name=tag_name))

            saved_entry = existing_entry
        else:
            saved_entry = JournalEntry(
                user_id=current_user.id,
                entry_date=entry_data.entry_date,
                content=entry_data.content,
                prompt_id=entry_data.prompt_id,
                mood=entry_data.mood,
                valence=entry_data.valence,
                arousal=entry_data.arousal,
                inferred_dominance=None,
                word_count=word_count,
            )
            db.add(saved_entry)
            await db.flush()

            for tag_name in normalized_tags:
                db.add(JournalTag(journal_entry_id=saved_entry.id, tag_name=tag_name))

        await db.commit()
        await db.refresh(saved_entry)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed saving journal entry for user %s: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Entry for this date might already exist or another error occurred.",
        ) from exc

    await invalidate_user_personal_context(current_user.id)

    from app.core.cache import get_cache_service

    cache = get_cache_service()
    await cache.delete_pattern(f"cache:journals:{current_user.id}:*")
    await cache.delete_pattern(f"cache:journal_highlights:{current_user.id}:*")

    try:
        await trigger_achievement_check(
            db,
            current_user,
            action="journal_saved",
            fail_on_config_error=False,
        )
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning(
            "Badge auto-sync failed after journal save for user %s: %s",
            current_user.id,
            exc,
        )

    background_tasks.add_task(
        analyze_journal_entry_for_insights,
        user_id=typing_cast(int, saved_entry.user_id),
        journal_entry_id=typing_cast(int, saved_entry.id),
        journal_content=typing_cast(str, saved_entry.content),
        valence=saved_entry.valence,
        arousal=saved_entry.arousal,
    )

    stmt = (
        select(JournalEntry)
        .options(
            selectinload(JournalEntry.reflection_points),
            selectinload(JournalEntry.tags),
            selectinload(JournalEntry.prompt),
        )
        .where(JournalEntry.id == saved_entry.id)
    )
    response_entry = (await db.execute(stmt)).scalar_one_or_none()
    if response_entry is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Saved entry not found")
    return response_entry


@router.get("/", response_model=list[JournalEntryResponse])
async def get_all_journal_entries(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve all journal entries for the current user with pagination."""
    stmt = (
        select(JournalEntry)
        .options(
            selectinload(JournalEntry.reflection_points),
            selectinload(JournalEntry.tags),
            selectinload(JournalEntry.prompt),
        )
        .where(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.entry_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return (await db.execute(stmt)).scalars().all()


@router.get("/{entry_date}", response_model=JournalEntryResponse)
async def get_journal_entry_by_date(
    entry_date: date,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve a journal entry by date for the authenticated user."""
    stmt = (
        select(JournalEntry)
        .options(
            selectinload(JournalEntry.reflection_points),
            selectinload(JournalEntry.tags),
            selectinload(JournalEntry.prompt),
        )
        .where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date == entry_date,
        )
    )
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry is None:
        logger.error("Journal entry not found for user %s on %s", current_user.id, entry_date)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal entry not found for this date.",
        )
    return entry


@router.post("/search", response_model=list[JournalEntryResponse])
async def search_journal_entries(
    filter_params: JournalEntryFilter,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Search and filter journal entries using legacy mood and PAD dimensions."""
    stmt = (
        select(JournalEntry)
        .options(
            selectinload(JournalEntry.reflection_points),
            selectinload(JournalEntry.tags),
            selectinload(JournalEntry.prompt),
        )
        .where(JournalEntry.user_id == current_user.id)
    )

    if filter_params.search_query:
        search_term = f"%{filter_params.search_query}%"
        stmt = stmt.where(JournalEntry.content.ilike(search_term))

    if filter_params.mood_min is not None:
        stmt = stmt.where(JournalEntry.mood >= filter_params.mood_min)
    if filter_params.mood_max is not None:
        stmt = stmt.where(JournalEntry.mood <= filter_params.mood_max)

    if filter_params.valence_min is not None:
        stmt = stmt.where(JournalEntry.valence >= filter_params.valence_min)
    if filter_params.valence_max is not None:
        stmt = stmt.where(JournalEntry.valence <= filter_params.valence_max)

    if filter_params.arousal_min is not None:
        stmt = stmt.where(JournalEntry.arousal >= filter_params.arousal_min)
    if filter_params.arousal_max is not None:
        stmt = stmt.where(JournalEntry.arousal <= filter_params.arousal_max)

    if filter_params.inferred_dominance_min is not None:
        stmt = stmt.where(JournalEntry.inferred_dominance >= filter_params.inferred_dominance_min)
    if filter_params.inferred_dominance_max is not None:
        stmt = stmt.where(JournalEntry.inferred_dominance <= filter_params.inferred_dominance_max)

    if filter_params.date_from:
        stmt = stmt.where(JournalEntry.entry_date >= filter_params.date_from)
    if filter_params.date_to:
        stmt = stmt.where(JournalEntry.entry_date <= filter_params.date_to)

    if filter_params.tags:
        for tag in filter_params.tags:
            subquery = (
                select(JournalTag.journal_entry_id)
                .where(JournalTag.tag_name == tag)
                .scalar_subquery()
            )
            stmt = stmt.where(JournalEntry.id.in_(subquery))

    stmt = stmt.order_by(JournalEntry.entry_date.desc()).offset(filter_params.skip).limit(filter_params.limit)
    return (await db.execute(stmt)).scalars().all()


@router.get("/analytics/overview", response_model=JournalAnalyticsResponse)
async def get_journal_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return journal analytics, preserving mood metrics while promoting PAD metrics."""
    date_threshold = datetime.now() - timedelta(days=days)
    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.tags))
        .where(
            JournalEntry.user_id == current_user.id,
            JournalEntry.entry_date >= date_threshold.date(),
        )
    )
    entries = result.scalars().all()

    total_entries = len(entries)
    total_word_count = sum(entry.word_count for entry in entries)
    avg_word_count = total_word_count / total_entries if total_entries > 0 else 0.0

    mood_distribution: defaultdict[int, int] = defaultdict(int)
    mood_trend: list[JournalMoodTrendPoint] = []
    pad_trend: list[JournalPadTrendPoint] = []

    pad_distribution = {
        "valence": _empty_pad_distribution(),
        "arousal": _empty_pad_distribution(),
        "inferred_dominance": _empty_pad_distribution(),
    }

    entries_sorted = sorted(entries, key=lambda row: typing_cast(date, row.entry_date).toordinal())
    for entry in entries_sorted:
        entry_date = typing_cast(date, entry.entry_date)
        if entry.mood is not None:
            mood_distribution[entry.mood] += 1
            mood_trend.append(
                JournalMoodTrendPoint(
                    date=entry_date.isoformat(),
                    mood=entry.mood,
                )
            )

        if any(v is not None for v in (entry.valence, entry.arousal, entry.inferred_dominance)):
            pad_trend.append(
                JournalPadTrendPoint(
                    date=entry_date.isoformat(),
                    valence=entry.valence,
                    arousal=entry.arousal,
                    inferred_dominance=entry.inferred_dominance,
                )
            )

        valence_bucket = _bucket_pad_value(entry.valence)
        if valence_bucket:
            pad_distribution["valence"][valence_bucket] += 1

        arousal_bucket = _bucket_pad_value(entry.arousal)
        if arousal_bucket:
            pad_distribution["arousal"][arousal_bucket] += 1

        dominance_bucket = _bucket_pad_value(entry.inferred_dominance)
        if dominance_bucket:
            pad_distribution["inferred_dominance"][dominance_bucket] += 1

    tag_count: defaultdict[str, int] = defaultdict(int)
    for entry in entries:
        for tag in entry.tags:
            tag_count[tag.tag_name] += 1

    most_used_tags = sorted(
        (JournalTagUsage(tag=tag_name, count=count) for tag_name, count in tag_count.items()),
        key=lambda item: item.count,
        reverse=True,
    )[:10]

    writing_frequency_count: defaultdict[str, int] = defaultdict(int)
    for entry in entries:
        entry_date = typing_cast(date, entry.entry_date)
        writing_frequency_count[entry_date.isoformat()] += 1

    writing_frequency = sorted(
        (WritingFrequencyPoint(date=day, count=count) for day, count in writing_frequency_count.items()),
        key=lambda item: item.date,
    )

    pad_distribution_model = PadDistribution(
        valence=PadAxisDistribution(**pad_distribution["valence"]),
        arousal=PadAxisDistribution(**pad_distribution["arousal"]),
        inferred_dominance=PadAxisDistribution(**pad_distribution["inferred_dominance"]),
    )

    return JournalAnalyticsResponse(
        total_entries=total_entries,
        total_word_count=total_word_count,
        avg_word_count=round(avg_word_count, 2),
        mood_distribution=dict(mood_distribution),
        most_used_tags=most_used_tags,
        mood_trend=mood_trend,
        writing_frequency=writing_frequency,
        pad_distribution=pad_distribution_model,
        pad_trend=pad_trend,
    )


@router.get("/export/{format}", response_model=JournalExportResponse)
async def export_journal_entries(
    format: str,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Export journal entries as CSV or PDF."""
    if format not in ["csv", "pdf"]:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'pdf'")

    result = await db.execute(
        select(JournalEntry)
        .options(selectinload(JournalEntry.tags), selectinload(JournalEntry.prompt))
        .where(JournalEntry.user_id == current_user.id)
        .order_by(JournalEntry.entry_date.desc())
    )
    entries = result.scalars().all()

    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Date",
                "Content",
                "Mood",
                "Valence",
                "Arousal",
                "Inferred Dominance",
                "Tags",
                "Prompt",
                "Word Count",
            ]
        )

        for entry in entries:
            tags = ", ".join(tag.tag_name for tag in entry.tags)
            prompt = entry.prompt.text if entry.prompt else ""
            writer.writerow(
                [
                    entry.entry_date,
                    entry.content.replace("\n", " "),
                    entry.mood if entry.mood is not None else "",
                    entry.valence if entry.valence is not None else "",
                    entry.arousal if entry.arousal is not None else "",
                    entry.inferred_dominance if entry.inferred_dominance is not None else "",
                    tags,
                    prompt,
                    entry.word_count,
                ]
            )

        temp_dir = tempfile.gettempdir()
        filename = f"journal_export_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(temp_dir, filename)

        with open(filepath, "w", newline="", encoding="utf-8") as file_handle:
            file_handle.write(output.getvalue())

        return FileResponse(filepath, media_type="text/csv", filename=filename)

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

        temp_dir = tempfile.gettempdir()
        filename = f"journal_export_{current_user.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = os.path.join(temp_dir, filename)

        doc = SimpleDocTemplate(filepath, pagesize=letter)
        styles = getSampleStyleSheet()
        elements: list[Any] = []

        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            spaceAfter=30,
            alignment=1,
        )
        elements.append(Paragraph("Journal Entries", title_style))
        elements.append(Spacer(1, 20))

        mood_emoji = {1: "😢", 2: "😕", 3: "😐", 4: "😊", 5: "😄"}
        for entry in entries:
            elements.append(Paragraph(f"<b>Date:</b> {entry.entry_date}", styles["Normal"]))

            if entry.mood is not None:
                emoji = mood_emoji.get(entry.mood, "")
                elements.append(
                    Paragraph(
                        f"<b>Mood:</b> {emoji} ({entry.mood}/5)",
                        styles["Normal"],
                    )
                )

            pad_parts: list[str] = []
            if entry.valence is not None:
                pad_parts.append(f"Valence {entry.valence:.2f}")
            if entry.arousal is not None:
                pad_parts.append(f"Arousal {entry.arousal:.2f}")
            if entry.inferred_dominance is not None:
                pad_parts.append(f"Dominance (inferred) {entry.inferred_dominance:.2f}")
            if pad_parts:
                elements.append(Paragraph(f"<b>PAD:</b> {' | '.join(pad_parts)}", styles["Normal"]))

            if entry.tags:
                tags_text = ", ".join(tag.tag_name for tag in entry.tags)
                elements.append(Paragraph(f"<b>Tags:</b> {tags_text}", styles["Normal"]))

            elements.append(Paragraph("<b>Content:</b>", styles["Normal"]))
            elements.append(Paragraph(entry.content.replace("\n", "<br/>"), styles["BodyText"]))
            elements.append(Spacer(1, 20))

        doc.build(elements)
        return FileResponse(filepath, media_type="application/pdf", filename=filename)
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="PDF generation not available. Install reportlab package.",
        ) from exc


@router.get("/tags/all", response_model=list[str])
async def get_all_user_tags(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all tags used by the current user."""
    result = await db.execute(
        select(JournalTag.tag_name)
        .join(JournalEntry, JournalEntry.id == JournalTag.journal_entry_id)
        .where(JournalEntry.user_id == current_user.id)
        .distinct()
    )
    return sorted(row[0] for row in result.all())


#! TODO: DELETE endpoint
# @router.delete("/{entry_date_str}", status_code=status.HTTP_204_NO_CONTENT)
# async def delete_journal_entry ...
