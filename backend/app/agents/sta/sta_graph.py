"""LangGraph state machine for Safety Triage Agent (STA).

This module implements the STA workflow as a LangGraph StateGraph:
    ingest_message → apply_redaction → assess_risk → decide_routing

The graph integrates with existing SafetyTriageService for classification
and ExecutionStateTracker for real-time monitoring.
"""
from __future__ import annotations

import logging
from typing import Callable
from datetime import datetime

from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import STAState
from app.agents.sta.service import get_safety_triage_service
from app.agents.sta.schemas import STAClassifyRequest
from app.agents.execution_tracker import execution_tracker
from app.core.redaction import redact_pii_regex
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)


@trace_agent("STA_Ingest")
async def ingest_message_node(state: STAState) -> STAState:
    """Node: Ingest and validate user message.
    
    This is the entry point for STA processing. It validates that required
    fields are present and initializes execution tracking.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with execution_path appended
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "sta:ingest_message", "sta")
    
    # Validate required fields
    if not state.get("message"):
        state["errors"].append("No message provided")
        if execution_id:
            execution_tracker.fail_node(execution_id, "sta:ingest_message", "No message")
        return state
    
    state["execution_path"].append("ingest_message")
    
    if execution_id:
        execution_tracker.complete_node(execution_id, "sta:ingest_message")
    
    logger.info(f"STA ingested message for user {state.get('user_hash', 'unknown')}")
    return state


@trace_agent("STA_Redaction")
async def apply_redaction_node(state: STAState, db: AsyncSession) -> STAState:
    """Node: Apply PII redaction to message.
    
    Uses the existing redaction service to strip personally identifiable
    information before classification and storage.
    
    Args:
        state: Current graph state
        db: Database session (unused, kept for consistency)
        
    Returns:
        Updated state with redacted_message field
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "sta:apply_redaction", "sta")
    
    try:
        original_message = state["message"]
        
        # Use existing redaction service (returns tuple of redacted_text, counts)
        redacted_message, redaction_counts = redact_pii_regex(original_message)
        state.setdefault("sta_context", {})["redacted_message"] = redacted_message
        state["execution_path"].append("apply_redaction")
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "sta:apply_redaction")
        
        logger.info(f"STA redacted PII from message (original length: {len(original_message)}, redactions: {sum(redaction_counts.values())})")
        
    except Exception as e:
        error_msg = f"Redaction failed: {str(e)}"
        state["errors"].append(error_msg)
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "sta:apply_redaction", str(e))
    
    return state


