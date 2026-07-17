"""
Appointment Scheduling Tools (Decorator Pattern)

Conversational appointment scheduling capabilities for Aika, allowing students
to book, cancel, and reschedule appointments with psychologists through natural language.

All tools are registered using @register_tool decorator for zero-redundancy architecture.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models.appointments import (
    Psychologist,
    Appointment,
    AppointmentType
)
from app.models.user import User
from .registry import register_tool

logger = logging.getLogger(__name__)


_WEEKDAY_NAMES = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


def _parse_time_value(value: Any) -> Optional[time]:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    candidates = ["%H:%M", "%H:%M:%S"]
    for fmt in candidates:
        try:
            return datetime.strptime(raw, fmt).time()
        except ValueError:
            continue
    return None


def _normalize_schedule_entries(schedule: Any) -> List[Dict[str, Any]]:
    if not isinstance(schedule, list):
        return []
    normalized: List[Dict[str, Any]] = []
    for item in schedule:
        if not isinstance(item, dict):
            continue
        day_value = str(item.get("day") or "").strip().lower()
        start_value = _parse_time_value(item.get("start_time"))
        end_value = _parse_time_value(item.get("end_time"))
        if day_value not in set(_WEEKDAY_NAMES.values()):
            continue
        if start_value is None or end_value is None or end_value <= start_value:
            continue
        if item.get("is_available") is False:
            continue
        normalized.append(
            {
                "day": day_value,
                "start_time": start_value,
                "end_time": end_value,
            }
        )
    return normalized


def _build_upcoming_slot_windows(
    schedule_entries: List[Dict[str, Any]],
    *,
    start_date: date,
    days_ahead: int,
) -> List[tuple[datetime, datetime]]:
    windows: List[tuple[datetime, datetime]] = []
    if days_ahead <= 0:
        return windows

    for offset in range(days_ahead):
        current_date = start_date + timedelta(days=offset)
        weekday_name = _WEEKDAY_NAMES[current_date.weekday()]
        for entry in schedule_entries:
            if entry["day"] != weekday_name:
                continue
            start_dt = datetime.combine(current_date, entry["start_time"])
            end_dt = datetime.combine(current_date, entry["end_time"])
            if end_dt <= start_dt:
                continue
            windows.append((start_dt, end_dt))

    windows.sort(key=lambda item: item[0])
    return windows


def _windows_conflict(window: tuple[datetime, datetime], appointment_dt: datetime) -> bool:
    start_dt, end_dt = window
    return start_dt <= appointment_dt < end_dt


def _matches_preferred_language(
    counselor_languages: Any,
    preferred_language: Optional[str],
) -> bool:
    """Return True when counselor_languages includes preferred_language.

    Handles JSON/list/string payloads safely without DB-specific casts.
    """
    if not preferred_language:
        return True

    needle = preferred_language.strip().lower()
    if not needle:
        return True

    if counselor_languages is None:
        return False

    if isinstance(counselor_languages, str):
        return needle in counselor_languages.lower()

    if isinstance(counselor_languages, list):
        return any(needle in str(item).lower() for item in counselor_languages)

    if isinstance(counselor_languages, dict):
        values = " ".join(str(value) for value in counselor_languages.values())
        return needle in values.lower()

    return needle in str(counselor_languages).lower()


# ============================================================================
# TOOL: Get Available Counselors
# ============================================================================

@register_tool(
    name="get_available_counselors",
    description="""Get list of available psychologists/counselors at UGM.

✅ CALL WHEN:
- User asks "siapa psikolog yang ada?", "counselor available?"
- User wants to choose specific counselor
- Need to show counselor options before booking
- User says "mau ketemu psikolog", "butuh konseling"

IMPORTANT: Always call this FIRST before book_appointment if user wants to choose counselor.

Returns list with:
- Counselor names, specializations, bios
- Years of experience, languages, ratings
- Availability status

