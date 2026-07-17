"""Alert management API endpoints for admin dashboard."""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models.alerts import AlertType, AlertSeverity
from app.models.user import User
from app.services.alert_service import get_alert_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["Admin - Alerts"])


def _coerce_enum(value: Any) -> str:
    if hasattr(value, "value"):
        return value.value
    return str(value)


# Schemas
class AlertSchema(BaseModel):
    """Alert response schema."""
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    link: Optional[str] = None
    alert_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str
    expires_at: Optional[str] = None
    is_seen: bool
    seen_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AlertListResponse(BaseModel):
    """Paginated alerts list response."""
    alerts: list[AlertSchema]
    total: int
    unread_count: int
    limit: int
    offset: int


class MarkSeenRequest(BaseModel):
    """Request to mark alerts as seen."""
    alert_ids: list[str] = Field(..., description="List of alert IDs to mark as seen")


class CleanupResponse(BaseModel):
    """Cleanup operation response."""
    deleted_count: int
    message: str


# Endpoints
@router.get("", response_model=AlertListResponse)
async def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low, info)"),
    alert_type: Optional[str] = Query(None, description="Filter by alert type"),
    is_seen: Optional[bool] = Query(None, description="Filter by seen status"),
    include_expired: bool = Query(False, description="Include expired alerts"),
    limit: int = Query(50, ge=1, le=100, description="Maximum results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> AlertListResponse:
    """List alerts with filtering and pagination.
    
    **Admin only** - Requires admin role.
    
    Returns recent alerts for the admin dashboard. Supports filtering by:
    - Severity level
    - Alert type
    - Seen/unseen status
    - Include/exclude expired alerts
    """
    try:
        alert_service = get_alert_service(db)
        
        # Parse enums if provided
        severity_enum = None
        if severity:
            try:
                severity_enum = AlertSeverity(severity)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid severity: {severity}. Must be one of: critical, high, medium, low, info"
                )
        
        type_enum = None
        if alert_type:
            try:
                type_enum = AlertType(alert_type)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid alert type: {alert_type}"
                )
        
        # Get alerts
        alerts = await alert_service.list_alerts(
            severity=severity_enum,
            alert_type=type_enum,
            is_seen=is_seen,
            include_expired=include_expired,
            limit=limit,
            offset=offset
        )
        
        # Get unread count
        unread_count = await alert_service.get_unread_count()
        
        # Convert to schema
        alert_schemas = [
            AlertSchema(
                id=str(a.id),
                alert_type=_coerce_enum(a.alert_type),
                severity=_coerce_enum(a.severity),
                title=a.title,
                message=a.message,
                link=a.link,
                alert_metadata=a.alert_metadata or {},
                created_at=a.created_at.isoformat(),
                expires_at=a.expires_at.isoformat() if a.expires_at else None,
                is_seen=a.is_seen,
                seen_at=a.seen_at.isoformat() if a.seen_at else None
            )
            for a in alerts
        ]
        
        return AlertListResponse(
            alerts=alert_schemas,
            total=len(alert_schemas),  # TODO: Add count query for accurate total
            unread_count=unread_count,
            limit=limit,
            offset=offset
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alerts"
        )


@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> AlertSchema:
    """Get a specific alert by ID.
    
    **Admin only** - Requires admin role.
    """
    try:
        alert_service = get_alert_service(db)
        alert = await alert_service.get_alert_by_id(alert_id)
        
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found"
            )
        
        return AlertSchema(
            id=str(alert.id),
            alert_type=_coerce_enum(alert.alert_type),
            severity=_coerce_enum(alert.severity),
            title=alert.title,
            message=alert.message,
            link=alert.link,
            alert_metadata=alert.alert_metadata or {},
            created_at=alert.created_at.isoformat(),
            expires_at=alert.expires_at.isoformat() if alert.expires_at else None,
            is_seen=alert.is_seen,
            seen_at=alert.seen_at.isoformat() if alert.seen_at else None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get alert {alert_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alert"
        )


@router.put("/{alert_id}/seen", response_model=AlertSchema)
async def mark_alert_seen(
    alert_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> AlertSchema:
    """Mark an alert as seen.
    
    **Admin only** - Requires admin role.
    """
    try:
        alert_service = get_alert_service(db)
        alert = await alert_service.mark_as_seen(alert_id)
        
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found"
            )
        
        return AlertSchema(
            id=str(alert.id),
            alert_type=_coerce_enum(alert.alert_type),
            severity=_coerce_enum(alert.severity),
            title=alert.title,
            message=alert.message,
            link=alert.link,
            alert_metadata=alert.alert_metadata or {},
            created_at=alert.created_at.isoformat(),
            expires_at=alert.expires_at.isoformat() if alert.expires_at else None,
            is_seen=alert.is_seen,
            seen_at=alert.seen_at.isoformat() if alert.seen_at else None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to mark alert {alert_id} as seen: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update alert"
        )


@router.post("/mark-seen", status_code=status.HTTP_200_OK)
async def mark_multiple_seen(
    request: MarkSeenRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Mark multiple alerts as seen.
    
    **Admin only** - Requires admin role.
    """
    try:
        alert_service = get_alert_service(db)
        
        # Convert string IDs to UUIDs
        alert_ids = [UUID(aid) for aid in request.alert_ids]
        
        count = await alert_service.mark_multiple_as_seen(alert_ids)
        
        return {
            "message": f"Marked {count} alerts as seen",
            "updated_count": count
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid alert ID format: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to mark multiple alerts as seen: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update alerts"
        )


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
):
    """Delete an alert.
    
    **Admin only** - Requires admin role.
    """
    try:
        alert_service = get_alert_service(db)
        deleted = await alert_service.delete_alert(alert_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Alert {alert_id} not found"
            )
        
        # No return needed for 204 No Content - FastAPI will handle it

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete alert {alert_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete alert"
        )


@router.post("/cleanup", response_model=CleanupResponse)
async def cleanup_expired_alerts(
    older_than_hours: int = Query(24, ge=1, le=168, description="Delete alerts expired longer than this many hours"),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> CleanupResponse:
    """Manually trigger cleanup of expired alerts.
    
    **Admin only** - Requires admin role.
    
    Deletes alerts that have been expired for longer than the specified duration.
    Default: 24 hours.
    """
    try:
        alert_service = get_alert_service(db)
        deleted_count = await alert_service.cleanup_expired_alerts(older_than_hours)
        
        return CleanupResponse(
            deleted_count=deleted_count,
            message=f"Deleted {deleted_count} expired alerts (older than {older_than_hours} hours)"
        )
    
    except Exception as e:
        logger.error(f"Failed to cleanup expired alerts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup alerts"
        )


@router.get("/stats/unread", response_model=dict)
async def get_unread_stats(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Get unread alert statistics.
    
    **Admin only** - Requires admin role.
    
    Returns counts of unread alerts by severity.
    """
    try:
        alert_service = get_alert_service(db)
        
        total_unread = await alert_service.get_unread_count()
        critical_unread = await alert_service.get_unread_count(AlertSeverity.CRITICAL)
        high_unread = await alert_service.get_unread_count(AlertSeverity.HIGH)
        
        return {
            "total_unread": total_unread,
            "critical_unread": critical_unread,
            "high_unread": high_unread,
            "requires_attention": critical_unread + high_unread
        }
    
    except Exception as e:
        logger.error(f"Failed to get unread stats: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alert statistics"
        )
