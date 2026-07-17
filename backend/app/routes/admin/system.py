"""System settings endpoints for the admin panel."""
from __future__ import annotations

import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db, async_engine
from app.dependencies import get_admin_user
from app.schemas.admin.system import (
    SystemSettingItem,
    SystemSettingsCategory,
    SystemSettingsResponse,
)
from app.utils.code_cleanup import CodeCleanupService
from app.services.database_monitoring import get_monitoring_service
from app.services.api_performance import get_performance_service

router = APIRouter(prefix="/system", tags=["Admin - System Settings"])


def _mask_secret(value: str | None) -> str:
    if not value:
        return "(not set)"
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}***{value[-4:]}"


@router.get("/settings", response_model=SystemSettingsResponse)
async def get_system_settings(
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> SystemSettingsResponse:
    """Return curated system configuration for the admin UI."""

    app_env = os.getenv("APP_ENV", "development")
    database_url = os.getenv("DATABASE_URL", "(not configured)")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    smtp_host = os.getenv("SMTP_HOST")

    appearance = SystemSettingsCategory(
        id="appearance",
        title="Appearance",
        description="Visual preferences applied across the admin workspace.",
        settings=[
            SystemSettingItem(
                key="theme_mode",
                label="Theme",
                value="Dark",
                type="option",
                editable=False,
                pending=True,
                help_text="Allows admins to switch between light and dark UI themes.",
            ),
            SystemSettingItem(
                key="accent_colour",
                label="Accent colour",
                value="#FFCA40",
                type="color",
                editable=False,
                pending=True,
                help_text="Used for primary call-to-action buttons and status badges.",
            ),
            SystemSettingItem(
                key="density",
                label="Navigation density",
                value="Comfortable",
                type="option",
                editable=False,
                pending=True,
            ),
        ],
    )

    collaboration = SystemSettingsCategory(
        id="collaboration",
        title="Team collaboration",
        description="Controls for human-in-the-loop workflows and shared context.",
        settings=[
            SystemSettingItem(
                key="review_mode",
                label="Require dual approval for interventions",
                value=True,
                type="toggle",
                editable=False,
                pending=True,
                help_text="When enabled, two admins must approve a manual intervention before sending.",
            ),
            SystemSettingItem(
                key="notes_visibility",
                label="Share reviewer notes",
                value="Counsellors",
                type="option",
                editable=False,
                pending=True,
                help_text="Determines which roles can view human reviewer notes in the queue.",
            ),
            SystemSettingItem(
                key="escalation_playbook",
                label="Escalation playbook",
                value="settings not yet implemented",
                type="alert",
                editable=False,
                pending=True,
            ),
        ],
    )

    notifications = SystemSettingsCategory(
        id="notifications",
        title="Notifications",
        description="Delivery channels for admin alerts and weekly summaries.",
        settings=[
            SystemSettingItem(
                key="weekly_digest",
                label="Weekly wellbeing digest",
                value=True,
                type="toggle",
                editable=False,
                pending=True,
            ),
            SystemSettingItem(
                key="queue_alerts",
                label="Queue alerts",
                value="Email",
                type="option",
                editable=False,
                pending=True,
                help_text="Preferred channel for urgent manual review notifications.",
            ),
            SystemSettingItem(
                key="incident_webhook",
                label="Incident webhook",
                value="settings not yet implemented",
                type="alert",
                editable=False,
                pending=True,
            ),
        ],
    )

    infrastructure = SystemSettingsCategory(
        id="infrastructure",
        title="Infrastructure",
        description="Environment metadata and critical integration keys.",
        settings=[
            SystemSettingItem(
                key="environment",
                label="Environment",
                value=app_env,
                type="badge",
                editable=False,
            ),
            SystemSettingItem(
                key="database_url",
                label="Database URL",
                value=_mask_secret(database_url),
                type="masked",
                editable=False,
            ),
            SystemSettingItem(
                key="openai_api_key",
                label="OpenAI API key",
                value=_mask_secret(openai_api_key),
                type="masked",
                editable=False,
            ),
            SystemSettingItem(
                key="smtp_host",
                label="SMTP host",
                value=smtp_host or "(not configured)",
                type="text",
                editable=False,
            ),
        ],
    )

    categories: List[SystemSettingsCategory] = [
        appearance,
        collaboration,
        notifications,
        infrastructure,
    ]

    return SystemSettingsResponse(
        generated_at=datetime.utcnow(),
        categories=categories,
    )


@router.put("/settings/{category}")
async def update_settings_category(
    category: str,
    settings: dict,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Update settings for a specific category."""
    from app.services.system_settings import settings_service
    
    if category == "appearance":
        errors = await settings_service.validate_settings("theme", settings)
        if errors:
            return {"success": False, "errors": errors}
        
        success = await settings_service.update_theme_preferences(db, settings)
        return {"success": success, "message": "Theme preferences updated"}
    
    elif category == "collaboration":
        errors = await settings_service.validate_settings("collaboration", settings)
        if errors:
            return {"success": False, "errors": errors}
        
        success = await settings_service.update_collaboration_settings(db, settings)
        return {"success": success, "message": "Collaboration settings updated"}
    
    elif category == "notifications":
        errors = await settings_service.validate_settings("notifications", settings)
        if errors:
            return {"success": False, "errors": errors}
        
        success = await settings_service.update_notification_settings(db, settings)
        return {"success": success, "message": "Notification settings updated"}
    
    else:
        return {"success": False, "message": "Invalid settings category"}


@router.get("/settings/export")
async def export_all_settings(
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Export all system settings for backup."""
    from app.services.system_settings import settings_service
    
    settings_data = await settings_service.export_settings(db)
    return settings_data


@router.post("/settings/import")
async def import_settings(
    settings_data: dict,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Import system settings from backup."""
    from app.services.system_settings import settings_service
    
    results = await settings_service.import_settings(db, settings_data)
    return results


# Code Cleanup Endpoints
@router.get("/cleanup/scan")
async def scan_codebase(
    admin_user=Depends(get_admin_user),
):
    """Scan codebase for cleanup opportunities."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    cleanup_service = CodeCleanupService(project_root)
    try:
        report = await cleanup_service.generate_cleanup_report()
        return {"success": True, "report": report}
    except Exception as e:
        # Do not expose internal errors to the client; log and return generic message
        import logging
        logging.getLogger(__name__).exception("Codebase scan failed")
        return {"success": False, "message": "Codebase scan failed"}


@router.post("/cleanup/execute")
async def execute_cleanup(
    categories: Optional[List[str]] = None,
    dry_run: bool = True,
    admin_user=Depends(get_admin_user),
):
    """Execute automated code cleanup."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
    cleanup_service = CodeCleanupService(project_root)
    
    if categories is None:
        categories = ['console_debug', 'temp_code', 'empty_blocks']
    
    try:
        results = await cleanup_service.auto_cleanup(categories, dry_run)
        return {
            "dry_run": dry_run,
            "categories": categories,
            "results": results,
            "message": "Cleanup executed successfully" if not dry_run else "Dry run completed - no files modified"
        }
    except ValueError as ve:
        return {"success": False, "message": str(ve)}
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Code cleanup failed")
        return {"success": False, "message": "Code cleanup failed"}


# Database Monitoring Endpoints
@router.get("/database/health")
async def get_database_health(
    admin_user=Depends(get_admin_user),
):
    """Get comprehensive database health status."""
    monitoring_service = get_monitoring_service(async_engine)
    health_status = await monitoring_service.check_health()
    return health_status


@router.get("/database/pool-stats")
async def get_pool_statistics(
    admin_user=Depends(get_admin_user),
):
    """Get current connection pool statistics."""
    monitoring_service = get_monitoring_service(async_engine)
    pool_stats = await monitoring_service.get_pool_stats()
    
    return {
        "pool_size": pool_stats.pool_size,
        "checked_out": pool_stats.checked_out_connections,
        "checked_in": pool_stats.checked_in_connections,
        "overflow": pool_stats.overflow_connections,
        "invalid": pool_stats.invalid_connections,
        "utilization": f"{pool_stats.utilization_percentage:.1f}%",
        "timestamp": pool_stats.timestamp.isoformat()
    }


@router.get("/database/performance")
async def get_database_performance(
    admin_user=Depends(get_admin_user),
):
    """Get database performance metrics."""
    monitoring_service = get_monitoring_service(async_engine)
    performance = await monitoring_service.get_database_performance()
    
    return {
        "active_connections": performance.active_connections,
        "idle_connections": performance.idle_connections,
        "waiting_connections": performance.waiting_connections,
        "slow_queries": performance.slow_queries_count,
        "average_query_time": f"{performance.average_query_time:.2f}s",
        "lock_waits": performance.lock_waits,
        "deadlocks": performance.deadlocks,
        "timestamp": performance.timestamp.isoformat()
    }


@router.get("/database/history")
async def get_database_history(
    hours: int = 24,
    admin_user=Depends(get_admin_user),
):
    """Get database connection and performance history."""
    monitoring_service = get_monitoring_service(async_engine)
    history = await monitoring_service.get_connection_history(hours)
    return history


@router.get("/database/optimize")
async def get_optimization_suggestions(
    admin_user=Depends(get_admin_user),
):
    """Get database pool optimization suggestions."""
    monitoring_service = get_monitoring_service(async_engine)
    suggestions = await monitoring_service.optimize_pool_settings()
    return suggestions


# API Performance Monitoring Endpoints
@router.get("/api/performance")
async def get_api_performance_summary(
    admin_user=Depends(get_admin_user),
):
    """Get overall API performance summary."""
    performance_service = get_performance_service()
    summary = performance_service.get_performance_summary()
    return summary


@router.get("/api/performance/alerts")
async def get_performance_alerts(
    admin_user=Depends(get_admin_user),
):
    """Get active performance alerts."""
    performance_service = get_performance_service()
    alerts = performance_service.get_active_alerts()
    return {"alerts": alerts}


@router.get("/api/performance/trends")
async def get_performance_trends(
    hours: int = 24,
    admin_user=Depends(get_admin_user),
):
    """Get API performance trends over time."""
    performance_service = get_performance_service()
    trends = performance_service.get_performance_trends(hours)
    return trends


@router.get("/api/performance/endpoint/{endpoint:path}")
async def get_endpoint_performance(
    endpoint: str,
    method: Optional[str] = None,
    admin_user=Depends(get_admin_user),
):
    """Get detailed performance metrics for a specific endpoint."""
    performance_service = get_performance_service()
    details = performance_service.get_endpoint_details(endpoint, method)
    return details
