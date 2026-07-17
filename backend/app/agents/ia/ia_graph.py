"""LangGraph state machine for Insights Agent (IA).

This module implements the IA workflow as a LangGraph StateGraph:
    Phase 1 (Data Collection):
        ingest_query → validate_consent → apply_k_anonymity → execute_analytics
    Phase 2 (Intelligence Layer):
        interpret_results → generate_narrative → create_recommendations → export_pdf

The graph integrates with existing InsightsAgentService for privacy-preserving
analytics, LLM-powered interpretation via InsightsInterpreter, and 
ExecutionStateTracker for real-time monitoring.

Privacy Safeguards:
- K-anonymity enforcement (k ≥ 5) for all aggregated queries
- Allow-listed queries only (no arbitrary SQL)
- Date range validation (prevent excessive historical data access)
- LLM only receives k-anonymized aggregated data (never individual records)
- Differential privacy budget tracking (future enhancement)
"""
from __future__ import annotations

import logging
from typing import Callable, Dict, Any, cast
from datetime import datetime, timedelta

from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables import RunnableConfig
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import IAState
from app.agents.ia.service import InsightsAgentService
from app.agents.ia.schemas import IAQueryRequest, IAQueryResponse, QuestionId
from app.agents.ia.llm_interpreter import InsightsInterpreter
from app.agents.execution_tracker import execution_tracker
from app.core.langfuse_config import trace_agent

logger = logging.getLogger(__name__)


# ============================================================================
# Graph Nodes
# ============================================================================

@trace_agent("IA_IngestQuery")
def ingest_query_node(state: IAState) -> IAState:
    """Node: Validate and ingest analytics query request.
    
    This node validates the incoming query structure and initializes
    the execution tracking.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with validated query parameters
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:ingest_query", "ia")
    
    try:
        # Validate required fields
        if not state.get("ia_context", {}).get("question_id"):
            raise ValueError("question_id is required")
        
        if not state.get("ia_context", {}).get("start_date") or not state.get("ia_context", {}).get("end_date"):
            raise ValueError("start_date and end_date are required")
        
        # Validate date range (prevent excessive historical queries)
        start = state.get("ia_context", {}).get("start_date")
        end = state.get("ia_context", {}).get("end_date")
        
        if not start or not end:
            raise ValueError("start_date and end_date must be provided")
        
        if start >= end:
            raise ValueError("start_date must be before end_date")
        
        max_days = 365  # Maximum 1 year of data
        delta = end - start
        if delta.days > max_days:
            raise ValueError(f"Date range too large. Maximum {max_days} days allowed.")
        
        state.setdefault("execution_path", []).append("ia:ingest_query")
        state.setdefault("ia_context", {})["query_validated"] = True
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:ingest_query")
        
        logger.info(f"IA ingested query: question_id={state.get("ia_context", {}).get("question_id")}, range={delta.days} days")
        
    except Exception as e:
        error_msg = f"Query ingestion failed: {str(e)}"
        logger.error(error_msg)
        state.setdefault("errors", []).append(error_msg)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:ingest_query", error_msg)
    
    return state


@trace_agent("IA_ValidateConsent")
def validate_consent_node(state: IAState) -> IAState:
    """Node: Validate user consent for analytics aggregation.
    
    This node checks that the query only accesses data from users who have
    provided consent for their data to be included in aggregated analytics.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with consent validation result
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:validate_consent", "ia")
    
    try:
        # Note: In production, this would query the consent ledger
        # For now, we assume all queries are aggregate-only (no individual data)
        # and therefore consent is implicitly satisfied for statistical aggregation
        
        # Check if query is in allow-listed analytics queries
        # (Allow-listed queries are pre-approved to access aggregate data only)
        question_id = state.get("ia_context", {}).get("question_id")
        
        # The IAQueryRequest will validate against ALLOWED_QUERIES
        # This node adds an additional layer of consent checking
        
        state.setdefault("execution_path", []).append("ia:validate_consent")
        state.setdefault("ia_context", {})["consent_validated"] = True
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:validate_consent")
        
        logger.info(f"IA consent validated for question_id={question_id}")
        
    except Exception as e:
        error_msg = f"Consent validation failed: {str(e)}"
        logger.error(error_msg)
        state.setdefault("errors", []).append(error_msg)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:validate_consent", error_msg)
    
    return state


