"""Counselor profile schemas for admin and counselor management."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


# ========================================
# Extended Profile Schemas
# ========================================

class EducationItem(BaseModel):
    """Single education entry."""
    degree: str
    institution: str
    year: Optional[int] = None
    field_of_study: Optional[str] = None

class CertificationItem(BaseModel):
    """Single certification entry."""
    name: str
    issuing_organization: str
    year: Optional[int] = None
    expiry_date: Optional[str] = None

class AvailabilitySlot(BaseModel):
    """Time slot for availability."""
    day: str  # monday, tuesday, etc.
    start_time: str  # "09:00"
    end_time: str  # "17:00"
    is_available: bool = True


# ========================================
# Base Counselor Schemas
# ========================================

class CounselorBase(BaseModel):
    """Base schema for Counselor data."""
    name: str = Field(..., min_length=1, max_length=255)
    specialization: Optional[str] = Field(None, max_length=255)
    image_url: Optional[str] = None
    is_available: bool = True
    bio: Optional[str] = None
    years_of_experience: Optional[int] = Field(None, ge=0, le=70)
    languages: Optional[List[str]] = Field(default_factory=list)
    consultation_fee: Optional[float] = Field(None, ge=0)
    
    @field_validator('languages')
    @classmethod
    def validate_languages(cls, v):
        if v is None:
            return []
        return v


class CounselorCreate(CounselorBase):
    """Schema for creating a Counselor profile (admin only)."""
    user_id: int = Field(..., description="User ID to link Counselor profile to")
    education: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    certifications: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    availability_schedule: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class CounselorUpdate(BaseModel):
    """Schema for updating Counselor profile."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    specialization: Optional[str] = Field(None, max_length=255)
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    bio: Optional[str] = None
    years_of_experience: Optional[int] = Field(None, ge=0, le=70)
    languages: Optional[List[str]] = None
    consultation_fee: Optional[float] = Field(None, ge=0)
    education: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[Dict[str, Any]]] = None
    availability_schedule: Optional[List[Dict[str, Any]]] = None


class CounselorAvailabilityToggle(BaseModel):
    """Schema for toggling Counselor availability."""
    is_available: bool


# ========================================
# Response Schemas
# ========================================

class UserBasicInfo(BaseModel):
    """Basic user information for Counselor response."""
    id: int
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class CounselorResponse(CounselorBase):
    """Complete Counselor profile response."""
    id: int
    user_id: Optional[int] = None
    rating: float = 0.0
    total_reviews: int = 0
    education: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    certifications: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    availability_schedule: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    user: Optional[UserBasicInfo] = None

    class Config:
        from_attributes = True


class CounselorListItem(BaseModel):
    """Simplified Counselor info for list views."""
    id: int
    user_id: Optional[int] = None
    name: str
    specialization: Optional[str] = None
    image_url: Optional[str] = None
    is_available: bool
    years_of_experience: Optional[int] = None
    rating: float = 0.0
    total_reviews: int = 0
    consultation_fee: Optional[float] = None

    class Config:
        from_attributes = True


class CounselorListResponse(BaseModel):
    """Paginated list of counselors."""
    counselors: List[CounselorListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ========================================
# Statistics Schemas
# ========================================

class CounselorStats(BaseModel):
    """Statistics for a Counselor."""
    total_appointments: int
    upcoming_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    total_patients: int
    average_rating: float
    total_reviews: int


class CounselorDashboardStats(BaseModel):
    """Dashboard statistics for counselor role."""
    profile_completion_percentage: float
    this_week_appointments: int
    upcoming_appointments: int
    total_revenue: float
    average_rating: float
    total_reviews: int
    total_patients: int
    total_completed_appointments: int
