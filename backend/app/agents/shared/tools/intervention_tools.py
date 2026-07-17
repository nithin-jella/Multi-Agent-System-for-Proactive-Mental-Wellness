"""
Intervention Tools - CBT and Treatment Plans

This module provides tools for managing intervention plans, CBT modules,
and treatment recommendations. Used primarily by TCA agent.

Tools:
- get_available_cbt_modules: List available CBT modules
- get_intervention_plan_details: Get details of a specific plan
- create_intervention_plan: Create new intervention plan for user

Privacy: Treatment data is SENSITIVE and requires consent.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models import (
    InterventionPlanRecord,
    InterventionPlanStepCompletion,
    CbtModule,
    CbtModuleStep
)
from app.agents.shared.tools.registry import register_tool

import logging

logger = logging.getLogger(__name__)

MAX_MODULES = 20
MAX_STEPS = 50


@register_tool(
    name="get_available_cbt_modules",
    description="Get list of available CBT modules with descriptions and difficulty levels. PUBLIC DATA - module catalog.",
    parameters={
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": "Optional category filter (e.g., 'anxiety', 'depression', 'stress')"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of modules to return (default 20, max 20)",
                "default": 20
            }
        },
        "required": []
    },
    category="intervention",
    requires_db=True,
    requires_user_id=False
)
async def get_available_cbt_modules(
    db: AsyncSession,
    category: Optional[str] = None,
    limit: int = MAX_MODULES,
    **kwargs
) -> Dict[str, Any]:
    """
    Get list of available CBT modules.
    
    Returns CBT modules with descriptions, categories, and step counts.
    PUBLIC DATA - module catalog.
    """
    try:
        if limit > MAX_MODULES:
            limit = MAX_MODULES
            
        # Query modules
        query = select(CbtModule).limit(limit)
        if category:
            query = query.where(CbtModule.category == category)
            
        result = await db.execute(query)
        modules = result.scalars().all()
        
        module_list = []
        for module in modules:
            # Count steps
            step_query = select(CbtModuleStep).where(CbtModuleStep.module_id == module.id)
            step_result = await db.execute(step_query)
            steps = step_result.scalars().all()
            
            module_list.append({
                "module_id": str(module.id),
                "name": module.name,
                "description": module.description,
                "category": module.category,
                "difficulty_level": module.difficulty_level,
                "estimated_duration_minutes": module.estimated_duration_minutes,
                "total_steps": len(steps),
                "is_active": module.is_active
            })
            
        logger.info(f"✅ Retrieved {len(module_list)} CBT modules")
        
        return {
            "success": True,
            "total_modules": len(module_list),
            "category_filter": category,
            "modules": module_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting CBT modules: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@register_tool(
    name="get_intervention_plan_details",
    description="Get details of a specific intervention plan including progress and completions. SENSITIVE DATA.",
    parameters={
        "type": "object",
        "properties": {
            "plan_id": {
                "type": "string",
                "description": "Intervention plan ID"
            }
        },
        "required": ["plan_id"]
    },
    category="intervention",
    requires_db=True,
    requires_user_id=False
)
async def get_intervention_plan_details(
    db: AsyncSession,
    plan_id: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Get details of a specific intervention plan.
    
    Returns plan info, assigned modules, completion status.
    SENSITIVE DATA - treatment information.
    """
    try:
        # Get plan
        query = select(InterventionPlanRecord).where(InterventionPlanRecord.id == plan_id)
        result = await db.execute(query)
        plan = result.scalar_one_or_none()
        
        if not plan:
            logger.warning(f"⚠️ Intervention plan {plan_id} not found")
            return {
                "success": False,
                "error": f"Intervention plan {plan_id} not found",
                "plan_id": plan_id
            }
        
        # Get completions
        comp_query = (
            select(InterventionPlanStepCompletion)
            .where(InterventionPlanStepCompletion.plan_id == plan_id)
        )
        comp_result = await db.execute(comp_query)
        completions = comp_result.scalars().all()
        
        completion_list = []
        for comp in completions:
            completion_list.append({
                "step_number": comp.step_number,
                "completed": comp.completed,
                "completed_at": comp.completed_at.isoformat() if comp.completed_at else None,
                "response": comp.response
            })
        
        logger.info(f"✅ Retrieved intervention plan details for {plan_id}")
        
        return {
            "success": True,
            "plan_id": plan_id,
            "user_id": str(plan.user_id),
            "module_type": plan.module_type,
            "status": plan.status,
            "current_step": plan.current_step,
            "total_steps": plan.total_steps,
            "progress_percentage": round((plan.current_step / plan.total_steps * 100) if plan.total_steps > 0 else 0, 1),
            "started_at": plan.started_at.isoformat() if plan.started_at else None,
            "completed_at": plan.completed_at.isoformat() if plan.completed_at else None,
            "completions": completion_list
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting intervention plan details for {plan_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "plan_id": plan_id
        }


@register_tool(
    name="create_intervention_plan",
    description="Create a guided self-help intervention plan with steps and resources for the user. Use this when user needs structured support or coping strategies. SENSITIVE DATA - creates treatment record.",
    parameters={
        "type": "object",
        "properties": {
            "plan_title": {
                "type": "string",
                "description": "Title of the intervention plan (e.g., 'Strategi Mengatasi Kecemasan', 'Panduan Mengelola Stres Akademik')"
            },
            "plan_steps": {
                "type": "array",
                "description": "List of action steps with title and description",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Step title/action"
                        },
                        "description": {
                            "type": "string",
                            "description": "Detailed description of the step"
                        }
                    },
                    "required": ["title", "description"]
                }
            },
            "resource_cards": {
                "type": "array",
                "description": "Optional resource cards with helpful links",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "description": "Resource title"
                        },
                        "url": {
                            "type": "string",
                            "description": "URL to resource"
                        },
                        "description": {
                            "type": "string",
                            "description": "Resource description"
                        }
                    }
                }
            },
            "next_check_in": {
                "type": "object",
                "description": "Optional check-in schedule",
                "properties": {
                    "timeframe": {
                        "type": "string",
                        "description": "When to check in (e.g., '1 hari', '3 hari', '1 minggu')"
                    },
                    "method": {
                        "type": "string",
                        "description": "How to check in (e.g., 'chat', 'form')"
                    }
                }
            },
            "risk_level": {
                "type": "integer",
                "description": "Risk level 0-3 (0=none, 1=low, 2=moderate, 3=high)"
            },
            "session_id": {
                "type": "string",
                "description": "Optional session ID"
            }
        },
        "required": ["plan_title", "plan_steps"]
    },
    category="intervention",
    requires_db=True,
    requires_user_id=True
)
async def create_intervention_plan(
    db: AsyncSession,
    user_id: int,
    plan_title: str,
    plan_steps: List[Dict[str, Any]],
    resource_cards: Optional[List[Dict[str, str]]] = None,
    next_check_in: Optional[Dict[str, str]] = None,
    risk_level: Optional[int] = None,
    session_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Create a new intervention plan for user.
    
    Creates a structured guided self-help plan with steps and resources.
    SENSITIVE DATA - creates treatment record.
    """
    try:
        from app.domains.mental_health.schemas.intervention_plans import (
            InterventionPlanRecordCreate,
            InterventionPlanData,
            PlanStep,
            ResourceCard,
            NextCheckIn
        )
        from app.domains.mental_health.services.intervention_plan_service import InterventionPlanService
        
        # Convert plan_steps to PlanStep objects
        steps = [
            PlanStep(
                title=step.get("title", step.get("label", "")),
                description=step.get("description", ""),
                completed=False
            )
            for step in plan_steps
        ]
        
        # Convert resource_cards if provided
        resources = []
        if resource_cards:
            resources = [
                ResourceCard(
                    title=card.get("title", ""),
                    url=card.get("url", ""),
                    description=card.get("description", card.get("summary", ""))
                )
                for card in resource_cards
            ]
        
        # Create next_check_in if provided
        check_in = None
        if next_check_in:
            check_in = NextCheckIn(
                timeframe=next_check_in.get("timeframe", "1 hari"),
                method=next_check_in.get("method", "chat")
            )
        
        # Create InterventionPlanData
        plan_data = InterventionPlanData(
            plan_steps=steps,
            resource_cards=resources,
            next_check_in=check_in
        )
        
        # Create InterventionPlanRecordCreate
        plan_create = InterventionPlanRecordCreate(
            user_id=user_id,
            session_id=session_id,
            plan_title=plan_title,
            risk_level=risk_level,
            plan_data=plan_data,
            total_steps=len(steps)
        )
        
        # Create plan record
        plan_record = await InterventionPlanService.create_plan(db, plan_create)
        
        logger.info(f"✅ Created intervention plan {plan_record.id} for user {user_id}")
        
        return {
            "success": True,
            "plan_id": plan_record.id,
            "plan_title": plan_record.plan_title,
            "total_steps": plan_record.total_steps,
            "created_at": plan_record.created_at.isoformat(),
            "plan_data": {
                "plan_steps": [{"title": s.title, "description": s.description} for s in plan_data.plan_steps],
                "resource_cards": [{"title": r.title, "url": r.url, "description": r.description} for r in plan_data.resource_cards],
                "next_check_in": {"timeframe": check_in.timeframe, "method": check_in.method} if check_in else None
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error creating intervention plan: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
