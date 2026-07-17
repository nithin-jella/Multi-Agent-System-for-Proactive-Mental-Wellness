"""Mental Health domain services.

Historically this package acted as an "aggregator" that eagerly imported many
submodules for convenience.

That pattern can create circular imports when another module imports a specific
submodule (e.g., `app.domains.mental_health.services.agent_orchestrator`). Python
must initialize the package first, which would in turn import other services.

To keep imports deterministic and avoid circulars, this file exposes a lazy
import surface while preserving the older `from ...services import <module>`
convenience.
"""

from __future__ import annotations

import importlib
from typing import Any


__all__ = [
    # AI Agents
    "agent_command",
    "agent_integration",
    "agent_orchestrator",
    # Chat & Context
    # "chat_processing",  # TODO: Uncomment when implemented
    "dialogue_orchestrator_service",
    "personal_context",
    "tool_calling",
    # Clinical
    "intervention_plan_service",
    "insights_service",
    # Gamification
    "quest_analytics_service",
    "quest_engine_service",
    "rewards_calculator_service",
    "user_stats_service",
    # Campaigns
    "ai_campaign_generator",
    "campaign_execution_service",
    "campaign_service",
    "campaign_trigger_evaluator",
]


def __getattr__(name: str) -> Any:
    if name in __all__:
        return importlib.import_module(f"{__name__}.{name}")
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(list(globals().keys()) + __all__)
