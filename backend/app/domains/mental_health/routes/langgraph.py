"""Admin endpoints for inspecting LangGraph agents."""
from typing import Iterable, List

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from app.agents.safety_graph_specs import (
    IA_GRAPH_SPEC,
    SCA_GRAPH_SPEC,
    SDA_GRAPH_SPEC,
    STA_GRAPH_SPEC,
)
from app.agents.execution_tracker import execution_tracker
from app.dependencies import get_admin_user
from app.models import User
from app.domains.mental_health.schemas.agents import LangGraphEdge, LangGraphNode, LangGraphState
from app.domains.mental_health.schemas.enhanced_agents import (
    EnhancedLangGraphState, 
    EnhancedLangGraphNode, 
    EnhancedLangGraphEdge,
    EdgeType
)

router = APIRouter(prefix="/api/v1/admin/agents-config", tags=["Admin"])

GRAPH_SPECS = {
    spec["id"]: spec
    for spec in (
    STA_GRAPH_SPEC,
    SCA_GRAPH_SPEC,
    SDA_GRAPH_SPEC,
    IA_GRAPH_SPEC,
    )
}


def _flatten_specs(specs: Iterable[dict]) -> tuple[List[EnhancedLangGraphNode], List[EnhancedLangGraphEdge]]:
    nodes: List[EnhancedLangGraphNode] = []
    edges: List[EnhancedLangGraphEdge] = []

    for spec in specs:
        agent_id = spec["id"]
        prefix = f"{agent_id}::"
        for node_def in spec.get("nodes", []):
            node_id = prefix + node_def["id"]
            node_data = {
                "label": node_def.get("label", node_def["id"].replace("_", " ").title()),
                "agent": spec.get("name", agent_id.title()),
                "agentId": agent_id,
                "description": node_def.get("description", ""),
                "column": node_def.get("column", 0),
                "row": node_def.get("row", 0),
            }
            nodes.append(
                EnhancedLangGraphNode(
                    id=node_id,
                    type=node_def.get("type", "process"),
                    data=node_data,
                )
            )

        for edge_def in spec.get("edges", []):
            edge_type = EdgeType.CONDITIONAL if edge_def.get("condition") else EdgeType.NORMAL
            edges.append(
                EnhancedLangGraphEdge(
                    source=prefix + edge_def["source"],
                    target=prefix + edge_def["target"],
                    edge_type=edge_type,
                    condition=edge_def.get("condition"),
                    data={"agentId": agent_id, "label": edge_def.get("label")}
                    if edge_def.get("label")
                    else {"agentId": agent_id},
                )
            )

    return nodes, edges


@router.get("", response_model=LangGraphState)
async def get_langgraph_state(
    agent: str | None = Query(None, description="Filter nodes by agent id"),
    admin_user: User = Depends(get_admin_user),
) -> LangGraphState:
    """Return the LangGraph topology for the configured agents."""

    if agent:
        spec = GRAPH_SPECS.get(agent)
        specs = [spec] if spec else []
    else:
        specs = GRAPH_SPECS.values()

    # Convert enhanced types back to basic types for compatibility
    enhanced_nodes, enhanced_edges = _flatten_specs(specs)
    
    basic_nodes = [
        LangGraphNode(id=node.id, type=node.type, data=node.data)
        for node in enhanced_nodes
    ]
    
    basic_edges = [
        LangGraphEdge(source=edge.source, target=edge.target, data=edge.data)
        for edge in enhanced_edges
    ]
    
    return LangGraphState(nodes=basic_nodes, edges=basic_edges)


@router.get("/enhanced", response_model=EnhancedLangGraphState)
async def get_enhanced_langgraph_state(
    agent: str | None = Query(None, description="Filter nodes by agent id"),
    admin_user: User = Depends(get_admin_user),
) -> EnhancedLangGraphState:
    """Return enhanced LangGraph topology with execution state and metrics."""

    if agent:
        spec = GRAPH_SPECS.get(agent)
        specs = [spec] if spec else []
    else:
        specs = GRAPH_SPECS.values()

    nodes, edges = _flatten_specs(specs)
    
    # Add execution state to nodes
    node_metrics = execution_tracker.get_node_metrics()
    for node in nodes:
        if node.id in node_metrics:
            node.data["metrics"] = node_metrics[node.id]
    
    # Get current execution state
    active_executions = execution_tracker.get_active_executions()
    current_execution = active_executions[0] if active_executions else None
    
    return EnhancedLangGraphState(
        nodes=nodes,
        edges=edges, 
        execution_state=current_execution,
        performance_metrics=node_metrics
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time execution state updates."""
    await websocket.accept()
    
    async def send_update(event_type: str, execution_state):
        """Send execution state updates to client."""
        try:
            await websocket.send_json({
                "event": event_type,
                "data": execution_state.model_dump() if hasattr(execution_state, 'model_dump') else execution_state
            })
        except Exception as e:
            print(f"Error sending WebSocket update: {e}")
    
    # Subscribe to execution tracker updates
    execution_tracker.subscribe(send_update)
    
    try:
        # Send current state immediately
        active_executions = execution_tracker.get_active_executions()
        if active_executions:
            await send_update("current_state", active_executions[0])
            
        # Keep connection alive
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        execution_tracker.unsubscribe(send_update)
