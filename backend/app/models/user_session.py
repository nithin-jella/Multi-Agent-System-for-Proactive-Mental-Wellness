"""
User Session Model

Tracks active user sessions for security and analytics.
**NEW TABLE** - Not in original design (best practice addition).

Industry Best Practices Applied:
- Session tracking for security (detect suspicious logins)
- Multi-device support ("You're logged in on 3 devices")
- Geographic tracking (location_city, location_country)
- Session expiry (expires_at)
- Last activity tracking (for timeout detection)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserSession(Base):
    """
    User Session - Tracks active user sessions (security & analytics).
    
    Contains: Session token, device info, location, activity.
    Access: User can view own sessions, admin can view all.
    
    Use Cases:
    - Security: Detect suspicious login locations
    - Multi-device: "You're logged in on 3 devices"
    - Force logout: Revoke all sessions
    - Analytics: Track device usage patterns
    """
    
    __tablename__ = "user_sessions"
    
    # Primary Key (Session Token)
    id = Column(
        String(255),  # Session token (e.g., JWT, UUID, secure random string)
        primary_key=True,
        comment="Session token (used in Authorization header)"
    )
    
    # Foreign Key
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True,
        comment="FK to users table (one-to-many relationship)"
    )
    
    # =====================================================================
    # DEVICE INFO
    # =====================================================================
    device_type = Column(
        String(50),
        comment="Device type: 'mobile', 'tablet', 'desktop', 'unknown'"
    )
    device_name = Column(
        String(200),
        comment="Device name/browser (e.g., 'Chrome 120.0', 'Safari iOS', 'Android App')"
    )
    
    # =====================================================================
    # NETWORK & LOCATION (Best Practice: Detect suspicious logins)
    # =====================================================================
    ip_address = Column(
        String(45),  # IPv6 max length: 45 characters
        index=True,
        comment="IP address of session"
    )
    user_agent = Column(
        String(500),  # User agents can be long
        comment="Browser/app user agent string"
    )
    
    location_city = Column(
        String(100),
        comment="Geographic location (city) - from IP geolocation"
    )
    location_country = Column(
        String(100),
        comment="Geographic location (country)"
    )
    
    # =====================================================================
    # SESSION STATUS
    # =====================================================================
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether session is currently active"
    )
    last_activity_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Last activity timestamp (updated on each request)"
    )
    
    # =====================================================================
    # TIMESTAMPS
    # =====================================================================
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="When session was created (login time)"
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When session expires (for automatic cleanup)"
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<UserSession(user_id={self.user_id}, device='{self.device_type}', active={self.is_active})>"
    
    @property
    def is_expired(self) -> bool:
        """
        Check if session has expired.
        """
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) >= self.expires_at
    
    @property
    def time_remaining(self) -> int:
        """
        Time remaining until session expires (in seconds).
        """
        from datetime import datetime, timezone
        if self.is_expired:
            return 0
        return int((self.expires_at - datetime.now(timezone.utc)).total_seconds())
