"""
Mental Health Domain Routes

This module aggregates all mental health-related routes for the UGM-AICare platform.
All routes are organized by feature area and can be imported from this single location.

Route Categories:
- Core: chat, feedback, session_events, summary
- Journaling: journal, journal_prompts
- Clinical: appointments, counselor, intervention_plans, clinical_analytics_routes
- AI Agents: agents, agents_command, agents_graph, safety_triage, langgraph, langgraph_analytics
- Features: quests, surveys

Note: CBT modules have been deprecated and integrated into TCA (Therapeutic Coach Agent).
See app/agents/sca/ for CBT-based intervention plans (cognitive_restructuring, behavioral_activation).
"""

# Core interaction routes
from . import chat
from . import feedback
from . import session_events
from . import summary

# Journaling routes
from . import journal
from . import journal_prompts

# Clinical management routes
from . import appointments
from . import counselor
from . import intervention_plans
from . import clinical_analytics_routes

# AI agent routes
from . import agents
from . import agents_command
from . import agents_graph
from . import safety_triage
from . import langgraph
from . import langgraph_analytics
from . import aika_stream

# Feature routes
from . import quests
from . import surveys
# cbt_modules removed - use TCA intervention plans instead

__all__ = [
    # Core
    "chat",
    "feedback",
    "session_events",
    "summary",
    # Journaling
    "journal",
    "journal_prompts",
    # Clinical
    "appointments",
    "counselor",
    "intervention_plans",
    "clinical_analytics_routes",
    # AI Agents
    "agents",
    "agents_command",
    "agents_graph",
    "safety_triage",
    "langgraph",
    "langgraph_analytics",
    "aika_stream",
    # Features
    "quests",
    "surveys",
]
