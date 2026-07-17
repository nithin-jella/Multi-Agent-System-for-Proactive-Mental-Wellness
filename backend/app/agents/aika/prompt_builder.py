"""Prompt construction utilities for the Aika decision pipeline.

All public functions are pure — they accept data, return strings, and produce
no side effects.  This makes them straightforward to test in isolation and
safe to call on every request without performance concerns.

The sole exception is ``get_aika_system_prompts()``, which performs a lazy
import of ``app.agents.aika.identity`` to avoid the circular-import chain
that arises when the module loads alongside the rest of the agent package.
That import is idempotent and causes no I/O.

Public API
----------
get_aika_system_prompts       Return the role-keyed system prompt dictionary.
normalize_role                Canonicalize a role string (delegates to role_utils).
format_personal_memory_block  Render user-consented memory facts for injection.
build_smalltalk_response      Return a role-appropriate one-liner for filler messages.
build_tail_context_block      Summarise recent turns for the decision prompt.
build_decision_prompt         Assemble the full routing/classification prompt.
"""
from __future__ import annotations

from typing import Any

from app.agents.graph_state import AikaOrchestratorState

__all__ = [
    "get_aika_system_prompts",
    "normalize_role",
    "format_personal_memory_block",
    "build_smalltalk_response",
    "build_tail_context_block",
    "build_decision_prompt",
    # Backward-compat underscore aliases — used inside aika_orchestrator_graph
    # and its sub-modules; will be removed once migration is complete.
    "_get_aika_prompts",
    "_normalize_user_role",
    "_format_personal_memory_block",
    "_build_smalltalk_response",
]

# ---------------------------------------------------------------------------
# Fallback prompts — used when identity.py cannot be imported (e.g. in unit
# tests that do not load the full package tree).
# ---------------------------------------------------------------------------
_FALLBACK_PROMPTS: dict[str, str] = {
    "user": (
        "You are Aika, a warm and empathetic mental health assistant "
        "for Indonesian university community members."
    ),
    "counselor": (
        "You are Aika, an AI assistant helping counselors "
        "with case management and clinical insights."
    ),
    "admin": "You are Aika, providing analytics and insights for platform administrators.",
}


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

def get_aika_system_prompts() -> dict[str, str]:
    """Return the role-keyed system prompt dictionary.

    Performs a lazy import of ``app.agents.aika.identity`` to avoid the
    circular-import chain that arises at module load time.  Falls back to
    minimal inline prompts when the import fails.
    """
    try:
        from app.agents.aika.identity import AIKA_SYSTEM_PROMPTS  # type: ignore[import]
        return AIKA_SYSTEM_PROMPTS
    except ImportError:
        return _FALLBACK_PROMPTS


def normalize_role(role: str) -> str:
    """Return the canonical role string for *role*.

    Thin wrapper over ``app.core.role_utils.normalize_role``.  The local
    import defers resolution until call time, avoiding the circular-import
    chain between the agent package and the core layer.

    >>> normalize_role("student")
    'user'
    >>> normalize_role("therapist")
    'counselor'
    """
    from app.core.role_utils import normalize_role as _norm  # local: avoids circular
    return _norm(role)


def format_personal_memory_block(state: AikaOrchestratorState) -> str:
    """Render user-consented memory facts as a plain-text block for injection.

    Returns an empty string when no facts are available, so callers can
    simply test ``if block:`` before appending.

    The source of truth is ``state["personal_context"]["remembered_facts"]``.
    At most 20 facts are rendered to keep context-window impact bounded.
    """
    personal_context = state.get("personal_context") or {}
    raw_facts = personal_context.get("remembered_facts") or []
    if not isinstance(raw_facts, list):
        return ""

    rendered = [str(f).strip() for f in raw_facts if str(f).strip()][:20]
    if not rendered:
        return ""

    lines = "\n".join(f"- {fact}" for fact in rendered)
    return (
        "User memory (user-provided, reviewable in Profile; use only if relevant):\n"
        + lines
    )


