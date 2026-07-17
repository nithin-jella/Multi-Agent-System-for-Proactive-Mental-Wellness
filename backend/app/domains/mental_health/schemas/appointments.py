# backend/app/schemas/appointments.py
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

#? --- Psychology Appointment Schemas ---

# --- Appointment Status Enum ---
class AppointmentStatus(str, Enum):
    """Valid appointment statuses."""
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    moved = "moved"
    no_show = "no_show"

# --- Psychologist Schemas ---
class PsychologistBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    specialization: Optional[str] = Field(None, max_length=200)
    image_url: Optional[str] = Field(None, max_length=500)
    is_available: bool = True

class PsychologistCreate(PsychologistBase):
    pass

class PsychologistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    specialization: Optional[str] = Field(None, max_length=200)
    image_url: Optional[str] = Field(None, max_length=500)
    is_available: Optional[bool] = None

class Psychologist(PsychologistBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- AppointmentType Schemas ---
class AppointmentTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    duration_minutes: int = Field(..., ge=15, le=480, description="Duration in minutes (15-480)")
    description: Optional[str] = Field(None, max_length=1000)

class AppointmentTypeCreate(AppointmentTypeBase):
    pass

class AppointmentTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    description: Optional[str] = Field(None, max_length=1000)

class AppointmentType(AppointmentTypeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Simplified User Schema for Appointment Responses ---
class AppointmentUser(BaseModel):
    """Simplified user information for appointment responses."""
    id: int
    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Appointment Schemas ---
class AppointmentBase(BaseModel):
    psychologist_id: int = Field(..., gt=0)
    appointment_type_id: int = Field(..., gt=0)
    appointment_datetime: datetime = Field(..., description="ISO 8601 datetime for the appointment")
    notes: Optional[str] = Field(None, max_length=5000, description="Pre-appointment notes or additional information")
    status: AppointmentStatus = AppointmentStatus.scheduled

    @field_validator('appointment_datetime')
    @classmethod
    def validate_future_datetime(cls, v: datetime) -> datetime:
        """Ensure appointment is not in the past (with 5-minute grace period)."""
        from datetime import timedelta
        if v < datetime.now() - timedelta(minutes=5):
            raise ValueError('Appointment datetime cannot be in the past')
        return v

class AppointmentCreate(AppointmentBase):
    """Schema for creating a new appointment."""
    pass  # Will use current user from auth

class AppointmentUpdate(BaseModel):
    """Schema for updating an appointment."""
    appointment_datetime: Optional[datetime] = Field(None, description="New datetime for the appointment")
    notes: Optional[str] = Field(None, max_length=5000)
    status: Optional[AppointmentStatus] = None

    @field_validator('appointment_datetime')
    @classmethod
    def validate_future_datetime(cls, v: Optional[datetime]) -> Optional[datetime]:
        """Ensure new appointment time is not in the past."""
        if v is not None:
            from datetime import timedelta
            if v < datetime.now() - timedelta(minutes=5):
                raise ValueError('Appointment datetime cannot be in the past')
        return v

class AppointmentNotesUpdate(BaseModel):
    """Schema for updating only appointment notes (pre-appointment information)."""
    notes: str = Field(..., max_length=5000, description="Pre-appointment notes for the counselor")

class AppointmentStatusUpdate(BaseModel):
    """Schema for updating appointment status."""
    status: AppointmentStatus

class Appointment(AppointmentBase):
    """Full appointment response with all relationships."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    
    # Nested relationships
    psychologist: Psychologist
    appointment_type: AppointmentType

    model_config = ConfigDict(from_attributes=True)

class AppointmentWithUser(Appointment):
    """Appointment response including user information (for admin endpoints)."""
    user: AppointmentUser

    model_config = ConfigDict(from_attributes=True)

class AppointmentListResponse(BaseModel):
    """Paginated list of appointments."""
    total: int
    appointments: List[Appointment]
    page: int = 1
    page_size: int = 50

    model_config = ConfigDict(from_attributes=True)

# --- Statistics Schemas ---
class AppointmentStats(BaseModel):
    """Statistics about user appointments."""
    total_appointments: int
    upcoming_count: int
    completed_count: int
    cancelled_count: int
    moved_count: int
    no_show_count: int

class PsychologistAvailability(BaseModel):
    """Psychologist availability information."""
    psychologist_id: int
    psychologist_name: str
    is_available: bool
    total_appointments: int
    upcoming_appointments: int

    model_config = ConfigDict(from_attributes=True)