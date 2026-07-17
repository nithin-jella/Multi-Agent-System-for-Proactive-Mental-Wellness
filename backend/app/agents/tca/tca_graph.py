"""LangGraph state machine for Therapeutic Coach Agent (TCA).

This module implements the TCA workflow as a LangGraph StateGraph:
    ingest_triage_signal → determine_intervention_type → generate_plan → 
    safety_review → persist_plan

The graph integrates with TherapeuticCoachService and uses Gemini AI for 
personalized intervention plan generation.
"""
from __future__ import annotations

import logging
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables import RunnableConfig
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import TCAState
from app.agents.tca.service import TherapeuticCoachService
from app.agents.tca.schemas import TCAInterveneRequest
from app.agents.execution_tracker import execution_tracker
from app.domains.mental_health.models import InterventionPlanRecord
from app.domains.mental_health.schemas.intervention_plans import (
    InterventionPlanData,
    PlanStep,
    ResourceCard,
    NextCheckIn
)
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)


@trace_agent("TCA_Ingest")
async def ingest_triage_signal_node(state: TCAState) -> TCAState:
    """Node: Ingest triage signal from STA.
    
    Validates that STA has provided necessary risk assessment data
    and initializes TCA execution tracking.
    
    Args:
        state: Current graph state with STA outputs
        
    Returns:
        Updated state with execution_path appended
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "tca::ingest_triage_signal", "tca")
    
    # Validate STA outputs are present
    if not state.get("sta_context", {}).get("severity") or not state.get("sta_context", {}).get("intent"):
        state["errors"].append("Missing STA risk assessment data")
        if execution_id:
            execution_tracker.fail_node(
                execution_id, 
                "tca::ingest_triage_signal", 
                "Missing STA data"
            )
        return state
    
    state["execution_path"].append("ingest_triage_signal")
    
    if execution_id:
        execution_tracker.complete_node(execution_id, "tca::ingest_triage_signal")
    
    logger.info(
        f"TCA ingested triage signal: severity={state.get("sta_context", {}).get("severity")}, "
        f"intent={state.get("sta_context", {}).get("intent")}"
    )
    return state


@trace_agent("TCA_DetermineType")
async def determine_intervention_type_node(state: TCAState) -> TCAState:
    """Node: Determine appropriate intervention type.
    
    Maps intent and severity to intervention plan type:
        - High anxiety/panic → calm_down
        - Overwhelmed/stuck → break_down_problem
        - General stress → general_coping
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with intervention_type field
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "tca::determine_intervention_type", "tca")
    
    try:
        intent = state.get("sta_context", {}).get("intent", "").lower()
        severity = state.get("sta_context", {}).get("severity", "low").lower()
        
        # Map intent to intervention type
        if intent in ("crisis", "panic", "anxiety", "acute_stress"):
            intervention_type = "calm_down"
        elif intent in ("overwhelmed", "stuck", "confused", "academic_stress"):
            intervention_type = "break_down_problem"
        else:
            intervention_type = "general_coping"
        
        state.setdefault("tca_context", {})["intervention_type"] = intervention_type
        state.setdefault("tca_context", {})["should_intervene"] = True
        state["execution_path"].append("determine_intervention_type")
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "tca::determine_intervention_type",
                metrics={"intervention_type": intervention_type}
            )
        
        logger.info(f"TCA determined intervention type: {intervention_type}")
        
    except Exception as e:
        error_msg = f"Failed to determine intervention type: {str(e)}"
        state["errors"].append(error_msg)
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(
                execution_id, 
                "tca::determine_intervention_type", 
                str(e)
            )
    
    return state