def build_smalltalk_response(role: str) -> str:
    """Return a role-appropriate one-liner greeting for social/filler messages.

    Pure function — does not call any LLM.

    >>> build_smalltalk_response("admin")  # doctest: +ELLIPSIS
    'Halo!...'
    """
    if role == "admin":
        return "Halo! Aku siap bantu untuk cek data atau operasional platform. Mau mulai dari apa?"
    if role == "counselor":
        return "Halo! Aku siap bantu kebutuhan case management atau insight klinis. Ada yang ingin dicek dulu?"
    return "Halo! Aku Aika. Senang ketemu kamu. Lagi pengin ngobrol tentang apa hari ini?"


def build_tail_context_block(
    conversation_history: list[dict[str, Any]],
    *,
    tail_turns: int = 4,
    max_chars_per_turn: int = 200,
) -> str:
    """Format the most recent *tail_turns* exchange pairs as a plain-text block.

    Appended to the decision prompt so the model can resolve implicit
    references ("I still feel the same") without receiving the full history.
    Returns an empty string when history is absent or empty.

    >>> build_tail_context_block([])
    ''
    """
    tail_msgs = conversation_history[-(tail_turns * 2):]
    if not tail_msgs:
        return ""

    lines = [
        f"  [{'User' if msg.get('role') == 'user' else 'Aika'}]: "
        f"{(msg.get('content') or '')[:max_chars_per_turn]}"
        for msg in tail_msgs
    ]
    return f"Recent conversation (last {tail_turns} turns):\n" + "\n".join(lines) + "\n"