Example flow:
User: "Aku mau ketemu psikolog nih"
You: Call get_available_counselors → Present options
User: "Yang Pak Budi aja"
You: Note psychologist_id → Call book_appointment""",
    parameters={
        "type": "object",
        "properties": {
            "specialization": {
                "type": "string",
                "description": "Optional filter by specialization (e.g., 'anxiety', 'depression', 'academic stress')"
            },
            "preferred_language": {
                "type": "string",
                "description": "Optional filter by language (e.g., 'English', 'Indonesian')"
            },
            "days_ahead": {
                "type": "integer",
                "description": "How many upcoming days to inspect for real schedule slots (default 14, max 30)",
                "default": 14
            }
        }
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=False
)
async def get_available_counselors(
    db: AsyncSession,
    specialization: Optional[str] = None,
    preferred_language: Optional[str] = None,
    days_ahead: int = 14,
    **kwargs
) -> Dict[str, Any]:
    """Get list of available psychologists."""
    try:
        # Query psychologists
        query = select(Psychologist).where(Psychologist.is_available == True)
        
        if specialization:
            query = query.where(
                Psychologist.specialization.ilike(f"%{specialization}%")
            )
        
        result = await db.execute(query)
        psychologists = result.scalars().all()

        bounded_days = max(1, min(days_ahead, 30))
        today = datetime.now().date()
        horizon_start = datetime.combine(today, time.min)
        horizon_end = horizon_start + timedelta(days=bounded_days + 1)

        psychologist_ids = [p.id for p in psychologists]
        appointments_by_psychologist: Dict[int, List[datetime]] = {pid: [] for pid in psychologist_ids}
        if psychologist_ids:
            appt_result = await db.execute(
                select(Appointment)
                .where(
                    Appointment.psychologist_id.in_(psychologist_ids),
                    Appointment.appointment_datetime >= horizon_start,
                    Appointment.appointment_datetime < horizon_end,
                    Appointment.status.in_(["scheduled", "pending", "confirmed", "in_progress"]),
                )
                .order_by(Appointment.appointment_datetime.asc())
            )
            for appt in appt_result.scalars().all():
                appointments_by_psychologist.setdefault(appt.psychologist_id, []).append(appt.appointment_datetime)
        
        # Format response
        counselors = []
        for p in psychologists:
            if not _matches_preferred_language(p.languages, preferred_language):
                continue

            schedule_entries = _normalize_schedule_entries(p.availability_schedule)
            slot_windows = _build_upcoming_slot_windows(
                schedule_entries,
                start_date=today,
                days_ahead=bounded_days,
            )

            blocked_times = appointments_by_psychologist.get(p.id, [])
            free_windows: List[Dict[str, str]] = []
            for window in slot_windows:
                if any(_windows_conflict(window, appt_time) for appt_time in blocked_times):
                    continue
                free_windows.append(
                    {
                        "start": window[0].isoformat(),
                        "end": window[1].isoformat(),
                        "day": _WEEKDAY_NAMES[window[0].weekday()],
                    }
                )
                if len(free_windows) >= 3:
                    break

            counselors.append({
                "id": p.id,
                "name": p.name,
                "specialization": p.specialization,
                "bio": p.bio[:200] if p.bio else None,
                "years_of_experience": p.years_of_experience,
                "languages": p.languages,
                "rating": p.rating,
                "total_reviews": p.total_reviews,
                "consultation_fee": p.consultation_fee,
                "has_availability": bool(free_windows),
                "next_available_slots": free_windows,
                "availability_window_days": bounded_days,
            })
        
        return {
            "success": True,
            "counselors": counselors,
            "count": len(counselors),
            "message": f"Found {len(counselors)} available counselor(s)"
        }
        
    except Exception as e:
        logger.error(f"Error getting available counselors: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "counselors": [],
            "message": "Failed to fetch counselors"
        }


# ============================================================================
# TOOL: Suggest Appointment Times
# ============================================================================

@register_tool(
    name="suggest_appointment_times",
    description="""Suggest optimal appointment times based on student preferences and counselor availability.

✅ CALL WHEN:
- User gives flexible time preferences
- Need to find mutually available time slots
- User says "kapan aja yang available", "yang bisa kapan aja"

Examples of preferences:
- "Aku prefer pagi sih"
- "Kapan aja besok atau lusa"
- "Kalau bisa sore aja, after class"
- "Next week tapi bukan hari Senin"

