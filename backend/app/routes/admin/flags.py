"""Flag management endpoints for the admin panel."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.mental_health.models import Conversation
from app.models import FlaggedSession, User  # Core models
from app.schemas.admin import (
    FlagCreate,
    FlagResponse,
    FlagUpdate,
    FlagsBulkCloseRequest,
    FlagsBulkTagRequest,
    FlagsSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Flags"])


@router.post("/conversations/session/{session_id}/flag", response_model=FlagResponse, status_code=status.HTTP_201_CREATED)
async def flag_session(
    session_id: str,
    data: FlagCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> FlagResponse:
    """Flag a conversation session for follow-up."""
    conv = (
        await db.execute(
            select(Conversation).filter(Conversation.session_id == session_id).limit(1)
        )
    ).scalar_one_or_none()

    flagged = FlaggedSession(
        session_id=session_id,
        user_id=conv.user_id if conv else None,
        reason=data.reason,
        status="open",
        flagged_by_admin_id=admin_user.id,
        tags=data.tags,
    )
    db.add(flagged)
    await db.commit()
    await db.refresh(flagged)
    return flagged


@router.get("/flags", response_model=List[FlagResponse])
async def list_flags(
    status_filter: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[FlagResponse]:
    query = select(FlaggedSession).order_by(desc(FlaggedSession.created_at))
    if status_filter:
        query = query.filter(FlaggedSession.status == status_filter)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.put("/flags/{flag_id}", response_model=FlagResponse)
async def update_flag(
    flag_id: int,
    data: FlagUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> FlagResponse:
    flag = (
        await db.execute(select(FlaggedSession).filter(FlaggedSession.id == flag_id))
    ).scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found")

    if hasattr(data, "status") and data.status is not None:
        flag.status = data.status
    if hasattr(data, "tags") and data.tags is not None:
        flag.tags = data.tags
    if hasattr(data, "notes") and data.notes is not None:
        flag.notes = data.notes

    flag.updated_at = datetime.now()
    db.add(flag)
    await db.commit()
    await db.refresh(flag)
    return flag


@router.get("/flags/summary", response_model=FlagsSummary)
async def get_flags_summary(
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> FlagsSummary:
    open_count = (
        await db.execute(
            select(func.count(FlaggedSession.id)).filter(FlaggedSession.status == "open")
        )
    ).scalar() or 0

    recent_flags = (
        await db.execute(
            select(FlaggedSession).order_by(desc(FlaggedSession.created_at)).limit(limit)
        )
    ).scalars().all()
    # Convert FlaggedSession objects to FlagResponse if needed
    recent_flag_responses = [FlagResponse.from_orm(flag) for flag in recent_flags]
    return FlagsSummary(open_count=int(open_count), recent=recent_flag_responses)


@router.post("/flags/bulk-close", response_model=List[FlagResponse])
async def bulk_close_flags(
    data: FlagsBulkCloseRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[FlagResponse]:
    if not data.ids:
        return []

    flags = (
        await db.execute(select(FlaggedSession).filter(FlaggedSession.id.in_(data.ids)))
    ).scalars().all()

    for flag in flags:
        flag.status = data.status or "resolved"
        flag.updated_at = datetime.now()
        db.add(flag)

    await db.commit()

    for flag in flags:
        await db.refresh(flag)

    return list(flags)


@router.post("/flags/bulk-tag", response_model=List[FlagResponse])
async def bulk_tag_flags(
    data: FlagsBulkTagRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[FlagResponse]:
    if not data.ids:
        return []

    mode = (data.mode or "add").lower()
    new_tags = {tag.strip() for tag in (data.tags or []) if tag and tag.strip()}

    flags = (
        await db.execute(select(FlaggedSession).filter(FlaggedSession.id.in_(data.ids)))
    ).scalars().all()

    for flag in flags:
        existing: List[str] = []
        if isinstance(flag.tags, list):
            existing = [str(item) for item in flag.tags]
        elif isinstance(flag.tags, str):
            existing = [flag.tags]

        if mode == "set":
            merged = list(new_tags)
        else:
            merged = list({*existing, *new_tags})

        flag.tags = merged
        flag.updated_at = datetime.now()
        db.add(flag)

    await db.commit()

    for flag in flags:
        await db.refresh(flag)

    return list(flags)
