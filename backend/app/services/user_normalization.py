"""User normalization helpers.

The codebase currently contains both:
- legacy columns on `users`
- normalized tables: `user_profiles`, `user_preferences`, `user_clinical_records`

This module provides:
- runtime best-effort migration from legacy -> normalized (no secrets needed)
- centralized accessors so callers stop reaching into legacy `users.*` fields

This enables a safe 2-phase migration:
1) Backfill + refactor callers
2) Drop legacy columns from `users`
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Optional

from sqlalchemy import inspect, select
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.models.user_clinical_record import UserClinicalRecord
from app.models.user_emergency_contact import UserEmergencyContact
from app.models.user_preferences import UserPreferences
from app.models.user_profile import UserProfile


_JAKARTA_DEFAULT_COUNTRY = "Indonesia"


def _split_primary_concerns(value: Optional[str]) -> list[str]:
    if not value:
        return []
    # Common formats seen in legacy text fields: comma-separated or newline-separated
    candidates = [part.strip() for part in value.replace("\n", ",").split(",")]
    return [c for c in candidates if c]


def _join_primary_concerns(value: Optional[Iterable[str]]) -> Optional[str]:
    if not value:
        return None
    normalized = [str(v).strip() for v in value if str(v).strip()]
    if not normalized:
        return None
    return ", ".join(normalized)


def display_name(user: User) -> str:
    """Best-effort human display name (safe for UI + email templates)."""

    if user.profile:
        for candidate in (user.profile.preferred_name, user.profile.first_name, user.profile.full_name):
            if candidate:
                return str(candidate)

    for candidate in (user.name, user.first_name, user.email):
        if candidate:
            return str(candidate)

    return "Teman UGM"


def allow_email_checkins(user: User) -> bool:
    if user.preferences and user.preferences.allow_email_checkins is not None:
        return bool(user.preferences.allow_email_checkins)
    return bool(getattr(user, "allow_email_checkins", True))


def check_in_code(user: User) -> Optional[str]:
    if user.preferences and user.preferences.check_in_code:
        return str(user.preferences.check_in_code)
    return getattr(user, "check_in_code", None)


def current_risk_level(user: User) -> Optional[str]:
    if user.clinical_record and user.clinical_record.current_risk_level:
        return str(user.clinical_record.current_risk_level)
    # Legacy field fallback (during migration)
    return getattr(user, "risk_level", None)


@dataclass(frozen=True)
class ClinicalSnapshot:
    risk_level: Optional[str]
    clinical_summary: Optional[str]
    primary_concerns: Optional[str]
    safety_plan_notes: Optional[str]


def clinical_snapshot(user: User) -> ClinicalSnapshot:
    if user.clinical_record:
        return ClinicalSnapshot(
            risk_level=current_risk_level(user),
            clinical_summary=user.clinical_record.clinical_summary,
            primary_concerns=_join_primary_concerns(user.clinical_record.primary_concerns),
            safety_plan_notes=user.clinical_record.safety_plan_notes,
        )

    return ClinicalSnapshot(
        risk_level=getattr(user, "risk_level", None),
        clinical_summary=getattr(user, "clinical_summary", None),
        primary_concerns=getattr(user, "primary_concerns", None),
        safety_plan_notes=getattr(user, "safety_plan_notes", None),
    )


async def ensure_user_normalized_tables(db: AsyncSession, user: User) -> User:
    """Ensure normalized 1:1 rows exist and are populated (best-effort).

    This function is intentionally conservative:
    - It only copies legacy -> normalized if the normalized field is missing.
    - It avoids overwriting non-empty normalized fields.
    """

    changed = False

    # Ensure relationships are loaded in async-safe way.
    # Some call sites intentionally resolve a minimal auth user object
    # with lazy relationships disabled; direct relationship access would
    # otherwise trigger MissingGreenlet.
    relationship_names = {
        "profile",
        "preferences",
        "clinical_record",
        "emergency_contacts",
    }
    user_state = inspect(user)
    should_preload = user_state.detached or any(
        rel_name in user_state.unloaded for rel_name in relationship_names
    )

    if should_preload:
        preload_result = await db.execute(
            select(User)
            .options(
                joinedload(User.profile),
                joinedload(User.preferences),
                selectinload(User.clinical_record),
                selectinload(User.emergency_contacts),
            )
            .where(User.id == user.id)
        )
        loaded_user = preload_result.unique().scalar_one_or_none()
        if loaded_user is not None:
            user = loaded_user

    # ---------------------------------------------------------------------
    # user_profiles
    # ---------------------------------------------------------------------
    if user.profile is None:
        user.profile = UserProfile(user_id=user.id, country=_JAKARTA_DEFAULT_COUNTRY)
        db.add(user.profile)
        changed = True

    profile = user.profile
    if profile is not None:
        # Names
        if not profile.first_name and getattr(user, "first_name", None):
            profile.first_name = user.first_name
            changed = True
        if not profile.last_name and getattr(user, "last_name", None):
            profile.last_name = user.last_name
            changed = True
        if not profile.preferred_name and getattr(user, "preferred_name", None):
            profile.preferred_name = user.preferred_name
            changed = True
        if not profile.pronouns and getattr(user, "pronouns", None):
            profile.pronouns = user.pronouns
            changed = True

        # Contact
        if not profile.phone and getattr(user, "phone", None):
            profile.phone = user.phone
            changed = True
        if not profile.alternate_phone and getattr(user, "alternate_phone", None):
            profile.alternate_phone = user.alternate_phone
            changed = True
        if not getattr(profile, "telegram_username", None) and getattr(user, "telegram_username", None):
            profile.telegram_username = user.telegram_username
            changed = True

        # Demographics / academics
        for attr in (
            "date_of_birth",
            "gender",
            "city",
            "university",
            "major",
        ):
            if getattr(profile, attr, None) is None and getattr(user, attr, None) is not None:
                setattr(profile, attr, getattr(user, attr))
                changed = True

        # year_of_study is int in profile, str in legacy user
        if profile.year_of_study is None and getattr(user, "year_of_study", None):
            try:
                profile.year_of_study = int(str(user.year_of_study))
                changed = True
            except Exception:
                pass

        # Engagement
        if getattr(profile, "sentiment_score", None) in (None, 0.0) and getattr(user, "sentiment_score", None) not in (None, 0.0):
            profile.sentiment_score = float(user.sentiment_score)
            changed = True
        if (profile.current_streak or 0) == 0 and getattr(user, "current_streak", 0):
            profile.current_streak = int(user.current_streak)
            changed = True
        if (profile.longest_streak or 0) == 0 and getattr(user, "longest_streak", 0):
            profile.longest_streak = int(user.longest_streak)
            changed = True
        if profile.last_activity_date is None and getattr(user, "last_activity_date", None) is not None:
            try:
                profile.last_activity_date = user.last_activity_date
                changed = True
            except Exception:
                pass

        if not profile.profile_photo_url and getattr(user, "profile_photo_url", None):
            profile.profile_photo_url = user.profile_photo_url
            changed = True

    # ---------------------------------------------------------------------
    # user_preferences
    # ---------------------------------------------------------------------
    if user.preferences is None:
        user.preferences = UserPreferences(
            user_id=user.id,
            preferred_language="id",
            preferred_timezone="Asia/Jakarta",
            aika_personality="empathetic",
            aika_response_length="balanced",
        )
        db.add(user.preferences)
        changed = True

    preferences = user.preferences
    if preferences is not None:
        # allow_email_checkins exists in both legacy + preferences
        legacy_allow = getattr(user, "allow_email_checkins", None)
        if preferences.allow_email_checkins is None and legacy_allow is not None:
            preferences.allow_email_checkins = bool(legacy_allow)
            changed = True

        legacy_checkin_code = getattr(user, "check_in_code", None)
        if not preferences.check_in_code and legacy_checkin_code:
            preferences.check_in_code = str(legacy_checkin_code)
            changed = True

        # Localization
        for attr in ("preferred_language", "preferred_timezone"):
            if not getattr(preferences, attr, None) and getattr(user, attr, None):
                setattr(preferences, attr, getattr(user, attr))
                changed = True

        # Accessibility needs: legacy uses `accessibility_needs`, preferences uses `accessibility_notes`
        if not preferences.accessibility_notes and getattr(user, "accessibility_needs", None):
            preferences.accessibility_notes = user.accessibility_needs
            changed = True

        # Legacy free-text blobs
        if not getattr(preferences, "communication_preferences", None) and getattr(user, "communication_preferences", None):
            preferences.communication_preferences = user.communication_preferences
            changed = True
        if not getattr(preferences, "interface_preferences", None) and getattr(user, "interface_preferences", None):
            preferences.interface_preferences = user.interface_preferences
            changed = True

        # Analytics consent (already exists on preferences)
        # If unset in preferences, keep its default.

    # ---------------------------------------------------------------------
    # user_clinical_records
    # ---------------------------------------------------------------------
    if user.clinical_record is None:
        # Only create if there is legacy clinical data to migrate.
        has_legacy_clinical = any(
            getattr(user, attr, None)
            for attr in (
                "risk_level",
                "clinical_summary",
                "primary_concerns",
                "safety_plan_notes",
                "therapy_modality",
                "therapy_frequency",
                "therapy_notes",
                "current_therapist_name",
                "current_therapist_contact",
                "aicare_team_notes",
            )
        )
        if has_legacy_clinical:
            user.clinical_record = UserClinicalRecord(user_id=user.id)
            db.add(user.clinical_record)
            changed = True

    clinical = user.clinical_record
    if clinical is not None:
        if not clinical.current_risk_level and getattr(user, "risk_level", None):
            clinical.current_risk_level = user.risk_level
            changed = True

        if not clinical.clinical_summary and getattr(user, "clinical_summary", None):
            clinical.clinical_summary = user.clinical_summary
            changed = True

        if not clinical.primary_concerns and getattr(user, "primary_concerns", None):
            clinical.primary_concerns = _split_primary_concerns(user.primary_concerns)
            changed = True

        if not clinical.safety_plan_notes and getattr(user, "safety_plan_notes", None):
            clinical.safety_plan_notes = user.safety_plan_notes
            changed = True

        # Map legacy "current therapist" fields to external therapist fields.
        if not clinical.external_therapist_name and getattr(user, "current_therapist_name", None):
            clinical.external_therapist_name = user.current_therapist_name
            changed = True
        if not clinical.external_therapist_contact and getattr(user, "current_therapist_contact", None):
            clinical.external_therapist_contact = user.current_therapist_contact
            changed = True

        if not clinical.therapy_modality and getattr(user, "therapy_modality", None):
            clinical.therapy_modality = user.therapy_modality
            changed = True
        if not clinical.therapy_frequency and getattr(user, "therapy_frequency", None):
            clinical.therapy_frequency = user.therapy_frequency
            changed = True

        if not getattr(clinical, "therapy_notes", None) and getattr(user, "therapy_notes", None):
            clinical.therapy_notes = user.therapy_notes
            changed = True

        if not clinical.aicare_team_notes and getattr(user, "aicare_team_notes", None):
            clinical.aicare_team_notes = user.aicare_team_notes
            changed = True

    # ---------------------------------------------------------------------
    # user_emergency_contacts (best-effort single primary contact)
    # ---------------------------------------------------------------------
    if not getattr(user, "emergency_contacts", None):
        legacy_name = getattr(user, "emergency_contact_name", None)
        legacy_rel = getattr(user, "emergency_contact_relationship", None)
        legacy_phone = getattr(user, "emergency_contact_phone", None)
        legacy_email = getattr(user, "emergency_contact_email", None)
        if any([legacy_name, legacy_rel, legacy_phone, legacy_email]):
            contact = UserEmergencyContact(user_id=user.id)
            if legacy_name:
                setattr(contact, "full_name", str(legacy_name))
            if legacy_rel:
                setattr(contact, "relationship_to_user", str(legacy_rel))
            if legacy_phone:
                setattr(contact, "phone", str(legacy_phone))
            if legacy_email:
                setattr(contact, "email", str(legacy_email))
            db.add(contact)
            changed = True

    if changed:
        # Avoid messing with caller's transaction semantics; the caller owns commit.
        db.add(user)

    return user


async def set_profile_last_activity_date(
    db: AsyncSession,
    *,
    user: User,
    activity_date: date,
) -> None:
    """Update last_activity_date in the normalized profile (best-effort)."""

    if user.profile is None:
        await ensure_user_normalized_tables(db, user)

    if user.profile and user.profile.last_activity_date != activity_date:
        user.profile.last_activity_date = activity_date
        db.add(user.profile)


async def set_checkins_opt_in(db: AsyncSession, *, user: User, allow: bool) -> None:
    if user.preferences is None:
        await ensure_user_normalized_tables(db, user)

    if not user.preferences:
        return

    user.preferences.allow_email_checkins = bool(allow)
    db.add(user.preferences)