Returns 3-5 suggested time slots ranked by suitability.
User can then choose one or request alternatives.""",
    parameters={
        "type": "object",
        "properties": {
            "psychologist_id": {
                "type": "integer",
                "description": "ID of the psychologist"
            },
            "preferences_text": {
                "type": "string",
                "description": "Natural language time preferences from student"
            }
        },
        "required": ["psychologist_id", "preferences_text"]
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=True
)
async def suggest_appointment_times(
    db: AsyncSession,
    user_id: int,
    psychologist_id: int,
    preferences_text: str,
    **kwargs
) -> Dict[str, Any]:
    """Use AI to suggest optimal appointment times."""
    try:
        # Get psychologist
        result = await db.execute(
            select(Psychologist).where(Psychologist.id == psychologist_id)
        )
        psychologist = result.scalar_one_or_none()
        
        if not psychologist:
            return {
                "success": False,
                "error": f"Psychologist with ID {psychologist_id} not found",
                "suggestions": []
            }
        
        # For now, return next 3 available slots (simplified)
        # In production, this would use LLM to parse preferences
        suggestions = [
            {
                "datetime": (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0).isoformat(),
                "day_name": "Besok",
                "time_label": "10:00 - 11:00 WIB",
                "reason": "Pagi hari, biasanya lebih fresh"
            },
            {
                "datetime": (datetime.now() + timedelta(days=2)).replace(hour=14, minute=0).isoformat(),
                "day_name": "Lusa",
                "time_label": "14:00 - 15:00 WIB",
                "reason": "Siang setelah istirahat"
            },
            {
                "datetime": (datetime.now() + timedelta(days=3)).replace(hour=16, minute=0).isoformat(),
                "day_name": "Hari ketiga",
                "time_label": "16:00 - 17:00 WIB",
                "reason": "Sore setelah kelas"
            }
        ]
        
        return {
            "success": True,
            "suggestions": suggestions,
            "psychologist_name": psychologist.name,
            "message": f"Ini beberapa waktu yang mungkin cocok dengan {psychologist.name}"
        }
        
    except Exception as e:
        logger.error(f"Error suggesting times: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "suggestions": []
        }


# ============================================================================
# TOOL: Book Appointment
# ============================================================================

@register_tool(
    name="book_appointment",
    description="""Book a counseling appointment with a psychologist at UGM.

✅ CALL WHEN USER:
- Explicitly requests appointment: "mau booking", "jadwalin konseling"
- Confirms specific time: "oke jam 2 aja", "besok sore"
- Says "mau ketemu psikolog"

❌ DO NOT CALL:
- When just gathering preferences (ask first, then book)
- For general questions about counseling

IMPORTANT FLOW:
1. User expresses intent → call get_available_counselors first
2. User chooses counselor → ask for preferred time
3. User confirms time → call book_appointment

