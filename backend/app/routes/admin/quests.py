from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import User  # Core model
from app.domains.mental_health.models import QuestTemplate
from app.schemas.admin.quests import (
    QuestTemplateCreate,
    QuestTemplateListResponse,
    QuestTemplateResponse,
    QuestTemplateUpdate,
)

router = APIRouter(prefix="/quests", tags=["Admin Quests"])


def _apply_filters(
    stmt: Select,
    *,
    search: Optional[str],
    include_inactive: bool,
    category: Optional[str],
    difficulty: Optional[str],
) -> Select:
    filters = []

    if search:
        pattern = f"%{search.lower()}%"
        filters.append(
            or_(
                func.lower(QuestTemplate.code).like(pattern),
                func.lower(QuestTemplate.name).like(pattern),
                func.lower(QuestTemplate.short_description).like(pattern),
            )
        )

    if not include_inactive:
        filters.append(QuestTemplate.is_active.is_(True))

    if category:
        filters.append(func.lower(QuestTemplate.category) == category.lower())

    if difficulty:
        filters.append(func.lower(QuestTemplate.difficulty) == difficulty.lower())

    if filters:
        stmt = stmt.where(and_(*filters))

    return stmt


@router.get("/templates", response_model=QuestTemplateListResponse)
async def list_quest_templates(
    search: Optional[str] = Query(default=None, description="Search by code, name, or description"),
    include_inactive: bool = Query(default=False),
    category: Optional[str] = Query(default=None),
    difficulty: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> QuestTemplateListResponse:
    del admin_user  # Only used for dependency enforcement

    stmt = select(QuestTemplate).order_by(QuestTemplate.created_at.desc())
    stmt = _apply_filters(
        stmt,
        search=search,
        include_inactive=include_inactive,
        category=category,
        difficulty=difficulty,
    )
    result = await db.execute(stmt)
    templates = list(result.scalars())
    return QuestTemplateListResponse(templates=templates)


@router.post("/templates", response_model=QuestTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_quest_template(
    payload: QuestTemplateCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> QuestTemplateResponse:
    del admin_user

    existing_stmt = select(QuestTemplate).where(func.lower(QuestTemplate.code) == payload.code.lower())
    if (await db.execute(existing_stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Quest template code already exists.",
        )

    template = QuestTemplate(
        code=payload.code,
        name=payload.name,
        short_description=payload.short_description,
        long_description=payload.long_description,
        category=payload.category,
        difficulty=payload.difficulty,
        recommended_duration_minutes=payload.recommended_duration_minutes,
        base_xp=payload.base_xp,
        base_joy=payload.base_joy,
        base_harmony=payload.base_harmony,
        extra_data=payload.extra_data,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return QuestTemplateResponse.model_validate(template)


@router.patch("/templates/{template_id}", response_model=QuestTemplateResponse)
async def update_quest_template(
    template_id: int,
    payload: QuestTemplateUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> QuestTemplateResponse:
    del admin_user

    stmt = select(QuestTemplate).where(QuestTemplate.id == template_id)
    template = (await db.execute(stmt)).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest template not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quest template update conflict.")

    await db.refresh(template)
    return QuestTemplateResponse.model_validate(template)


@router.post("/templates/{template_id}/activate", response_model=QuestTemplateResponse)
async def toggle_template_activation(
    template_id: int,
    activate: bool = Query(default=True),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> QuestTemplateResponse:
    del admin_user

    stmt = select(QuestTemplate).where(QuestTemplate.id == template_id)
    template = (await db.execute(stmt)).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quest template not found.")

    template.is_active = activate
    await db.commit()
    await db.refresh(template)
    return QuestTemplateResponse.model_validate(template)
