"""Shared state schema for all LangGraph agent workflows.

This module defines the TypedDict state that flows through the Safety Agent Suite
graphs (STA, TCA, CMA, IA) and the master orchestrator.
"""
from __future__ import annotations

from typing import TypedDict, Optional, List, Dict, Any, Literal
from typing_extensions import NotRequired
from datetime import datetime

class TCAContext(TypedDict, total=False):
    """TCA-specific context."""
    intervention_plan: Optional[Dict[str, Any]]
    intervention_type: Optional[str]
    should_intervene: bool
    intervention_plan_id: Optional[int]
    safety_approved: Optional[bool]

class CMAContext(TypedDict, total=False):
    """CMA-specific context."""
    case_id: Optional[str]
    case_created: bool
    case_severity: Optional[str]
    assigned_counsellor_id: Optional[int]
    sla_breach_at: Optional[datetime]
    sla_hours: Optional[int]
    assigned_to: Optional[str]
    assignment_id: Optional[str]
    assignment_reason: Optional[str]
    assigned_workload: Optional[int]
    schedule_appointment: bool
    appointment_id: Optional[int]
    appointment_datetime: Optional[str]
    appointment_confirmed: bool
    psychologist_id: Optional[int]
    preferred_time: Optional[str]
    scheduling_context: Optional[Dict[str, Any]]
    notification_sent: Optional[bool]

class STAContext(TypedDict, total=False):
    """STA-specific context."""
    risk_level: Optional[int]
    risk_score: Optional[float]
    severity: Optional[Literal["low", "moderate", "high", "critical"]]
    intent: Optional[str]
    next_step: Optional[str]
    redacted_message: Optional[str]
    triage_assessment_id: Optional[int]

class IAContext(TypedDict, total=False):
    """IA-specific context."""
    question_id: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    user_hash: str
    query_validated: bool
    consent_validated: bool
    privacy_enforced: bool
    k_threshold: int
    query_completed: bool
    analytics_result: Optional[Dict[str, Any]]
    interpretation: str
    trends: List[Dict[str, Any]]
    summary: str
    recommendations: List[Dict[str, Any]]
    interpretation_completed: bool
    pdf_url: Optional[str]
    ia_report: Optional[str]
    query_type: Optional[str]
    execution_id: str
    execution_path: List[str]
    errors: List[str]
    started_at: datetime
    completed_at: datetime


class SafetyAgentState(TypedDict, total=False):
    """Shared state across STA, TCA, CMA, and IA agents."""
    user_id: int
    session_id: str
    user_hash: str
    message: str
    conversation_id: int
    parallel_crisis_mode: bool
    execution_id: str
    errors: List[str]
    execution_path: List[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    tca_context: TCAContext
    cma_context: CMAContext
    sta_context: STAContext
    ia_context: IAContext

class STAState(SafetyAgentState): pass
class TCAState(SafetyAgentState): pass
class CMAState(SafetyAgentState): pass
class OrchestratorState(SafetyAgentState): pass

class IAState(TypedDict, total=False):
    """IA (Insights Agent) specific state for analytics queries.

    This state is separate from SafetyAgentState because IA performs
    privacy-preserving analytics aggregation, not individual user support.
    """
    question_id: str
    start_date: datetime
    end_date: datetime
    user_hash: str
    query_validated: bool
    consent_validated: bool
    privacy_enforced: bool
    k_threshold: int
    query_completed: bool
    analytics_result: Dict[str, Any]
    interpretation: str
    trends: List[Dict[str, Any]]
    summary: str
    recommendations: List[Dict[str, Any]]
    interpretation_completed: bool
    pdf_url: Optional[str]
    ia_report: Optional[str]
    query_type: Optional[str]
    execution_id: str
    execution_path: List[str]
    errors: List[str]
    started_at: datetime
    completed_at: datetime

class AikaOrchestratorState(TypedDict, total=False):
    """State for the unified Aika orchestrator graph."""
    user_id: int
    user_role: Literal["user", "counselor", "admin"]
    session_id: str
    user_hash: str
    message: str
    conversation_id: Optional[str]
    conversation_history: List[Dict[str, str]]
    
    intent: Optional[str]
    intent_confidence: Optional[float]
    needs_agents: bool
    aika_direct_response: Optional[str]
    agent_reasoning: Optional[str]
    
    tca_context: TCAContext
    cma_context: CMAContext
    sta_context: STAContext
    ia_context: IAContext
    
    tool_calls: Optional[List[Dict[str, Any]]]
    preferred_model: Optional[str]
    personal_context: Optional[Dict[str, Any]]
    force_sta_reanalysis: Optional[bool]
    immediate_risk_level: Optional[Literal["none", "low", "moderate", "high", "critical"]]
    crisis_keywords_detected: List[str]
    risk_reasoning: Optional[str]
    conversation_ended: bool
    conversation_assessment: Optional[Dict[str, Any]]
    sta_analysis_completed: bool
    needs_cma_escalation: bool
    last_message_timestamp: Optional[float]
    previous_conversation_id: Optional[str]
    screening_profile: Optional[Dict[str, Any]]
    intervention_suggestion: Optional[Dict[str, Any]]
    screening_enhanced_response: Optional[str]
    screening_prompt_addition: Optional[str]
    discordance_level: Optional[Literal["none", "low", "medium", "high"]]
    discordance_reason: Optional[str]
    discordance_concerning_context: Optional[bool]
    discordance_escalated: Optional[bool]
    autopilot_action_id: Optional[int]
    autopilot_action_type: Optional[str]
    autopilot_policy_decision: Optional[str]
    decision_event_id: Optional[int]
    attestation_record_id: Optional[int]
    final_response: Optional[str]
    response_source: Optional[Literal["aika_direct", "agents", "aika_react_tools"]]
    is_fallback: Optional[bool]
    fallback_type: Optional[Literal["rate_limit", "model_error"]]
    retry_after_ms: Optional[int]
    execution_id: Optional[str]
    execution_path: List[str]
    agents_invoked: List[str]
    errors: List[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processing_time_ms: Optional[float]
