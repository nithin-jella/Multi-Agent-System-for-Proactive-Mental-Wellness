"""Unified Aika Orchestrator Graph - LangGraph with Aika as First Decision Node.

This module is the assembly point for the unified Aika orchestrator.  All
node logic, prompt construction, routing, and background tasks now live in
dedicated sub-modules under ``app/agents/aika/``.  This file only wires those
pieces together into a LangGraph ``StateGraph`` and exposes the two public
factory functions below.

Real-time Graph Architecture:
    START -> aika_decision_node
                 |
                 |--[high/critical]--> parallel_crisis (TCA || CMA, async fan-out)
                 |                           |
                 |--[moderate]-----> execute_tca (TCA only)
                 |                           |
                 |--[analytics]----> execute_ia  |
                 |                      |       |
                 '--[direct]---> END    '-------'--> synthesize --> END

Safety Triage Agent (STA) - Post-Conversation Background Task:
    STA does NOT participate in the real-time graph.  It runs separately:
    - Automatically triggered via asyncio.create_task() when a conversation ends.
    - Manually triggerable via the trigger_conversation_analysis tool.
    - Performs deep clinical analysis: risk trend, PHQ-9/GAD-7/DASS-21 screening,
      psychologist report, and CMA referral recommendation.
    - Results persisted to ConversationRiskAssessment and ScreeningProfile tables.

Sub-module map:
    aika/constants.py        Static data — crisis keywords, smalltalk vocab.
    aika/message_classifier.py  Pure classification helpers.
    aika/prompt_builder.py   Prompt construction helpers.
    aika/decision_node.py    aika_decision_node — first orchestrator node.
    aika/background_tasks.py Fire-and-forget STA analysis + screening update.
    aika/subgraph_nodes.py   TCA, CMA, IA, synthesize node implementations.
    aika/routing.py          Conditional edge functions for the graph.
"""
from __future__ import annotations

import logging
from typing import Any, Optional, TYPE_CHECKING

from langgraph.graph import StateGraph, END

from app.agents.graph_state import AikaOrchestratorState

# ---------------------------------------------------------------------------
# Re-export extracted nodes and utilities so external import paths remain
# stable.  Any code that does ``from app.agents.aika_orchestrator_graph import
# aika_decision_node`` (or any other name below) will continue to work.
# ---------------------------------------------------------------------------
from app.agents.aika.decision_node import aika_decision_node
from app.agents.aika.background_tasks import trigger_sta_conversation_analysis_background
from app.agents.aika.message_classifier import (
    detect_crisis_keywords as _detect_crisis_keywords,
    is_smalltalk_message as _is_smalltalk_message,
)
from app.agents.aika.prompt_builder import (
    normalize_role as _normalize_user_role,
    format_personal_memory_block as _format_personal_memory_block,
)
from app.agents.aika.subgraph_nodes import (
    _AsyncInvokable,
    parallel_crisis_node,
    execute_tca_subgraph,
    execute_cma_subgraph,
    execute_ia_subgraph,
    synthesize_final_response,
    execute_sta_subgraph,
)
from app.agents.aika.routing import (
    should_invoke_agents,
    ROUTE_CRISIS_PARALLEL,
    ROUTE_TCA,
    ROUTE_IA,
    ROUTE_END,
)

# Lazy TYPE_CHECKING imports kept for IDE/type-checker support only.
if TYPE_CHECKING:
    from app.agents.sta.sta_graph import create_sta_graph
    from app.agents.tca.tca_graph import get_tca_graph
    from app.agents.cma.cma_graph import get_cma_graph
    from app.agents.ia.ia_graph import get_ia_graph

logger = logging.getLogger(__name__)


# ============================================================================
# MODULE-LEVEL AGENT SINGLETON
# Compiled once at FastAPI startup (lifespan) and reused across all requests.
# This avoids re-compiling the graph (and re-binding db sessions) on every
# HTTP request, which was the previous per-request pattern.
# ============================================================================

_compiled_agent: Any = None


def set_aika_agent(agent: Any) -> None:
    """Store the app-lifetime compiled Aika agent.

    Called exactly once from the FastAPI lifespan handler after the database
    and checkpointer have been initialised.  Subsequent requests retrieve the
    cached agent via ``get_aika_agent()`` and inject the per-request
    ``db`` session via ``config["configurable"]["db"]``.
    """
    global _compiled_agent
    _compiled_agent = agent
    logger.info(
        "Aika agent singleton registered: %s",
        type(agent).__name__,
    )


