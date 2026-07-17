"""Service wrapper for TCA LangGraph execution.

This module provides a high-level interface for executing the Therapeutic Coach Agent
workflow via LangGraph, including execution tracking and error handling.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import TCAState
from app.agents.tca.tca_graph import get_tca_graph
from app.agents.execution_tracker import execution_tracker

logger = logging.getLogger(__name__)


class TCAGraphService:
    """Execute TCA workflow via LangGraph.
    
    This service wraps the TCA StateGraph and provides execution tracking,
    state initialization, and error handling.
    
    Example:
        ```python
        async with get_async_db() as db:
            service = TCAGraphService(db)
            result = await service.execute(
                user_id=123,
                session_id="abc-123",
                user_hash="hash_456",
                message="I'm feeling really stressed",
                conversation_id=789,
                severity="moderate",
                intent="anxiety",
                triage_assessment_id=456
            )
            print(f"Intervention type: {result['intervention_type']}")
            print(f"Plan ID: {result['intervention_plan_id']}")
        ```
    """
    
    def __init__(self, db: AsyncSession):
        """Initialize TCA graph service.
        
        Args:
            db: Database session for graph node operations
        """
        self.db = db
        self.graph = get_tca_graph()
    
    async def execute(
        self,
        user_id: int,
        session_id: str,
        user_hash: str,
        message: str,
        conversation_id: int | None = None,
        severity: str = "moderate",
        intent: str = "general",
        triage_assessment_id: int | None = None
    ) -> TCAState:
        """Execute TCA graph workflow.
        
        This method:
        1. Starts execution tracking
        2. Initializes graph state with STA triage outputs
        3. Executes the compiled StateGraph
        4. Completes execution tracking
        5. Returns final state with intervention plan
        
        Args:
            user_id: User database ID
            session_id: Session identifier
            user_hash: Anonymized user identifier
            message: User message for coaching
            conversation_id: Optional conversation ID
            severity: Risk severity from STA (low/moderate/high/critical)
            intent: Detected intent from STA (e.g., "anxiety", "overwhelmed")
            triage_assessment_id: Database ID of STA triage assessment
            
        Returns:
            Final state after graph execution with intervention plan
            
        Raises:
            Exception: If graph execution fails
        """
        # Start execution tracking
        execution_id = execution_tracker.start_execution(
            graph_id="tca",
            agent_name="Therapeutic Coach Agent",
            input_data={
                "message": message,
                "user_hash": user_hash,
                "session_id": session_id,
                "severity": severity,
                "intent": intent
            }
        )
        
        # Initialize state with STA and TCA contexts
        initial_state: TCAState = {
            "user_id": user_id,
            "session_id": session_id,
            "user_hash": user_hash,
            "message": message,
            "conversation_id": conversation_id or 0,
            "execution_id": execution_id,
            "errors": [],
            "execution_path": [],
            "started_at": datetime.now(),
            "sta_context": {
                "severity": severity,
                "intent": intent,
            },
            "tca_context": {
                "triage_assessment_id": triage_assessment_id,
                "should_intervene": True,
            }
        }
        
        try:
            # Execute graph
            logger.info(
                f"Executing TCA graph for user_hash={user_hash}, "
                f"severity={severity}, intent={intent}, "
                f"execution_id={execution_id}"
            )
            
            final_state = await self.graph.ainvoke(initial_state, config={"configurable": {"db": self.db}})
            
            # Mark completion timestamp
            final_state["completed_at"] = datetime.now()
            
            # Track execution completion
            execution_success = len(final_state.get("errors", [])) == 0
            execution_tracker.complete_execution(execution_id, success=execution_success)
            
            logger.info(
                f"TCA graph execution completed: "
                f"intervention_type={final_state.get('tca_context', {}).get('intervention_type', 'unknown')}, "
                f"plan_id={final_state.get('tca_context', {}).get('intervention_plan_id', 'none')}, "
                f"errors={len(final_state.get('errors', []))}"
            )
            
            return final_state
            
        except Exception as e:
            logger.error(f"TCA graph execution failed: {e}", exc_info=True)
            execution_tracker.complete_execution(execution_id, success=False)
            
            # Return state with error
            initial_state["errors"].append(f"Graph execution failed: {str(e)}")
            initial_state["completed_at"] = datetime.now()
            
            raise


async def get_tca_graph_service(db: AsyncSession) -> TCAGraphService:
    """FastAPI dependency factory for TCAGraphService.
    
    Args:
        db: Database session
        
    Returns:
        Initialized TCAGraphService
    """
    return TCAGraphService(db)
