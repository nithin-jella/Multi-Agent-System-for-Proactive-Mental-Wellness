"""User management endpoints for the admin panel."""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from passlib.context import CryptContext
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import User, UserBadge, UserClinicalRecord, UserPreferences, UserProfile  # Core models
from app.domains.mental_health.models import Appointment, Conversation, JournalEntry
from app.models.user_audit_log import UserAuditLog
from app.models.agent_user import AgentUser
from app.schemas.admin import (
    AgentUserSummary,
    AdminCreateUserRequest,
    AdminCreateUserResponse,
    AdminUpdateUserRequest,
    AdminUserLogItem,
    UserDetailResponse,
    UserListItem,
    UsersResponse,
)
from .utils import decrypt_user_email, get_user_stats, build_avatar_url, decrypt_user_field
from app.services.user_normalization import allow_email_checkins as allow_email_checkins_for_user
from app.services.user_normalization import check_in_code as check_in_code_for_user
from app.services.user_normalization import clinical_snapshot
from app.services.user_normalization import ensure_user_normalized_tables
from app.services.user_normalization import set_checkins_opt_in
from app.core.role_utils import normalize_role as _normalize_role

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Users"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _ensure_admin_only(admin_user: User) -> None:
    if _normalize_role(getattr(admin_user, "role", "")) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _hash_password(password: str) -> str:
    return _pwd_context.hash(password)


