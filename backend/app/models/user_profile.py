"""
User Profile Model

Stores public user profile data (names, demographics, academic info, gamification).
Separated from core User table for better normalization and performance.

Industry Best Practices Applied:
- Separate first_name/last_name (better than full_name for sorting, i18n, personalization)
- VARCHAR(100) for names (industry standard, allows for long names)
- TEXT for bio (unlimited length, no performance penalty in PostgreSQL)
- ARRAY for interests (native PostgreSQL, better than comma-separated strings)
- student_id as UNIQUE (official NIM for UGM integration)
"""

from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey, Text, ARRAY, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserProfile(Base):
    """
    User Profile - Public data (safe to cache, non-sensitive).
    
    Contains: Names, demographics, academic info, gamification stats.
    Access: Public (any authenticated user can view).
    """
    
    __tablename__ = "user_profiles"
    
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
    # NAMES (Best Practice: Separate fields for flexibility)
    # =====================================================================
    first_name = Column(
        String(100), 
        comment="Given name (e.g., 'John')"
    )
    last_name = Column(
        String(100), 
        comment="Family name (e.g., 'Doe')"
    )
    preferred_name = Column(
        String(100), 
        comment="What they want to be called (e.g., 'Johnny')"
    )
    pronouns = Column(
        String(50), 
        comment="e.g., 'he/him', 'she/her', 'they/them'"
    )
    
    # =====================================================================
    # CONTACT INFO
    # =====================================================================
    phone = Column(String(20))
    alternate_phone = Column(String(20))
    telegram_username = Column(
        String(100),
        comment="Telegram username without '@' (e.g., 'john_doe')",
    )
    
    # =====================================================================
    # DEMOGRAPHICS
    # =====================================================================
    date_of_birth = Column(Date)
    gender = Column(String(50))  # More inclusive than ENUM (non-binary, prefer not to say, etc.)
    
    # Geographic (Indonesia context)
    city = Column(String(100))
    province = Column(
        String(100), 
        comment="Indonesian province (e.g., 'DI Yogyakarta')"
    )
    country = Column(
        String(100), 
        default="Indonesia",
        comment="Country of residence"
    )
    
    # =====================================================================
    # ACADEMIC INFO (UGM-specific)
    # =====================================================================
    university = Column(String(200))
    faculty = Column(
        String(200), 
        comment="UGM faculty (e.g., 'FMIPA', 'FEB', 'FK')"
    )
    department = Column(
        String(200), 
        comment="Department/Program (e.g., 'Computer Science')"
    )
    major = Column(String(200))
    year_of_study = Column(Integer)
    student_id = Column(
        String(50), 
        unique=True, 
        index=True,
        comment="Official NIM (Nomor Induk Mahasiswa) - UNIQUE identifier"
    )
    batch_year = Column(
        Integer,
        comment="Enrollment year (e.g., 2021)"
    )
    
    # =====================================================================
    # SIMASTER INTEGRATION
    # =====================================================================
    simaster_verified = Column(
        Boolean,
        default=False,
        comment="Whether profile was verified via SIMASTER import"
    )
    simaster_verified_at = Column(
        DateTime,
        comment="Timestamp when SIMASTER verification occurred"
    )
    
    # =====================================================================
    # PROFILE MEDIA
    # =====================================================================
    profile_photo_url = Column(String(500))
    profile_photo_storage_key = Column(
        String(200),
        comment="S3/MinIO storage key for profile photo"
    )
    
    # =====================================================================
    # GAMIFICATION & ENGAGEMENT
    # =====================================================================
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(Date)
    sentiment_score = Column(Float, default=0.0)  # Average mood over time
    total_care_tokens = Column(
        Integer, 
        default=0,
        comment="Total CARE tokens earned (token economy integration)"
    )
    
    # =====================================================================
    # SOCIAL FEATURES
    # =====================================================================
    bio = Column(
        Text,  # Best Practice: TEXT for long content (no length limit, same performance as VARCHAR)
        comment="User bio / about me (unlimited length)"
    )
    interests = Column(
        ARRAY(String),  # Best Practice: PostgreSQL native ARRAY (better than comma-separated)
        comment="List of interests (e.g., ['music', 'sports', 'reading'])"
    )
    
    # =====================================================================
    # TIMESTAMPS
    # =====================================================================
    created_at = Column(
        Date,
        server_default=func.current_date(),
        nullable=False
    )
    updated_at = Column(
        Date,
        server_default=func.current_date(),
        onupdate=func.current_date(),
        nullable=False
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="profile")
    
    def __repr__(self):
        return f"<UserProfile(user_id={self.user_id}, name='{self.first_name} {self.last_name}')>"
    
    @property
    def full_name(self) -> str:
        """
        Computed property: Full name display.
        Best Practice: Don't store full_name, compute it from parts.
        """
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p)
    
    @property
    def display_name(self) -> str:
        """
        Display name: Preferred name if set, otherwise first name.
        """
        return self.preferred_name or self.first_name or "User"
