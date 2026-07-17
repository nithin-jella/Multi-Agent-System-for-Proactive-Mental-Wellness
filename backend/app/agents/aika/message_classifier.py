"""Pure message-classification utilities for the Aika decision pipeline.

All functions are stateless and free of I/O — safe to call on every request
and straightforward to unit-test.  They depend only on ``constants`` from the
same package; nothing heavier is imported here.

Public API
----------
detect_crisis_keywords   Check whether a message contains crisis vocabulary.
is_smalltalk_message     Decide if a message is harmless social filler.
requests_structured_support  Detect when the user explicitly asks for a plan.
tool_iterations_for_intent   Map a routing intent to an LLM tool-call budget.
"""
from __future__ import annotations

import re

from app.agents.aika.constants import (
    CRISIS_KEYWORDS,
    MAX_HISTORY_TURNS,
    SMALLTALK_AIKA_PREFIX,
    SMALLTALK_EXACT,
)

__all__ = [
    "detect_crisis_keywords",
    "is_smalltalk_message",
    "requests_structured_support",
    "tool_iterations_for_intent",
    # Backward-compat underscore aliases (used inside aika_orchestrator_graph)
    "_detect_crisis_keywords",
    "_is_smalltalk_message",
    "_requests_structured_support",
    "_tool_iterations_for_intent",
    # Re-export so callers can get MAX_HISTORY_TURNS from here if convenient
    "MAX_HISTORY_TURNS",
]


# ---------------------------------------------------------------------------
# Crisis detection
# ---------------------------------------------------------------------------

def detect_crisis_keywords(text: str) -> list[str]:
    """Return all crisis keywords found in *text* (case-insensitive).

    An empty list means no crisis signals were detected.

    >>> detect_crisis_keywords("I want to bunuh diri")
    ['bunuh diri']
    >>> detect_crisis_keywords("just feeling a bit stressed")
    []
    """
    lowered = (text or "").lower()
    return [kw for kw in CRISIS_KEYWORDS if kw in lowered]


# ---------------------------------------------------------------------------
# Smalltalk classification
# ---------------------------------------------------------------------------

def is_smalltalk_message(text: str) -> bool:
    """Return True when *text* is a short social/ack phrase with no distress content.

    Three tiers, evaluated cheapest-first to minimise CPU on the hot path:

    1. Exact set lookup against ``SMALLTALK_EXACT``  — O(1).
    2. Length-bounded check against ``SMALLTALK_AIKA_PREFIX`` — O(1).
    3. Regex: single-emoji, pure-punctuation, or very short repeated-char fillers.

    >>> is_smalltalk_message("halo")
    True
    >>> is_smalltalk_message("aku mau bunuh diri")
    False
    """
    cleaned = re.sub(r"\s+", " ", (text or "").strip().lower())
    if not cleaned:
        return False

    # Tier 1 — exact match
    if cleaned in SMALLTALK_EXACT:
        return True

    # Tier 2 — Aika-name prefix variants (capped at 22 chars to stay O(1))
    if len(cleaned) <= 22 and cleaned in SMALLTALK_AIKA_PREFIX:
        return True

    # Tier 3 — structural patterns that are never distress signals
    if re.fullmatch(
        r"[^\w\s]{1,4}"                     # pure punctuation / emoji surrogates
        r"|[\U00010000-\U0010FFFF]{1,3}"     # actual emoji codepoints
        r"|(ha){2,6}|(wk){2,6}|(heh)+"      # laughter fillers
        r"|oh\s+(iya|okay|oke|i see|gitu)"   # short realisations
        r"|hmm+|hm+",
        cleaned,
    ):
        return True

    return False


# ---------------------------------------------------------------------------
# Structured-support detection
# ---------------------------------------------------------------------------

def requests_structured_support(text: str) -> bool:
    """Return True when the user explicitly asks for a step-by-step plan.

    Triggering this routes low-distress emotional-support messages to TCA
    so the user gets a concrete coping plan rather than a conversational reply.

    >>> requests_structured_support("tolong buatkan plan buat saya")
    True
    >>> requests_structured_support("aku lagi sedih nih")
    False
    """
    lowered = (text or "").lower()
    triggers = (
        "rencana",
        "langkah",
        "step by step",
        "strategi",
        "coping plan",
        "buatkan plan",
        "bikin rencana",
        "cara mengatasi",
    )
    return any(trigger in lowered for trigger in triggers)


# ---------------------------------------------------------------------------
# Tool-call iteration budget
# ---------------------------------------------------------------------------

def tool_iterations_for_intent(intent: str) -> int:
    """Map a routing intent label to a tool-calling loop budget.

    A tighter budget means fewer Gemini API round-trips per request:

    - ``casual_chat``            : 1 — single pass, no tool calls expected.
    - ``information_inquiry``    : 2 — one look-up, then reply.
    - ``appointment_scheduling`` : 4 — get counselors → slots → book → confirm.
    - everything else            : 3 — emotional support may call one tool then reply.

    >>> tool_iterations_for_intent("casual_chat")
    1
    >>> tool_iterations_for_intent("appointment_scheduling")
    4
    >>> tool_iterations_for_intent("emotional_support")
    3
    """
    if intent == "casual_chat":
        return 1
    if intent == "information_inquiry":
        return 2
    if intent == "appointment_scheduling":
        return 4
    return 3


# ---------------------------------------------------------------------------
# Backward-compat private aliases (used in aika_orchestrator_graph)
# ---------------------------------------------------------------------------
# These allow the orchestrator to keep calling the underscore-prefixed names
# while we migrate it incrementally.  They will be removed once the
# orchestrator is fully broken down.

_detect_crisis_keywords = detect_crisis_keywords
_is_smalltalk_message = is_smalltalk_message
_requests_structured_support = requests_structured_support
_tool_iterations_for_intent = tool_iterations_for_intent
