"""Enhanced schemas for LangGraph execution state tracking."""

from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class NodeExecutionStatus(str, Enum):
    """Status of node execution."""
    IDLE = "idle"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class EdgeType(str, Enum):
    """Type of edge in the graph."""
    NORMAL = "normal"
    CONDITIONAL = "conditional"

class NodeExecutionState(BaseModel):
    """Runtime execution state for a node."""
    node_id: str
    status: NodeExecutionStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    metrics: Dict[str, Any] = {}

class EdgeExecutionState(BaseModel):
    """Runtime execution state for an edge."""
    edge_id: str
    source: str
    target: str
    edge_type: EdgeType
    condition: Optional[str] = None
    triggered: bool = False
    evaluation_result: Optional[bool] = None

class GraphExecutionState(BaseModel):
    """Complete execution state of a graph."""
    graph_id: str
    execution_id: str
    status: NodeExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    current_node: Optional[str] = None
    nodes: List[NodeExecutionState] = []
    edges: List[EdgeExecutionState] = []
    metrics: Dict[str, Any] = {}

class EnhancedLangGraphNode(BaseModel):
    """Enhanced node with execution state."""
    id: str
    type: str
    data: Dict[str, Any]
    execution_state: Optional[NodeExecutionState] = None

class EnhancedLangGraphEdge(BaseModel):
    """Enhanced edge with execution state and conditional styling."""
    source: str
    target: str
    data: Optional[Dict[str, Any]] = None
    edge_type: EdgeType = EdgeType.NORMAL
    condition: Optional[str] = None
    execution_state: Optional[EdgeExecutionState] = None

class EnhancedLangGraphState(BaseModel):
    """Enhanced graph state with execution tracking."""
    nodes: List[EnhancedLangGraphNode]
    edges: List[EnhancedLangGraphEdge]
    execution_state: Optional[GraphExecutionState] = None
    performance_metrics: Dict[str, Any] = {}