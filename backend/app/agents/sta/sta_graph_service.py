"""Service wrapper for STA LangGraph execution.

This module provides a high-level interface for executing the Safety Triage Agent
workflow via LangGraph, including execution tracking and error handling.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.graph_state import STAState
from app.agents.sta.sta_graph import create_sta_graph
from app.agents.execution_tracker import execution_tracker

logger = logging.getLogger(__name__)


class STAGraphService:
    """Execute STA workflow via LangGraph.
    
    This service wraps the STA StateGraph and provides execution tracking,
    state initialization, and error handling.
    
    Example:
        ```python
        async with get_async_db() as db:
            service = STAGraphService(db)
            result = await service.execute(
                user_id=123,
                session_id="abc-123",
                user_hash="hash_456",
                message="I'm feeling really stressed",
                conversation_id=789
            )
            print(f"Risk level: {result['risk_level']}")
            print(f"Next step: {result['next_step']}")
        ```
    """
    
    def __init__(self, db: AsyncSession):
        """Initialize STA graph service.
        
        Args:
            db: Database session for graph node operations
        """
        self.db = db
        self.graph = create_sta_graph(db)
    
    async def execute(
        self,
        user_id: int,
        session_id: str,
        user_hash: str,
        message: str,
        conversation_id: int | None = None
    ) -> STAState:
        """Execute STA graph workflow.
        
        This method:
        1. Starts execution tracking
        2. Initializes graph state
        3. Executes the compiled StateGraph
        4. Completes execution tracking
        5. Returns final state
        
        Args:
            user_id: User database ID
            session_id: Session identifier
            user_hash: Anonymized user identifier
            message: User message to analyze
            conversation_id: Optional conversation ID
            
        Returns:
            Final state after graph execution with all STA outputs
            
        Raises:
            Exception: If graph execution fails
        """
        # Start execution tracking
        execution_id = execution_tracker.start_execution(
            graph_id="sta",
            agent_name="Safety Triage Agent",
            input_data={
                "message": message,
                "user_hash": user_hash,
                "session_id": session_id
            }
        )
        
        # Initialize state
        initial_state: STAState = {
            "user_id": user_id,
            "session_id": session_id,
            "user_hash": user_hash,
            "message": message,
            "conversation_id": conversation_id or 0,
            "execution_id": execution_id,
            "errors": [],
            "execution_path": [],
            "should_intervene": False,
            "case_created": False,
            "started_at": datetime.now()
        }
        
        try:
            # Execute graph
            logger.info(
                f"Executing STA graph for user_hash={user_hash}, "
                f"execution_id={execution_id}"
            )
            
            final_state = await self.graph.ainvoke(initial_state)
            
            # Mark completion timestamp
            final_state["completed_at"] = datetime.now()
            
            # Track execution completion
            execution_success = len(final_state.get("errors", [])) == 0
            execution_tracker.complete_execution(execution_id, success=execution_success)
            
            logger.info(
                f"STA graph execution completed: "
                f"severity={final_state.get("sta_context", {}).get("severity", 'unknown')}, "
                f"next_step={final_state.get("sta_context", {}).get("next_step", 'unknown')}, "
                f"errors={len(final_state.get('errors', []))}"
            )
            
            return final_state
            
        except Exception as e:
            logger.error(f"STA graph execution failed: {e}", exc_info=True)
            execution_tracker.complete_execution(execution_id, success=False)
            
            # Return state with error
            initial_state["errors"].append(f"Graph execution failed: {str(e)}")
            initial_state["completed_at"] = datetime.now()
            initial_state.setdefault("sta_context", {})["next_step"] = "end"  # Safe fallback
            
            raise


async def get_sta_graph_service(db: AsyncSession) -> STAGraphService:
    """FastAPI dependency factory for STAGraphService.
    
    Args:
        db: Database session
        
    Returns:
        Initialized STAGraphService instance
    """
    return STAGraphService(db)
