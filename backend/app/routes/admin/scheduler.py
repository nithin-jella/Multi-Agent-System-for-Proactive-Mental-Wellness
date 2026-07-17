"""Admin API endpoints for APScheduler job management."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/scheduler", tags=["Admin - Scheduler"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SchedulerJobResponse(BaseModel):
    id: str
    name: str
    description: str
    enabled: bool
    cron_expression: str
    next_run_time: Optional[datetime]
    func_name: str


class RescheduleJobRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23)
    minute: int = Field(..., ge=0, le=59)
    day_of_week: Optional[str] = Field(
        None,
        description="APScheduler day_of_week expression, e.g. 'mon-fri', 'sun', '0,6'",
    )


class ToggleJobRequest(BaseModel):
    enabled: bool


class TriggerCheckinRequest(BaseModel):
    user_id: int
    reason: str = "manual_admin"


# ---------------------------------------------------------------------------
# Job metadata (descriptions shown in the UI)
# ---------------------------------------------------------------------------

_JOB_DESCRIPTIONS: dict[str, str] = {
    "proactive_checkin_job": "Morning student check-in — Aika sends email + in-app message to inactive/at-risk students (10:00 AM).",
    "proactive_checkin_job_evening": "Evening student check-in — same logic as morning run, targeting high-risk students (7:00 PM).",
    "trend_detection_job": "Screening trend detection — scans all profiles for deteriorating mental health indicators every 6 hours.",
    "weekly_ia_report_job": "Weekly IA report — generates anonymised population-level insights report every Sunday at 2:00 AM.",
    "retention_cohort_job": "Retention cohort materialisation — computes cohort retention metrics daily at 1:30 AM.",
    "counselor_reminder_job": "Counselor reminder — sends in-app alert + email to counselors with stale assigned cases (9:00 AM).",
}


def _build_cron_string(job: Any) -> str:
    """Derive a human-readable cron expression from an APScheduler CronTrigger."""
    try:
        trigger = job.trigger
        fields = {f.name: str(f) for f in trigger.fields}
        parts = [
            fields.get("day_of_week", "*"),
            fields.get("hour", "*"),
            fields.get("minute", "*"),
        ]
        return f"{parts[2]} {parts[1]} * * {parts[0]}"
    except Exception:
        return "unknown"


def _job_to_response(job: Any) -> SchedulerJobResponse:
    return SchedulerJobResponse(
        id=job.id,
        name=job.id.replace("_", " ").title(),
        description=_JOB_DESCRIPTIONS.get(job.id, "No description available."),
        enabled=job.next_run_time is not None,
        cron_expression=_build_cron_string(job),
        next_run_time=job.next_run_time,
        func_name=getattr(job.func, "__name__", str(job.func)),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/jobs", response_model=list[SchedulerJobResponse])
async def list_scheduler_jobs(
    admin_user: User = Depends(get_admin_user),
) -> list[SchedulerJobResponse]:
    """List all registered APScheduler jobs with their current state."""
    from app.core.scheduler import scheduler

    jobs = scheduler.get_jobs()
    return [_job_to_response(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=SchedulerJobResponse)
async def get_scheduler_job(
    job_id: str,
    admin_user: User = Depends(get_admin_user),
) -> SchedulerJobResponse:
    """Get details for a specific scheduler job."""
    from app.core.scheduler import scheduler

    job = scheduler.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduler job '{job_id}' not found.",
        )
    return _job_to_response(job)


@router.patch("/jobs/{job_id}", response_model=SchedulerJobResponse)
async def toggle_or_reschedule_job(
    job_id: str,
    payload: ToggleJobRequest | RescheduleJobRequest,
    admin_user: User = Depends(get_admin_user),
) -> SchedulerJobResponse:
    """Enable/disable a job, or reschedule it with a new cron expression.

    - Send ``{"enabled": true/false}`` to pause or resume the job.
    - Send ``{"hour": H, "minute": M}`` (and optional ``day_of_week``) to
      reschedule the job and automatically resume it if it was paused.
    """
    from app.core.scheduler import scheduler

    job = scheduler.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduler job '{job_id}' not found.",
        )

    if isinstance(payload, ToggleJobRequest):
        if payload.enabled:
            scheduler.resume_job(job_id)
        else:
            scheduler.pause_job(job_id)
    else:
        # Reschedule
        reschedule_kwargs: dict[str, Any] = {
            "trigger": "cron",
            "hour": payload.hour,
            "minute": payload.minute,
        }
        if payload.day_of_week is not None:
            reschedule_kwargs["day_of_week"] = payload.day_of_week

        scheduler.reschedule_job(job_id, **reschedule_kwargs)
        # Resume if it was paused
        if scheduler.get_job(job_id).next_run_time is None:
            scheduler.resume_job(job_id)

    updated_job = scheduler.get_job(job_id)
    return _job_to_response(updated_job)


@router.post("/jobs/{job_id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_job_now(
    job_id: str,
    admin_user: User = Depends(get_admin_user),
) -> dict[str, str]:
    """Trigger a job to run immediately (fire-and-forget, non-blocking)."""
    import asyncio

    from app.core.scheduler import (
        CHECKIN_JOB_ID,
        COUNSELOR_REMINDER_JOB_ID,
        RETENTION_COHORT_JOB_ID,
        TREND_DETECTION_JOB_ID,
        WEEKLY_IA_REPORT_JOB_ID,
        compute_retention_cohort_metrics,
        detect_screening_trends,
        generate_weekly_ia_report,
        scheduler,
        send_counselor_reminders,
        send_proactive_checkins,
    )

    JOB_FUNCTION_MAP = {
        CHECKIN_JOB_ID: send_proactive_checkins,
        f"{CHECKIN_JOB_ID}_evening": send_proactive_checkins,
        TREND_DETECTION_JOB_ID: detect_screening_trends,
        WEEKLY_IA_REPORT_JOB_ID: generate_weekly_ia_report,
        RETENTION_COHORT_JOB_ID: compute_retention_cohort_metrics,
        COUNSELOR_REMINDER_JOB_ID: send_counselor_reminders,
    }

    if scheduler.get_job(job_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheduler job '{job_id}' not found.",
        )

    func = JOB_FUNCTION_MAP.get(job_id)
    if func is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Job '{job_id}' cannot be triggered manually.",
        )

    asyncio.create_task(func())
    return {"detail": f"Job '{job_id}' triggered. Running in background."}


@router.post("/checkins/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_user_checkin(
    payload: TriggerCheckinRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict[str, Any]:
    """Manually trigger an immediate check-in for a specific student."""
    from app.core.scheduler import trigger_immediate_checkin

    success = await trigger_immediate_checkin(
        user_id=payload.user_id,
        reason=payload.reason,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to trigger check-in for user {payload.user_id}. "
            "User may not exist or may have no email.",
        )

    return {
        "detail": f"Check-in triggered successfully for user {payload.user_id}.",
        "user_id": payload.user_id,
        "reason": payload.reason,
    }
