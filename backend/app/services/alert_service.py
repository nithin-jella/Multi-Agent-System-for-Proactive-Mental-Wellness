"""Alert service for managing real-time alerts in admin dashboard.

Handles alert creation, retrieval, management, and cleanup.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerts import Alert, AlertType, AlertSeverity

logger = logging.getLogger(__name__)


class AlertService:
    """Service for managing alerts in the admin dashboard."""
    
    def __init__(self, db: AsyncSession) -> None:
        """Initialize alert service.
        
        Args:
            db: Database session
        """
        self.db = db
    
    async def create_alert(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        message: str,
        link: Optional[str] = None,
        alert_metadata: Optional[dict] = None,
        expires_at: Optional[datetime] = None
    ) -> Alert:
        """Create a new alert.
        
        Args:
            alert_type: Type of alert (case_created, sla_breach, etc.)
            severity: Alert severity level
            title: Alert title (short description)
            message: Full alert message
            link: Optional link to related resource
            alert_metadata: Optional additional metadata
            expires_at: Optional expiration timestamp (defaults to 24 hours)
            
        Returns:
            Created Alert object
        """
        if not expires_at:
            expires_at = datetime.utcnow() + timedelta(hours=24)
        
        alert = Alert(
            id=uuid4(),
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            entity_type=None,
            entity_id=None,
            context_data={},
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            is_seen=False
        )

        alert.link = link
        alert.alert_metadata = alert_metadata or {}
        
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)
        
        logger.info(f"Created {severity} alert: {title} (ID: {alert.id})")
        
        return alert
    
    async def list_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        alert_type: Optional[AlertType] = None,
        is_seen: Optional[bool] = None,
        include_expired: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> list[Alert]:
        """List alerts with optional filtering.
        
        Args:
            severity: Filter by severity level
            alert_type: Filter by alert type
            is_seen: Filter by seen status
            include_expired: Include expired alerts
            limit: Maximum number of results
            offset: Pagination offset
            
        Returns:
            List of Alert objects
        """
        stmt = select(Alert).order_by(Alert.created_at.desc())
        
        # Build filters
        filters = []
        
        if severity:
            filters.append(Alert.severity == severity)
        
        if alert_type:
            filters.append(Alert.alert_type == alert_type)
        
        if is_seen is not None:
            filters.append(Alert.is_seen == is_seen)
        
        if not include_expired:
            filters.append(
                or_(
                    Alert.expires_at.is_(None),
                    Alert.expires_at > datetime.utcnow()
                )
            )
        
        if filters:
            stmt = stmt.where(and_(*filters))
        
        stmt = stmt.limit(limit).offset(offset)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
    
    async def get_alert_by_id(self, alert_id: UUID) -> Optional[Alert]:
        """Get a specific alert by ID.
        
        Args:
            alert_id: Alert UUID
            
        Returns:
            Alert object or None if not found
        """
        stmt = select(Alert).where(Alert.id == alert_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def mark_as_seen(self, alert_id: UUID) -> Optional[Alert]:
        """Mark an alert as seen.
        
        Args:
            alert_id: Alert UUID
            
        Returns:
            Updated Alert object or None if not found
        """
        alert = await self.get_alert_by_id(alert_id)
        
        if not alert:
            logger.warning(f"Alert {alert_id} not found")
            return None
        
        if not alert.is_seen:
            alert.is_seen = True
            alert.seen_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(alert)
            logger.info(f"Marked alert {alert_id} as seen")
        
        return alert
    
    async def mark_multiple_as_seen(self, alert_ids: list[UUID]) -> int:
        """Mark multiple alerts as seen.
        
        Args:
            alert_ids: List of alert UUIDs
            
        Returns:
            Number of alerts updated
        """
        count = 0
        for alert_id in alert_ids:
            alert = await self.mark_as_seen(alert_id)
            if alert:
                count += 1
        
        logger.info(f"Marked {count} alerts as seen")
        return count
    
    async def delete_alert(self, alert_id: UUID) -> bool:
        """Delete an alert.
        
        Args:
            alert_id: Alert UUID
            
        Returns:
            True if deleted, False if not found
        """
        alert = await self.get_alert_by_id(alert_id)
        
        if not alert:
            logger.warning(f"Alert {alert_id} not found")
            return False
        
        await self.db.delete(alert)
        await self.db.commit()
        logger.info(f"Deleted alert {alert_id}")
        
        return True
    
    async def cleanup_expired_alerts(self, older_than_hours: int = 24) -> int:
        """Clean up expired alerts.
        
        Args:
            older_than_hours: Delete alerts expired longer than this many hours
            
        Returns:
            Number of alerts deleted
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
        
        stmt = select(Alert).where(
            and_(
                Alert.expires_at.isnot(None),
                Alert.expires_at < cutoff_time
            )
        )
        
        result = await self.db.execute(stmt)
        alerts = result.scalars().all()
        
        count = 0
        for alert in alerts:
            await self.db.delete(alert)
            count += 1
        
        await self.db.commit()
        logger.info(f"Cleaned up {count} expired alerts")
        
        return count
    
    async def get_unread_count(
        self,
        severity: Optional[AlertSeverity] = None
    ) -> int:
        """Get count of unread alerts.
        
        Args:
            severity: Optional filter by severity
            
        Returns:
            Count of unread alerts
        """
        filters = [
            Alert.is_seen == False,
            or_(
                Alert.expires_at.is_(None),
                Alert.expires_at > datetime.utcnow()
            )
        ]
        
        if severity:
            filters.append(Alert.severity == severity)
        
        stmt = select(Alert).where(and_(*filters))
        result = await self.db.execute(stmt)
        alerts = result.scalars().all()
        
        return len(alerts)


def get_alert_service(db: AsyncSession) -> AlertService:
    """Dependency to get alert service instance.
    
    Args:
        db: Database session
        
    Returns:
        AlertService instance
    """
    return AlertService(db)
