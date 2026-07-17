from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Set, cast
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_db
from app.dependencies import (
    get_current_active_user,
    get_current_active_user_with_normalized_relations,
)
from app.models import (
    User, 
    UserBadge,
    UserProfile,
    UserClinicalRecord,
    UserPreferences,
    UserEmergencyContact,
    UserConsentLedger,
)  # Core models
from app.domains.mental_health.models import (
    Appointment,
    AppointmentType,
    Conversation,
    JournalEntry,
)
from app.schemas.user import (
    CheckinSettingsResponse,
    CheckinSettingsUpdate,
    ContactInfo,
    ConsentAndPrivacySettings,
    EmergencyContact,
    EarnedBadgeInfo,
    LocalizationAndAccessibility,
    ProfileHeaderSummary,
    SafetyAndClinicalBasics,
    SyncAchievementsResponse,
    TherapyAssignment,
    TimelineEntry,
    UserProfileOverviewResponse,
    UserProfileOverviewUpdate,
    UserStatsResponse,
)
from app.schemas.ai_memory import AIMemoryFactResponse
from app.domains.mental_health.services.user_stats_service import UserStatsService
from app.services.user_normalization import (
    allow_email_checkins as allow_email_checkins_for_user,
    check_in_code as get_check_in_code,
    clinical_snapshot,
    ensure_user_normalized_tables,
    set_checkins_opt_in,
)
from app.services.achievement_service import sync_user_achievements as sync_achievements_for_user
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/api/v1/profile",
    tags=["Profile"],
    dependencies=[Depends(get_current_active_user)],
)


# =============================================================================
# SIMASTER Import Schema
# =============================================================================

class SimasterImportRequest(BaseModel):
    """Request schema for importing SIMASTER profile data."""
    nim: Optional[str] = Field(None, description="Student ID (NIM)")
    name: Optional[str] = Field(None, description="Full name from SIMASTER")
    faculty: Optional[str] = Field(None, description="Faculty name")
    major: Optional[str] = Field(None, description="Study program/major")
    year: Optional[str] = Field(None, description="Year of enrollment")
    email: Optional[str] = Field(None, description="Email from SIMASTER")
    photo_url: Optional[str] = Field(None, description="Profile photo URL")


class SimasterImportResponse(BaseModel):
    """Response schema for SIMASTER import."""
    success: bool
    message: str
    updated_fields: List[str]


def _normalize_optional_string(value: str | None) -> str | None:
    """Normalize and clean optional string values."""
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _calculate_age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(years, 0)


async def _ensure_check_in_code(user: User, db: AsyncSession) -> None:
    normalized_user = await ensure_user_normalized_tables(db, user)

    code = get_check_in_code(normalized_user)
    if not code:
        code = uuid.uuid4().hex
        if normalized_user.preferences:
            normalized_user.preferences.check_in_code = code
            db.add(normalized_user.preferences)

    # Keep legacy users.check_in_code in sync during the migration window.
    if getattr(normalized_user, "check_in_code", None) != code:
        normalized_user.check_in_code = code
        db.add(normalized_user)

    await db.commit()


def _build_avatar_url(full_name: str | None, check_in_code: str) -> str:
    seed = full_name or check_in_code
    return f"https://api.dicebear.com/7.x/initials/png?seed={quote(seed)}"


