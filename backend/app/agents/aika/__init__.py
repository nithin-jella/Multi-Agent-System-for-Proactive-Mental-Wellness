"""
Aika - The Meta-Agent

Aika (愛佳) is the unified AI consciousness of UGM-AICare.
She orchestrates all four Safety Agent Suite agents based on user role and intent.

Architecture:
- Meta-agent that coordinates STA, TCA, CMA, and IA
- Role-based routing (student, counselor, admin)
- LangGraph-powered orchestration with direct invocation (agentic pattern)
- Unified personality across all interactions

Name meaning:
- 愛 (Ai) = Love, affection
- 佳 (Ka) = Excellent, beautiful

⚠️ IMPORTANT: Use the cached agent singleton, NOT per-request compilation!
  from app.agents.aika_orchestrator_graph import get_aika_agent
  aika = get_aika_agent()  # compiled once at startup, reused per request
  result = await aika.ainvoke(state, config={"configurable": {"thread_id": "...", "db": db}})
"""

# ✅ REMOVED: Legacy AikaOrchestrator - use aika_orchestrator_graph.py instead
from .identity import AIKA_IDENTITY, AIKA_SYSTEM_PROMPTS, AIKA_GREETINGS, AIKA_CAPABILITIES
from .state import AikaState, AikaResponseMetadata
from .tools import get_aika_tools, execute_tool_call

__all__ = [
    # ❌ DEPRECATED: "AikaOrchestrator" - Use create_aika_agent_with_checkpointing instead
    "AIKA_IDENTITY",
    "AIKA_SYSTEM_PROMPTS",
    "AIKA_GREETINGS",
    "AIKA_CAPABILITIES",
    "AikaState",
    "AikaResponseMetadata",
    "get_aika_tools",
    "execute_tool_call",
]
