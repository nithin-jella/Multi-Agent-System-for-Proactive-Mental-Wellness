"""Appointment and therapist management endpoints for the admin panel."""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import (
    TherapistSchedule,
    User,
    UserBadge,
)  # Core models
from app.domains.mental_health.models import (
    Appointment,
    Conversation,
    JournalEntry,
    Psychologist,
)
from app.routes.admin.utils import (
    decrypt_user_email,
    decrypt_user_field,
    build_avatar_url,
)
from app.schemas.admin.appointments import (
    AppointmentResponse,
    AppointmentUpdate,
    AppointmentUser,
    PsychologistResponse,
    TherapistScheduleCreate,
    TherapistScheduleResponse,
    TherapistScheduleUpdate,
    TherapistSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Appointments"])


@router.get("/psychologists", response_model=List[TherapistSummary])
async def get_psychologists(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[TherapistSummary]:
    """Return therapist contacts enriched with engagement statistics and schedules."""

    logger.info("Admin %s requesting therapist directory", admin_user.id)

    journal_count_sq = (
        select(func.count(JournalEntry.id))
        .where(JournalEntry.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    conversation_count_sq = (
        select(func.count(Conversation.id))
        .where(Conversation.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    badge_count_sq = (
        select(func.count(UserBadge.id))
        .where(UserBadge.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    appointment_count_sq = (
        select(func.count(Appointment.id))
        .where(Appointment.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    base_query = (
        select(
            User,
            journal_count_sq.label("journal_count"),
            conversation_count_sq.label("conversation_count"),
            badge_count_sq.label("badge_count"),
            appointment_count_sq.label("appointment_count"),
        )
        .where(User.role.in_(["counselor", "therapist"]))  # therapist is a legacy alias for counselor
        .order_by(User.created_at.asc())
    )

    rows = await db.execute(base_query)
    therapist_rows = rows.all()

    if not therapist_rows:
        return []

    therapist_ids = [user.id for user, *_ in therapist_rows]

    psychologist_rows = await db.execute(
        select(Psychologist).where(Psychologist.id.in_(therapist_ids))
    )
    psychologist_map: Dict[int, Psychologist] = {
        item.id: item for item in psychologist_rows.scalars().all()
    }

    schedule_rows = await db.execute(
        select(TherapistSchedule).where(TherapistSchedule.therapist_id.in_(therapist_ids))
    )
    schedule_map: Dict[int, List[TherapistSchedule]] = defaultdict(list)
    for schedule_entry in schedule_rows.scalars():
        schedule_map[schedule_entry.therapist_id].append(schedule_entry)

    day_order = {day: index for index, day in enumerate(
        [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
    )}

    def sort_key(entry: TherapistSchedule) -> tuple[int, str]:
        return (day_order.get(entry.day_of_week, 99), entry.start_time)

    therapists: List[TherapistSummary] = []
    for user, _, _, _, appointment_count in therapist_rows:
        psychologist = psychologist_map.get(user.id)
        schedules = schedule_map.get(user.id, [])
        schedules.sort(key=sort_key)

        name_plain = decrypt_user_field(user.name)
        first_name_plain = decrypt_user_field(user.first_name)
        last_name_plain = decrypt_user_field(user.last_name)
        phone_plain = decrypt_user_field(user.phone)
        email_plain = decrypt_user_email(user.email)

        display_name_candidates = [
            name_plain,
            " ".join(filter(None, [first_name_plain, last_name_plain])) or None,
            psychologist.name if psychologist else None,
            email_plain,
        ]
        display_name = next((value for value in display_name_candidates if value), "Therapist")

        fallback_avatar = build_avatar_url(email_plain, user.id, size=192)
        display_image = psychologist.image_url if psychologist and psychologist.image_url else fallback_avatar

        therapists.append(
            TherapistSummary(
                id=user.id,
                email=email_plain,
                name=display_name,
                first_name=first_name_plain,
                last_name=last_name_plain,
                phone=phone_plain,
                specialization=psychologist.specialization if psychologist else None,
                is_available=psychologist.is_available if psychologist else True,
                allow_email_checkins=user.allow_email_checkins,
                total_appointments=int(appointment_count or 0),
                upcoming_schedules=[
                    TherapistScheduleResponse.model_validate(entry)
                    for entry in schedules[:5]
                ],
                image_url=display_image,
                avatar_url=fallback_avatar,
            )
        )

    return therapists


def _map_psychologist(psychologist: Psychologist) -> PsychologistResponse:
    return PsychologistResponse(
        id=psychologist.id,
        name=psychologist.name,
        specialization=psychologist.specialization,
        image_url=psychologist.image_url,
        is_available=psychologist.is_available,
    )


def _map_user(user: User) -> AppointmentUser:
    email_plain = decrypt_user_email(user.email)
    return AppointmentUser(
        id=user.id,
        email=email_plain,
        avatar_url=build_avatar_url(email_plain, user.id, size=96),
    )


@router.get("/appointments", response_model=List[AppointmentResponse])
async def get_appointments(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[AppointmentResponse]:
    """Return all appointments ordered by datetime desc."""

    logger.info("Admin %s requesting appointments list", admin_user.id)

    result = await db.execute(
        select(Appointment)
        .options(
            selectinload(Appointment.user),
            selectinload(Appointment.psychologist),
            selectinload(Appointment.appointment_type),
        )
        .order_by(desc(Appointment.appointment_datetime))
    )

    appointments = []
    for appointment in result.scalars().all():
        if not appointment.user or not appointment.psychologist:
            logger.warning("Appointment %s missing related user or psychologist", appointment.id)
            continue

        appointments.append(
            AppointmentResponse(
                id=appointment.id,
                user=_map_user(appointment.user),
                psychologist=_map_psychologist(appointment.psychologist),
                appointment_type=(
                    appointment.appointment_type.name if appointment.appointment_type else None
                ),
                appointment_datetime=appointment.appointment_datetime,
                notes=appointment.notes,
                status=appointment.status,
                created_at=appointment.created_at,
            )
        )

    return appointments


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> AppointmentResponse:
    """Fetch a single appointment with relationships."""

    logger.info("Admin %s requesting appointment %s", admin_user.id, appointment_id)

    result = await db.execute(
        select(Appointment)
        .options(
            selectinload(Appointment.user),
            selectinload(Appointment.psychologist),
            selectinload(Appointment.appointment_type),
        )
        .filter(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment or not appointment.user or not appointment.psychologist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    return AppointmentResponse(
        id=appointment.id,
        user=_map_user(appointment.user),
        psychologist=_map_psychologist(appointment.psychologist),
        appointment_type=(appointment.appointment_type.name if appointment.appointment_type else None),
        appointment_datetime=appointment.appointment_datetime,
        notes=appointment.notes,
        status=appointment.status,
        created_at=appointment.created_at,
    )


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: int,
    appointment_data: AppointmentUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> AppointmentResponse:
    """Update an appointment's status."""

    logger.info(
        "Admin %s updating appointment %s status to %s",
        admin_user.id,
        appointment_id,
        appointment_data.status,
    )

    result = await db.execute(
        select(Appointment)
        .options(
            selectinload(Appointment.user),
            selectinload(Appointment.psychologist),
            selectinload(Appointment.appointment_type),
        )
        .filter(Appointment.id == appointment_id)
    )
    db_appointment = result.scalar_one_or_none()
    if not db_appointment or not db_appointment.user or not db_appointment.psychologist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    db_appointment.status = appointment_data.status
    db.add(db_appointment)
    await db.commit()
    await db.refresh(db_appointment)

    return AppointmentResponse(
        id=db_appointment.id,
        user=_map_user(db_appointment.user),
        psychologist=_map_psychologist(db_appointment.psychologist),
        appointment_type=(
            db_appointment.appointment_type.name if db_appointment.appointment_type else None
        ),
        appointment_datetime=db_appointment.appointment_datetime,
        notes=db_appointment.notes,
        status=db_appointment.status,
        created_at=db_appointment.created_at,
    )


@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_200_OK)
async def delete_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict[str, str]:
    """Delete an appointment."""

    logger.info("Admin %s deleting appointment %s", admin_user.id, appointment_id)

    result = await db.execute(select(Appointment).filter(Appointment.id == appointment_id))
    db_appointment = result.scalar_one_or_none()
    if not db_appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    await db.delete(db_appointment)
    await db.commit()
    return {"detail": "deleted"}


@router.get("/therapists/{therapist_id}/schedule", response_model=List[TherapistScheduleResponse])
async def get_therapist_schedule(
    therapist_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[TherapistScheduleResponse]:
    """Return all schedule entries for a therapist."""

    logger.info(
        "Admin %s requesting schedule for therapist %s",
        admin_user.id,
        therapist_id,
    )

    result = await db.execute(
        select(TherapistSchedule).filter(TherapistSchedule.therapist_id == therapist_id)
    )
    schedules = [
        TherapistScheduleResponse.model_validate(entry) for entry in result.scalars().all()
    ]
    return schedules


@router.post(
    "/therapists/{therapist_id}/schedule",
    response_model=TherapistScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_therapist_schedule(
    therapist_id: int,
    schedule_data: TherapistScheduleCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> TherapistScheduleResponse:
    """Create a schedule entry for a therapist."""

    logger.info(
        "Admin %s creating schedule for therapist %s",
        admin_user.id,
        therapist_id,
    )

    db_schedule = TherapistSchedule(therapist_id=therapist_id, **schedule_data.model_dump())
    db.add(db_schedule)
    await db.commit()
    await db.refresh(db_schedule)
    return TherapistScheduleResponse.model_validate(db_schedule)


@router.put(
    "/therapists/schedule/{schedule_id}",
    response_model=TherapistScheduleResponse,
)
async def update_therapist_schedule(
    schedule_id: int,
    schedule_data: TherapistScheduleUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> TherapistScheduleResponse:
    """Update an existing therapist schedule entry."""

    logger.info(
        "Admin %s updating schedule %s",
        admin_user.id,
        schedule_id,
    )

    result = await db.execute(
        select(TherapistSchedule).filter(TherapistSchedule.id == schedule_id)
    )
    db_schedule = result.scalar_one_or_none()
    if not db_schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    update_data = schedule_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_schedule, key, value)

    db.add(db_schedule)
    await db.commit()
    await db.refresh(db_schedule)
    return TherapistScheduleResponse.model_validate(db_schedule)


@router.delete("/therapists/schedule/{schedule_id}", status_code=status.HTTP_200_OK)
async def delete_therapist_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict[str, str]:
    """Delete a therapist schedule entry."""

    logger.info(
        "Admin %s deleting schedule %s",
        admin_user.id,
        schedule_id,
    )

    result = await db.execute(
        select(TherapistSchedule).filter(TherapistSchedule.id == schedule_id)
    )
    db_schedule = result.scalar_one_or_none()
    if not db_schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    await db.delete(db_schedule)
    await db.commit()
    return {"detail": "deleted"}








