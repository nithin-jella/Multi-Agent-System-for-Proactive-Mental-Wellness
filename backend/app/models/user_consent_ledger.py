"""
User Consent Ledger Model

**APPEND-ONLY** - Never delete records (GDPR/HIPAA compliance).

Tracks all consent changes over time (granted/withdrawn).
Enables "right to audit" and "right to be forgotten" compliance.

Industry Best Practices Applied:
- Append-only (never delete, always insert new row)
- Version tracking (consent_version)
- Technical context (IP, user agent, device type)
- Expiry tracking (expires_at)
- Language tracking (consent_language)
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserConsentLedger(Base):
    """
    User Consent Ledger - **APPEND-ONLY** audit trail for consent.
    
    Contains: Consent type, granted/withdrawn, timestamp, technical context.
    Access: Admin/compliance only.
    
    NEVER DELETE RECORDS - Append-only for GDPR/HIPAA compliance.
    """
    
    __tablename__ = "user_consent_ledger"
    
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
    # CONSENT DETAILS
    # =====================================================================
    consent_type = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Type: 'data_sharing', 'research', 'marketing', 'emergency_contact', 'analytics', 'ai_coaching'"
    )
    granted = Column(
        Boolean,
        nullable=False,
        index=True,
        comment="True=consent granted, False=consent withdrawn"
    )
    
    scope = Column(
        Text,
        comment="Scope of consent (e.g., 'Share anonymized mood data with research team')"
    )
    
    # =====================================================================
    # VERSIONING (Best Practice: Track consent document versions)
    # =====================================================================
    consent_version = Column(
        String(50),
        nullable=False,
        comment="Version of consent document (e.g., 'v1.0', 'v2.1')"
    )
    consent_document_url = Column(
        String(500),
        comment="URL to the consent document user agreed to"
    )
    consent_language = Column(
        String(10),
        comment="Language consent was shown in (e.g., 'id', 'en')"
    )
    
    # =====================================================================
    # TECHNICAL CONTEXT (Best Practice: Capture how consent was given)
    # =====================================================================
    ip_address = Column(
        String(45),  # IPv6 max length: 45 characters
        comment="IP address where consent was given"
    )
    user_agent = Column(
        Text,
        comment="Browser/app user agent string"
    )
    device_type = Column(
        String(50),
        comment="Device type: 'mobile', 'tablet', 'desktop'"
    )
    consent_method = Column(
        String(50),
        comment="Method: 'checkbox', 'digital_signature', 'verbal_recorded', 'opt_in', 'opt_out'"
    )
    
    # =====================================================================
    # TIMESTAMP & EXPIRY
    # =====================================================================
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="When consent was granted/withdrawn"
    )
    expires_at = Column(
        DateTime(timezone=True),
        comment="When consent expires (optional, for time-limited consent)"
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="consent_ledger")
    
    def __repr__(self):
        status = "GRANTED" if self.granted else "WITHDRAWN"
        return f"<UserConsentLedger(user_id={self.user_id}, type='{self.consent_type}', status={status})>"
    
    @property
    def is_active(self) -> bool:
        """
        Check if consent is currently active (granted and not expired).
        """
        if not self.granted:
            return False
        
        if self.expires_at:
            from datetime import datetime, timezone
            return datetime.now(timezone.utc) <= self.expires_at
        
        return True
