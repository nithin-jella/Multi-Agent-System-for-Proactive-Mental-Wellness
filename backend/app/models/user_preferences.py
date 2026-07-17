"""
User Preferences Model

Stores user settings: language, notifications, accessibility, AI personality.
User-controlled preferences (safe to cache, non-sensitive).

Industry Best Practices Applied:
- Sensible defaults for UGM context (preferred_language='id', timezone='Asia/Jakarta')
- Granular notification controls (email_frequency, notification_frequency)
- Accessibility features (dyslexia_font, keyboard_navigation_only)
- AI personality customization (aika_personality, aika_response_length)
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Time, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserPreferences(Base):
    """
    User Preferences - Settings & preferences (user-controlled).
    
    Contains: Language, notifications, accessibility, AI customization.
    Access: User can edit, public read (non-sensitive).
    """
    
    __tablename__ = "user_preferences"
    
    # Primary Key & Foreign Key
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        unique=True, 
        nullable=False,
        index=True,
        comment="FK to users table (one-to-one relationship)"
    )
    
    # =====================================================================
    # LANGUAGE & LOCALIZATION (Indonesia context)
    # =====================================================================
    preferred_language = Column(
        String(10),
        default="id",  # Best Practice: Default to Indonesian for UGM
        comment="ISO 639-1 code: 'id' (Indonesian), 'en' (English), 'jv' (Javanese)"
    )
    preferred_timezone = Column(
        String(50),
        default="Asia/Jakarta",  # Best Practice: Default to Indonesian timezone
        comment="IANA timezone (e.g., 'Asia/Jakarta', 'Asia/Makassar')"
    )
    date_format = Column(
        String(20),
        default="DD/MM/YYYY",  # Indonesian standard
        comment="Date display format"
    )
    time_format = Column(
        String(10),
        default="24h",  # Indonesian preference
        comment="12h or 24h"
    )
    
    # =====================================================================
    # NOTIFICATION PREFERENCES
    # =====================================================================
    allow_email_checkins = Column(Boolean, default=True)
    allow_sms_reminders = Column(Boolean, default=False)
    allow_push_notifications = Column(Boolean, default=True)
    allow_whatsapp_notifications = Column(
        Boolean, 
        default=False,
        comment="WhatsApp is very popular in Indonesia"
    )
    
    notification_quiet_hours_start = Column(Time)
    notification_quiet_hours_end = Column(Time)
    notification_frequency = Column(
        String(20),
        default="normal",
        comment="low | normal | high"
    )
    
    # Email preferences (granular control)
    email_frequency = Column(
        String(20),
        default="weekly",
        comment="daily | weekly | monthly | never"
    )
    email_newsletter = Column(
        Boolean,
        default=True,
        comment="Subscribe to UGM-AICare newsletter"
    )
    email_updates = Column(
        Boolean,
        default=True,
        comment="Receive platform updates & announcements"
    )
    
    # =====================================================================
    # INTERFACE PREFERENCES
    # =====================================================================
    theme = Column(
        String(20),
        default="system",
        comment="light | dark | system"
    )
    font_size = Column(
        String(20),
        default="medium",
        comment="small | medium | large | xlarge"
    )
    high_contrast_mode = Column(
        Boolean,
        default=False,
        comment="High contrast for visual impairment"
    )
    reduce_animations = Column(
        Boolean,
        default=False,
        comment="Reduce motion for vestibular disorders"
    )
    color_scheme = Column(
        String(50),
        comment="Custom color scheme (future feature)"
    )

    # Legacy free-text blobs (kept for backward compatibility with existing UI)
    communication_preferences = Column(
        Text,
        comment="User communication preferences (free text; migrated from users.communication_preferences)"
    )
    interface_preferences = Column(
        Text,
        comment="User interface preferences (free text; migrated from users.interface_preferences)"
    )
    
    # =====================================================================
    # ACCESSIBILITY (Best Practice: Inclusive design)
    # =====================================================================
    screen_reader_enabled = Column(
        Boolean,
        default=False,
        comment="Using screen reader (optimize for ARIA)"
    )
    keyboard_navigation_only = Column(
        Boolean,
        default=False,
        comment="Navigate without mouse (motor impairment)"
    )
    dyslexia_font = Column(
        Boolean,
        default=False,
        comment="Use dyslexia-friendly font (OpenDyslexic)"
    )
    accessibility_notes = Column(
        Text,
        comment="Additional accessibility needs (free text)"
    )
    
    # =====================================================================
    # CHECK-IN PREFERENCES
    # =====================================================================
    check_in_code = Column(
        String(50),
        unique=True,
        index=True,
        comment="Unique code for daily check-ins (e.g., 'MOOD-abc123')"
    )
    check_in_frequency = Column(
        String(20),
        default="daily",
        comment="daily | weekly | manual"
    )
    check_in_reminder_time = Column(
        Time,
        comment="Preferred time for daily check-in reminder (e.g., '09:00')"
    )
    check_in_reminder_enabled = Column(
        Boolean,
        default=True
    )
    
    # =====================================================================
    # PRIVACY PREFERENCES
    # =====================================================================
    profile_visibility = Column(
        String(20),
        default="private",
        comment="public | friends | private"
    )
    show_online_status = Column(
        Boolean,
        default=False,
        comment="Show when user is online (future social feature)"
    )
    allow_analytics_tracking = Column(
        Boolean,
        default=True,
        comment="Consent to anonymized analytics (IA agent)"
    )
    
    # =====================================================================
    # AI CUSTOMIZATION (Best Practice: Personalized AI experience)
    # =====================================================================
    aika_personality = Column(
        String(20),
        default="empathetic",
        comment="empathetic | professional | casual | balanced"
    )
    aika_response_length = Column(
        String(20),
        default="balanced",
        comment="concise | balanced | detailed"
    )
    auto_suggest_interventions = Column(
        Boolean,
        default=True,
        comment="Aika proactively suggests CBT interventions"
    )
    
    # =====================================================================
    # TIMESTAMPS
    # =====================================================================
    created_at = Column(
        Integer,
        server_default=func.extract('epoch', func.now()),
        nullable=False
    )
    updated_at = Column(
        Integer,
        server_default=func.extract('epoch', func.now()),
        onupdate=func.extract('epoch', func.now()),
        nullable=False
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="preferences")
    
    def __repr__(self):
        return f"<UserPreferences(user_id={self.user_id}, lang='{self.preferred_language}', aika='{self.aika_personality}')>"