def get_aika_agent() -> Any:
    """Return the cached compiled Aika agent.

    Returns ``None`` before the FastAPI lifespan has completed startup.
    Call sites should guard against this (requests arriving before startup
    are extremely unlikely but possible under heavy load during cold start).
    """
    return _compiled_agent


# ============================================================================
# GRAPH CONSTRUCTION
# ============================================================================

def create_aika_unified_graph() -> StateGraph:
    """Assemble and return the uncompiled Aika orchestrator StateGraph.

    Graph structure::

        START
          |
          +-- aika_decision --+-- [cma]   --> parallel_crisis --> synthesize --> END
                              |-- [tca]   --> execute_tca     --> synthesize --> END
                              |-- [ia]    --> execute_ia       --> synthesize --> END
                              '--[direct]                                     --> END

    STA is NOT a node in this graph.  It runs as a fire-and-forget background
    task (trigger_sta_conversation_analysis_background) when a conversation
    ends, or can be triggered manually via the trigger_conversation_analysis
    tool.  execute_cma (CMA) is not registered as a standalone node; it is
    invoked exclusively inside parallel_crisis_node via asyncio.gather.

    ``db`` is no longer bound at compile time.  Each node receives it at
    invocation time via ``config["configurable"]["db"]``, which allows this
    compiled graph to be shared across all requests.

    Returns:
        Uncompiled StateGraph ready to be compiled with ``.compile()``.
    """
    workflow = StateGraph(AikaOrchestratorState)

    # Nodes accept (state, config) — db is injected via config["configurable"],
    # so no functools.partial binding is needed here.
    workflow.add_node("aika_decision", aika_decision_node)
    workflow.add_node("parallel_crisis", parallel_crisis_node)
    workflow.add_node("execute_tca", execute_tca_subgraph)
    workflow.add_node("execute_ia", execute_ia_subgraph)
    workflow.add_node("synthesize", synthesize_final_response)

    # Entry point
    workflow.set_entry_point("aika_decision")

    # Conditional fan-out after the decision node
    workflow.add_conditional_edges(
        "aika_decision",
        should_invoke_agents,
        {
            ROUTE_CRISIS_PARALLEL: "parallel_crisis",
            ROUTE_TCA: "execute_tca",
            ROUTE_IA: "execute_ia",
            ROUTE_END: END,
        },
    )

    # All non-direct paths converge at synthesize, then exit.
    workflow.add_edge("execute_tca", "synthesize")
    workflow.add_edge("parallel_crisis", "synthesize")
    workflow.add_edge("execute_ia", "synthesize")
    workflow.add_edge("synthesize", END)

    logger.info("Unified Aika orchestrator graph created.")

    return workflow


def create_aika_agent_with_checkpointing(
    checkpointer: Optional[Any] = None,
) -> Any:
    """Compile the Aika agent with optional conversation-persistent checkpointing.

    Intended to be called **once** at FastAPI startup (via the lifespan handler)
    and stored as ``app.state.aika_agent`` or via ``set_aika_agent()``.
    Subsequent requests retrieve the compiled agent with ``get_aika_agent()``
    and inject the per-request ``db`` session through LangGraph's config::

        result = await aika_agent.ainvoke(
            initial_state,
            config={
                "configurable": {
                    "thread_id": f"user_{uid}_session_{sid}",
                    "db": db,               # <-- injected here, not at compile time
                }
            },
        )

    Example — in-memory (testing / dev)::

        from langgraph.checkpoint.memory import MemorySaver
        aika = create_aika_agent_with_checkpointing(MemorySaver())

    Example — Postgres (production)::

        aika = create_aika_agent_with_checkpointing(get_langgraph_checkpointer())

    Args:
        checkpointer: Optional LangGraph checkpointer.  When ``None``, a
                      stateless (no conversation memory) graph is returned.

    Returns:
        CompiledGraph ready for direct invocation.
    """
    workflow = create_aika_unified_graph()

    if checkpointer:
        logger.info(
            "Aika agent compiled WITH checkpointing: %s",
            type(checkpointer).__name__,
        )
        return workflow.compile(checkpointer=checkpointer)

    logger.warning("Aika agent compiled WITHOUT checkpointing (stateless).")
    return workflow.compile()
