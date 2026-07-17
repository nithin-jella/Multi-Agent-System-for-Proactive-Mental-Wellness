"""API routes for intervention plan records."""

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)
from app.domains.mental_health.schemas.intervention_plans import (
    InterventionPlanRecordCreate,
    InterventionPlanRecordResponse,
    InterventionPlanListResponse,
    StepCompletionRequest,
    StepCompletionResponse
)
from app.domains.mental_health.services.intervention_plan_service import InterventionPlanService

router = APIRouter(prefix="/api/v1/intervention-plans", tags=["intervention-plans"])


@router.get("", response_model=InterventionPlanListResponse)
async def get_user_intervention_plans(
    active_only: bool = True,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get all intervention plans for the current user.
    
    - **active_only**: Filter to show only active plans (default: True)
    - **limit**: Maximum number of plans to return (default: 50)
    - **offset**: Number of plans to skip for pagination (default: 0)
    """
    plans = await InterventionPlanService.get_user_plans(
        db=db,
        user_id=current_user.id,
        active_only=active_only,
        limit=limit,
        offset=offset
    )
    
    total = await InterventionPlanService.get_active_plan_count(db, current_user.id)
    
    # DEBUG: Log what we're returning (avoid emoji for Windows console compatibility)
    logger.info("Intervention Plans API - User: %s, Active Only: %s", current_user.id, active_only)
    logger.info("Returning %s plans (total count: %s)", len(plans), total)
    if plans:
        for plan in plans:
            logger.info(
                "  - Plan ID %s: user_id=%s, is_active=%s, status=%s",
                plan.id,
                plan.user_id,
                plan.is_active,
                plan.status,
            )
    else:
        logger.warning("No plans found for user %s (active_only=%s)", current_user.id, active_only)
    
    return InterventionPlanListResponse(
        plans=plans,
        total=total
    )


@router.get("/{plan_id}", response_model=InterventionPlanRecordResponse)
async def get_intervention_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Get a specific intervention plan by ID.
    
    Automatically marks the plan as viewed.
    """
    plan = await InterventionPlanService.get_plan_by_id(
        db=db,
        plan_id=plan_id,
        user_id=current_user.id
    )
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intervention plan not found"
        )
    
    # Mark as viewed
    await InterventionPlanService.mark_plan_viewed(
        db=db,
        plan_id=plan_id,
        user_id=current_user.id
    )
    
    return plan


@router.post("/{plan_id}/complete-step", response_model=StepCompletionResponse)
async def complete_plan_step(
    plan_id: int,
    request: StepCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Mark a specific step in an intervention plan as complete or incomplete.
    
    - **step_index**: Zero-based index of the step
    - **completed**: Whether the step is completed (true) or not (false)
    - **notes**: Optional notes about the step completion
    """
    updated_plan = await InterventionPlanService.mark_step_complete(
        db=db,
        plan_id=plan_id,
        step_index=request.step_index,
        completed=request.completed,
        user_id=current_user.id,
        notes=request.notes
    )
    
    if not updated_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intervention plan not found"
        )
    
    return StepCompletionResponse(
        plan_id=plan_id,
        step_index=request.step_index,
        completed=request.completed,
        completed_at=updated_plan.updated_at if request.completed else None,
        updated_plan=updated_plan
    )


@router.post("/{plan_id}/archive", response_model=InterventionPlanRecordResponse)
async def archive_intervention_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Archive an intervention plan.
    
    Archived plans are hidden from the active plans list but remain accessible.
    """
    archived_plan = await InterventionPlanService.archive_plan(
        db=db,
        plan_id=plan_id,
        user_id=current_user.id
    )
    
    if not archived_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intervention plan not found"
        )
    
    return archived_plan


@router.post("", response_model=InterventionPlanRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_intervention_plan(
    plan_create: InterventionPlanRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db)
):
    """
    Create a new intervention plan record.
    
    This endpoint is typically called by the agent integration service
    when TCA generates a new intervention plan.
    """
    # Ensure the plan is being created for the current user
    if plan_create.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create intervention plan for another user"
        )
    
    new_plan = await InterventionPlanService.create_plan(db=db, plan_data=plan_create)
    
    return new_plan
