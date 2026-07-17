from __future__ import annotations

from typing import Dict, Literal, Optional, Union

from pydantic import BaseModel, Field


RiskLevel = Literal[0, 1, 2, 3]
NextStep = Literal['tca', 'human', 'resource']
SupportPlanType = Literal['calm_down', 'break_down_problem', 'general_coping', 'none']


class STAClassifyRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    meta: Optional[Dict[str, Union[str, int, float]]] = None


class STAClassifyResponse(BaseModel):
    risk_level: RiskLevel
    intent: str
    next_step: NextStep
    handoff: bool = False
    diagnostic_notes: Optional[str] = Field(default=None, exclude=True)
    needs_therapeutic_coach_plan: bool = Field(
        default=False,
        description="Flag indicating if user could benefit from TCA Therapeutic Coach Plan"
    )
    therapeutic_plan_type: SupportPlanType = Field(
        default='none',
        description="Type of support plan recommended: calm_down, break_down_problem, general_coping, or none"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "risk_level": 1,
                "intent": "academic_stress",
                "next_step": "tca",
                "handoff": False,
                "needs_therapeutic_coach_plan": True,
                "therapeutic_plan_type": "break_down_problem"
            }
        }
