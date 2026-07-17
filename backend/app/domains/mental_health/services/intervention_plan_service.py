"""Service layer for intervention plan records."""

from datetime import datetime
from typing import Sequence, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func

from app.domains.mental_health.models import InterventionPlanRecord, InterventionPlanStepCompletion
from app.domains.mental_health.schemas.intervention_plans import (
    InterventionPlanRecordCreate,
    InterventionPlanRecordUpdate,
    CompletionTracking,
    InterventionPlanData
)


class InterventionPlanService:
    """Service for managing intervention plan records."""

    @staticmethod
    async def create_plan(db: AsyncSession, plan_data: InterventionPlanRecordCreate) -> InterventionPlanRecord:
        """Create a new intervention plan record."""
        
        # Initialize completion tracking
        completion_tracking = CompletionTracking(
            completed_steps=[],
            completion_percentage=0.0,
            last_updated=datetime.now()
        )
        
        db_plan = InterventionPlanRecord(
            user_id=plan_data.user_id,
            session_id=plan_data.session_id,
            conversation_id=plan_data.conversation_id,
            plan_title=plan_data.plan_title,
            risk_level=plan_data.risk_level,
            plan_data=plan_data.plan_data.model_dump(mode='json'),
            total_steps=plan_data.total_steps,
            completed_steps=0,
            completion_tracking=completion_tracking.model_dump(mode='json'),
            status="active",
            is_active=True
        )
        
        db.add(db_plan)
        await db.commit()
        await db.refresh(db_plan)
        
        return db_plan

    @staticmethod
    async def get_user_plans(
        db: AsyncSession, 
        user_id: int, 
        active_only: bool = True,
        limit: int = 50,
        offset: int = 0
    ) -> Sequence[InterventionPlanRecord]:
        """Get all intervention plans for a user."""
        query = select(InterventionPlanRecord).filter(
            InterventionPlanRecord.user_id == user_id
        )
        
        if active_only:
            query = query.filter(InterventionPlanRecord.is_active == True)
        
        query = query.order_by(desc(InterventionPlanRecord.created_at))
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_plan_by_id(db: AsyncSession, plan_id: int, user_id: Optional[int] = None) -> Optional[InterventionPlanRecord]:
        """Get a specific intervention plan by ID."""
        query = select(InterventionPlanRecord).filter(
            InterventionPlanRecord.id == plan_id
        )
        
        if user_id is not None:
            query = query.filter(InterventionPlanRecord.user_id == user_id)
        
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def update_plan(
        db: AsyncSession, 
        plan_id: int, 
        update_data: InterventionPlanRecordUpdate,
        user_id: Optional[int] = None
    ) -> Optional[InterventionPlanRecord]:
        """Update an intervention plan."""
        plan = await InterventionPlanService.get_plan_by_id(db, plan_id, user_id)
        
        if not plan:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        
        for key, value in update_dict.items():
            if key == "completion_tracking" and value:
                setattr(plan, key, value.model_dump())
            else:
                setattr(plan, key, value)
        
        plan.updated_at = datetime.now()
        await db.commit()
        await db.refresh(plan)
        
        return plan

    @staticmethod
    async def mark_step_complete(
        db: AsyncSession,
        plan_id: int,
        step_index: int,
        completed: bool,
        user_id: Optional[int] = None,
        notes: Optional[str] = None
    ) -> Optional[InterventionPlanRecord]:
        """Mark a specific step as complete or incomplete."""
        plan = await InterventionPlanService.get_plan_by_id(db, plan_id, user_id)
        
        if not plan:
            return None
        
        # Get current completion tracking
        tracking = plan.completion_tracking or {
            "completed_steps": [],
            "completion_percentage": 0.0,
            "last_updated": None
        }
        
        completed_steps_list = tracking.get("completed_steps", [])
        
        # Update step completion status
        if completed and step_index not in completed_steps_list:
            completed_steps_list.append(step_index)
        elif not completed and step_index in completed_steps_list:
            completed_steps_list.remove(step_index)
        
        # Calculate completion percentage
        completion_percentage = (len(completed_steps_list) / plan.total_steps * 100) if plan.total_steps > 0 else 0.0
        
        # Update tracking
        tracking["completed_steps"] = sorted(completed_steps_list)
        tracking["completion_percentage"] = round(completion_percentage, 2)
        tracking["last_updated"] = datetime.now().isoformat()
        
        plan.completion_tracking = tracking
        plan.completed_steps = len(completed_steps_list)
        
        # Update status if fully completed
        if len(completed_steps_list) == plan.total_steps:
            plan.status = "completed"
        elif plan.status == "completed":
            plan.status = "active"
        
        plan.updated_at = datetime.now()
        
        # Create step completion record
        query = select(InterventionPlanStepCompletion).filter(
            InterventionPlanStepCompletion.plan_id == plan_id,
            InterventionPlanStepCompletion.step_index == step_index
        )
        result = await db.execute(query)
        step_completion = result.scalar_one_or_none()
        
        if step_completion:
            step_completion.completed = completed
            step_completion.completed_at = datetime.now() if completed else None
            step_completion.notes = notes
            step_completion.updated_at = datetime.now()
        else:
            # Get step title from plan data
            plan_data = plan.plan_data
            steps = plan_data.get("plan_steps", [])
            step_title = steps[step_index].get("title", f"Step {step_index + 1}") if step_index < len(steps) else f"Step {step_index + 1}"
            
            step_completion = InterventionPlanStepCompletion(
                plan_id=plan_id,
                step_index=step_index,
                step_title=step_title,
                completed=completed,
                completed_at=datetime.now() if completed else None,
                notes=notes
            )
            db.add(step_completion)
        
        await db.commit()
        await db.refresh(plan)
        
        return plan

    @staticmethod
    async def mark_plan_viewed(db: AsyncSession, plan_id: int, user_id: Optional[int] = None) -> Optional[InterventionPlanRecord]:
        """Update last_viewed_at timestamp."""
        plan = await InterventionPlanService.get_plan_by_id(db, plan_id, user_id)
        
        if not plan:
            return None
        
        plan.last_viewed_at = datetime.now()
        await db.commit()
        await db.refresh(plan)
        
        return plan

    @staticmethod
    async def archive_plan(db: AsyncSession, plan_id: int, user_id: Optional[int] = None) -> Optional[InterventionPlanRecord]:
        """Archive an intervention plan."""
        plan = await InterventionPlanService.get_plan_by_id(db, plan_id, user_id)
        
        if not plan:
            return None
        
        plan.is_active = False
        plan.status = "archived"
        plan.archived_at = datetime.now()
        plan.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(plan)
        
        return plan

    @staticmethod
    async def get_active_plan_count(db: AsyncSession, user_id: int) -> int:
        """Get count of active plans for a user."""
        query = select(func.count()).select_from(InterventionPlanRecord).filter(
            InterventionPlanRecord.user_id == user_id,
            InterventionPlanRecord.is_active == True
        )
        result = await db.execute(query)
        return result.scalar() or 0