@trace_agent("TCA_GeneratePlan")
async def generate_plan_node(state: TCAState) -> TCAState:
    """Node: Generate personalized intervention plan using Gemini AI.
    
    Uses TherapeuticCoachService with Gemini-powered plan generation to create
    hyper-personalized CBT-informed intervention plans.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with intervention_plan field
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "tca::generate_plan", "tca")
    
    try:
        # Get TCA service
        sca_service = TherapeuticCoachService()
        
        # Build intervention request
        request = TCAInterveneRequest(
            intent=state.get("sta_context", {}).get("intent", "general_support"),
            user_hash=state["user_hash"],
            session_id=state["session_id"],
            options={
                "risk_level": state.get("sta_context", {}).get("severity", "moderate"),  # Use severity from STA
                "severity": state.get("sta_context", {}).get("severity", "moderate")
            }
        )
        
        # Generate plan with Gemini AI
        response = await sca_service.intervene(
            payload=request,
            use_gemini_plan=True,
            plan_type=state.get("tca_context", {}).get("intervention_type", "general_coping"),
            user_message=state.get("message", ""),
            sta_context={
                "risk_level": state.get("sta_context", {}).get("risk_level"),
                "severity": state.get("sta_context", {}).get("severity"),
                "risk_score": state.get("sta_context", {}).get("risk_score")
            }
        )
        
        # Store plan in state
        state.setdefault("tca_context", {})["intervention_plan"] = {
            "plan_steps": [
                {
                    "id": getattr(step, "id", None),
                    "title": getattr(step, "title", getattr(step, "label", "Step")),
                    "description": getattr(step, "description", getattr(step, "summary", "")),
                    "duration_min": getattr(step, "duration_min", 5)
                }
                for step in response.plan_steps
            ],
            "resource_cards": [
                {
                    "resource_id": card.resource_id,
                    "title": card.title,
                    "description": card.description,
                    "url": card.url
                }
                for card in response.resource_cards
            ]
        }
        
        state["execution_path"].append("generate_plan")
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "tca::generate_plan",
                metrics={
                    "num_steps": len(response.plan_steps),
                    "num_resources": len(response.resource_cards)
                }
            )
        
        logger.info(
            f"TCA generated plan: {len(response.plan_steps)} steps, "
            f"{len(response.resource_cards)} resources"
        )
        
    except Exception as e:
        error_msg = f"Plan generation failed: {str(e)}"
        state["errors"].append(error_msg)
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "tca::generate_plan", str(e))
    
    return state


@trace_agent("TCA_SafetyReview")
async def safety_review_node(state: TCAState) -> TCAState:
    """Node: Apply safety checks before plan activation.
    
    Ensures plans are appropriate for user's risk level and applies
    any necessary safety guardrails.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state after safety review
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "tca::safety_review", "tca")
    
    try:
        severity = state.get("sta_context", {}).get("severity", "low")
        
        # Safety check: High/critical severity should not use TCA *alone*.
        # However, when running inside parallel_crisis_node alongside CMA,
        # TCA is still needed for immediate coping support — CMA handles the
        # crisis escalation, so TCA should persist its plan in that context.
        if severity in ("high", "critical") and not state.get("parallel_crisis_mode"):
            state.setdefault("tca_context", {})["should_intervene"] = False
            state["errors"].append(
                "Safety review: High/critical severity should route to CMA, not TCA alone"
            )
            logger.warning(
                "TCA safety review blocked (solo mode): severity=%s", severity
            )
        
        state["execution_path"].append("safety_review")
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "tca::safety_review",
                metrics={"should_intervene": state.get("tca_context", {}).get("should_intervene", False)}
            )
        
        logger.info(f"TCA safety review passed: should_intervene={state.get("tca_context", {}).get("should_intervene")}")
        
    except Exception as e:
        error_msg = f"Safety review failed: {str(e)}"
        state["errors"].append(error_msg)
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "tca::safety_review", str(e))
    
    return state


