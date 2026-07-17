"""Static constants used across Aika agent modules.

Isolated here so that both ``message_classifier`` and the orchestrator graph
can import them without pulling in any heavy dependencies or risking circular
imports.  All values are immutable — do not modify at runtime.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Crisis detection vocabulary (Indonesian + English)
# ---------------------------------------------------------------------------
# Checked against every incoming message in O(n·k) time.  Keep the list
# purposefully conservative: false positives trigger unnecessary CMA escalation.
CRISIS_KEYWORDS: tuple[str, ...] = (
    "suicide",
    "bunuh diri",
    "kill myself",
    "end my life",
    "tidak ingin hidup lagi",
    "self-harm",
    "menyakiti diri",
    "overdose",
    "mau mati",
    "ingin mati",
)

# ---------------------------------------------------------------------------
# Smalltalk exact-match vocabulary
# ---------------------------------------------------------------------------
# Tier-1 gate: if the entire normalised message is in this set the message is
# treated as social filler and bypasses the full LLM decision call.
SMALLTALK_EXACT: frozenset[str] = frozenset({
    # English greetings / acks
    "hi", "hello", "hey", "yo", "sup",
    "ok", "okay", "okey", "okk", "alright", "sure", "yep", "nope", "noted",
    "thanks", "thank you", "thx", "ty",
    "bye", "bye bye", "see you", "good morning", "good night", "good afternoon",
    "p", "ping",
    # Indonesian greetings / acks
    "halo", "hai",
    "oke", "oke deh", "sip", "siap", "iya", "ya", "yap", "nggak",
    "makasih", "terima kasih", "trims",
    "baik", "baik baik",
    "dadah", "sampai jumpa",
    "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
    "selamat tidur",
    # Filler / acknowledgment
    "hmm", "hm", "oh", "oh oke", "oh okay", "oh baik", "ooh",
})

# ---------------------------------------------------------------------------
# Aika-name prefix smalltalk variants (Tier-2, max 22 chars)
# ---------------------------------------------------------------------------
SMALLTALK_AIKA_PREFIX: frozenset[str] = frozenset({
    "hi aika", "halo aika", "hai aika", "hello aika", "hey aika",
    "thank you aika", "makasih ya", "terima kasih ya",
    "oke aika", "ok aika", "sip aika", "noted aika", "bye aika",
})

# ---------------------------------------------------------------------------
# Conversation history window
# ---------------------------------------------------------------------------
# Maximum number of conversation *turns* (user + model pairs) to include in
# the context window on each non-crisis direct-response call.  10 turns
# (= 20 messages) caps per-request input token cost while preserving enough
# recency for coherent replies.
MAX_HISTORY_TURNS: int = 10