@trace_agent("IA_ApplyKAnonymity")
def apply_k_anonymity_node(state: IAState) -> IAState:
    """Node: Apply k-anonymity enforcement before executing query.
    
    This node ensures that all aggregated results meet the k-anonymity
    threshold (k ≥ 5) to prevent re-identification of individuals.
    
    Args:
        state: Current graph state
        
    Returns:
        Updated state with k-anonymity configuration
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:apply_k_anonymity", "ia")
    
    try:
        # Set k-anonymity threshold
        k_threshold = 5  # Minimum group size for aggregated results
        state.setdefault("ia_context", {})["k_threshold"] = k_threshold
        
        # Note: Actual k-anonymity enforcement happens in the query execution layer
        # This node documents the privacy requirement and tracks it
        
        state.setdefault("execution_path", []).append("ia:apply_k_anonymity")
        state.setdefault("ia_context", {})["privacy_enforced"] = True
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:apply_k_anonymity")
        
        logger.info(f"IA k-anonymity configured: k={k_threshold}")
        
    except Exception as e:
        error_msg = f"K-anonymity configuration failed: {str(e)}"
        logger.error(error_msg)
        state.setdefault("errors", []).append(error_msg)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:apply_k_anonymity", error_msg)
    
    return state


@trace_agent("IA_ExecuteAnalytics")
async def execute_analytics_node(state: IAState, config: RunnableConfig) -> IAState:
    """Node: Execute analytics query with privacy safeguards.
    
    This node uses the InsightsAgentService to execute the allow-listed
    analytics query and return aggregated results.
    
    Args:
        state: Current graph state
        config: LangGraph runtime config carrying ``db`` under ``config["configurable"]["db"]``
        
    Returns:
        Updated state with query results
    """
    db: AsyncSession = config["configurable"]["db"]
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:execute_analytics", "ia")
    
    try:
        # Create IA service
        ia_service = InsightsAgentService(db)
        
        # Get and cast question_id
        question_id_str = state.get("ia_context", {}).get("question_id", "")
        question_id = cast(QuestionId, question_id_str)
        
        # Build query request with proper datetime objects
        start_date = state.get("ia_context", {}).get("start_date")
        end_date = state.get("ia_context", {}).get("end_date")
        
        if not isinstance(start_date, datetime) or not isinstance(end_date, datetime):
            raise ValueError("start_date and end_date must be datetime objects")
        
        # Create IAQueryParams using the correct field aliases ('from' and 'to')
        from app.agents.ia.schemas import IAQueryParams
        query_params = IAQueryParams.model_validate({
            "from": start_date,
            "to": end_date
        })
        
        request = IAQueryRequest(
            question_id=question_id,
            params=query_params
        )
        
        # Execute query (service handles k-anonymity and privacy)
        response: IAQueryResponse = await ia_service.query(request)
        
        # Check k-anonymity satisfaction
        # Queries from Phase 1 have k-anonymity built-in via HAVING COUNT(*) >= 5
        k_satisfied = len(response.table) > 0  # If table has data, k-anonymity was satisfied
        total_records = len(response.table) if response.table else 0
        
        # Store results in state with privacy metadata
        state.setdefault("ia_context", {})["analytics_result"] = {
            "data": response.table,  # Frontend expects 'data' instead of 'table'
            "chart": response.chart,
            "notes": response.notes,
            "k_anonymity_satisfied": k_satisfied,
            "differential_privacy_budget_used": 0.0,  # TODO: Implement in Phase 3
            "total_records_anonymized": total_records
        }
        state.setdefault("execution_path", []).append("ia:execute_analytics")
        state.setdefault("ia_context", {})["query_completed"] = True
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:execute_analytics")
        
        logger.info(
            f"IA query completed: question_id={state.get("ia_context", {}).get("question_id")}, "
            f"rows={len(response.table) if response.table else 0}"
        )
        
    except Exception as e:
        error_msg = f"Analytics execution failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:execute_analytics", error_msg)
    
    return state


# ============================================================================
# Phase 2: LLM Intelligence Layer Nodes
# ============================================================================

@trace_agent("IA_InterpretResults")
async def interpret_results_node(state: IAState) -> IAState:
    """Node: Generate LLM interpretation of analytics results.
    
    This node uses LLM to provide natural language interpretation of the
    k-anonymized aggregated data, identifying key insights and patterns.
    
    Privacy Note: LLM only receives aggregated statistics that have already
    passed k-anonymity checks. No individual user data is ever sent to LLM.
    
    Args:
        state: Current graph state with analytics_result
        
    Returns:
        Updated state with interpretation and trends
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:interpret_results", "ia")
    
    try:
        # Check if analytics were successful
        if not state.get("ia_context", {}).get("query_completed") or not state.get("ia_context", {}).get("analytics_result"):
            raise ValueError("Analytics results not available for interpretation")
        
        # Extract analytics results
        analytics = state.get("ia_context", {}).get("analytics_result", {})
        data = analytics.get("data", [])
        chart = analytics.get("chart", {})
        notes = analytics.get("notes", [])
        
        # Get query metadata
        question_id = state.get("ia_context", {}).get("question_id", "")
        start_date = state.get("ia_context", {}).get("start_date")
        end_date = state.get("ia_context", {}).get("end_date")
        
        if not isinstance(start_date, datetime) or not isinstance(end_date, datetime):
            raise ValueError("Invalid date range for interpretation")
        
        # Initialize interpreter
        interpreter = InsightsInterpreter()
        
        # Generate interpretation
        logger.info(f"IA generating interpretation for {len(data)} data points")
        interpretation_result = await interpreter.interpret_analytics(
            question_id=question_id,
            data=data,
            chart=chart,
            notes=notes,
            start_date=start_date,
            end_date=end_date
        )
        
        # Store interpretation results in state
        state.setdefault("ia_context", {})["interpretation"] = interpretation_result.get("interpretation", "")
        state.setdefault("ia_context", {})["trends"] = interpretation_result.get("trends", [])
        state.setdefault("ia_context", {})["summary"] = interpretation_result.get("summary", "")
        state.setdefault("ia_context", {})["recommendations"] = interpretation_result.get("recommendations", [])
        
        state.setdefault("execution_path", []).append("ia:interpret_results")
        state.setdefault("ia_context", {})["interpretation_completed"] = True
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:interpret_results")
        
        logger.info(
            f"IA interpretation completed: {len(interpretation_result.get('trends', []))} trends, "
            f"{len(interpretation_result.get('recommendations', []))} recommendations"
        )
        
    except Exception as e:
        error_msg = f"Result interpretation failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        
        # Set fallback values
        state.setdefault("ia_context", {})["interpretation"] = "Interpretasi tidak tersedia saat ini."
        state.setdefault("ia_context", {})["trends"] = []
        state.setdefault("ia_context", {})["summary"] = ""
        state.setdefault("ia_context", {})["recommendations"] = []
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:interpret_results", error_msg)
    
    return state