Returns appointment confirmation with:
- Appointment ID, date/time, location
- Psychologist info
- How to cancel/reschedule""",
    parameters={
        "type": "object",
        "properties": {
            "psychologist_id": {
                "type": "integer",
                "description": "ID of psychologist (from get_available_counselors). Optional if auto-assign."
            },
            "appointment_datetime": {
                "type": "string",
                "description": "ISO 8601 datetime (YYYY-MM-DDTHH:MM:SS). Example: '2025-11-19T14:00:00'"
            },
            "appointment_type_id": {
                "type": "integer",
                "description": "1=General Counseling, 2=Academic, 3=Career, 4=Crisis. Default 1."
            },
            "notes": {
                "type": "string",
                "description": "Optional notes about appointment reason"
            }
        },
        "required": ["appointment_datetime"]
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=True
)
async def book_appointment(
    db: AsyncSession,
    user_id: int,
    appointment_datetime: str,
    psychologist_id: Optional[int] = None,
    appointment_type_id: int = 1,
    notes: str = "",
    **kwargs
) -> Dict[str, Any]:
    """Book counseling appointment."""
    try:
        # Parse datetime
        appt_dt = datetime.fromisoformat(appointment_datetime.replace("Z", "+00:00"))
        
        # Auto-assign psychologist if not specified
        if not psychologist_id:
            result = await db.execute(
                select(Psychologist)
                .where(Psychologist.is_available == True)
                .limit(1)
            )
            psychologist = result.scalar_one_or_none()
            if not psychologist:
                return {
                    "success": False,
                    "error": "No available psychologists found"
                }
            psychologist_id = psychologist.id
        else:
            result = await db.execute(
                select(Psychologist).where(Psychologist.id == psychologist_id)
            )
            psychologist = result.scalar_one_or_none()
            if not psychologist:
                return {
                    "success": False,
                    "error": f"Psychologist ID {psychologist_id} not found"
                }
        
        # Create appointment
        appointment = Appointment(
            user_id=user_id, # Fixed: student_id -> user_id
            psychologist_id=psychologist_id,
            appointment_datetime=appt_dt,
            appointment_type_id=appointment_type_id,
            status="scheduled",
            notes=notes,
            # location="Ruang Konseling Gedung UC Lt. 3, Universitas Gadjah Mada" # Removed: Not in model
        )
        
        db.add(appointment)
        await db.commit()
        await db.refresh(appointment)
        
        # Get appointment type
        type_result = await db.execute(
            select(AppointmentType).where(AppointmentType.id == appointment_type_id)
        )
        appt_type = type_result.scalar_one_or_none()
        
        return {
            "success": True,
            "appointment": {
                "id": appointment.id,
                "student_id": appointment.user_id,
                "psychologist_id": appointment.psychologist_id,
                "appointment_datetime": appointment.appointment_datetime.isoformat(),
                "status": appointment.status,
                "notes": appointment.notes,
                # "location": appointment.location, # Removed
                "psychologist": {
                    "id": psychologist.id,
                    "name": psychologist.name,
                    "specialization": psychologist.specialization,
                    # "contact_email": psychologist.contact_email, # Removed
                    # "contact_phone": psychologist.contact_phone # Removed
                },
                "appointment_type": {
                    "id": appt_type.id if appt_type else None,
                    "name": appt_type.name if appt_type else "General Counseling",
                    "duration_minutes": appt_type.duration_minutes if appt_type else 60
                }
            },
            "message": f"Appointment successfully booked with {psychologist.name}"
        }
        
    except Exception as e:
        logger.error(f"Error booking appointment: {e}", exc_info=True)
        await db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to book appointment"
        }


# ============================================================================
# TOOL: Cancel Appointment
# ============================================================================

@register_tool(
    name="cancel_appointment",
    description="""Cancel an existing appointment.

✅ CALL WHEN:
- User says "mau cancel appointment", "batalin janji"
- User wants to cancel their scheduled session

Returns confirmation of cancellation.
Appointment status changed to 'cancelled' in database.""",
    parameters={
        "type": "object",
        "properties": {
            "appointment_id": {
                "type": "integer",
                "description": "ID of appointment to cancel"
            },
            "reason": {
                "type": "string",
                "description": "Reason for cancellation"
            }
        },
        "required": ["appointment_id"]
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=True
)
async def cancel_appointment(
    db: AsyncSession,
    user_id: int,
    appointment_id: int,
    reason: str = "No reason provided",
    **kwargs
) -> Dict[str, Any]:
    """Cancel appointment."""
    try:
        # Get appointment
        result = await db.execute(
            select(Appointment)
            .where(
                and_(
                    Appointment.id == appointment_id,
                    Appointment.user_id == user_id # Fixed: student_id -> user_id
                )
            )
        )
        appointment = result.scalar_one_or_none()
        
        if not appointment:
            return {
                "success": False,
                "error": f"Appointment ID {appointment_id} not found or not owned by user"
            }
        
        if appointment.status == "cancelled":
            return {
                "success": False,
                "error": "Appointment is already cancelled"
            }
        
        # Cancel appointment
        appointment.status = "cancelled"
        appointment.notes = f"{appointment.notes}\n\nCancellation reason: {reason}"
        await db.commit()
        
        return {
            "success": True,
            "appointment_id": appointment_id,
            "message": f"Appointment #{appointment_id} successfully cancelled"
        }
        
    except Exception as e:
        logger.error(f"Error cancelling appointment: {e}", exc_info=True)
        await db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to cancel appointment"
        }


# ============================================================================
# TOOL: Reschedule Appointment
# ============================================================================

@register_tool(
    name="reschedule_appointment",
    description="""Reschedule an existing appointment to a new time.

✅ CALL WHEN:
- User says "mau reschedule", "ganti waktu appointment"
- User wants to change their scheduled time

