from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
import logging

from app.agents.tca.resources import get_default_resources
from app.agents.tca.schemas import (
    PlanStep,
    ResourceCard,
    TCAFollowUpRequest,
    TCAFollowUpResponse,
    TCAInterveneRequest,
    TCAInterveneResponse,
)
from app.core.events import AgentEvent, AgentNameEnum, emit_agent_event

logger = logging.getLogger(__name__)


PlanMatrix = dict[str, list[PlanStep]]

_DEFAULT_PLAN_STEPS: PlanMatrix = {
    "academic_stress": [
        PlanStep(title="Grounding", description="Box breathing to reset focus", duration_min=4),
        PlanStep(title="Planning", description="Break assignments into smaller actions", duration_min=6),
        PlanStep(title="Support", description="Message a study buddy or mentor", duration_min=3),
    ],
    "acute_distress": [
        PlanStep(title="Breathing", description="Guided 4-7-8 breathing", duration_min=5),
        PlanStep(title="Body Scan", description="Progressive muscle relaxation", duration_min=7),
        PlanStep(title="Safety Plan", description="Review personal safety plan", duration_min=5),
    ],
    "relationship_strain": [
        PlanStep(title="Reflect", description="Name the need behind the feeling", duration_min=5),
        PlanStep(title="Communicate", description="Draft an 'I feel / I need' message", duration_min=6),
        PlanStep(title="Connect", description="Reach out to a trusted friend", duration_min=4),
    ],
    "financial_pressure": [
        PlanStep(title="Budget", description="List fixed vs. flexible expenses", duration_min=8),
        PlanStep(title="Relief", description="Explore campus aid and scholarships", duration_min=6),
        PlanStep(title="Self Care", description="Schedule a restorative break", duration_min=4),
    ],
}

_FALLBACK_PLAN = [
    PlanStep(title="Check In", description="Pause and notice how your body feels", duration_min=3),
    PlanStep(title="Cope", description="Use a favourite coping skill for 5 minutes", duration_min=5),
    PlanStep(title="Reach Out", description="Share how you're feeling with someone you trust", duration_min=4),
]


from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession

class TherapeuticCoachService:
    """
    Therapeutic Coach Agent (TCA) - Generates structured therapeutic intervention plans.
    
    Supports multiple evidence-based approaches:
    - Crisis Management: calm_down, break_down_problem, general_coping
    - CBT Interventions: cognitive_restructuring, behavioral_activation
    
    CBT Integration (replacing legacy CBT modules):
    The TCA now incorporates Cognitive Behavioral Therapy principles through
    AI-generated personalized plans. These plans follow established CBT frameworks
    while adapting to each user's specific situation.
    
    Available Plan Types:
    - calm_down: Anxiety and panic management (breathing, grounding)
    - break_down_problem: Problem-solving for overwhelming situations
    - general_coping: General stress management and resilience
    - cognitive_restructuring: CBT thought challenging and reframing
    - behavioral_activation: CBT activity scheduling for depression/low motivation
    
    Usage:
        # For AI-powered CBT plan:
        response = await sca_service.intervene(
            payload=request,
            use_gemini_plan=True,
            plan_type="cognitive_restructuring",
            user_message="I failed my exam and I'm a complete failure",
            sta_context={"risk_level": 2}
        )
    """

    def __init__(
        self,
        event_emitter: Callable[[AgentEvent], Awaitable[None]] = emit_agent_event,
    ) -> None:
        self._emit_event = event_emitter

    async def intervene(
        self, 
        payload: TCAInterveneRequest,
        use_gemini_plan: bool = False,
        plan_type: Optional[str] = None,
        user_message: Optional[str] = None,
        sta_context: Optional[Dict[str, Any]] = None,
        user: Optional[User] = None,
        db: Optional[AsyncSession] = None
    ) -> TCAInterveneResponse:
        """Generate intervention plan - uses Gemini AI if requested, otherwise static plans.
        
        Args:
            payload: Standard TCA intervention request
            use_gemini_plan: If True, generate personalized plan with Gemini AI
            plan_type: Type of plan:
                - "calm_down": Anxiety/panic management
                - "break_down_problem": Problem-solving
                - "general_coping": General stress management
                - "cognitive_restructuring": CBT thought challenging (replaces legacy CBT module)
                - "behavioral_activation": CBT activity scheduling (replaces legacy CBT module)
            user_message: Original user message for context (required if use_gemini_plan=True)
            sta_context: Additional context from STA (risk_level, etc.)
            user: Optional user object for saving the plan
            db: Optional database session for saving the plan
        
        Returns:
            TCAInterveneResponse with plan steps and resources
        """
        intent_key = payload.intent.strip().lower()
        
        # Use Gemini-powered plan generation if requested
        if use_gemini_plan and plan_type and user_message:
            try:
                logger.info(f"Generating Gemini-powered {plan_type} plan for intent: {intent_key}")
                
                from app.agents.tca.gemini_plan_generator import generate_personalized_plan
                
                # Build context for Gemini
                gemini_context = {}
                if sta_context:
                    gemini_context.update(sta_context)
                
                # Add any additional context from payload options
                if isinstance(payload.options, dict):
                    if "risk_level" in payload.options:
                        gemini_context["risk_level"] = payload.options["risk_level"]
                    if "demographics" in payload.options:
                        gemini_context["demographics"] = payload.options["demographics"]
                    if "previous_sessions" in payload.options:
                        gemini_context["previous_sessions"] = payload.options["previous_sessions"]
                
                # Generate personalized plan
                plan_data = await generate_personalized_plan(
                    user_message=user_message,
                    intent=intent_key,
                    plan_type=plan_type,
                    context=gemini_context if gemini_context else None
                )
                
                # Convert to PlanStep and ResourceCard objects
                plan_steps = [
                    PlanStep(
                        title=step.get("title", "Step"),
                        description=step.get("description", ""),
                        duration_min=step.get("duration_min"),
                        id=step.get("id")
                    )
                    for i, step in enumerate(plan_data.get("plan_steps", []))
                ]
                
                resources = [
                    ResourceCard(
                        title=card.get("title", ""),
                        description=card.get("description", ""),
                        url=card.get("url"),
                        resource_id=card.get("resource_id")
                    )
                    for i, card in enumerate(plan_data.get("resource_cards", []))
                ]
                
                logger.info(f"Gemini plan generated: {len(plan_steps)} steps, {len(resources)} resources")
                
            except Exception as e:
                logger.error(f"Gemini plan generation failed, falling back to static: {e}", exc_info=True)
                # Fallback to static plans
                plan_steps = list(_DEFAULT_PLAN_STEPS.get(intent_key, _FALLBACK_PLAN))
                resources = list(self._coerce_resources(intent_key))
        else:
            # Use static plans (original behavior)
            plan_steps = list(_DEFAULT_PLAN_STEPS.get(intent_key, _FALLBACK_PLAN))
            resources = list(self._coerce_resources(intent_key))

        check_in_hours = self._resolve_followup_window(payload, default_hours=24)
        next_check_in = (
            datetime.utcnow() + timedelta(hours=check_in_hours)
            if payload.consent_followup is not False
            else None
        )

        response = TCAInterveneResponse(
            plan_steps=plan_steps,
            resource_cards=resources,
            next_check_in=next_check_in,
        )

        # Save to database if user and db are provided
        if user and db:
            try:
                from app.domains.mental_health.services.intervention_plan_service import InterventionPlanService
                from app.domains.mental_health.schemas.intervention_plans import (
                    InterventionPlanRecordCreate,
                    InterventionPlanData,
                    PlanStep as StoragePlanStep,
                    ResourceCard as StorageResourceCard,
                    NextCheckIn as StorageNextCheckIn
                )
                
                # Map TCA response to storage schema models
                # TCA PlanStep: title, description, duration_min
                # Storage PlanStep: title, description, completed
                storage_steps = []
                for step in plan_steps:
                    desc = step.description
                    if step.duration_min:
                        desc += f" ({step.duration_min} min)"
                        
                    storage_steps.append(StoragePlanStep(
                        title=step.title,
                        description=desc,
                        completed=False
                    ))
                
                # TCA ResourceCard: title, description, url
                # Storage ResourceCard: title, url, description
                storage_resources = []
                for card in resources:
                    storage_resources.append(StorageResourceCard(
                        title=card.title,
                        url=card.url or "#",
                        description=card.description
                    ))
                
                # TCA next_check_in: datetime
                # Storage NextCheckIn: timeframe, method
                check_in_str = next_check_in.isoformat() if next_check_in else "24 hours"
                storage_check_in = StorageNextCheckIn(
                    timeframe=check_in_str,
                    method="automated"
                )
                
                # Create proper InterventionPlanData model
                plan_data_model = InterventionPlanData(
                    plan_steps=storage_steps,
                    resource_cards=storage_resources,
                    next_check_in=storage_check_in
                )
                
                # Determine risk level from context or payload options
                risk_level = None
                if sta_context and "risk_level" in sta_context:
                    risk_level = sta_context["risk_level"]
                elif payload.options and "risk_level" in payload.options:
                    try:
                        risk_level = int(payload.options["risk_level"])
                    except (ValueError, TypeError):
                        pass

                plan_create = InterventionPlanRecordCreate(
                    user_id=user.id,
                    session_id=payload.session_id,
                    conversation_id=None,
                    plan_title=f"Intervention Plan: {intent_key.replace('_', ' ').title()}",
                    risk_level=risk_level,
                    plan_data=plan_data_model,
                    total_steps=len(plan_steps)
                )
                
                await InterventionPlanService.create_plan(db, plan_create)
                logger.info(f"Saved intervention plan for user {user.id}")
            except Exception as e:
                logger.error(f"Failed to save intervention plan: {e}", exc_info=True)

        await self._emit_event(
            AgentEvent(
                agent=AgentNameEnum.TCA,
                step="plan_generated",
                payload={
                    "session_id": payload.session_id,
                    "intent": intent_key,
                    "user_hash": payload.user_hash,  # Use direct field, not options
                    "resource_count": len(resources),
                    "plan_length": len(plan_steps),
                    "used_gemini": use_gemini_plan,
                    "plan_type": plan_type if use_gemini_plan else "static",
                },
                ts=datetime.utcnow(),
            )
        )

        return response

    async def followup(self, payload: TCAFollowUpRequest) -> TCAFollowUpResponse:
        sentiment = str(payload.check_in.get("mood", "")).lower()
        stress = str(payload.check_in.get("stress", "")).lower()

        if sentiment in {"worse", "bad"} or stress in {"high", "elevated"}:
            hours = 6
        elif sentiment in {"better", "good"}:
            hours = 48
        else:
            hours = 24

        next_check_in = datetime.utcnow() + timedelta(hours=hours)
        response = TCAFollowUpResponse(acknowledged=True, next_check_in=next_check_in)

        await self._emit_event(
            AgentEvent(
                agent=AgentNameEnum.TCA,
                step="followup_logged",
                payload={
                    "session_id": payload.session_id,
                    "plan_id": payload.last_plan_id,
                    "user_hash": payload.check_in.get("user_hash"),
                    "mood": sentiment or None,
                    "stress": stress or None,
                },
                ts=datetime.utcnow(),
            )
        )

        return response

    @staticmethod
    def _resolve_followup_window(payload: TCAInterveneRequest, default_hours: int) -> int:
        options = payload.options or {}
        window = options.get("check_in_hours")
        if isinstance(window, (int, float)) and window > 0:
            return int(window)
        if payload.intent.lower() in {"acute_distress", "crisis_support"}:
            return 6
        return default_hours

    @staticmethod
    def _coerce_resources(intent: str) -> list[ResourceCard]:
        resources = list(get_default_resources(intent))
        if resources:
            return resources
        return list(get_default_resources("general_support"))


def get_therapeutic_coach_service() -> "TherapeuticCoachService":
    """FastAPI dependency factory for :class:`TherapeuticCoachService`."""

    return TherapeuticCoachService()