@trace_agent("STA_AssessRisk")
async def assess_risk_node(state: STAState, db: AsyncSession) -> STAState:
    """Node: Assess safety risk using STA Gemini-based classifier.
    
    This integrates with the SafetyTriageService which uses a 3-tier approach:
    1. Rule-based pre-screening (instant crisis/safe detection)
    2. Gemini chain-of-thought assessment (contextual analysis)
    3. Conversation caching (smart optimization)
    
    Args:
        state: Current graph state
        db: Database session
        
    Returns:
        Updated state with risk assessment fields
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "sta:assess_risk", "sta")
    
    try:
        # Get STA service with hybrid classifier
        sta_service = get_safety_triage_service(db)
        
        # Build meta dict, filtering out None values
        meta = {}
        if state.get("user_id") is not None:
            meta["user_id"] = state["user_id"]
        if state.get("conversation_id") is not None:
            meta["conversation_id"] = state["conversation_id"]
        if state.get("user_hash") is not None:
            meta["user_hash"] = state["user_hash"]
        
        # Build classification request
        request = STAClassifyRequest(
            text=state.get("sta_context", {}).get("redacted_message") or state["message"],
            session_id=state["session_id"],
            meta=meta if meta else None
        )
        
        # Classify using existing service (which handles DB persistence)
        response = await sta_service.classify(request)
        
        # Map risk_level (0-3) to severity (low/medium/high/critical)
        severity_map = {0: "low", 1: "medium", 2: "high", 3: "critical"}
        severity = severity_map.get(response.risk_level, "low")
        
        # Normalize risk_level to risk_score (0.0-1.0)
        risk_score = response.risk_level / 3.0 if response.risk_level > 0 else 0.0
        
        # Update state with STA outputs
        state.setdefault("sta_context", {})["risk_level"] = response.risk_level
        state.setdefault("sta_context", {})["risk_score"] = risk_score
        state.setdefault("sta_context", {})["severity"] = severity
        state.setdefault("sta_context", {})["intent"] = response.intent
        state.setdefault("sta_context", {})["next_step"] = response.next_step
        # Note: triage_assessment_id is created by the service in the DB, but not returned
        
        state["execution_path"].append("assess_risk")
        
        if execution_id:
            execution_tracker.complete_node(
                execution_id, 
                "sta:assess_risk",
                metrics={
                    "risk_level": response.risk_level,
                    "risk_score": risk_score,
                    "severity": severity
                }
            )
        
        logger.info(
            f"STA assessed risk: {severity} (level {response.risk_level}, "
            f"score {risk_score:.2f})"
        )
        
    except Exception as e:
        error_msg = f"Risk assessment failed: {str(e)}"
        state["errors"].append(error_msg)
        state.setdefault("sta_context", {})["next_step"] = "end"  # Safe fallback
        logger.error(error_msg, exc_info=True)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "sta:assess_risk", str(e))
    
    return state


def decide_routing(state: STAState) -> str:
    """Conditional edge: Route based on risk level and severity.
    
    Routing logic:
        - High/Critical severity → escalate_sda (create case)
        - Moderate + next_step=sca → route_sca (coaching)
        - Otherwise → end (normal conversation)
    
    Args:
        state: Current graph state
        
    Returns:
        Target node name: "escalate_sda", "route_sca", or "end"
    """
    execution_id = state.get("execution_id")
    
    next_step = state.get("sta_context", {}).get("next_step", "end")
    severity = state.get("sta_context", {}).get("severity", "low")
    
    # Track edge decision
    if execution_id:
        execution_tracker.trigger_edge(
            execution_id, 
            f"sta:decide_routing->{next_step}",
            condition_result=True
        )
    
    logger.info(f"STA routing decision: {next_step} (severity: {severity})")
    
    # High/critical always escalate to CMA
    if severity in ("high", "critical"):
        return "escalate_sda"
    
    # Moderate routes to TCA if needed
    if next_step == "tca":
        return "route_sca"
    
    return "end"


def create_sta_graph(db: AsyncSession) -> StateGraph:
    """Create the STA LangGraph state machine.
    
    Graph structure:
        START → ingest_message → apply_redaction → assess_risk → decide_routing
        
        decide_routing branches:
            - escalate_sda → END (will be handled by orchestrator)
            - route_sca → END (will be handled by orchestrator)
            - end → END (normal conversation continues)
    
    Args:
        db: Database session for node operations
        
    Returns:
        Compiled StateGraph ready for execution
    """
    workflow = StateGraph(STAState)
    
    # Create async wrapper functions for db-dependent nodes
    async def apply_redaction_wrapper(state: STAState) -> STAState:
        return await apply_redaction_node(state, db)
    
    async def assess_risk_wrapper(state: STAState) -> STAState:
        return await assess_risk_node(state, db)
    
    # Add nodes
    workflow.add_node("ingest_message", ingest_message_node)
    workflow.add_node("apply_redaction", apply_redaction_wrapper)
    workflow.add_node("assess_risk", assess_risk_wrapper)
    
    # Define linear flow through nodes
    workflow.set_entry_point("ingest_message")
    workflow.add_edge("ingest_message", "apply_redaction")
    workflow.add_edge("apply_redaction", "assess_risk")
    
    # Conditional routing from assess_risk
    workflow.add_conditional_edges(
        "assess_risk",
        decide_routing,
        {
            "escalate_sda": END,  # Will be handled by orchestrator
            "route_sca": END,     # Will be handled by orchestrator
            "end": END
        }
    )
    
    return workflow.compile()