def build_decision_prompt(
    *,
    user_role: str,
    current_message: str,
    tail_context_block: str,
    personal_memory_block: str,
) -> str:
    """Assemble the JSON-request prompt sent to Gemini for intent classification.

    All variable sections are passed as named keyword arguments so the
    construction logic is transparent, individually testable, and easy to
    update without touching the LLM call site.

    The prompt instructs the model to return a strict JSON object containing
    intent, routing decision, immediate risk level, and (when applicable)
    analytics parameters.
    """
    memory_section = f"\n\n{personal_memory_block}" if personal_memory_block else ""

    normalized = normalize_role(user_role)
    routing_rules = ""

    if normalized == "user":
        routing_rules = (
            f"FOR REGULAR USERS (role=user — students, lecturers, and staff):\n"
            f"- ASSESS AND ROUTE DIRECTLY:\n"
            f"  * Aika is the primary responder for ALL user interactions.\n"
            f"  * Aika handles emotional support, crisis de-escalation, and appointment booking via tools.\n"
            f"  * Route to TCA or CMA directly if needed. DO NOT route to STA synchronously.\n"
            f"  * Background processes handle deep risk analysis after the conversation.\n\n"
        )
    elif normalized == "admin":
        routing_rules = (
            f"FOR ADMINS:\n"
            f"- NEEDS AGENTS (invoke IA for analytics):\n"
            f'  * Requests complex data/analytics ("trending topics", "case statistics")\n'
            f"  * Aggregated reports requiring specialised processing\n"
            f"  * Questions about system usage, user engagement, or mental health trends\n"
            f"- NO AGENTS NEEDED (handle directly with tools):\n"
            f'  * Simple status checks ("is system healthy?")\n'
            f"  * General platform questions\n"
            f"  * Specific user lookups (Aika can use tools for this)\n"
            f"  * Requests to analyse a conversation or user: use trigger_conversation_analysis tool\n\n"
        )
    elif normalized == "counselor":
        routing_rules = (
            f"FOR COUNSELORS:\n"
            f"- NEEDS AGENTS (invoke CMA for case management):\n"
            f"  * Requests to CREATE or MODIFY cases\n"
            f"  * Clinical insights requiring deep analysis\n"
            f"- NEEDS AGENTS (invoke IA for analytics):\n"
            f"  * Requests for population-level insights or trends\n"
            f'  * "How many users are stressed this week?"\n'
            f"- NO AGENTS NEEDED (handle directly with tools):\n"
            f"  * General clinical questions\n"
            f"  * Viewing patient data (Aika can use tools)\n"
            f"  * Requests to analyse a conversation or risk assessment:\n"
            f"    use trigger_conversation_analysis tool directly\n\n"
        )

    return (
        f"Analyze this message and determine the next step.\n\n"
        f"User Role: {user_role}\n"
        f"{tail_context_block}"
        f"Message: {current_message}\n\n"
        f"Decision Criteria:\n\n"
        f"{routing_rules}"
        f"Return JSON with:\n"
        f"{{\n"
        f'  "intent": "string (MUST be one of: \'casual_chat\', \'emotional_support\', \'crisis_intervention\', \'information_inquiry\', \'appointment_scheduling\', \'emergency_escalation\', \'analytics_query\')",\n'
        f'  "intent_confidence": float (0.0-1.0),\n'
        f'  "needs_agents": boolean,\n'
        f'  "next_step": "string (MUST be one of: \'tca\', \'cma\', \'ia\', \'none\')",\n'
        f'  "reasoning": "string explaining decision",\n\n'
        f'  "immediate_risk": "none|low|moderate|high|critical",\n'
        f'  "crisis_keywords": ["list of crisis keywords found, empty if none"],\n'
        f'  "risk_reasoning": "Brief 1-sentence explanation of risk assessment",\n\n'
        f'  "analytics_params": {{\n'
        f'      "question_id": "string (MUST be one of: \'crisis_trend\', \'dropoffs\', \'resource_reuse\', \'fallback_reduction\', \'cost_per_helpful\', \'coverage_windows\')",\n'
        f'      "start_date": "YYYY-MM-DD (default to 30 days ago if not specified)",\n'
        f'      "end_date": "YYYY-MM-DD (default to today if not specified)"\n'
        f"  }}\n"
        f"}}\n\n"
        f"INTENT DEFINITIONS:\n"
        f"- 'casual_chat': Greetings, small talk, thanks, closing conversation.\n"
        f"- 'emotional_support': Venting, sharing feelings, relationship issues, stress (non-crisis).\n"
        f"- 'crisis_intervention': Self-harm, suicide, severe danger, \"want to die\".\n"
        f"- 'information_inquiry': Questions about mental health concepts, app features, or general info.\n"
        f"- 'appointment_scheduling': Requests to book, check, or manage appointments with counselors.\n"
        f"- 'emergency_escalation': Explicit request for immediate human help or emergency services.\n"
        f"- 'analytics_query': Requests for data, statistics, trends, or reports (Admin/Counselor only).\n\n"
        f"IMMEDIATE RISK ASSESSMENT CRITERIA:\n"
        f'- "critical": Explicit suicide plan/intent with method and timeframe OR active crisis in progress.\n'
        f'  Examples: "I\'m going to kill myself tonight", "I have pills ready to overdose"\n'
        f"  * IMPORTANT: If history shows recent suicide threat, MAINTAIN 'critical' or 'high' until explicitly de-escalated.\n"
        f'- "high": Strong self-harm ideation or active suicidal thoughts.\n'
        f'  Examples: "I keep thinking about cutting myself", "I want to die", "bunuh diri"\n'
        f'- "moderate": Significant emotional distress with concerning patterns.\n'
        f'  Examples: "I feel completely hopeless", "nothing matters anymore", "tidak ada gunanya hidup"\n'
        f'- "low": Stress/anxiety without crisis indicators.\n'
        f'  Examples: "I\'m stressed about exams", "feeling anxious about presentation"\n'
        f'- "none": No distress signals.\n'
        f'  Examples: "Hello, how are you?", "What is CBT?", "Thanks for the help"\n\n'
        f"CRISIS KEYWORDS TO DETECT (Indonesian + English):\n"
        f"suicide, bunuh diri, kill myself, end my life, tidak ingin hidup lagi,\n"
        f"self-harm, cutting, mutilasi diri, menyakiti diri, overdose,\n"
        f"jump from building, loncat dari gedung, gantung diri, hanging,\n"
        f"want to die, mau mati, ingin mati, etc."
        f"{memory_section}"
    )


# ---------------------------------------------------------------------------
# Backward-compat underscore aliases
# These let aika_orchestrator_graph and its dependants keep existing call
# sites while the orchestrator is migrated incrementally.  They will be
# removed once the orchestrator is fully decomposed.
# ---------------------------------------------------------------------------
_get_aika_prompts = get_aika_system_prompts
_normalize_user_role = normalize_role
_format_personal_memory_block = format_personal_memory_block
_build_smalltalk_response = build_smalltalk_response