async def _build_timeline(user_id: int, db: AsyncSession) -> List[TimelineEntry]:
    timeline: List[TimelineEntry] = []

    journal_stmt = (
        select(
            JournalEntry.id,
            JournalEntry.entry_date,
            JournalEntry.content,
            JournalEntry.created_at,
        )
        .where(JournalEntry.user_id == user_id)
        .order_by(JournalEntry.created_at.desc())
        .limit(10)
    )
    journal_entries = (await db.execute(journal_stmt)).all()
    for entry_id, entry_date, content, created_at in journal_entries:
        description = (content[:160] + "...") if len(content) > 160 else content
        timeline.append(
            TimelineEntry(
                kind="journal",
                title="Journal entry submitted",
                description=description,
                timestamp=created_at,
                metadata={"entry_id": entry_id, "entry_date": date.fromisoformat(str(entry_date)).isoformat()},
            )
        )

    session_starts_subquery = (
        select(
            Conversation.session_id,
            func.min(Conversation.timestamp).label("started_at"),
        )
        .where(Conversation.user_id == user_id)
        .group_by(Conversation.session_id)
        .subquery()
    )

    conversation_stmt = (
        select(Conversation, session_starts_subquery.c.started_at)
        .join(
            session_starts_subquery,
            and_(
                Conversation.session_id == session_starts_subquery.c.session_id,
                Conversation.timestamp == session_starts_subquery.c.started_at,
            ),
        )
        .order_by(session_starts_subquery.c.started_at.desc())
        .limit(10)
    )
    conversation_rows = await db.execute(conversation_stmt)
    for convo, started_at in conversation_rows.all():
        raw_message = (convo.message or "").strip()
        normalized = " ".join(raw_message.split())
        if normalized:
            topic = normalized[:80]
            if len(normalized) > 80:
                topic = topic.rstrip() + "..."
            title = f"Opened a session with Aika about {topic}"
        else:
            title = "Opened a session with Aika"

        timeline.append(
            TimelineEntry(
                kind="conversation",
                title=title,
                description=None,
                timestamp=started_at,
                metadata={"session_id": convo.session_id},
            )
        )

    appointment_stmt = (
        select(Appointment, AppointmentType)
        .join(AppointmentType, Appointment.appointment_type_id == AppointmentType.id)
        .where(Appointment.user_id == user_id)
        .order_by(Appointment.appointment_datetime.desc())
        .limit(10)
    )
    appointment_rows = await db.execute(appointment_stmt)
    for appointment, appointment_type in appointment_rows.all():
        title = f"Appointment: {appointment_type.name}" if getattr(appointment_type, "name", None) else "Therapy appointment"
        timeline.append(
            TimelineEntry(
                kind="appointment",
                title=title,
                description=f"Status: {appointment.status}",
                timestamp=appointment.appointment_datetime,
                metadata={"appointment_id": appointment.id},
            )
        )

    badge_stmt = (
        select(UserBadge)
        .where(UserBadge.user_id == user_id)
        .order_by(UserBadge.awarded_at.desc())
        .limit(10)
    )
    badges = (await db.execute(badge_stmt)).scalars().all()
    for badge in badges:
        timeline.append(
            TimelineEntry(
                kind="badge",
                title="New badge earned",
                description=f"Badge #{badge.badge_id}",
                timestamp=badge.awarded_at,
                metadata={"transaction_hash": badge.transaction_hash},
            )
        )

    timeline.sort(key=lambda entry: entry.timestamp, reverse=True)
    return timeline[:20]


