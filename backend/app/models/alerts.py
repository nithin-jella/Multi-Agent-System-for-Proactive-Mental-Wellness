"""Alert models for real-time notifications."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertType(str, enum.Enum):
    """Types of alerts that can be created."""
    CASE_CREATED = "case_created"
    CASE_UPDATED = "case_updated"
    SLA_BREACH = "sla_breach"
    IA_REPORT_GENERATED = "ia_report_generated"
    CAMPAIGN_EXECUTED = "campaign_executed"
    SYSTEM_NOTIFICATION = "system_notification"


class AlertSeverity(str, enum.Enum):
    """Severity levels for alerts."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Alert(Base):
    """System alerts for admin dashboard real-time notifications.
    
    Stores alerts for critical events like case creation, SLA breaches,
    and system events that require admin attention.
    """
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Alert type and severity
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # Types: 'case_created', 'case_updated', 'sla_breach', 'ia_report_generated', 'system_error'
    
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    # Severities: 'critical', 'high', 'medium', 'low', 'info'
    
    # Alert content
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Related entity (optional)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Types: 'case', 'report', 'campaign', 'user'
    
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    
    # Additional context data
    context_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Store additional context like case severity, user_hash, etc.
    
    # Status tracking
    is_seen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    seen_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # FK to users.id
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        nullable=False, 
        default=datetime.utcnow,
        index=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Auto-expire alerts after a certain time (e.g., 7 days)

    def _ensure_context_data(self) -> dict:
        if not isinstance(self.context_data, dict):
            self.context_data = {}
        return self.context_data

    @property
    def link(self) -> Optional[str]:
        if isinstance(self.context_data, dict):
            value = self.context_data.get("link")
            return str(value) if value is not None else None
        return None

    @link.setter
    def link(self, value: Optional[str]) -> None:
        data = self._ensure_context_data()
        if value is None:
            data.pop("link", None)
        else:
            data["link"] = value

    @property
    def alert_metadata(self) -> dict:
        if not isinstance(self.context_data, dict):
            return {}
        data = dict(self.context_data)
        data.pop("link", None)
        return data

    @alert_metadata.setter
    def alert_metadata(self, value: Optional[dict]) -> None:
        data = self._ensure_context_data()
        existing_link = data.get("link")
        data.clear()
        if isinstance(value, dict):
            data.update(value)
        if existing_link is not None and "link" not in data:
            data["link"] = existing_link
    
    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, type={self.alert_type}, severity={self.severity}, seen={self.is_seen})>"
    
    def to_dict(self) -> dict:
        """Convert alert to dictionary for JSON serialization."""
        return {
            'id': str(self.id),
            'alert_type': self.alert_type,
            'severity': self.severity,
            'title': self.title,
            'message': self.message,
            'link': self.link,
            'alert_metadata': self.alert_metadata,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'context_data': self.context_data,
            'is_seen': self.is_seen,
            'seen_at': self.seen_at.isoformat() if self.seen_at else None,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }
