"""Admin profile management endpoints."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import User
from app.schemas.admin.profile import (
    AdminPasswordChangeRequest,
    AdminPasswordChangeResponse,
    AdminProfileResponse,
    AdminProfileUpdateRequest,
)
from app.services.user_service import async_get_user_by_plain_email

router = APIRouter(prefix="/profile", tags=["Admin - Profile"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _serialize_admin(user: User) -> AdminProfileResponse:
    email_plain = user.email or ""
    if "@" not in email_plain:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored admin email address is invalid. Please contact support.",
        )

    return AdminProfileResponse(
        id=user.id,
        email=email_plain,
        name=user.name,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        allow_email_checkins=user.allow_email_checkins,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=AdminProfileResponse)
async def get_admin_profile(current_admin: User = Depends(get_admin_user)) -> AdminProfileResponse:
    return _serialize_admin(current_admin)


@router.put("/me", response_model=AdminProfileResponse)
async def update_admin_profile(
    payload: AdminProfileUpdateRequest,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_db),
) -> AdminProfileResponse:
    has_changes = False

    current_email = current_admin.email or ""
    if payload.email and payload.email.lower() != current_email.lower():
        existing = await async_get_user_by_plain_email(db, payload.email)
        if existing and existing.id != current_admin.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email address is already associated with another account.",
            )
        current_admin.email = payload.email
        has_changes = True

    for field_name, new_value in (
        ("name", payload.name),
        ("first_name", payload.first_name),
        ("last_name", payload.last_name),
        ("phone", payload.phone),
    ):
        if new_value is not None:
            if getattr(current_admin, field_name) != new_value:
                setattr(current_admin, field_name, new_value)
                has_changes = True

    if payload.allow_email_checkins is not None and current_admin.allow_email_checkins != payload.allow_email_checkins:
        current_admin.allow_email_checkins = payload.allow_email_checkins
        has_changes = True

    if not has_changes:
        return _serialize_admin(current_admin)

    current_admin.updated_at = datetime.utcnow()

    try:
        db.add(current_admin)
        await db.commit()
        await db.refresh(current_admin)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile. Please try again.",
        ) from exc

    return _serialize_admin(current_admin)


@router.post("/password", response_model=AdminPasswordChangeResponse)
async def change_admin_password(
    payload: AdminPasswordChangeRequest,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_db),
) -> AdminPasswordChangeResponse:
    if not current_admin.password_hash or not _pwd_context.verify(payload.current_password, current_admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    current_admin.password_hash = _pwd_context.hash(payload.new_password)
    current_admin.updated_at = datetime.utcnow()

    try:
        db.add(current_admin)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password. Please try again.",
        ) from exc

    return AdminPasswordChangeResponse(message="Password updated successfully.")