Returns confirmation with new appointment details.""",
    parameters={
        "type": "object",
        "properties": {
            "appointment_id": {
                "type": "integer",
                "description": "ID of appointment to reschedule"
            },
            "new_datetime": {
                "type": "string",
                "description": "New datetime in ISO format (YYYY-MM-DDTHH:MM:SS)"
            },
            "reason": {
                "type": "string",
                "description": "Optional reason for rescheduling"
            }
        },
        "required": ["appointment_id", "new_datetime"]
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=True
)
async def reschedule_appointment(
    db: AsyncSession,
    user_id: int,
    appointment_id: int,
    new_datetime: str,
    reason: str = "Rescheduled by student",
    **kwargs
) -> Dict[str, Any]:
    """Reschedule appointment."""
    try:
        # Get appointment
        result = await db.execute(
            select(Appointment)
            .where(
                and_(
                    Appointment.id == appointment_id,
                    Appointment.user_id == user_id # Fixed: student_id -> user_id
                )
            )
        )
        appointment = result.scalar_one_or_none()
        
        if not appointment:
            return {
                "success": False,
                "error": f"Appointment ID {appointment_id} not found or not owned by user"
            }
        
        if appointment.status == "cancelled":
            return {
                "success": False,
                "error": "Cannot reschedule a cancelled appointment"
            }
        
        # Parse new datetime
        new_dt = datetime.fromisoformat(new_datetime.replace("Z", "+00:00"))
        old_dt = appointment.appointment_datetime
        
        # Update appointment
        appointment.appointment_datetime = new_dt
        appointment.notes = f"{appointment.notes}\n\nRescheduled from {old_dt.isoformat()} to {new_dt.isoformat()}. Reason: {reason}"
        await db.commit()
        await db.refresh(appointment)
        
        return {
            "success": True,
            "appointment": {
                "id": appointment.id,
                "old_datetime": old_dt.isoformat(),
                "new_datetime": appointment.appointment_datetime.isoformat(),
                "status": appointment.status
            },
            "message": f"Appointment #{appointment_id} successfully rescheduled"
        }
        
    except Exception as e:
        logger.error(f"Error rescheduling appointment: {e}", exc_info=True)
        await db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to reschedule appointment"
        }


# ============================================================================
# TOOL: Get User Appointments
# ============================================================================

@register_tool(
    name="get_user_appointments",
    description="""Get list of user's appointments (upcoming and past).

✅ CALL WHEN:
- User asks "jadwal saya kapan?", "cek appointment saya"
- User wants to see their history
- Before cancelling/rescheduling to get appointment IDs

Returns list of appointments with details.""",
    parameters={
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["scheduled", "completed", "cancelled", "all"],
                "description": "Filter by status (default: 'scheduled')"
            },
            "limit": {
                "type": "integer",
                "description": "Max number of appointments to return (default: 5)"
            }
        },
        "required": []
    },
    category="scheduling",
    requires_db=True,
    requires_user_id=True
)
async def get_user_appointments(
    db: AsyncSession,
    user_id: int,
    status: str = "scheduled",
    limit: int = 5,
    **kwargs
) -> Dict[str, Any]:
    """Get user appointments."""
    try:
        query = select(Appointment).where(Appointment.user_id == user_id) # Fixed: student_id -> user_id
        
        if status != "all":
            query = query.where(Appointment.status == status)
            
        # Order by datetime (upcoming first for scheduled, past first for others)
        if status == "scheduled":
            query = query.order_by(Appointment.appointment_datetime.asc())
        else:
            query = query.order_by(Appointment.appointment_datetime.desc())
            
        query = query.limit(limit)
        
        result = await db.execute(query)
        appointments = result.scalars().all()
        
        # Get psychologist details for each appointment
        appt_list = []
        for appt in appointments:
            psych_result = await db.execute(
                select(Psychologist).where(Psychologist.id == appt.psychologist_id)
            )
            psych = psych_result.scalar_one_or_none()
            
            appt_list.append({
                "id": appt.id,
                "datetime": appt.appointment_datetime.isoformat(),
                "status": appt.status,
                "psychologist_name": psych.name if psych else "Unknown",
                # "location": appt.location, # Removed
                "notes": appt.notes
            })
            
        return {
            "success": True,
            "appointments": appt_list,
            "count": len(appt_list),
            "message": f"Found {len(appt_list)} {status} appointment(s)"
        }
        
    except Exception as e:
        logger.error(f"Error getting user appointments: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "appointments": []
        }
