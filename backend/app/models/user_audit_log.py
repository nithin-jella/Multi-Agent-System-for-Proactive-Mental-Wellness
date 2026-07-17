"""
User Audit Log Model

**APPEND-ONLY** - Tracks all changes to user-related tables.

Enables compliance, debugging, and accountability.
Used by CMA agent for case management.

Industry Best Practices Applied:
- JSONB for changed_fields (flexible, queryable)
- Distributed tracing IDs (request_id, session_id)
- Actor tracking (who made the change)
- Change reason (why the change was made)
"""

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserAuditLog(Base):
    """
    User Audit Log - **APPEND-ONLY** change tracking for all user data.
    
    Contains: Action, table, changed fields, actor, timestamp.
    Access: Admin/compliance only.
    
    NEVER DELETE RECORDS - Append-only for compliance and debugging.
    """
    
    __tablename__ = "user_audit_log"
    
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
    # ACTION DETAILS
    # =====================================================================
    action = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Action: 'created', 'updated', 'deleted', 'viewed', 'exported', 'migrated'"
    )
    table_name = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Table that was changed (e.g., 'user_profiles', 'user_clinical_records')"
    )
    record_id = Column(
        Integer,
        comment="ID of the specific record that was changed"
    )
    
    # =====================================================================
    # CHANGED FIELDS (Best Practice: JSONB for flexible structure)
    # =====================================================================
    changed_fields = Column(
        JSONB,  # Best Practice: JSONB (not JSON) for better performance
        comment="Changed fields with old/new values: {'field': {'old': 'value1', 'new': 'value2'}}"
    )
    change_reason = Column(
        Text,
        comment="Why the change was made (e.g., 'Risk escalation detected by STA', 'User profile update')"
    )
    
    # =====================================================================
    # ACTOR (Who made the change)
    # =====================================================================
    changed_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        index=True,
        comment="User who made the change (NULL for system/agent changes)"
    )
    changed_by_role = Column(
        String(50),
        comment="Role of actor: 'user', 'counselor', 'admin', 'system', 'agent'"
    )
    changed_by_name = Column(
        String(200),
        comment="Name of actor (for human readability)"
    )
    
    # =====================================================================
    # TECHNICAL CONTEXT (Best Practice: Distributed tracing)
    # =====================================================================
    ip_address = Column(
        String(45),
        comment="IP address of request"
    )
    user_agent = Column(
        Text,
        comment="Browser/app user agent string"
    )
    request_id = Column(
        String(100),
        index=True,
        comment="Distributed tracing request ID (for tracking across microservices)"
    )
    session_id = Column(
        String(100),
        index=True,
        comment="Session ID (for tracking user session)"
    )
    
    # =====================================================================
    # TIMESTAMP
    # =====================================================================
    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="When the change occurred"
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="audit_log", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<UserAuditLog(user_id={self.user_id}, action='{self.action}', table='{self.table_name}')>"
