from pydantic import BaseModel, ConfigDict, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

# --- Triage Agent Schemas ---

class TriageMessage(BaseModel):
    """Represents a single message in a conversation for triage."""
    role: str
    content: str


class TriageRequest(BaseModel):
    """Request model for richer triage assessments (reserved for future use)."""
    messages: List[TriageMessage]
    user_id: int
    session_id: str


class TriageResponse(BaseModel):
    """Response model for a detailed triage assessment payload."""
    assessment_id: int
    risk_score: float
    confidence_score: float
    severity_level: str
    risk_factors: List[str]
    protective_factors: List[str]
    recommendations: Dict[str, Any]
    escalation: Dict[str, Any]


class TriageClassifyRequest(BaseModel):
    """Lightweight request for the current triage classification endpoint."""
    message: str


class TriageClassifyResponse(BaseModel):
    """Simplified response returned by the triage classification endpoint."""
    classification: str
    recommended_resources: List[Dict[str, Any]]


class LangGraphNode(BaseModel):
    """Node representation for LangGraph state inspection."""
    id: str
    type: str
    data: Dict[str, Any]


class LangGraphEdge(BaseModel):
    """Edge representation for LangGraph state inspection."""
    source: str
    target: str
    data: Optional[Dict[str, Any]] = None


class LangGraphState(BaseModel):
    """Full LangGraph state including nodes and edges."""
    nodes: List[LangGraphNode]
    edges: List[LangGraphEdge]


# --- Command Center Schemas ---

from datetime import datetime
from typing import Optional


class AgentRunBase(BaseModel):
    agent_name: str
    action: str
    status: str
    correlation_id: str


class AgentRun(BaseModel):
    id: int
    agent_name: str
    action: str
    status: str
    correlation_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes = True)


class AgentMessage(BaseModel):
    id: int
    run_id: int
    agent_name: str
    role: str
    message_type: str
    content: str
    metadata: Optional[Dict[str, Any]] = Field(None, alias="meta")  # Map from ORM attribute 'meta'
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AgentStreamEvent(BaseModel):
    type: str
    correlationId: Optional[str] = None
    runId: Optional[int] = None
    agent: Optional[str] = None
    action: Optional[str] = None
    status: Optional[str] = None
    token: Optional[str] = None
    content: Optional[str] = None
    ts: Optional[str] = None
    error: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
