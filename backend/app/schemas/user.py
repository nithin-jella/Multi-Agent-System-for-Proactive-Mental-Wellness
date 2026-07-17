from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class LinkDIDRequest(BaseModel):
    wallet_address: str


class OCIDLinkRequest(BaseModel):
    """Payload sent from the frontend after a successful OCID OAuth flow.
    The `id_token` is the raw JWT issued by Open Campus; the backend will
    verify it against the Open Campus JWKS endpoint and extract the wallet
    address and OCId claim from its payload.
    """
    id_token: str


class EarnedBadgeInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    badge_id: int
    awarded_at: datetime
    transaction_hash: str
    contract_address: str
    name: Optional[str] = None
    image_url: Optional[str] = None


class OCIDLinkResponse(BaseModel):
    status: str
    wallet_address: str
    ocid_username: str
    newly_minted_badges: List[EarnedBadgeInfo] = []


class EmergencyContact(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class ContactInfo(BaseModel):
    primary_email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None


class SafetyAndClinicalBasics(BaseModel):
    risk_level: Optional[str] = None
    clinical_summary: Optional[str] = None
    primary_concerns: Optional[str] = None
    safety_plan_notes: Optional[str] = None


class TherapyAssignment(BaseModel):
    current_therapist_name: Optional[str] = None
    current_therapist_contact: Optional[str] = None
    therapy_modality: Optional[str] = None
    therapy_frequency: Optional[str] = None
    therapy_notes: Optional[str] = None


class ConsentAndPrivacySettings(BaseModel):
    allow_email_checkins: bool = True
    consent_data_sharing: bool = False
    consent_research: bool = False
    consent_emergency_contact: bool = False
    consent_marketing: bool = False
    consent_ai_memory: bool = False


class LocalizationAndAccessibility(BaseModel):
    preferred_language: Optional[str] = None
    preferred_timezone: Optional[str] = None
    accessibility_needs: Optional[str] = None
    communication_preferences: Optional[str] = None
    interface_preferences: Optional[str] = None


class TimelineEntry(BaseModel):
    kind: str
    title: str
    description: Optional[str] = None
    timestamp: datetime
    metadata: Optional[dict[str, Any]] = None


class ProfileHeaderSummary(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    preferred_name: Optional[str] = None
    pronouns: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    wallet_address: Optional[str] = None
    google_sub: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    sentiment_score: float = 0.0
    current_streak: int = 0
    longest_streak: int = 0
    last_activity_date: Optional[date] = None
    city: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    year_of_study: Optional[str] = None
    created_at: Optional[datetime] = None
    check_in_code: str


class UserProfileOverviewResponse(BaseModel):
    header: ProfileHeaderSummary
    contact: ContactInfo
    safety: SafetyAndClinicalBasics
    therapy: TherapyAssignment
    timeline: List[TimelineEntry]
    consent: ConsentAndPrivacySettings
    localization: LocalizationAndAccessibility
    aicare_team_notes: Optional[str] = None


class UserProfileOverviewUpdate(BaseModel):
    preferred_name: Optional[str] = None
    pronouns: Optional[str] = None
    profile_photo_url: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_email: Optional[str] = None
    risk_level: Optional[str] = None
    clinical_summary: Optional[str] = None
    primary_concerns: Optional[str] = None
    safety_plan_notes: Optional[str] = None
    current_therapist_name: Optional[str] = None
    current_therapist_contact: Optional[str] = None
    therapy_modality: Optional[str] = None
    therapy_frequency: Optional[str] = None
    therapy_notes: Optional[str] = None
    aicare_team_notes: Optional[str] = None
    consent_data_sharing: Optional[bool] = None
    consent_research: Optional[bool] = None
    consent_emergency_contact: Optional[bool] = None
    consent_marketing: Optional[bool] = None
    consent_ai_memory: Optional[bool] = None
    preferred_language: Optional[str] = None
    preferred_timezone: Optional[str] = None
    accessibility_needs: Optional[str] = None
    communication_preferences: Optional[str] = None
    interface_preferences: Optional[str] = None
    city: Optional[str] = None
    university: Optional[str] = None
    major: Optional[str] = None
    year_of_study: Optional[str] = None
    
    model_config = ConfigDict(extra='ignore')


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    google_sub: str
    email: Optional[str] = None
    wallet_address: Optional[str] = None
    current_streak: int = 0
    longest_streak: int = 0
    allow_email_checkins: bool = True


class CheckinSettingsUpdate(BaseModel):
    allow_email_checkins: bool


class CheckinSettingsResponse(BaseModel):
    allow_email_checkins: bool
    message: str = "Settings updated successfully"


class TestEmailPayload(BaseModel):
    recipient_email: EmailStr
    subject: str = "UGM-AICare Test Email"
    message: str = "This is a test message from the UGM-AICare email utility."


class SyncAchievementsResponse(BaseModel):
    message: str
    newly_awarded_badges: List[EarnedBadgeInfo] = []


class UserStatsResponse(BaseModel):
    """Response model for user statistics (streaks, sentiment)."""
    current_streak: int
    longest_streak: int
    sentiment_score: float
    last_activity_date: Optional[date] = None