@trace_agent("TCA_PersistPlan")
async def persist_plan_node(state: TCAState, config: RunnableConfig) -> TCAState:
    """Node: Persist intervention plan to database.
    
    Creates InterventionPlan record for tracking and follow-up.
    
    Args:
        state: Current graph state
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with intervention_plan_id
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "tca::persist_plan", "tca")
    
    try:
        # Only persist if intervention should proceed
        if not state.get("tca_context", {}).get("should_intervene"):
            logger.info("TCA skipping plan persistence (should_intervene=False)")
            state["execution_path"].append("persist_plan")
            if execution_id:
                execution_tracker.complete_node(execution_id, "tca::persist_plan")
            return state
        
        # Get intervention_type string and raw plan data from state
        intervention_type = state.get("tca_context", {}).get("intervention_type", "general_coping")
        raw_plan_data = state.get("tca_context", {}).get("intervention_plan", {})
        
        # Validate and ensure proper structure using schema models
        plan_steps_raw = raw_plan_data.get("plan_steps", []) if raw_plan_data else []
        resources_raw = raw_plan_data.get("resource_cards", []) if raw_plan_data else []
        next_check_in_raw = raw_plan_data.get("next_check_in") if raw_plan_data else None
        
        # Convert to proper schema models
        plan_steps = [
            PlanStep(
                title=step.get("title", step.get("label", "Step")),
                description=step.get("description", ""),
                completed=step.get("completed", False)
            )
            for step in plan_steps_raw
        ]
        
        resource_cards = [
            ResourceCard(
                title=card.get("title", "Resource"),
                url=card.get("url", "#"),
                description=card.get("description", card.get("summary", ""))
            )
            for card in resources_raw
        ]
        
        next_check_in = None
        if next_check_in_raw:
            next_check_in = NextCheckIn(
                timeframe=next_check_in_raw.get("timeframe", "24 hours"),
                method=next_check_in_raw.get("method", "chat")
            )
        
        # Create validated InterventionPlanData model
        validated_plan_data = InterventionPlanData(
            plan_steps=plan_steps,
            resource_cards=resource_cards,
            next_check_in=next_check_in
        )
        
        # Convert to dict for storage, preserving intervention_type
        plan_data_dict = validated_plan_data.model_dump(mode='json')
        plan_data_dict["intervention_type"] = intervention_type
        
        total_steps = len(plan_steps)
        
        # Create InterventionPlanRecord
        # Note: conversation_id is expected to be int (FK to conversations table), not string
        # Skip conversation_id if it's a string, 0, or invalid
        conv_id = state.get("conversation_id")
        if isinstance(conv_id, str) or conv_id == 0 or not conv_id:
            conv_id = None  # Only use valid int FK references
        
        plan = InterventionPlanRecord(
            user_id=state.get("user_id"),
            session_id=state.get("session_id"),
            conversation_id=conv_id,
            plan_title=f"{intervention_type.replace('_', ' ').title() if intervention_type else 'General'} Intervention Plan",
            risk_level=state.get("sta_context", {}).get("risk_level", 0),
            plan_data=plan_data_dict,
            total_steps=total_steps,
            completed_steps=0,
            completion_tracking={},
            status="active"
        )
        
        db.add(plan)
        await db.flush()
        # NOTE: Only flush here — the outer orchestrator or chat route owns
        # the final commit boundary.  This prevents premature commits when TCA
        # runs inside parallel_crisis_node (shared db session with CMA).
        
        # DEBUG: Log plan creation details
        logger.info(f"TCA persisted intervention plan: ID={plan.id}, user_id={plan.user_id}, is_active={plan.is_active}, status={plan.status}")
        
        state.setdefault("tca_context", {})["intervention_plan_id"] = plan.id
        state["execution_path"].append("persist_plan")
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "tca::persist_plan",
                metrics={"plan_id": plan.id}
            )
        
        logger.info(f"TCA persisted intervention plan: ID={plan.id}")
        
    except Exception as e:
        error_msg = f"Plan persistence failed: {str(e)}"
        state["errors"].append(error_msg)
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "tca::persist_plan", str(e))
    
    return state


def _build_tca_graph() -> CompiledStateGraph:
    """Build and compile the TCA LangGraph state machine.

    Graph structure:
        START → ingest_triage_signal → determine_intervention_type →
        generate_plan → safety_review → persist_plan → END

    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(TCAState)

    # Add nodes
    workflow.add_node("ingest_triage_signal", ingest_triage_signal_node)
    workflow.add_node("determine_intervention_type", determine_intervention_type_node)
    workflow.add_node("generate_plan", generate_plan_node)
    workflow.add_node("safety_review", safety_review_node)
    workflow.add_node("persist_plan", persist_plan_node)

    # Define linear flow
    workflow.set_entry_point("ingest_triage_signal")
    workflow.add_edge("ingest_triage_signal", "determine_intervention_type")
    workflow.add_edge("determine_intervention_type", "generate_plan")
    workflow.add_edge("generate_plan", "safety_review")
    workflow.add_edge("safety_review", "persist_plan")
    workflow.add_edge("persist_plan", END)

    return workflow.compile()


# Module-level cached compiled graph
_tca_graph: CompiledStateGraph | None = None


def get_tca_graph() -> CompiledStateGraph:
    """Return the cached TCA compiled graph, building it on first call."""
    global _tca_graph
    if _tca_graph is None:
        _tca_graph = _build_tca_graph()
    return _tca_graph
