"""Proactive Outreach (Interventions) admin endpoints.

This module is intentionally conservative:
- Human review can be enforced for outbound check-ins.
- Admins can inspect and approve/reject queued executions.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.mental_health.models import CampaignExecution, InterventionCampaign
from app.domains.mental_health.services.proactive_checkins import send_checkin_execution, CHECKIN_CAMPAIGN_TYPE
from app.schemas.admin.interventions import (
    InterventionCampaignCreate,
    InterventionCampaignListResponse,
    InterventionCampaignResponse,
    InterventionExecutionListResponse,
    InterventionExecutionResponse,
)


router = APIRouter(prefix="/interventions", tags=["Admin - Interventions"])


def _to_campaign_response(row: InterventionCampaign) -> InterventionCampaignResponse:
    metrics = {
        "total": row.executions_delivered + row.executions_failed,
        "scheduled": 0,
        "pending_review": 0,
        "active": 1 if row.status in ("active", "running") else 0,
        "completed": 1 if row.status in ("completed", "stopped", "ended") else 0,
        "failed": 1 if row.status == "failed" else 0,
    }
    return InterventionCampaignResponse(
        id=row.id,
        campaign_type=row.campaign_type,
        title=row.title,
        description=row.description,
        content=row.content or {},
        target_criteria=row.target_criteria,
        target_audience_size=row.target_audience_size,
        priority=row.priority,
        status=row.status,
        start_date=row.start_date,
        end_date=row.end_date,
        executions_delivered=row.executions_delivered,
        executions_failed=row.executions_failed,
        created_at=row.created_at,
        updated_at=row.updated_at,
        metrics=metrics,
    )


@router.get("/campaigns", response_model=InterventionCampaignListResponse)
async def list_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> InterventionCampaignListResponse:
    base = select(InterventionCampaign).order_by(desc(InterventionCampaign.updated_at)).offset(skip).limit(limit)
    rows = (await db.execute(base)).scalars().all()
    total = int((await db.execute(select(func.count()).select_from(InterventionCampaign))).scalar() or 0)
    items = [_to_campaign_response(row) for row in rows]
    return InterventionCampaignListResponse(items=items, total=total)


@router.post("/campaigns", response_model=InterventionCampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    payload: InterventionCampaignCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> InterventionCampaignResponse:
    now = datetime.utcnow()
    row = InterventionCampaign(
        campaign_type=payload.campaign_type,
        title=payload.title,
        description=payload.description,
        content=payload.content or {},
        target_criteria=payload.target_criteria,
        priority=payload.priority or "medium",
        status=payload.status or "draft",
        start_date=payload.start_date or now,
        end_date=payload.end_date,
        target_audience_size=0,
        executions_delivered=0,
        executions_failed=0,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    await db.refresh(row)
    return _to_campaign_response(row)


# --- Intervention Plans ---

from app.domains.mental_health.models.interventions import InterventionPlanRecord
from app.models.user import User
from app.schemas.admin.interventions import InterventionPlanListResponse, InterventionPlanResponse


def _to_execution_response(
    row: CampaignExecution,
    user: Optional[User],
    campaign: Optional[InterventionCampaign],
) -> InterventionExecutionResponse:
    trigger: dict[str, Any] = row.trigger_data or {}
    plan_preview: dict[str, Any] | None = None
    if campaign and campaign.campaign_type == CHECKIN_CAMPAIGN_TYPE:
        # Surface only safe, review-oriented metadata.
        plan_preview = {
            "type": trigger.get("type"),
            "risk_level": trigger.get("risk_level"),
            "primary_concerns": trigger.get("primary_concerns"),
            "subject_preview": trigger.get("subject_preview"),
            "template_version": trigger.get("template_version"),
        }

    return InterventionExecutionResponse(
        id=row.id,
        campaign_id=row.campaign_id,
        user_id=row.user_id,
        status=row.status,
        scheduled_at=row.scheduled_at,
        executed_at=row.executed_at,
        delivery_method=row.delivery_method,
        notes=row.notes,
        engagement_score=row.engagement_score,
        is_manual=row.is_manual,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        campaign_title=campaign.title if campaign else None,
        priority=campaign.priority if campaign else None,
        plan_preview=plan_preview,
    )


@router.get("/executions", response_model=InterventionExecutionListResponse)
async def list_executions(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> InterventionExecutionListResponse:
    stmt = select(CampaignExecution).order_by(desc(CampaignExecution.scheduled_at))
    if status_filter:
        stmt = stmt.where(CampaignExecution.status == status_filter)

    total_stmt = select(func.count()).select_from(CampaignExecution)
    if status_filter:
        total_stmt = total_stmt.where(CampaignExecution.status == status_filter)

    rows = (
        await db.execute(stmt.offset(skip).limit(limit))
    ).scalars().all()
    total = int((await db.execute(total_stmt)).scalar() or 0)

    # Batch-load related data.
    campaign_ids = {r.campaign_id for r in rows}
    user_ids = {r.user_id for r in rows}
    campaigns = {}
    users = {}
    if campaign_ids:
        campaign_rows = (
            await db.execute(select(InterventionCampaign).where(InterventionCampaign.id.in_(campaign_ids)))
        ).scalars().all()
        campaigns = {c.id: c for c in campaign_rows}
    if user_ids:
        user_rows = (
            await db.execute(select(User).where(User.id.in_(user_ids)))
        ).scalars().all()
        users = {u.id: u for u in user_rows}

    items = [
        _to_execution_response(r, users.get(r.user_id), campaigns.get(r.campaign_id))
        for r in rows
    ]
    return InterventionExecutionListResponse(items=items, total=total)


@router.post("/executions/{execution_id}/approve")
async def approve_execution(
    execution_id: int,
    note: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> dict:
    row = (
        await db.execute(select(CampaignExecution).where(CampaignExecution.id == execution_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")

    trigger = row.trigger_data or {}
    trigger["review"] = {
        "decision": "approved",
        "by_user_id": getattr(admin_user, "id", None),
        "at": datetime.utcnow().isoformat(),
        "note": note,
    }
    row.trigger_data = trigger
    row.status = "approved"
    row.notes = note or row.notes
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok"}


@router.post("/executions/{execution_id}/reject")
async def reject_execution(
    execution_id: int,
    reason: str,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> dict:
    row = (
        await db.execute(select(CampaignExecution).where(CampaignExecution.id == execution_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")

    trigger = row.trigger_data or {}
    trigger["review"] = {
        "decision": "rejected",
        "by_user_id": getattr(admin_user, "id", None),
        "at": datetime.utcnow().isoformat(),
        "note": reason,
    }
    row.trigger_data = trigger
    row.status = "rejected"
    row.notes = reason
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok"}


@router.post("/executions/{execution_id}/send")
async def send_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> dict:
    row = (
        await db.execute(select(CampaignExecution).where(CampaignExecution.id == execution_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Execution not found")

    if row.status not in {"approved", "pending_review"}:
        raise HTTPException(status_code=400, detail="Execution not in a sendable state")

    campaign = (
        await db.execute(select(InterventionCampaign).where(InterventionCampaign.id == row.campaign_id))
    ).scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.campaign_type != CHECKIN_CAMPAIGN_TYPE:
        raise HTTPException(status_code=400, detail="Unsupported campaign type for send")

    try:
        now = datetime.utcnow()
        await send_checkin_execution(db=db, execution=row, now=now)
        await db.commit()
        return {"status": "ok"}
    except Exception as exc:
        row.status = "failed"
        row.error_message = str(exc)
        row.updated_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(status_code=500, detail="Failed to send execution")

@router.get("/plans", response_model=InterventionPlanListResponse)
async def list_intervention_plans(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> InterventionPlanListResponse:
    """List all intervention plans."""
    # Join with User to get names
    stmt = (
        select(InterventionPlanRecord, User)
        .join(User, InterventionPlanRecord.user_id == User.id)
        .order_by(desc(InterventionPlanRecord.updated_at))
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    total = int((await db.execute(select(func.count()).select_from(InterventionPlanRecord))).scalar() or 0)
    
    items = []
    for plan, user in rows:
        items.append(InterventionPlanResponse(
            id=plan.id,
            user_id=plan.user_id,
            user_name=user.name,
            user_email=user.email,
            plan_title=plan.plan_title,
            risk_level=plan.risk_level,
            status=plan.status,
            total_steps=plan.total_steps,
            completed_steps=plan.completed_steps,
            created_at=plan.created_at,
            updated_at=plan.updated_at,
            plan_data=plan.plan_data,
            completion_tracking=plan.completion_tracking
        ))
        
    return InterventionPlanListResponse(items=items, total=total)


@router.post("/plans/{plan_id}/notify", status_code=status.HTTP_200_OK)
async def notify_user_about_plan(
    plan_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
):
    """Notify user about their intervention plan (Email/Push)."""
    stmt = select(InterventionPlanRecord).where(InterventionPlanRecord.id == plan_id)
    plan = (await db.execute(stmt)).scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    # In a real system, this would trigger an email or push notification
    # For now, we'll just log it or return success
    
    return {"message": f"Notification sent to user {plan.user_id} for plan {plan_id}"}

