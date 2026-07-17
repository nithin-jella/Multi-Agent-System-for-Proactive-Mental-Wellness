"""Service wrapper for IA LangGraph execution.

This module provides a high-level interface for executing the Insights Agent
workflow via LangGraph, including execution tracking and privacy enforcement.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import IAState
from app.agents.ia.ia_graph import get_ia_graph
from app.agents.execution_tracker import execution_tracker

logger = logging.getLogger(__name__)


class IAGraphService:
    """Execute IA workflow via LangGraph.
    
    This service wraps the IA StateGraph and provides execution tracking,
    state initialization, and privacy enforcement.
    
    Example:
        ```python
        async with get_async_db() as db:
            service = IAGraphService(db)
            result = await service.execute(
                question_id="crisis_trend",
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 1, 31),
                user_hash="analyst-123"
            )
            print(f"Chart: {result['analytics_result']['chart']}")
            print(f"Table: {result['analytics_result']['table']}")
        ```
    """
    
    def __init__(self, db: AsyncSession):
        """Initialize IA graph service.
        
        Args:
            db: Database session for graph node operations
        """
        self.db = db
        self.graph = get_ia_graph()
    
    async def execute(
        self,
        question_id: str,
        start_date: datetime,
        end_date: datetime,
        user_hash: str,
        execution_context: Dict[str, Any] | None = None
    ) -> Dict[str, Any]:
        """Execute IA graph workflow.
        
        This method:
        1. Starts execution tracking
        2. Initializes graph state
        3. Executes the compiled StateGraph (privacy-preserving analytics)
        4. Completes execution tracking
        5. Returns final state with analytics results
        
        Args:
            question_id: ID of allow-listed analytics question
            start_date: Query start date
            end_date: Query end date
            user_hash: Anonymized user/analyst identifier
            execution_context: Optional additional context
            
        Returns:
            Final state after graph execution with analytics results
            
        Raises:
            Exception: If graph execution fails
        """
        # Start execution tracking
        execution_id = execution_tracker.start_execution(
            graph_id="ia",
            agent_name="Insights Agent",
            input_data={
                "question_id": question_id,
                "date_range": f"{start_date.isoformat()} to {end_date.isoformat()}",
                "user_hash": user_hash
            }
        )
        
        # Initialize state with nested ia_context
        initial_state: Dict[str, Any] = {
            "ia_context": {
                "question_id": question_id,
                "start_date": start_date,
                "end_date": end_date,
                "user_hash": user_hash,
                "query_validated": False,
                "consent_validated": False,
                "privacy_enforced": False,
                "query_completed": False,
            },
            "execution_id": execution_id,
            "errors": [],
            "execution_path": [],
            "started_at": datetime.now()
        }
        
        # Merge additional context if provided
        if execution_context:
            initial_state.update(execution_context)
        
        try:
            # Execute graph
            logger.info(
                f"Executing IA graph: question_id={question_id}, "
                f"execution_id={execution_id}"
            )
            
            # Cast to IAState for type checker
            final_state_raw = await self.graph.ainvoke(cast(IAState, initial_state), config={"configurable": {"db": self.db}})
            final_state = cast(Dict[str, Any], final_state_raw)
            
            # Mark completion timestamp
            final_state["completed_at"] = datetime.now()
            
            # Track execution completion
            execution_success = len(final_state.get("errors", [])) == 0
            execution_tracker.complete_execution(execution_id, success=execution_success)
            
            logger.info(
                f"IA graph execution completed: "
                f"question_id={final_state.get('ia_context', {}).get('question_id')}, "
                f"query_completed={final_state.get('ia_context', {}).get('query_completed', False)}, "
                f"errors={len(final_state.get('errors', []))}"
            )
            
            return final_state
            
        except Exception as e:
            logger.error(f"IA graph execution failed: {e}", exc_info=True)
            execution_tracker.complete_execution(execution_id, success=False)
            
            # Return state with error
            initial_state["errors"].append(f"Graph execution failed: {str(e)}")
            initial_state["completed_at"] = datetime.now()
            
            raise
    
    async def log_interaction_metrics(
        self,
        user_role: str,
        intent: str | None,
        risk_level: str | None,
        agents_invoked: list[str],
        processing_time_ms: float | None
    ) -> None:
        """Log anonymized interaction metrics for research.
        
        This is a placeholder for future IA analytics logging.
        Currently does nothing to avoid blocking the main flow.
        
        Args:
            user_role: Role of user (user/admin/researcher)
            intent: Classified intent of interaction
            risk_level: Risk level from triage
            agents_invoked: List of agents invoked
            processing_time_ms: Total processing time
        """
        # TODO: Implement anonymized metrics collection with differential privacy
        # For now, just log silently
        logger.debug(
            f"IA metrics logged: role={user_role}, intent={intent}, "
            f"risk={risk_level}, agents={len(agents_invoked)}, time={processing_time_ms}ms"
        )


async def get_ia_graph_service(db: AsyncSession) -> IAGraphService:
    """FastAPI dependency factory for IAGraphService.
    
    Args:
        db: Database session
        
    Returns:
        Initialized IAGraphService instance
    """
    return IAGraphService(db)
