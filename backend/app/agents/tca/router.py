from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tca.schemas import (
    TCAFollowUpRequest,
    TCAFollowUpResponse,
    TCAInterveneRequest,
    TCAInterveneResponse,
)
from app.agents.tca.service import TherapeuticCoachService, get_therapeutic_coach_service
from app.core.auth import get_current_user
from app.models.user import User
from app.database import get_async_db

router = APIRouter(prefix="/api/agents/sca", tags=["agents:sca"])


@router.post("/intervene", response_model=TCAInterveneResponse)
async def intervene(
    payload: TCAInterveneRequest,
    service: TherapeuticCoachService = Depends(get_therapeutic_coach_service),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> TCAInterveneResponse:
    # Extract options for dynamic plan generation
    options = payload.options or {}
    
    # Check for Gemini flag (handle string "true" or boolean/int)
    use_gemini_raw = options.get("use_gemini_plan", False)
    use_gemini = str(use_gemini_raw).lower() in ("true", "1", "yes") if use_gemini_raw else False
    
    plan_type = str(options.get("plan_type", "general_coping"))
    user_message = str(options.get("original_prompt", ""))

    return await service.intervene(
        payload, 
        use_gemini_plan=use_gemini,
        plan_type=plan_type,
        user_message=user_message,
        user=current_user, 
        db=db
    )


@router.post("/followup", response_model=TCAFollowUpResponse)
async def followup(
    payload: TCAFollowUpRequest,
    service: TherapeuticCoachService = Depends(get_therapeutic_coach_service),
) -> TCAFollowUpResponse:
    return await service.followup(payload)
