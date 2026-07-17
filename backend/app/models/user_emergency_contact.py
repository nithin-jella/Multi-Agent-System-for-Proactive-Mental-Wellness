"""
User Emergency Contact Model

Supports MULTIPLE emergency contacts per user (best practice for flexibility).
Tracks consent and contact preferences.

Industry Best Practices Applied:
- Multiple contacts per user (not just one)
- Priority field (1=primary, 2=secondary, etc.)
- Granular consent (can_receive_crisis_alerts)
- Time-limited consent (consent_expires_date)
- Last contacted tracking (for audit and avoiding over-contact)
"""

from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserEmergencyContact(Base):
    """
    User Emergency Contact - Supports multiple contacts per user.
    
    Contains: Contact info, relationship, consent, priority.
    Access: User can edit own, counselors can view during crisis.
    """
    
    __tablename__ = "user_emergency_contacts"
    
    # Primary Key & Foreign Key
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False,
        index=True,
        comment="FK to users table (one-to-many relationship)"
    )
    
    # =====================================================================
    # CONTACT INFO
    # =====================================================================
    full_name = Column(
        String(200),  # Best Practice: VARCHAR(200) for full names (handles long names)
        nullable=False,
        comment="Full name of emergency contact"
    )
    relationship_to_user = Column(
        String(100),
        nullable=False,
        comment="Relationship to user (e.g., 'Mother', 'Best Friend', 'Academic Advisor')"
    )
    
    phone = Column(
        String(20),
        nullable=False,
        comment="Primary phone number"
    )
    alternate_phone = Column(
        String(20),
        comment="Alternate phone number (optional)"
    )
    email = Column(
        String(255),  # Best Practice: VARCHAR(255) for email (RFC 5321 standard)
        comment="Email address (optional)"
    )
    address = Column(
        Text,  # Best Practice: TEXT for addresses (variable length)
        comment="Full address (for in-person contact if needed)"
    )
    
    # =====================================================================
    # PRIORITY & STATUS (Best Practice: Order contacts by priority)
    # =====================================================================
    priority = Column(
        Integer,
        default=1,
        nullable=False,
        index=True,
        comment="Contact priority: 1=primary, 2=secondary, 3=tertiary, etc."
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether this contact is currently active"
    )
    
    # =====================================================================
    # CRISIS NOTIFICATION PREFERENCES
    # =====================================================================
    can_receive_crisis_alerts = Column(
        Boolean,
        default=True,
        comment="Whether to notify during crisis (some contacts prefer no alerts)"
    )
    contact_time_restrictions = Column(
        Text,
        comment="Time restrictions (e.g., 'Only 9am-5pm weekdays', 'No late night calls')"
    )
    
    # =====================================================================
    # CONSENT TRACKING (Best Practice: Document consent)
    # =====================================================================
    consent_to_contact = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Contact has consented to be emergency contact"
    )
    consent_granted_date = Column(
        Date,
        comment="When consent was granted"
    )
    consent_expires_date = Column(
        Date,
        comment="When consent expires (optional, for time-limited consent)"
    )
    consent_method = Column(
        String(50),
        comment="How consent was obtained: 'verbal', 'written', 'digital_signature'"
    )
    
    # =====================================================================
    # NOTES & TRACKING
    # =====================================================================
    notes = Column(
        Text,
        comment="Additional notes about this contact (e.g., 'Speaks English only', 'Prefers WhatsApp')"
    )
    last_contacted_at = Column(
        DateTime(timezone=True),
        comment="When this contact was last reached (for audit and avoiding over-contact)"
    )
    
    # =====================================================================
    # TIMESTAMPS
    # =====================================================================
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="emergency_contacts")
    
    def __repr__(self):
        return f"<UserEmergencyContact(user_id={self.user_id}, name='{self.full_name}', priority={self.priority})>"
    
    @property
    def is_consent_valid(self) -> bool:
        """
        Check if consent is still valid (not expired).
        """
        if not self.consent_to_contact:
            return False
        
        if self.consent_expires_date:
            from datetime import date
            return date.today() <= self.consent_expires_date
        
        return True
