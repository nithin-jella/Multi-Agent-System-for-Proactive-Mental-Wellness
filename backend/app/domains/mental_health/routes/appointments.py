# backend/app/routes/appointments.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.database import get_async_db
from app import models
from app.domains.mental_health.schemas import appointments as schemas
from app.dependencies import get_current_active_user
from typing import List, Optional
from datetime import datetime, timedelta
from app.domains.mental_health.services.personal_context import invalidate_user_personal_context

router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])

# ========================================
# PUBLIC ENDPOINTS (No Auth Required)
# ========================================

@router.get("/psychologists", response_model=List[schemas.Psychologist])
async def get_psychologists(
    available_only: bool = Query(False, description="Filter only available psychologists"),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get all psychologists, optionally filtered by availability.
    
    Public endpoint - no authentication required.
    """
    query = select(models.Psychologist)
    
    if available_only:
        query = query.where(models.Psychologist.is_available == True)
    
    result = await db.execute(query)
    psychologists = result.scalars().all()
    return psychologists

@router.get("/psychologists/{psychologist_id}", response_model=schemas.Psychologist)
async def get_psychologist(
    psychologist_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """Get a single psychologist by ID."""
    result = await db.execute(
        select(models.Psychologist).where(models.Psychologist.id == psychologist_id)
    )
    psychologist = result.scalar_one_or_none()
    
    if not psychologist:
        raise HTTPException(status_code=404, detail="Psychologist not found")
    
    return psychologist

@router.get("/appointment-types", response_model=List[schemas.AppointmentType])
async def get_appointment_types(db: AsyncSession = Depends(get_async_db)):
    """
    Get all available appointment types.
    
    Public endpoint - no authentication required.
    """
    result = await db.execute(select(models.AppointmentType))
    appointment_types = result.scalars().all()
    return appointment_types

@router.get("/appointment-types/{type_id}", response_model=schemas.AppointmentType)
async def get_appointment_type(
    type_id: int,
    db: AsyncSession = Depends(get_async_db)
):
    """Get a single appointment type by ID."""
    result = await db.execute(
        select(models.AppointmentType).where(models.AppointmentType.id == type_id)
    )
    appointment_type = result.scalar_one_or_none()
    
    if not appointment_type:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    
    return appointment_type

# ========================================
# AUTHENTICATED USER ENDPOINTS
# ========================================

@router.post("", response_model=schemas.Appointment, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment: schemas.AppointmentCreate,
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create a new appointment for the authenticated user.
    
    Requires authentication. The appointment will be created for the current user.
    """
    # Verify psychologist exists and is available
    psychologist_result = await db.execute(
        select(models.Psychologist).where(models.Psychologist.id == appointment.psychologist_id)
    )
    psychologist = psychologist_result.scalar_one_or_none()
    
    if not psychologist:
        raise HTTPException(status_code=404, detail="Psychologist not found")
    
    if not psychologist.is_available:
        raise HTTPException(status_code=400, detail="Psychologist is not currently available")
    
    # Verify appointment type exists
    type_result = await db.execute(
        select(models.AppointmentType).where(models.AppointmentType.id == appointment.appointment_type_id)
    )
    appointment_type = type_result.scalar_one_or_none()
    
    if not appointment_type:
        raise HTTPException(status_code=404, detail="Appointment type not found")
    
    # Check for conflicting appointments (same user, overlapping time)
    # Get all scheduled/moved appointments for this user
    existing_query = select(models.Appointment).join(
        models.AppointmentType
    ).where(
        and_(
            models.Appointment.user_id == current_user.id,
            models.Appointment.status.in_(["scheduled", "moved"])
        )
    )
    
    existing_result = await db.execute(existing_query)
    existing_appointments = existing_result.scalars().all()
    
    # Check for time conflicts manually
    new_start = appointment.appointment_datetime
    new_end = appointment.appointment_datetime + timedelta(minutes=appointment_type.duration_minutes)
    
    for existing in existing_appointments:
        existing_type_result = await db.execute(
            select(models.AppointmentType).where(
                models.AppointmentType.id == existing.appointment_type_id
            )
        )
        existing_type = existing_type_result.scalar_one()
        existing_start = existing.appointment_datetime
        existing_end = existing.appointment_datetime + timedelta(minutes=existing_type.duration_minutes)
        
        # Check if appointments overlap
        if not (new_end <= existing_start or new_start >= existing_end):
            raise HTTPException(
                status_code=409,
                detail="You already have an appointment scheduled at this time"
            )
    
    # Create the appointment
    db_appointment = models.Appointment(
        user_id=current_user.id,
        psychologist_id=appointment.psychologist_id,
        appointment_type_id=appointment.appointment_type_id,
        appointment_datetime=appointment.appointment_datetime,
        notes=appointment.notes,
        status=appointment.status.value
    )
    
    db.add(db_appointment)
    await db.commit()
    await db.refresh(db_appointment)
    
    # Invalidate user context after booking
    await invalidate_user_personal_context(current_user.id)
    
    return db_appointment

@router.get("/my-appointments", response_model=List[schemas.Appointment])
async def get_my_appointments(
    status_filter: Optional[str] = Query(None, description="Filter by status: scheduled, completed, cancelled, moved, no_show"),
    upcoming_only: bool = Query(False, description="Show only upcoming appointments"),
    past_only: bool = Query(False, description="Show only past appointments"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of appointments to return"),
    offset: int = Query(0, ge=0, description="Number of appointments to skip"),
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get all appointments for the authenticated user.
    
    Supports filtering by status, time (upcoming/past), and pagination.
    Results are ordered by appointment_datetime descending (newest first).
    """
    query = select(models.Appointment).where(
        models.Appointment.user_id == current_user.id
    )
    
    # Apply filters
    if status_filter:
        query = query.where(models.Appointment.status == status_filter)
    
    if upcoming_only:
        query = query.where(models.Appointment.appointment_datetime >= datetime.now())
    
    if past_only:
        query = query.where(models.Appointment.appointment_datetime < datetime.now())
    
    # Order and paginate
    query = query.order_by(models.Appointment.appointment_datetime.desc())
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    appointments = result.scalars().all()
    
    return appointments

@router.get("/my-appointments/stats", response_model=schemas.AppointmentStats)
async def get_my_appointment_stats(
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """Get appointment statistics for the authenticated user."""
    base_query = select(models.Appointment).where(
        models.Appointment.user_id == current_user.id
    )
    
    # Total appointments
    total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar() or 0
    
    # Count by status
    status_counts = {}
    for status_value in ["scheduled", "completed", "cancelled", "moved", "no_show"]:
        count_result = await db.execute(
            select(func.count()).select_from(
                base_query.where(models.Appointment.status == status_value).subquery()
            )
        )
        status_counts[status_value] = count_result.scalar() or 0
    
    # Upcoming (scheduled + moved, future dates)
    upcoming_result = await db.execute(
        select(func.count()).select_from(
            base_query.where(
                and_(
                    models.Appointment.status.in_(["scheduled", "moved"]),
                    models.Appointment.appointment_datetime >= datetime.now()
                )
            ).subquery()
        )
    )
    upcoming = upcoming_result.scalar() or 0
    
    return schemas.AppointmentStats(
        total_appointments=total,
        upcoming_count=upcoming,
        completed_count=status_counts["completed"],
        cancelled_count=status_counts["cancelled"],
        moved_count=status_counts["moved"],
        no_show_count=status_counts["no_show"]
    )

@router.get("/{appointment_id}", response_model=schemas.Appointment)
async def get_appointment(
    appointment_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get a single appointment by ID.
    
    Users can only access their own appointments.
    """
    result = await db.execute(
        select(models.Appointment).where(
            and_(
                models.Appointment.id == appointment_id,
                models.Appointment.user_id == current_user.id
            )
        )
    )
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found or you don't have access to it"
        )
    
    return appointment

@router.put("/{appointment_id}", response_model=schemas.Appointment)
async def update_appointment(
    appointment_id: int,
    appointment_update: schemas.AppointmentUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update an appointment (reschedule, change status, update notes).
    
    Users can only update their own appointments.
    Cannot update appointments that are already completed or cancelled.
    """
    # Get existing appointment
    result = await db.execute(
        select(models.Appointment).where(
            and_(
                models.Appointment.id == appointment_id,
                models.Appointment.user_id == current_user.id
            )
        )
    )
    db_appointment = result.scalar_one_or_none()
    
    if not db_appointment:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found or you don't have access to it"
        )
    
    # Prevent updates to completed/cancelled appointments (unless changing status)
    if db_appointment.status in ["completed", "cancelled"] and appointment_update.appointment_datetime:
        raise HTTPException(
            status_code=400,
            detail="Cannot reschedule completed or cancelled appointments"
        )
    
    # If changing datetime, check for conflicts
    if appointment_update.appointment_datetime:
        # Get appointment type for duration
        type_result = await db.execute(
            select(models.AppointmentType).where(
                models.AppointmentType.id == db_appointment.appointment_type_id
            )
        )
        appointment_type = type_result.scalar_one()
        
        # Get all scheduled/moved appointments for this user (excluding current)
        existing_query = select(models.Appointment).join(
            models.AppointmentType
        ).where(
            and_(
                models.Appointment.id != appointment_id,
                models.Appointment.user_id == current_user.id,
                models.Appointment.status.in_(["scheduled", "moved"])
            )
        )
        
        existing_result = await db.execute(existing_query)
        existing_appointments = existing_result.scalars().all()
        
        # Check for time conflicts manually
        new_start = appointment_update.appointment_datetime
        new_end = appointment_update.appointment_datetime + timedelta(minutes=appointment_type.duration_minutes)
        
        for existing in existing_appointments:
            existing_type_result = await db.execute(
                select(models.AppointmentType).where(
                    models.AppointmentType.id == existing.appointment_type_id
                )
            )
            existing_type = existing_type_result.scalar_one()
            existing_start = existing.appointment_datetime
            existing_end = existing.appointment_datetime + timedelta(minutes=existing_type.duration_minutes)
            
            # Check if appointments overlap
            if not (new_end <= existing_start or new_start >= existing_end):
                raise HTTPException(
                    status_code=409,
                    detail="You already have an appointment scheduled at this time"
                )
    
    # Update fields
    if appointment_update.appointment_datetime is not None:
        db_appointment.appointment_datetime = appointment_update.appointment_datetime
    
    if appointment_update.notes is not None:
        db_appointment.notes = appointment_update.notes
    
    if appointment_update.status is not None:
        db_appointment.status = appointment_update.status.value
    
    db_appointment.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(db_appointment)
    
    # Invalidate user context after update
    await invalidate_user_personal_context(current_user.id)
    
    return db_appointment

@router.put("/{appointment_id}/notes", response_model=schemas.Appointment)
async def update_appointment_notes(
    appointment_id: int,
    notes_update: schemas.AppointmentNotesUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Update only the notes for an appointment (pre-appointment information).
    
    Dedicated endpoint for the pre-appointment notes feature.
    Users can only update notes for their own appointments.
    """
    # Get existing appointment
    result = await db.execute(
        select(models.Appointment).where(
            and_(
                models.Appointment.id == appointment_id,
                models.Appointment.user_id == current_user.id
            )
        )
    )
    db_appointment = result.scalar_one_or_none()
    
    if not db_appointment:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found or you don't have access to it"
        )
    
    # Update notes
    db_appointment.notes = notes_update.notes
    db_appointment.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(db_appointment)
    
    return db_appointment

@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_appointment(
    appointment_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Cancel an appointment (soft delete - sets status to 'cancelled').
    
    Users can only cancel their own appointments.
    Cannot cancel already completed appointments.
    """
    # Get existing appointment
    result = await db.execute(
        select(models.Appointment).where(
            and_(
                models.Appointment.id == appointment_id,
                models.Appointment.user_id == current_user.id
            )
        )
    )
    db_appointment = result.scalar_one_or_none()
    
    if not db_appointment:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found or you don't have access to it"
        )
    
    if db_appointment.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel a completed appointment"
        )
    
    if db_appointment.status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Appointment is already cancelled"
        )
    
    # Soft delete by setting status to cancelled
    db_appointment.status = "cancelled"
    db_appointment.updated_at = datetime.now()
    
    await db.commit()
    
    # Invalidate user context after cancellation
    await invalidate_user_personal_context(current_user.id)
    
    return None
