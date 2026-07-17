"""
Aika State Management

Defines the state structure passed through Aika's orchestration graph.
"""

from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


class AikaState(BaseModel):
    """
    State passed through Aika's LangGraph orchestration.
    
    This state carries context through the entire agent workflow,
    allowing each agent to access and update relevant information.
    """
    
    # User context
    user_id: int
    user_role: Literal["user", "counselor", "admin"] = Field(
        description="User's role in the system"
    )
    session_id: Optional[str] = None
    conversation_id: Optional[str] = Field(
        default=None,
        description="Unique conversation identifier for tracking context"
    )
    
    # Input
    message: str = Field(description="User's input message")
    conversation_history: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Conversation history for context"
    )
    
    # Intent classification
    intent: Optional[str] = Field(
        default=None,
        description="Classified user intent (e.g., 'student_chat', 'admin_query')"
    )
    intent_confidence: Optional[float] = None
    
    # Context
    personal_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="User's personal context (wellness state, history, etc.)"
    )
    system_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="System-level context (platform stats, alerts, etc.)"
    )
    
    # Agent outputs
    triage_result: Optional[Dict] = Field(
        default=None,
        description="Safety Triage Agent assessment"
    )
    coaching_result: Optional[Dict] = Field(
        default=None,
        description="Therapeutic Coach Agent response"
    )
    service_result: Optional[Dict] = Field(
        default=None,
        description="Case Management Agent actions"
    )
    insights_result: Optional[Dict] = Field(
        default=None,
        description="Insights Agent analytics"
    )
    
    # Admin-specific results
    admin_query_result: Optional[Dict] = None
    admin_action_result: Optional[Dict] = None
    confirmation_required: bool = False
    
    # Counselor-specific results
    counselor_cases_result: Optional[Dict] = None
    counselor_insights_result: Optional[Dict] = None
    
    # Final output
    response: Optional[str] = Field(
        default=None,
        description="Final response to user"
    )
    actions_taken: List[str] = Field(
        default_factory=list,
        description="List of actions taken by agents"
    )
    escalation_needed: bool = Field(
        default=False,
        description="Whether human intervention is needed"
    )
    escalation_reason: Optional[str] = None
    
    # Metadata
    processing_time_ms: Optional[float] = None
    agents_invoked: List[str] = Field(
        default_factory=list,
        description="List of agents that processed this request"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Risk assessment (for students)
    risk_level: Optional[Literal["low", "moderate", "high", "critical"]] = Field(
        default="low",
        description="Risk level assessment from Safety Triage Agent"
    )
    risk_factors: List[str] = Field(default_factory=list)
    
    # Intervention plan (if created)
    intervention_plan: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Intervention plan created by TCA if user needs structured guidance"
    )
    
    # Error handling
    errors: List[str] = Field(
        default_factory=list,
        description="Any errors encountered during processing"
    )
    
    class Config:
        arbitrary_types_allowed = True


class AikaResponseMetadata(BaseModel):
    """Metadata about Aika's response for debugging and analytics"""
    
    session_id: str
    user_role: str
    intent: Optional[str]
    agents_invoked: List[str]
    processing_time_ms: float
    risk_level: Optional[str] = None
    escalation_needed: bool = False
    actions_taken: List[str]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