@router.get("/overview", response_model=UserProfileOverviewResponse)
async def get_profile_overview(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user_with_normalized_relations),
) -> UserProfileOverviewResponse:
    await _ensure_check_in_code(current_user, db)

    # Reuse eager-loaded auth user to avoid redundant DB roundtrips.
    user = current_user

    # Email always from User table (core auth)
    email = user.email

    phone = user.profile.phone if user.profile else None
    alternate_phone = user.profile.alternate_phone if user.profile else None

    # Emergency contact - read from UserEmergencyContact table with fallback to legacy User columns
    emergency_contact = None
    if user.emergency_contacts:
        # Use first emergency contact from normalized table
        primary_contact = user.emergency_contacts[0]
        emergency_contact = EmergencyContact(
            name=primary_contact.full_name,
            relationship=primary_contact.relationship_to_user,
            phone=primary_contact.phone,
            email=primary_contact.email,
        )
    else:
        # Fallback to legacy User columns
        legacy_emergency_contact = EmergencyContact(
            name=user.emergency_contact_name,
            relationship=user.emergency_contact_relationship,
            phone=user.emergency_contact_phone,
            email=user.emergency_contact_email,
        )
        if any([legacy_emergency_contact.name, legacy_emergency_contact.relationship, 
                legacy_emergency_contact.phone, legacy_emergency_contact.email]):
            emergency_contact = legacy_emergency_contact

    # Name fields (canonical: UserProfile)
    first_name = user.profile.first_name if user.profile else None
    last_name = user.profile.last_name if user.profile else None
    full_name_parts = [first_name, last_name]
    full_name = " ".join([part for part in full_name_parts if part]) or user.name

    preferred_name = user.profile.preferred_name if user.profile else None

    # Profile header (canonical: UserProfile)
    pronouns = user.profile.pronouns if user.profile else None
    city = user.profile.city if user.profile else None
    university = user.profile.university if user.profile else None
    major = user.profile.major if user.profile else None

    year_of_study = str(user.profile.year_of_study) if (user.profile and user.profile.year_of_study is not None) else None
    date_of_birth = user.profile.date_of_birth if user.profile else None
    profile_photo_url = user.profile.profile_photo_url if user.profile else None

    normalized_check_in_code = get_check_in_code(user) or ""

    header = ProfileHeaderSummary(
        user_id=user.id,
        full_name=full_name,
        preferred_name=preferred_name,
        pronouns=pronouns,
        profile_photo_url=profile_photo_url,
        wallet_address=user.wallet_address,
        google_sub=user.google_sub,
        avatar_url=profile_photo_url
        or _build_avatar_url(preferred_name or full_name, normalized_check_in_code or str(user.id)),
        date_of_birth=cast(date, date_of_birth) if date_of_birth else None,
        age=_calculate_age(cast(date, date_of_birth) if date_of_birth else None),
        sentiment_score=(user.profile.sentiment_score if user.profile else user.sentiment_score) or 0.0,
        current_streak=(user.profile.current_streak if user.profile else user.current_streak) or 0,
        longest_streak=(user.profile.longest_streak if user.profile else user.longest_streak) or 0,
        last_activity_date=(cast(date, user.profile.last_activity_date) if (user.profile and user.profile.last_activity_date) else None),
        city=city,
        university=university,
        major=major,
        year_of_study=year_of_study,
        created_at=user.created_at,
        check_in_code=normalized_check_in_code,
    )

    contact = ContactInfo(
        primary_email=email,
        phone=phone,
        alternate_phone=alternate_phone,
        emergency_contact=emergency_contact,
    )

    clinical = clinical_snapshot(user)
    safety = SafetyAndClinicalBasics(
        risk_level=clinical.risk_level,
        clinical_summary=clinical.clinical_summary,
        primary_concerns=clinical.primary_concerns,
        safety_plan_notes=clinical.safety_plan_notes,
    )

    therapy = TherapyAssignment(
        current_therapist_name=(user.clinical_record.external_therapist_name if user.clinical_record else None),
        current_therapist_contact=(user.clinical_record.external_therapist_contact if user.clinical_record else None),
        therapy_modality=(user.clinical_record.therapy_modality if user.clinical_record else None),
        therapy_frequency=(user.clinical_record.therapy_frequency if user.clinical_record else None),
        therapy_notes=(getattr(user.clinical_record, "therapy_notes", None) if user.clinical_record else None),
    )

    allow_email_checkins = allow_email_checkins_for_user(user)
    consent = ConsentAndPrivacySettings(
        allow_email_checkins=allow_email_checkins,
        consent_data_sharing=user.consent_data_sharing,
        consent_research=user.consent_research,
        consent_emergency_contact=user.consent_emergency_contact,
        consent_marketing=user.consent_marketing,
        consent_ai_memory=getattr(user, "consent_ai_memory", False),
    )

    preferred_language = (user.preferences.preferred_language if user.preferences else None) or "id"
    preferred_timezone = (user.preferences.preferred_timezone if user.preferences else None) or "Asia/Jakarta"
    accessibility_needs = user.preferences.accessibility_notes if user.preferences else None
    communication_preferences = user.preferences.communication_preferences if user.preferences else None
    interface_preferences = user.preferences.interface_preferences if user.preferences else None
    
    localization = LocalizationAndAccessibility(
        preferred_language=preferred_language,
        preferred_timezone=preferred_timezone,
        accessibility_needs=accessibility_needs,
        communication_preferences=communication_preferences,
        interface_preferences=interface_preferences,
    )

    timeline = await _build_timeline(user.id, db)

    return UserProfileOverviewResponse(
        header=header,
        contact=contact,
        safety=safety,
        therapy=therapy,
        timeline=timeline,
        consent=consent,
        localization=localization,
        aicare_team_notes=(user.clinical_record.aicare_team_notes if user.clinical_record else None),
    )


