from app.routes.admin.utils import decrypt_user_email, decrypt_user_field

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import IntegrityError
from typing import Optional
from app.database import get_async_db
from app.models.user import User
from app.domains.mental_health.models import Psychologist as CounselorProfile, Appointment
from app.schemas.counselor import (
    CounselorCreate,
    CounselorUpdate,
    CounselorResponse,
    CounselorListResponse,
    CounselorListItem,
    CounselorAvailabilityToggle,
    CounselorStats
)
from app.dependencies import get_current_active_user

router = APIRouter(prefix="/admin/counselors", tags=["Admin - Counselors"])


async def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Dependency to ensure user has admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _prepare_counselor_display(profile: CounselorProfile) -> CounselorProfile:
    """Ensure counselor fields are decrypted for client consumption."""
    if profile.name:
        decrypted_name = decrypt_user_field(profile.name)
        if decrypted_name:
            profile.name = decrypted_name

    if profile.user:
        if profile.user.name:
            decrypted_user_name = decrypt_user_field(profile.user.name)
            if decrypted_user_name:
                profile.user.name = decrypted_user_name
        if profile.user.email:
            profile.user.email = decrypt_user_email(profile.user.email)

    return profile


# ========================================
# List and Search Counselors
# ========================================

async def _ensure_counselor_profiles(db: AsyncSession) -> None:
    """Ensure counselor users have matching profile records."""
    try:
        counselor_rows = await db.execute(
            select(User.id, User.name, User.email).where(User.role == "counselor")
        )
        counselor_users = counselor_rows.all()
        if not counselor_users:
            return

        user_map = {row.id: row for row in counselor_users}
        existing_rows = await db.execute(
            select(CounselorProfile.user_id).where(CounselorProfile.user_id.is_not(None))
        )
        existing_ids = {row[0] for row in existing_rows if row[0] is not None}
        missing_ids = [user_id for user_id in user_map if user_id not in existing_ids]

        if not missing_ids:
            return

        for user_id in missing_ids:
            row = user_map[user_id]
            email = getattr(row, "email", None)
            display_name_encrypted = getattr(row, "name", None)
            
            # Try to get name from user profile first
            display_name = decrypt_user_field(display_name_encrypted)
            
            # If no name, try to get from email
            if not display_name and email:
                display_name = decrypt_user_email(email)
                
            # If still no name (decryption failed or empty), use raw email or ID fallback
            if not display_name:
                display_name = email or f"Counselor {user_id}"

            profile = CounselorProfile(
                user_id=user_id,
                name=display_name,
                is_available=True,
            )
            db.add(profile)

        await db.commit()
    except IntegrityError:
        # Handle race condition where profile was created by another request
        await db.rollback()
    except Exception as e:
        # Log other errors but don't crash the list endpoint
        print(f"Error ensuring counselor profiles: {e}")
        await db.rollback()