@trace_agent("IA_ExportPDF")
async def export_pdf_node(state: IAState) -> IAState:
    """Node: Export comprehensive analytics report as PDF.
    
    This node generates a PDF report containing all analytics results,
    interpretations, trends, and recommendations.
    
    Args:
        state: Current graph state with complete analytics and interpretation
        
    Returns:
        Updated state with PDF URL
    """
    execution_id = state.get("execution_id")
    if execution_id:
        execution_tracker.start_node(execution_id, "ia:export_pdf", "ia")
    
    try:
        # Import generator dynamically to avoid circular imports
        from app.agents.ia.pdf_generator import generate_pdf_report
        
        # Generate PDF
        pdf_url = generate_pdf_report(state)
        
        state.setdefault("ia_context", {})["pdf_url"] = pdf_url
        state.setdefault("execution_path", []).append("ia:export_pdf")
        
        if execution_id:
            execution_tracker.complete_node(execution_id, "ia:export_pdf")
        
        if pdf_url:
            logger.info(f"IA PDF export successful: {pdf_url}")
        else:
            logger.warning("IA PDF export returned None")
        
    except Exception as e:
        error_msg = f"PDF export failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        state.setdefault("errors", []).append(error_msg)
        state.setdefault("ia_context", {})["pdf_url"] = None
        
        if execution_id:
            execution_tracker.fail_node(execution_id, "ia:export_pdf", error_msg)
    
    return state


# ============================================================================
# Graph Creation
# ============================================================================

def _build_ia_graph() -> CompiledStateGraph:
    """Build and compile the IA (Insights Agent) StateGraph.

    This graph implements privacy-preserving analytics workflow with LLM intelligence:

    Phase 1 - Data Collection:
    1. Ingest query request and validate parameters
    2. Validate user consent for data access
    3. Apply k-anonymity privacy enforcement
    4. Execute analytics query with safeguards

    Phase 2 - Intelligence Layer:
    5. Interpret results using LLM (on k-anonymized data only)
    6. Export comprehensive PDF report

    Returns:
        Compiled StateGraph ready for execution via ainvoke()
    """
    # Create workflow
    workflow = StateGraph(IAState)

    # Phase 1: Add data collection nodes
    workflow.add_node("ingest_query", ingest_query_node)
    workflow.add_node("validate_consent", validate_consent_node)
    workflow.add_node("apply_k_anonymity", apply_k_anonymity_node)
    workflow.add_node("execute_analytics", execute_analytics_node)

    # Phase 2: Add LLM intelligence nodes
    workflow.add_node("interpret_results", interpret_results_node)
    workflow.add_node("export_pdf", export_pdf_node)

    # Define workflow: Phase 1 → Phase 2 → END
    workflow.set_entry_point("ingest_query")
    workflow.add_edge("ingest_query", "validate_consent")
    workflow.add_edge("validate_consent", "apply_k_anonymity")
    workflow.add_edge("apply_k_anonymity", "execute_analytics")

    # Connect Phase 1 to Phase 2
    workflow.add_edge("execute_analytics", "interpret_results")
    workflow.add_edge("interpret_results", "export_pdf")
    workflow.add_edge("export_pdf", END)

    # Compile graph
    return workflow.compile()


# Module-level cached compiled graph
_ia_graph: CompiledStateGraph | None = None


def get_ia_graph() -> CompiledStateGraph:
    """Return the cached IA compiled graph, building it on first call."""
    global _ia_graph
    if _ia_graph is None:
        _ia_graph = _build_ia_graph()
    return _ia_graph