@router.post("/refresh-stats", response_model=UserStatsResponse)
async def refresh_user_stats(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> UserStatsResponse:
    """
    Refresh and update user statistics (streaks, sentiment score).
    Call this endpoint from dashboard/profile to ensure stats are always current.
    """
    logger.info(f"Refreshing stats for user {current_user.id}")
    try:
        stats_service = UserStatsService(db)
        stats = await stats_service.refresh_user_stats(current_user)
        return stats
    except Exception as e:
        logger.error(f"Failed to refresh stats for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh user statistics"
        )


@router.put("/overview", response_model=UserProfileOverviewResponse)
async def update_profile_overview(
    payload: UserProfileOverviewUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user_with_normalized_relations),
) -> UserProfileOverviewResponse:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return await get_profile_overview(db=db, current_user=current_user)

    user = current_user

    # Ensure 1:1 normalized rows exist so writes target the canonical tables.
    await ensure_user_normalized_tables(db, user)

    # Define which fields belong to which tables
    profile_fields = {
        "preferred_name", "pronouns", "profile_photo_url", "phone", "alternate_phone",
        "city", "university", "major", "year_of_study"
    }
    preference_fields = {
        "preferred_language",
        "preferred_timezone",
        "accessibility_needs",
        "communication_preferences",
        "interface_preferences",
    }
    emergency_contact_fields = {
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone", "emergency_contact_email"
    }
    consent_fields = {
        "consent_data_sharing", "consent_research",
        "consent_emergency_contact", "consent_marketing",
        "consent_ai_memory",
    }
    clinical_fields = {
        "risk_level",
        "clinical_summary",
        "primary_concerns",
        "safety_plan_notes",
        "current_therapist_name",
        "current_therapist_contact",
        "therapy_modality",
        "therapy_frequency",
        "therapy_notes",
        "aicare_team_notes",
    }

    updated = False

    try:
        # Update UserProfile fields
        for field in profile_fields:
            if field in data:
                # Create profile if it doesn't exist
                if not user.profile:
                    user.profile = UserProfile(user_id=user.id, country="Indonesia")
                    db.add(user.profile)
                    updated = True

                if field == "year_of_study":
                    raw_value = data.get(field)
                    try:
                        normalized_int = int(str(raw_value).strip()) if raw_value is not None else None
                    except Exception:
                        normalized_int = None
                    user.profile.year_of_study = normalized_int
                    # Keep legacy users.year_of_study in sync during the migration window.
                    if hasattr(user, "year_of_study"):
                        user.year_of_study = str(normalized_int) if normalized_int is not None else None
                else:
                    normalized = _normalize_optional_string(data.get(field))
                    setattr(user.profile, field, normalized)
                    # Dual-write to legacy User column for backward compatibility
                    if hasattr(user, field):
                        setattr(user, field, normalized)
                updated = True

        # Update UserPreferences fields
        # Note: 'accessibility_needs' from API maps to 'accessibility_notes' in UserPreferences
        for field in preference_fields:
            if field in data:
                # Create preferences if they don't exist
                if not user.preferences:
                    user.preferences = UserPreferences(
                        user_id=user.id,
                        preferred_language="id",
                        preferred_timezone="Asia/Jakarta",
                        aika_personality="empathetic",
                        aika_response_length="balanced"
                    )
                    db.add(user.preferences)
                    updated = True

                normalized = _normalize_optional_string(data.get(field))
                # Map accessibility_needs to accessibility_notes for UserPreferences
                prefs_field = "accessibility_notes" if field == "accessibility_needs" else field
                setattr(user.preferences, prefs_field, normalized)
                # Dual-write to legacy User column for backward compatibility
                # (communication/interface blobs live on users historically)
                if prefs_field == "accessibility_notes" and hasattr(user, "accessibility_needs"):
                    user.accessibility_needs = normalized
                elif hasattr(user, field):
                    setattr(user, field, normalized)
                updated = True

        # Update emergency contact in UserEmergencyContact table
        emergency_data = {k: data.get(k) for k in emergency_contact_fields if k in data}
        if emergency_data:
            # Map legacy field names to normalized field names
            normalized_emergency = {}
            if "emergency_contact_name" in emergency_data:
                normalized_emergency["full_name"] = emergency_data["emergency_contact_name"]
            if "emergency_contact_relationship" in emergency_data:
                normalized_emergency["relationship_to_user"] = emergency_data["emergency_contact_relationship"]
            if "emergency_contact_phone" in emergency_data:
                normalized_emergency["phone"] = emergency_data["emergency_contact_phone"]
            if "emergency_contact_email" in emergency_data:
                normalized_emergency["email"] = emergency_data["emergency_contact_email"]

            # Update or create first emergency contact
            if user.emergency_contacts:
                # Update existing first contact
                primary_contact = user.emergency_contacts[0]
                for field, value in normalized_emergency.items():
                    normalized_value = _normalize_optional_string(value)
                    setattr(primary_contact, field, normalized_value)
            else:
                # Create new emergency contact
                new_contact = UserEmergencyContact(user_id=user.id)
                for field, value in normalized_emergency.items():
                    normalized_value = _normalize_optional_string(value)
                    if normalized_value is not None:
                        setattr(new_contact, field, normalized_value)
                db.add(new_contact)
            
            # Dual-write to legacy User columns for backward compatibility
            for legacy_field, value in emergency_data.items():
                normalized_value = _normalize_optional_string(value)
                setattr(user, legacy_field, normalized_value)
            updated = True

        # Update consent settings (append to UserConsentLedger for audit trail)
        for field in consent_fields:
            if field in data and data[field] is not None:
                # Update User table (current consent status)
                setattr(user, field, data[field])
                
                # Append to UserConsentLedger (append-only audit trail)
                consent_type = field.replace("consent_", "")
                consent_entry = UserConsentLedger(
                    user_id=user.id,
                    consent_type=consent_type,
                    granted=data[field],
                    consent_version="v1.0",
                    consent_language=(
                        user.preferences.preferred_language if user.preferences 
                        else user.preferred_language or "id"
                    ),
                    consent_method="profile_update",
                    timestamp=datetime.utcnow(),
                )
                db.add(consent_entry)
                updated = True

        # Update clinical/therapy fields in UserClinicalRecord (canonical)
        clinical_data = {k: data.get(k) for k in clinical_fields if k in data}
        if clinical_data:
            if not user.clinical_record:
                user.clinical_record = UserClinicalRecord(user_id=user.id)
                db.add(user.clinical_record)
                updated = True

            if "risk_level" in clinical_data:
                user.clinical_record.current_risk_level = _normalize_optional_string(clinical_data.get("risk_level"))
                # Keep legacy users.risk_level in sync during migration window.
                if hasattr(user, "risk_level"):
                    user.risk_level = user.clinical_record.current_risk_level
                updated = True

            if "clinical_summary" in clinical_data:
                user.clinical_record.clinical_summary = _normalize_optional_string(clinical_data.get("clinical_summary"))
                if hasattr(user, "clinical_summary"):
                    user.clinical_summary = user.clinical_record.clinical_summary
                updated = True

            if "primary_concerns" in clinical_data:
                raw = _normalize_optional_string(clinical_data.get("primary_concerns"))
                if raw is None:
                    user.clinical_record.primary_concerns = None
                else:
                    parts = [p.strip() for p in raw.replace("\n", ",").split(",")]
                    user.clinical_record.primary_concerns = [p for p in parts if p]
                if hasattr(user, "primary_concerns"):
                    user.primary_concerns = raw
                updated = True

            if "safety_plan_notes" in clinical_data:
                user.clinical_record.safety_plan_notes = _normalize_optional_string(clinical_data.get("safety_plan_notes"))
                if hasattr(user, "safety_plan_notes"):
                    user.safety_plan_notes = user.clinical_record.safety_plan_notes
                updated = True

            # Map legacy “current therapist” fields -> external therapist columns
            if "current_therapist_name" in clinical_data:
                user.clinical_record.external_therapist_name = _normalize_optional_string(clinical_data.get("current_therapist_name"))
                if hasattr(user, "current_therapist_name"):
                    user.current_therapist_name = user.clinical_record.external_therapist_name
                updated = True
            if "current_therapist_contact" in clinical_data:
                user.clinical_record.external_therapist_contact = _normalize_optional_string(clinical_data.get("current_therapist_contact"))
                if hasattr(user, "current_therapist_contact"):
                    user.current_therapist_contact = user.clinical_record.external_therapist_contact
                updated = True

            if "therapy_modality" in clinical_data:
                user.clinical_record.therapy_modality = _normalize_optional_string(clinical_data.get("therapy_modality"))
                if hasattr(user, "therapy_modality"):
                    user.therapy_modality = user.clinical_record.therapy_modality
                updated = True
            if "therapy_frequency" in clinical_data:
                user.clinical_record.therapy_frequency = _normalize_optional_string(clinical_data.get("therapy_frequency"))
                if hasattr(user, "therapy_frequency"):
                    user.therapy_frequency = user.clinical_record.therapy_frequency
                updated = True
            if "therapy_notes" in clinical_data:
                therapy_notes = _normalize_optional_string(clinical_data.get("therapy_notes"))
                setattr(user.clinical_record, "therapy_notes", therapy_notes)
                if hasattr(user, "therapy_notes"):
                    user.therapy_notes = therapy_notes
                updated = True

            if "aicare_team_notes" in clinical_data:
                user.clinical_record.aicare_team_notes = _normalize_optional_string(clinical_data.get("aicare_team_notes"))
                updated = True

        if updated:
            user.updated_at = datetime.utcnow()
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            # Invalidate user cache after profile update
            from app.core.cache import invalidate_user_cache
            await invalidate_user_cache(user.id)
            logger.info(f"Invalidated cache for user {user.id} after profile update")
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        await db.rollback()
        logger.error("Failed to update profile overview for user %s", user.id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update profile overview.") from exc

    return await get_profile_overview(db=db, current_user=user)


@router.put("/settings/checkins", response_model=CheckinSettingsResponse)
async def update_checkin_settings(
    settings: CheckinSettingsUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user_with_normalized_relations),
) -> CheckinSettingsResponse:
    logger.info("Updating check-in settings for user %s to %s", current_user.id, settings.allow_email_checkins)
    user = current_user

    await set_checkins_opt_in(db, user=user, allow=settings.allow_email_checkins)

    # Keep legacy users.allow_email_checkins in sync during the migration window.
    if hasattr(user, "allow_email_checkins"):
        user.allow_email_checkins = settings.allow_email_checkins
    try:
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except Exception as exc:  # pragma: no cover - defensive logging
        await db.rollback()
        logger.error("Failed to update check-in settings for user %s", current_user.id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update settings") from exc

    return CheckinSettingsResponse(allow_email_checkins=allow_email_checkins_for_user(user))


@router.get("/ai-memory/facts", response_model=List[AIMemoryFactResponse])
async def list_ai_memory_facts(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> List[AIMemoryFactResponse]:
    """List user AI memory facts.

    Facts are always visible to the user to enable explicit deletion control,
    regardless of whether consent is currently enabled.
    """
    from app.services.ai_memory_facts_service import list_user_facts

    facts = await list_user_facts(db, current_user.id, limit=100)
    return [
        AIMemoryFactResponse(
            id=fact.id,
            fact=fact.fact_encrypted or "",  # Column stores plaintext now (encryption removed)
            category=fact.category,
            source=fact.source,
            created_at=fact.created_at,
            updated_at=fact.updated_at,
        )
        for fact in facts
    ]


@router.delete(
    "/ai-memory/facts/{fact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_ai_memory_fact(
    fact_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Forget a single AI memory fact."""
    from app.services.ai_memory_facts_service import delete_user_fact

    deleted = await delete_user_fact(db, current_user.id, fact_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory fact not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sync-achievements", response_model=SyncAchievementsResponse)
async def sync_user_achievements(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> SyncAchievementsResponse:
    logger.info("Running achievement sync for user %s", current_user.id)

    try:
        newly_awarded_badge_info = await sync_achievements_for_user(db, current_user, fail_on_config_error=True)

        return SyncAchievementsResponse(
            message="Achievements checked successfully.",
            newly_awarded_badges=newly_awarded_badge_info,
        )

    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Unexpected error syncing achievements for user %s", current_user.id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to sync achievements") from exc


@router.get("/my-badges", response_model=List[EarnedBadgeInfo])
async def get_my_earned_badges(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> List[EarnedBadgeInfo]:
    logger.info("Fetching earned badges for user %s", current_user.id)
    try:
        result = await db.execute(
            select(UserBadge).filter(UserBadge.user_id == current_user.id).order_by(UserBadge.awarded_at.desc())
        )
        return list(result.scalars().all())
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.error("Error fetching badges for user %s", current_user.id, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve earned badges.") from exc


# =============================================================================
# SIMASTER Import Endpoint
# =============================================================================

@router.post("/import-simaster", response_model=SimasterImportResponse)
async def import_simaster_data(
    payload: SimasterImportRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> SimasterImportResponse:
    """
    Import profile data from SIMASTER.
    
    This endpoint receives data extracted by the client-side bookmarklet
    from the user's SIMASTER profile page.
    """
    logger.info("SIMASTER import request for user %s", current_user.id)
    
    updated_fields: List[str] = []
    
    try:
        # Load user with profile relationship
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == current_user.id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Ensure UserProfile exists
        if not user.profile:
            user.profile = UserProfile(user_id=user.id)
            db.add(user.profile)
        
        # Update fields from SIMASTER data
        if payload.nim:
            # Store NIM in a custom field or notes
            # For now, we can store it as student_id in profile
            user.profile.student_id = payload.nim
            updated_fields.append("nim")
        
        if payload.name:
            # Parse name into first/last if possible
            name_parts = payload.name.strip().split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            user.profile.first_name = first_name
            user.profile.last_name = last_name
            user.name = payload.name
            updated_fields.append("name")
        
        if payload.faculty:
            # Store faculty - could be in university field or a new field
            # For now, append to university or store separately
            user.profile.faculty = payload.faculty
            updated_fields.append("faculty")
        
        if payload.major:
            user.profile.major = payload.major
            user.major = payload.major  # Legacy field
            updated_fields.append("major")
        
        if payload.year:
            # Try to extract year number
            year_str = payload.year.strip()
            try:
                year_num = int(year_str)
                user.profile.year_of_study = year_num
                user.year_of_study = str(year_num)  # Legacy field
                updated_fields.append("year")
            except ValueError:
                # If not a number, store as-is in legacy field
                user.year_of_study = year_str
                updated_fields.append("year")
        
        if payload.photo_url:
            user.profile.profile_photo_url = payload.photo_url
            updated_fields.append("photo_url")
        
        # Set university as UGM since we're importing from SIMASTER
        user.profile.university = "Universitas Gadjah Mada"
        user.university = "Universitas Gadjah Mada"
        if "university" not in updated_fields:
            updated_fields.append("university")
        
        # Mark profile as verified from SIMASTER
        user.profile.simaster_verified = True
        user.profile.simaster_verified_at = datetime.now()
        
        await db.commit()
        
        logger.info(
            "SIMASTER import successful for user %s: updated %s",
            current_user.id,
            ", ".join(updated_fields)
        )
        
        return SimasterImportResponse(
            success=True,
            message=f"Successfully imported {len(updated_fields)} fields from SIMASTER",
            updated_fields=updated_fields
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.error("SIMASTER import failed for user %s: %s", current_user.id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to import SIMASTER data"
        ) from exc