@router.get("/agent-users", response_model=List[AgentUserSummary])
async def list_agent_users(
    role: Optional[str] = Query(None, description="Filter by agent role"),
    search: Optional[str] = Query(None, description="Search by agent identifier"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[AgentUserSummary]:
    """Return agent/counselor accounts available for assignments."""
    logger.info(
        "Admin %s requesting agent users (role=%s, search=%s)",
        admin_user.id,
        role,
        search,
    )

    stmt = select(AgentUser).order_by(AgentUser.created_at.desc())
    if role:
        stmt = stmt.where(AgentUser.role == role)
    if search:
        stmt = stmt.where(AgentUser.id.ilike(f"%{search}%"))

    result = await db.execute(stmt)
    agents = result.scalars().all()
    return [AgentUserSummary.model_validate(agent) for agent in agents]


@router.post("/users", response_model=AdminCreateUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminCreateUserRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> AdminCreateUserResponse:
    """Create a new user (user/counselor/admin) for manual provisioning."""
    _ensure_admin_only(admin_user)

    requested_role = _normalize_role(payload.role)
    if requested_role not in {"user", "counselor", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid role. Allowed: user, counselor, admin",
        )

    email_normalized = payload.email.strip().lower()
    existing = (
        await db.execute(select(User).where(func.lower(User.email) == email_normalized).limit(1))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    temp_password: Optional[str] = None
    if payload.password:
        password_hash = _hash_password(payload.password)
    else:
        temp_password = secrets.token_urlsafe(12)
        password_hash = _hash_password(temp_password)

    user = User(
        email=email_normalized,
        name=payload.name,
        role=requested_role,
        password_hash=password_hash,
        is_active=payload.is_active,
        email_verified=payload.email_verified,
        allow_email_checkins=payload.allow_email_checkins,
        created_at=datetime.utcnow(),
        last_login=None,
        check_in_code=uuid.uuid4().hex,
    )

    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to create user")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        ) from exc

    return AdminCreateUserResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        temporary_password=temp_password,
    )


@router.get("/users", response_model=UsersResponse)
async def get_users(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email or google_sub"),
    sort_by: str = Query("id", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    active_only: bool = Query(False, description="Show only active users"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Get paginated list of users with statistics."""
    logger.info(
        "Admin %s requesting users list (page %s, limit %s)",
        admin_user.id,
        page,
        limit,
    )

    base_query = (
        select(
            User,
            func.count(JournalEntry.id).label("journal_count"),
            func.count(Conversation.id).label("conversation_count"),
            func.count(UserBadge.id).label("badge_count"),
            func.count(Appointment.id).label("appointment_count"),
        )
        .outerjoin(JournalEntry, User.id == JournalEntry.user_id)
        .outerjoin(Conversation, User.id == Conversation.user_id)
        .outerjoin(UserBadge, User.id == UserBadge.user_id)
        .outerjoin(Appointment, User.id == Appointment.user_id)
        .outerjoin(UserProfile, User.id == UserProfile.user_id)
        .options(
            selectinload(User.profile),
            selectinload(User.preferences),
            selectinload(User.clinical_record),
        )
        .group_by(User.id)
    )

    if search:
        pattern = f"%{search}%"
        base_query = base_query.filter(
            or_(User.email.ilike(pattern), User.google_sub.ilike(pattern))
        )

    if active_only:
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        base_query = base_query.filter(func.coalesce(UserProfile.last_activity_date, User.last_activity_date) >= thirty_days_ago)

    count_query = select(func.count()).select_from(base_query.subquery())
    total_count = (await db.execute(count_query)).scalar() or 0

    sort_column = getattr(User, sort_by, User.id)
    ordered_query = base_query.order_by(
        desc(sort_column) if sort_order.lower() == "desc" else asc(sort_column)
    )

    offset = (page - 1) * limit
    rows = (await db.execute(ordered_query.offset(offset).limit(limit))).all()

    users: List[UserListItem] = []
    for user_obj, journal_count, conversation_count, badge_count, appointment_count in rows:
        email_plain = decrypt_user_email(user_obj.email)
        avatar_url = build_avatar_url(email_plain, user_obj.id)
        # Ensure last_activity_date is a Python date or None
        lad = (user_obj.profile.last_activity_date if user_obj.profile else None) or user_obj.last_activity_date
        import datetime as dt
        if lad is not None and not isinstance(lad, dt.date):
            try:
                if isinstance(lad, str):
                    lad = dt.date.fromisoformat(lad)
                else:
                    lad = dt.date.fromisoformat(str(lad))
            except Exception:
                lad = None
        users.append(
            UserListItem(
                id=user_obj.id,
                email=email_plain,
                google_sub=user_obj.google_sub,
                wallet_address=user_obj.wallet_address,
                sentiment_score=(user_obj.profile.sentiment_score if user_obj.profile else user_obj.sentiment_score),
                current_streak=(user_obj.profile.current_streak if user_obj.profile else user_obj.current_streak),
                longest_streak=(user_obj.profile.longest_streak if user_obj.profile else user_obj.longest_streak),
                last_activity_date=lad,
                allow_email_checkins=allow_email_checkins_for_user(user_obj),
                role=getattr(user_obj, "role", "user"),
                is_active=user_obj.is_active,
                created_at=user_obj.created_at,
                avatar_url=avatar_url,
                check_in_code=check_in_code_for_user(user_obj) or user_obj.check_in_code,
                total_journal_entries=journal_count or 0,
                total_conversations=conversation_count or 0,
                total_badges=badge_count or 0,
                total_appointments=appointment_count or 0,
                last_login=user_obj.last_login,
            )
        )

    stats = await get_user_stats(db)
    return UsersResponse(users=users, total_count=total_count, stats=stats)


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Retrieve full details for a single user."""
    logger.info("Admin %s requesting user detail %s", admin_user.id, user_id)
    user = (
        await db.execute(
            select(User)
            .options(
                selectinload(User.profile),
                selectinload(User.preferences),
                selectinload(User.clinical_record),
                selectinload(User.emergency_contacts),
            )
            .where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await ensure_user_normalized_tables(db, user)

    email_plain = decrypt_user_email(user.email)
    avatar_url = build_avatar_url(email_plain, user.id, size=192)

    journals = (
        await db.execute(
            select(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(desc(JournalEntry.created_at))
            .limit(10)
        )
    ).scalars().all()
    conversations = (
        await db.execute(
            select(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(desc(Conversation.timestamp))
            .limit(10)
        )
    ).scalars().all()
    badges = (
        await db.execute(select(UserBadge).filter(UserBadge.user_id == user_id))
    ).scalars().all()
    appointments = (
        await db.execute(select(Appointment).filter(Appointment.user_id == user_id))
    ).scalars().all()

    lad = (user.profile.last_activity_date if user.profile else None) or user.last_activity_date
    import datetime as dt
    if lad is not None and not isinstance(lad, dt.date):
        try:
            if isinstance(lad, str):
                lad = dt.date.fromisoformat(lad)
            else:
                lad = dt.date.fromisoformat(str(lad))
        except Exception:
            lad = None
    clinical = clinical_snapshot(user)

    emergency_contact = user.emergency_contacts[0] if user.emergency_contacts else None

    return UserDetailResponse(
        id=user.id,
        email=email_plain,
        google_sub=user.google_sub,
        wallet_address=user.wallet_address,
        sentiment_score=(user.profile.sentiment_score if user.profile else user.sentiment_score),
        current_streak=(user.profile.current_streak if user.profile else user.current_streak),
        longest_streak=(user.profile.longest_streak if user.profile else user.longest_streak),
        last_activity_date=lad,
        allow_email_checkins=allow_email_checkins_for_user(user),
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        avatar_url=avatar_url,
        check_in_code=check_in_code_for_user(user) or user.check_in_code,
        preferred_name=decrypt_user_field(user.profile.preferred_name if user.profile else None),
        pronouns=decrypt_user_field(user.profile.pronouns if user.profile else None),
        alternate_phone=decrypt_user_field(user.profile.alternate_phone if user.profile else None),
        emergency_contact_name=decrypt_user_field(emergency_contact.full_name if emergency_contact else None),
        emergency_contact_relationship=decrypt_user_field(emergency_contact.relationship_to_user if emergency_contact else None),
        emergency_contact_phone=decrypt_user_field(emergency_contact.phone if emergency_contact else None),
        emergency_contact_email=decrypt_user_field(emergency_contact.email if emergency_contact else None),
        risk_level=decrypt_user_field(clinical.risk_level),
        clinical_summary=decrypt_user_field(clinical.clinical_summary),
        primary_concerns=decrypt_user_field(clinical.primary_concerns),
        safety_plan_notes=decrypt_user_field(clinical.safety_plan_notes),
        current_therapist_name=decrypt_user_field(user.clinical_record.external_therapist_name if user.clinical_record else None),
        current_therapist_contact=decrypt_user_field(user.clinical_record.external_therapist_contact if user.clinical_record else None),
        therapy_modality=decrypt_user_field(user.clinical_record.therapy_modality if user.clinical_record else None),
        therapy_frequency=decrypt_user_field(user.clinical_record.therapy_frequency if user.clinical_record else None),
        therapy_notes=decrypt_user_field(getattr(user.clinical_record, "therapy_notes", None) if user.clinical_record else None),
        consent_data_sharing=user.consent_data_sharing,
        consent_research=user.consent_research,
        consent_emergency_contact=user.consent_emergency_contact,
        consent_marketing=user.consent_marketing,
        preferred_language=decrypt_user_field(user.preferences.preferred_language if user.preferences else None),
        preferred_timezone=decrypt_user_field(user.preferences.preferred_timezone if user.preferences else None),
        accessibility_needs=decrypt_user_field(user.preferences.accessibility_notes if user.preferences else None),
        communication_preferences=decrypt_user_field(user.preferences.communication_preferences if user.preferences else None),
        interface_preferences=decrypt_user_field(user.preferences.interface_preferences if user.preferences else None),
        aicare_team_notes=decrypt_user_field(user.clinical_record.aicare_team_notes if user.clinical_record else None),
        journal_entries=[j.__dict__ for j in journals],
        recent_conversations=[c.__dict__ for c in conversations],
        badges=[b.__dict__ for b in badges],
        appointments=[a.__dict__ for a in appointments],
    )


@router.get("/users/{user_id}/logs", response_model=List[AdminUserLogItem])
async def get_user_logs(
    user_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> List[AdminUserLogItem]:
    """Return audit log entries performed by a given user (best-effort)."""
    _ensure_admin_only(admin_user)

    # Ensure user exists
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    stmt = (
        select(UserAuditLog)
        .where(UserAuditLog.changed_by_user_id == user_id)
        .order_by(UserAuditLog.timestamp.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    out: List[AdminUserLogItem] = []
    for row in rows:
        activity = f"{row.action} {row.table_name}"
        if row.change_reason:
            activity = f"{activity}: {row.change_reason}"
        out.append(AdminUserLogItem(timestamp=row.timestamp, activity=activity))
    return out


@router.put("/users/{user_id}/email-checkins")
async def update_user_email_checkins(
    user_id: int,
    enabled: bool = Query(..., alias="enabled"),
    allow_email_checkins: Optional[bool] = Query(None, alias="allow_email_checkins"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Update the email check-in preference for a user."""
    logger.info(
        "Admin %s updating email check-ins for user %s", admin_user.id, user_id
    )
    user = (
        await db.execute(
            select(User)
            .options(selectinload(User.preferences))
            .where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Accept either `enabled` or legacy `allow_email_checkins`.
    resolved = enabled if allow_email_checkins is None else allow_email_checkins
    await ensure_user_normalized_tables(db, user)
    await set_checkins_opt_in(db, user=user, allow=bool(resolved))

    # Keep legacy users.allow_email_checkins in sync during migration window.
    user.allow_email_checkins = bool(resolved)
    await db.commit()
    await db.refresh(user)
    return {"user_id": user_id, "allow_email_checkins": resolved}


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    is_active: bool,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Activate or deactivate a user account."""
    logger.info("Admin %s updating status for user %s", admin_user.id, user_id)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return {"user_id": user_id, "is_active": is_active}


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Update a user's role."""
    logger.info("Admin %s updating role for user %s", admin_user.id, user_id)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    requested_role = _normalize_role(role)
    if requested_role == "admin":
        _ensure_admin_only(admin_user)
    user.role = requested_role
    await db.commit()
    await db.refresh(user)
    return {"user_id": user_id, "role": requested_role}


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: AdminUpdateUserRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Update basic user fields used by the admin panel."""
    _ensure_admin_only(admin_user)

    # Prefer AsyncSession.get() for compatibility with unit tests and for efficiency.
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    needs_normalization = any(
        value is not None
        for value in (
            payload.phone,
            payload.allow_email_checkins,
            payload.date_of_birth,
        )
    )
    if needs_normalization:
        await ensure_user_normalized_tables(db, user)

    if payload.email is not None:
        email_normalized = payload.email.strip().lower()
        existing = (
            await db.execute(
                select(User)
                .where(func.lower(User.email) == email_normalized)
                .where(User.id != user_id)
                .limit(1)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A different user with this email already exists",
            )
        user.email = email_normalized

    if payload.name is not None:
        user.name = payload.name
    if payload.phone is not None:
        if user.profile is None:
            user.profile = UserProfile(user_id=user.id, country="Indonesia")
            db.add(user.profile)
        user.profile.phone = payload.phone
        # Keep legacy users.phone in sync during migration window.
        if hasattr(user, "phone"):
            user.phone = payload.phone
    if payload.wallet_address is not None:
        user.wallet_address = payload.wallet_address
    if payload.allow_email_checkins is not None:
        await set_checkins_opt_in(db, user=user, allow=bool(payload.allow_email_checkins))
        user.allow_email_checkins = bool(payload.allow_email_checkins)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.date_of_birth is not None:
        if user.profile is None:
            user.profile = UserProfile(user_id=user.id, country="Indonesia")
            db.add(user.profile)
        user.profile.date_of_birth = payload.date_of_birth
        if hasattr(user, "date_of_birth"):
            user.date_of_birth = payload.date_of_birth

    if payload.role is not None:
        requested_role = _normalize_role(payload.role)
        if requested_role == "admin":
            _ensure_admin_only(admin_user)
        user.role = requested_role

    user.updated_at = datetime.utcnow()
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to update user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        ) from exc

    return {"message": "User updated", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    permanent: bool = Query(False, description="Permanently delete (default: soft deactivate)"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Delete or deactivate a user."""
    _ensure_admin_only(admin_user)
    logger.info("Admin %s deleting user %s (permanent=%s)", admin_user.id, user_id, permanent)
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not permanent:
        user.is_active = False
        await db.commit()
        await db.refresh(user)
        return {"message": f"User {user_id} deactivated", "user_id": user_id}

    await db.delete(user)
    await db.commit()
    return {"message": f"User {user_id} deleted", "user_id": user_id}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """Generate a password reset token for a user."""
    logger.info("Admin %s requesting password reset for user %s", admin_user.id, user_id)
    if getattr(admin_user, "role", None) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can reset passwords",
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_email = decrypt_user_email(user.email)
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an email address",
        )

    reset_token = secrets.token_urlsafe(32)
    # Persist token + expiry so the normal reset flow can validate it.
    user.password_reset_token = reset_token
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.exception("Failed to persist reset token for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate reset token",
        ) from exc

    logger.info("Password reset token generated for user %s", user_id)
    return {
        "message": f"Password reset token generated for user {user_id}",
        "user_id": user_id,
        "email": user_email,
        "reset_token": reset_token,
        "note": "In production, this token would be sent via email",
    }
