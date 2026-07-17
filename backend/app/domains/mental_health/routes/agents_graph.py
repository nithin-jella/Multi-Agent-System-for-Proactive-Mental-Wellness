"""LangGraph agent execution endpoints.

This module provides REST API endpoints for executing Safety Agent Suite workflows
via LangGraph StateGraphs. Each agent (STA, TCA, CMA) and the master orchestrator
have dedicated execution endpoints.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.agents.sta.sta_graph_service import STAGraphService
from app.agents.tca.tca_graph_service import TCAGraphService
from app.agents.cma.cma_graph_service import CMAGraphService

from app.agents.ia.ia_graph_service import IAGraphService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agents/graph", tags=["Agent Graphs (LangGraph)"])


# ============================================================================
# Request/Response Models
# ============================================================================

class STAGraphRequest(BaseModel):
    """Request payload for STA graph execution."""
    
    user_id: int = Field(..., description="User database ID")
    session_id: str = Field(..., description="Session identifier")
    user_hash: str = Field(..., description="Anonymized user identifier")
    message: str = Field(..., description="User message to analyze")
    conversation_id: int | None = Field(None, description="Optional conversation ID")


class RiskAssessment(BaseModel):
    """Risk assessment output from STA."""
    
    risk_level: int = Field(..., description="Risk level 0-3")
    risk_score: float = Field(..., description="Normalized risk score 0.0-1.0")
    severity: str = Field(..., description="Severity: low/moderate/high/critical")
    intent: str = Field(..., description="Detected user intent")
    next_step: str = Field(..., description="Routing decision: tca/cma/end")


class STAGraphResponse(BaseModel):
    """Response from STA graph execution."""
    
    success: bool = Field(..., description="Whether execution succeeded without errors")
    execution_id: str = Field(..., description="Unique execution tracking ID")
    execution_path: List[str] = Field(..., description="List of nodes executed")
    risk_assessment: RiskAssessment
    triage_assessment_id: int | None = Field(None, description="Database ID of triage assessment")
    errors: List[str] = Field(default_factory=list, description="Errors encountered during execution")
    execution_time_ms: float | None = Field(None, description="Total execution time in milliseconds")


# ============================================================================
# STA Graph Endpoints
# ============================================================================

@router.post("/sta/execute", response_model=STAGraphResponse, status_code=status.HTTP_200_OK)
async def execute_sta_graph(
    request: STAGraphRequest,
    db: AsyncSession = Depends(get_async_db)
) -> STAGraphResponse:
    """Execute Safety Triage Agent (STA) workflow via LangGraph.
    
    This endpoint runs the full STA state machine:
        ingest_message → apply_redaction → assess_risk → decide_routing
    
    The graph uses the existing SafetyTriageService for classification and
    integrates with ExecutionStateTracker for real-time monitoring.
    
    **Routing Decisions:**
    - `high`/`critical` severity → Routes to CMA (case creation)
    - `moderate` + support needed → Routes to TCA (coaching)
    - `low` → Ends normally (conversation continues)
    
    **Real-time Monitoring:**
    The admin dashboard at `/admin/langgraph` shows real-time execution state
    via WebSocket updates from ExecutionStateTracker.
    
    Args:
        request: STA graph execution request
        db: Database session
        
    Returns:
        Execution result with risk assessment and routing decision
        
    Raises:
        HTTPException: If graph execution fails
        
    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/agents/graph/sta/execute \\
          -H "Content-Type: application/json" \\
          -d '{
            "user_id": 1,
            "session_id": "test-123",
            "user_hash": "hash-123",
            "message": "I want to die",
            "conversation_id": 1
          }'
        ```
    """
    try:
        # Create service and execute graph
        service = STAGraphService(db)
        result = await service.execute(
            user_id=request.user_id,
            session_id=request.session_id,
            user_hash=request.user_hash,
            message=request.message,
            conversation_id=request.conversation_id
        )
        
        # Calculate execution time (safe access with type guards)
        execution_time_ms = None
        started_at = result.get("started_at")
        completed_at = result.get("completed_at")
        if started_at and completed_at:
            delta = completed_at - started_at
            execution_time_ms = delta.total_seconds() * 1000
        
        # Build response
        return STAGraphResponse(
            success=len(result.get("errors", [])) == 0,
            execution_id=result.get("execution_id", "unknown"),
            execution_path=result.get("execution_path", []),
            risk_assessment=RiskAssessment(
                risk_level=result.get("risk_level", 0),
                risk_score=result.get("risk_score", 0.0),
                severity=result.get("severity", "low"),
                intent=result.get("intent", "unknown"),
                next_step=result.get("next_step", "end")
            ),
            triage_assessment_id=result.get("triage_assessment_id"),
            errors=result.get("errors", []),
            execution_time_ms=execution_time_ms
        )
        
    except Exception as e:
        logger.error(f"STA graph execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"STA graph execution failed: {str(e)}"
        )


@router.get("/sta/health", status_code=status.HTTP_200_OK)
async def sta_graph_health() -> Dict[str, Any]:
    """Health check for STA graph endpoint.
    
    Returns:
        Basic health status
    """
    return {
        "status": "healthy",
        "graph": "sta",
        "name": "Safety Triage Agent",
        "version": "1.0.0",
        "langgraph_enabled": True
    }


# ============================================================================
# TCA (Therapeutic Coach Agent) Graph Endpoints
# ============================================================================

class SCAGraphRequest(BaseModel):
    """Request payload for TCA graph execution."""
    
    user_id: int = Field(..., description="User database ID")
    session_id: str = Field(..., description="Session identifier")
    user_hash: str = Field(..., description="Anonymized user identifier")
    message: str = Field(..., description="User message for coaching")
    conversation_id: int | None = Field(None, description="Optional conversation ID")
    severity: str = Field(..., description="Risk severity from STA (low/moderate/high/critical)")
    intent: str = Field(..., description="Detected intent from STA")
    triage_assessment_id: int | None = Field(None, description="Database ID of triage assessment")


class SCAGraphResponse(BaseModel):
    """Response from TCA graph execution."""
    
    success: bool = Field(..., description="Whether execution succeeded without errors")
    execution_id: str = Field(..., description="Unique execution tracking ID")
    execution_path: List[str] = Field(..., description="List of nodes executed")
    
    intervention_type: str | None = Field(None, description="Type of intervention plan")
    intervention_plan_id: int | None = Field(None, description="Database ID of intervention plan")
    plan_persisted: bool = Field(False, description="Whether plan was saved to database")
    
    errors: List[str] = Field(default_factory=list, description="Errors encountered during execution")
    execution_time_ms: float | None = Field(None, description="Total execution time in milliseconds")


@router.post("/tca/execute", response_model=SCAGraphResponse, status_code=status.HTTP_200_OK)
async def execute_sca_graph(
    request: SCAGraphRequest,
    db: AsyncSession = Depends(get_async_db)
) -> SCAGraphResponse:
    """Execute Therapeutic Coach Agent (TCA) workflow via LangGraph.
    
    This endpoint runs the full TCA state machine:
        ingest_triage_signal → determine_intervention_type → generate_plan → 
        safety_review → persist_plan
    
    The graph uses the existing TherapeuticCoachService for CBT-informed coaching
    and integrates with ExecutionStateTracker for real-time monitoring.
    
    **Intervention Types:**
    - `calm_down`: For anxiety/panic situations
    - `break_down_problem`: For overwhelmed/stuck situations
    - `general_coping`: For general stress
    
    **Input Requirements:**
    TCA requires STA outputs (severity, intent) to determine appropriate coaching.
    
    Args:
        request: TCA graph execution request
        db: Database session
        
    Returns:
        Execution result with intervention plan details
        
    Raises:
        HTTPException: If graph execution fails
        
    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/agents/graph/tca/execute \\
          -H "Content-Type: application/json" \\
          -d '{
            "user_id": 1,
            "session_id": "test-123",
            "user_hash": "hash-123",
            "message": "I feel so overwhelmed with everything",
            "conversation_id": 1,
            "severity": "moderate",
            "intent": "overwhelmed",
            "triage_assessment_id": 456
          }'
        ```
    """
    try:
        # Create service and execute graph
        service = TCAGraphService(db)
        result = await service.execute(
            user_id=request.user_id,
            session_id=request.session_id,
            user_hash=request.user_hash,
            message=request.message,
            conversation_id=request.conversation_id,
            severity=request.severity,
            intent=request.intent,
            triage_assessment_id=request.triage_assessment_id
        )
        
        # Calculate execution time
        execution_time_ms = None
        started_at = result.get("started_at")
        completed_at = result.get("completed_at")
        if started_at and completed_at:
            delta = completed_at - started_at
            execution_time_ms = delta.total_seconds() * 1000
        
        # Build response
        return SCAGraphResponse(
            success=len(result.get("errors", [])) == 0,
            execution_id=result.get("execution_id", "unknown"),
            execution_path=result.get("execution_path", []),
            intervention_type=result.get("intervention_type"),
            intervention_plan_id=result.get("intervention_plan_id"),
            plan_persisted=result.get("intervention_plan_id") is not None,
            errors=result.get("errors", []),
            execution_time_ms=execution_time_ms
        )
        
    except Exception as e:
        logger.error(f"TCA graph execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TCA graph execution failed: {str(e)}"
        )


@router.get("/tca/health", status_code=status.HTTP_200_OK)
async def sca_graph_health() -> Dict[str, Any]:
    """Health check for TCA graph endpoint.
    
    Returns:
        Basic health status
    """
    return {
        "status": "healthy",
        "graph": "tca",
        "name": "Therapeutic Coach Agent",
        "version": "1.0.0",
        "langgraph_enabled": True,
        "intervention_types": ["calm_down", "break_down_problem", "general_coping"]
    }


# ============================================================================
# CMA (Case Management Agent) Graph Endpoints
# ============================================================================

class SDAGraphRequest(BaseModel):
    """Request payload for CMA graph execution."""
    
    user_id: int = Field(..., description="User database ID")
    session_id: str = Field(..., description="Session identifier")
    user_hash: str = Field(..., description="Anonymized user identifier")
    message: str = Field(..., description="User message triggering escalation")
    conversation_id: int | None = Field(None, description="Optional conversation ID")
    severity: str = Field(..., description="Risk severity from STA (must be 'high' or 'critical')")
    intent: str = Field(..., description="Detected intent from STA")
    risk_score: float = Field(..., description="Numerical risk score from STA (0.0-1.0)")
    triage_assessment_id: int | None = Field(None, description="Database ID of triage assessment")


class SDAGraphResponse(BaseModel):
    """Response from CMA graph execution."""
    
    success: bool = Field(..., description="Whether execution succeeded without errors")
    execution_id: str = Field(..., description="Unique execution tracking ID")
    execution_path: List[str] = Field(..., description="List of nodes executed")
    
    case_created: bool = Field(False, description="Whether case was created")
    case_id: int | None = Field(None, description="Database ID of created case")
    case_severity: str | None = Field(None, description="Case severity level")
    sla_breach_at: str | None = Field(None, description="ISO timestamp when SLA will breach")
    assigned_to: str | None = Field(None, description="Counsellor assignment info")
    
    errors: List[str] = Field(default_factory=list, description="Errors encountered during execution")
    execution_time_ms: float | None = Field(None, description="Total execution time in milliseconds")


@router.post("/cma/execute", response_model=SDAGraphResponse, status_code=status.HTTP_200_OK)
async def execute_sda_graph(
    request: SDAGraphRequest,
    db: AsyncSession = Depends(get_async_db)
) -> SDAGraphResponse:
    """Execute Case Management Agent (CMA) workflow via LangGraph.
    
    This endpoint runs the full CMA state machine:
        ingest_escalation → create_case → calculate_sla → auto_assign → notify_counsellor
    
    The graph handles high/critical severity cases requiring manual intervention
    by licensed counsellors.
    
    **SLA Policy:**
    - Critical: 1 hour response time
    - High: 4 hours response time
    
    **Requirements:**
    CMA only handles high/critical severity cases. Will return error for low/moderate.
    
    Args:
        request: CMA graph execution request
        db: Database session
        
    Returns:
        Execution result with case details and SLA information
        
    Raises:
        HTTPException: If graph execution fails or severity is invalid
        
    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/agents/graph/cma/execute \\
          -H "Content-Type: application/json" \\
          -d '{
            "user_id": 1,
            "session_id": "test-123",
            "user_hash": "hash-123",
            "message": "I want to end everything",
            "conversation_id": 1,
            "severity": "critical",
            "intent": "crisis",
            "risk_score": 0.95,
            "triage_assessment_id": 456
          }'
        ```
    """
    try:
        # Create service and execute graph
        service = CMAGraphService(db)
        result = await service.execute(
            user_id=request.user_id,
            session_id=request.session_id,
            user_hash=request.user_hash,
            message=request.message,
            conversation_id=request.conversation_id,
            severity=request.severity,
            intent=request.intent,
            risk_score=request.risk_score,
            triage_assessment_id=request.triage_assessment_id
        )
        
        # Calculate execution time
        execution_time_ms = None
        started_at = result.get("started_at")
        completed_at = result.get("completed_at")
        if started_at and completed_at:
            delta = completed_at - started_at
            execution_time_ms = delta.total_seconds() * 1000
        
        # Build response
        return SDAGraphResponse(
            success=len(result.get("errors", [])) == 0,
            execution_id=result.get("execution_id", "unknown"),
            execution_path=result.get("execution_path", []),
            case_created=result.get("case_created", False),
            case_id=result.get("case_id"),
            case_severity=result.get("case_severity"),
            sla_breach_at=result.get("sla_breach_at"),
            assigned_to=result.get("assigned_to"),
            errors=result.get("errors", []),
            execution_time_ms=execution_time_ms
        )
        
    except ValueError as e:
        # Handle severity validation error
        logger.warning(f"Invalid CMA request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"CMA graph execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CMA graph execution failed: {str(e)}"
        )


@router.get("/cma/health", status_code=status.HTTP_200_OK)
async def sda_graph_health() -> Dict[str, Any]:
    """Health check for CMA graph endpoint.
    
    Returns:
        Basic health status
    """
    return {
        "status": "healthy",
        "graph": "cma",
        "name": "Case Management Agent",
        "version": "1.0.0",
        "langgraph_enabled": True,
        "supported_severities": ["high", "critical"],
        "sla_policies": {
            "critical": "1 hour",
            "high": "4 hours"
        }
    }


# ============================================================================
# IA (Insights Agent) Graph Endpoints
# ============================================================================

class IAGraphRequest(BaseModel):
    """Request payload for IA graph execution."""
    
    question_id: str = Field(..., description="ID of allow-listed analytics question")
    start_date: str = Field(..., description="Query start date (ISO format)")
    end_date: str = Field(..., description="Query end date (ISO format)")
    user_hash: str = Field(..., description="Anonymized analyst identifier")


class IAGraphResponse(BaseModel):
    """Response from IA graph execution.
    
    Includes both raw analytics data (Phase 1) and LLM-generated insights (Phase 2).
    """
    
    success: bool = Field(..., description="Whether execution succeeded without errors")
    execution_id: str = Field(..., description="Unique execution tracking ID")
    execution_path: List[str] = Field(..., description="List of nodes executed")
    
    query_validated: bool = Field(..., description="Whether query parameters passed validation")
    consent_validated: bool = Field(..., description="Whether consent was validated")
    privacy_enforced: bool = Field(..., description="Whether privacy safeguards were applied")
    query_completed: bool = Field(..., description="Whether analytics query completed")
    
    # Phase 1: Raw analytics data
    result: Dict[str, Any] | None = Field(None, description="Analytics query results with privacy metadata")
    
    # Phase 2: LLM-generated insights (NEW)
    interpretation: str | None = Field(None, description="Natural language interpretation of results")
    trends: List[Dict[str, Any]] | None = Field(None, description="Identified patterns and trends")
    summary: str | None = Field(None, description="Executive summary of key findings")
    recommendations: List[Dict[str, Any]] | None = Field(None, description="Actionable recommendations for admins")
    pdf_url: str | None = Field(None, description="URL to downloadable PDF report")
    
    privacy_metadata: Dict[str, Any] = Field(default_factory=dict, description="Privacy enforcement metadata")
    errors: List[str] = Field(default_factory=list, description="Errors encountered during execution")
    execution_time_ms: float | None = Field(None, description="Total execution time in milliseconds")
    privacy_metadata: Dict[str, Any] = Field(
        default_factory=lambda: {"k_value": 5, "epsilon_used": 0.0, "delta_used": 0.0},
        description="Privacy safeguard metadata"
    )
    query_name: str = Field(default="", description="Name of the executed query")
    
    errors: List[str] = Field(default_factory=list, description="Errors encountered")
    execution_time_ms: float | None = Field(None, description="Total execution time in milliseconds")


@router.post("/ia/execute", response_model=IAGraphResponse, status_code=status.HTTP_200_OK)
async def execute_ia_graph(
    request: IAGraphRequest,
    db: AsyncSession = Depends(get_async_db)
) -> IAGraphResponse:
    """Execute Insights Agent workflow for privacy-preserving analytics.
    
    This endpoint runs the IA graph workflow:
        ingest_query → validate_consent → apply_k_anonymity → execute_analytics
    
    **Privacy Safeguards:**
    - K-anonymity enforcement (k ≥ 5)
    - Allow-listed queries only
    - Date range validation
    - Consent validation
    
    **Allow-listed Questions:**
    - `crisis_trend`: High/critical risk assessments over time
    - `dropoffs`: Session completion rates
    - `resource_reuse`: Resource recommendation effectiveness
    - `fallback_reduction`: Fallback rate trends
    - `cost_per_helpful`: Cost efficiency metrics
    - `coverage_windows`: Response time coverage
    
    Args:
        request: IA graph execution request
        db: Database session
        
    Returns:
        Analytics query results with privacy safeguards applied
        
    Raises:
        HTTPException: If IA execution fails
        
    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/agents/graph/ia/execute \\
          -H "Content-Type: application/json" \\
          -d '{
            "question_id": "crisis_trend",
            "start_date": "2025-01-01T00:00:00Z",
            "end_date": "2025-01-31T23:59:59Z",
            "user_hash": "analyst-123"
          }'
        ```
    """
    try:
        from datetime import datetime
        
        # Parse dates
        start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(request.end_date.replace('Z', '+00:00'))
        
        # Create service and execute IA graph
        service = IAGraphService(db)
        result = await service.execute(
            question_id=request.question_id,
            start_date=start_date,
            end_date=end_date,
            user_hash=request.user_hash
        )
        
        # Calculate execution time
        execution_time_ms = None
        if result.get("started_at") and result.get("completed_at"):
            delta = result["completed_at"] - result["started_at"]
            execution_time_ms = delta.total_seconds() * 1000
        
        # Build response - map analytics_result to 'result' for frontend compatibility
        analytics_result = result.get("analytics_result", {})
        
        return IAGraphResponse(
            success=len(result.get("errors", [])) == 0,
            execution_id=result.get("execution_id", "unknown"),
            execution_path=result.get("execution_path", []),
            query_validated=result.get("query_validated", False),
            consent_validated=result.get("consent_validated", False),
            privacy_enforced=result.get("privacy_enforced", False),
            query_completed=result.get("query_completed", False),
            result=analytics_result,  # Frontend expects 'result' key
            # Phase 2: LLM-generated insights
            interpretation=result.get("interpretation"),
            trends=result.get("trends"),
            summary=result.get("summary"),
            recommendations=result.get("recommendations"),
            pdf_url=result.get("pdf_url"),
            privacy_metadata={
                "k_value": 5,  # Our k-anonymity threshold
                "epsilon_used": analytics_result.get("differential_privacy_budget_used", 0.0) if analytics_result else 0.0,
                "delta_used": 0.0  # TODO: Implement delta tracking in Phase 3
            },
            errors=result.get("errors", []),
            execution_time_ms=execution_time_ms
        )
        
    except Exception as e:
        logger.error(f"IA graph execution failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"IA graph execution failed: {str(e)}"
        )


@router.get("/ia/health", status_code=status.HTTP_200_OK)
async def ia_graph_health() -> Dict[str, Any]:
    """Health check for IA graph endpoint.
    
    Returns:
        Basic health status
    """
    return {
        "status": "healthy",
        "graph": "ia",
        "name": "Insights Agent",
        "version": "1.0.0",
        "langgraph_enabled": True,
        "privacy_features": ["k-anonymity", "allow-listed queries", "consent validation"]
    }