@router.get("", response_model=CounselorListResponse)
async def list_counselors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    search: Optional[str] = None,
    is_available: Optional[bool] = None,
    specialization: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin),
):
    """List all counselors with pagination and filters."""
    await _ensure_counselor_profiles(db)

    max_page_size = 100
    effective_page_size = min(page_size, max_page_size)

    query = select(CounselorProfile).options(selectinload(CounselorProfile.user))

    if search:
        query = query.filter(
            or_(
                CounselorProfile.name.ilike(f"%{search}%"),
                CounselorProfile.specialization.ilike(f"%{search}%"),
            )
        )

    if is_available is not None:
        query = query.filter(CounselorProfile.is_available == is_available)

    if specialization:
        query = query.filter(CounselorProfile.specialization.ilike(f"%{specialization}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    offset = (page - 1) * effective_page_size
    query = query.order_by(CounselorProfile.name).offset(offset).limit(effective_page_size)

    result = await db.execute(query)
    counselors = [_prepare_counselor_display(profile) for profile in result.scalars().all()]

    total_pages = (total + effective_page_size - 1) // effective_page_size

    return CounselorListResponse(
        counselors=[CounselorListItem.model_validate(p) for p in counselors],
        total=total,
        page=page,
        page_size=effective_page_size,
        total_pages=total_pages,
    )


# ========================================
# Get Single Counselor
# ========================================

@router.get("/{counselor_id}", response_model=CounselorResponse)
async def get_counselor(
    counselor_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """Get detailed information about a specific counselor."""
    query = select(CounselorProfile).options(
        joinedload(CounselorProfile.user)
    ).filter(CounselorProfile.id == counselor_id)
    
    result = await db.execute(query)
    counselor = result.scalar_one_or_none()
    
    if not counselor:
        raise HTTPException(status_code=404, detail="Counselor not found")

    counselor = _prepare_counselor_display(counselor)
    return CounselorResponse.model_validate(counselor)


# ========================================
# Create Counselor profile
# ========================================

@router.post("", response_model=CounselorResponse, status_code=201)
async def create_counselor(
    counselor_data: CounselorCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new Counselor profile linked to a user.
    
    The user must exist and must have role 'counselor' or 'admin'.
    """
    # Check if user exists
    user_query = select(User).filter(User.id == counselor_data.user_id)
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has appropriate role
    if user.role not in ["counselor", "admin"]:
        raise HTTPException(
            status_code=400, 
            detail=f"User must have 'counselor' or 'admin' role. Current role: {user.role}"
        )
    
    # Check if Counselor profile already exists for this user
    existing_query = select(CounselorProfile).filter(CounselorProfile.user_id == counselor_data.user_id)
    existing_result = await db.execute(existing_query)
    existing = existing_result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=409, 
            detail="Counselor profile already exists for this user"
        )
    
    # Create Counselor profile
    counselor = CounselorProfile(
        user_id=counselor_data.user_id,
        name=counselor_data.name,
        specialization=counselor_data.specialization,
        image_url=counselor_data.image_url,
        is_available=counselor_data.is_available,
        bio=counselor_data.bio,
        years_of_experience=counselor_data.years_of_experience,
        languages=counselor_data.languages,
        consultation_fee=counselor_data.consultation_fee,
        education=counselor_data.education,
        certifications=counselor_data.certifications,
        availability_schedule=counselor_data.availability_schedule
    )
    
    db.add(counselor)
    await db.commit()
    await db.refresh(counselor)
    
    # Load user relationship
    await db.refresh(counselor, ['user'])

    counselor = _prepare_counselor_display(counselor)
    return CounselorResponse.model_validate(counselor)


# ========================================
# Update Counselor profile
# ========================================

@router.put("/{counselor_id}", response_model=CounselorResponse)
async def update_counselor(
    counselor_id: int,
    counselor_data: CounselorUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """Update an existing Counselor profile."""
    query = select(CounselorProfile).filter(CounselorProfile.id == counselor_id)
    result = await db.execute(query)
    counselor = result.scalar_one_or_none()
    
    if not counselor:
        raise HTTPException(status_code=404, detail="Counselor not found")
    
    # Update only provided fields
    update_data = counselor_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(counselor, field, value)
    
    await db.commit()
    await db.refresh(counselor)
    await db.refresh(counselor, ['user'])

    counselor = _prepare_counselor_display(counselor)
    return CounselorResponse.model_validate(counselor)


# ========================================
# Toggle Availability
# ========================================

@router.patch("/{counselor_id}/availability", response_model=CounselorResponse)
async def toggle_availability(
    counselor_id: int,
    availability: CounselorAvailabilityToggle,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """Toggle counselor availability status."""
    query = select(CounselorProfile).filter(CounselorProfile.id == counselor_id)
    result = await db.execute(query)
    counselor = result.scalar_one_or_none()
    
    if not counselor:
        raise HTTPException(status_code=404, detail="Counselor not found")
    
    counselor.is_available = availability.is_available
    await db.commit()
    await db.refresh(counselor)
    await db.refresh(counselor, ['user'])

    counselor = _prepare_counselor_display(counselor)
    return CounselorResponse.model_validate(counselor)


# ========================================
# Delete Counselor profile
# ========================================

@router.delete("/{counselor_id}", status_code=204)
async def delete_counselor(
    counselor_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete a Counselor profile.
    
    Note: This does not delete the associated user account, only the Counselor profile.
    All appointments with this counselor will remain but reference will be removed.
    """
    query = select(CounselorProfile).filter(CounselorProfile.id == counselor_id)
    result = await db.execute(query)
    counselor = result.scalar_one_or_none()
    
    if not counselor:
        raise HTTPException(status_code=404, detail="Counselor not found")
    
    await db.delete(counselor)
    await db.commit()
    
    return None


# ========================================
# Get counselor Statistics
# ========================================

@router.get("/{counselor_id}/stats", response_model=CounselorStats)
async def get_counselor_stats(
    counselor_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(require_admin)
):
    """Get statistics for a specific counselor."""
    counselor_query = select(CounselorProfile).filter(CounselorProfile.id == counselor_id)
    counselor_result = await db.execute(counselor_query)
    counselor = counselor_result.scalar_one_or_none()
    
    if not counselor:
        raise HTTPException(status_code=404, detail="Counselor not found")
    
    # Get appointment statistics
    total_appointments_query = select(func.count(Appointment.id)).filter(
        Appointment.psychologist_id == counselor_id
    )
    total_appointments = await db.scalar(total_appointments_query) or 0
    
    upcoming_appointments_query = select(func.count(Appointment.id)).filter(
        Appointment.psychologist_id == counselor_id,
        Appointment.status == 'scheduled'
    )
    upcoming_appointments = await db.scalar(upcoming_appointments_query) or 0
    
    completed_appointments_query = select(func.count(Appointment.id)).filter(
        Appointment.psychologist_id == counselor_id,
        Appointment.status == 'completed'
    )
    completed_appointments = await db.scalar(completed_appointments_query) or 0
    
    cancelled_appointments_query = select(func.count(Appointment.id)).filter(
        Appointment.psychologist_id == counselor_id,
        Appointment.status == 'cancelled'
    )
    cancelled_appointments = await db.scalar(cancelled_appointments_query) or 0
    
    # Get unique patients count
    total_patients_query = select(func.count(func.distinct(Appointment.user_id))).filter(
        Appointment.psychologist_id == counselor_id
    )
    total_patients = await db.scalar(total_patients_query) or 0
    
    return CounselorStats(
        total_appointments=total_appointments,
        upcoming_appointments=upcoming_appointments,
        completed_appointments=completed_appointments,
        cancelled_appointments=cancelled_appointments,
        total_patients=total_patients,
        average_rating=counselor.rating or 0.0,
        total_reviews=counselor.total_reviews or 0
    )



