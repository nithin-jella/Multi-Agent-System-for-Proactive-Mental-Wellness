from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple
import os

# Attempt to import app settings; fall back to safe defaults if unavailable
try:
    from app.core.settings import settings as _app_settings  # type: ignore
    _SETTINGS_AVAILABLE = True
except Exception:  # pragma: no cover - tests may not load full settings
    _app_settings = None
    _SETTINGS_AVAILABLE = False

# Default placeholders (can be made configurable later)
PLACEHOLDERS: Dict[str, str] = {
    "email": "[REDACTED_EMAIL]",
    "phone": "[REDACTED_PHONE]",
    "ugm_id": "[REDACTED_UGM_STUDENT_ID]",
    "person": "[REDACTED_PERSON]",
    "location": "[REDACTED_LOCATION]",
    "org": "[REDACTED_ORG]",
}

# Precompiled regex patterns
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
# A balanced, international-ish phone number pattern
PHONE_RE = re.compile(
    r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?){2,4}\d\b"
)
# UGM student ID: 12/123456/AA/12345 (case-insensitive on AA)
UGM_ID_RE = re.compile(r"\b\d{2}/\d{6}/[A-Za-z]{2}/\d{5}\b", re.IGNORECASE)

# Matches already redacted tokens to avoid double-redaction
ALREADY_REDACTED_RE = re.compile(r"\[REDACTED_[A-Z_]+\]")


def extract_pii(message: Optional[str]) -> Dict[str, Any]:
    if not message:
        return {}
    findings: Dict[str, Any] = {}
    emails = EMAIL_RE.findall(message)
    if emails:
        findings["emails"] = emails
    phones = PHONE_RE.findall(message)
    if phones:
        findings["phones"] = phones
    ugm_ids = UGM_ID_RE.findall(message)
    if ugm_ids:
        findings["ugm_student_ids"] = ugm_ids
    return findings


def _sub_idempotent(pattern: re.Pattern[str], replacement: str, text: str) -> Tuple[str, int]:
    def repl(match: re.Match[str]) -> str:
        m = match.group(0)
        if ALREADY_REDACTED_RE.fullmatch(m):
            return m
        return replacement

    count = 0
    def repl_count(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return repl(match)

    return pattern.sub(repl_count, text), count


def redact_pii_regex(text: str) -> Tuple[str, Dict[str, int]]:
    redaction_counts: Dict[str, int] = {"email": 0, "phone": 0, "ugm_id": 0}
    # Order matters: redact structured IDs before generic phone patterns
    redacted, c_email = _sub_idempotent(EMAIL_RE, PLACEHOLDERS["email"], text)
    redaction_counts["email"] = c_email
    redacted, c_ugm = _sub_idempotent(UGM_ID_RE, PLACEHOLDERS["ugm_id"], redacted)
    redaction_counts["ugm_id"] = c_ugm
    redacted, c_phone = _sub_idempotent(PHONE_RE, PLACEHOLDERS["phone"], redacted)
    redaction_counts["phone"] = c_phone
    return redacted, redaction_counts


_nlp = None


def _flag(name: str, default: Any) -> Any:
    if _SETTINGS_AVAILABLE and _app_settings is not None:
        return getattr(_app_settings, name, default)
    # Env-based fallback for simple toggles
    env_map = {
        "pii_redaction_enabled": ("PII_REDACTION_ENABLED", default),
        "pii_nlp_redaction_enabled": ("PII_NLP_REDACTION_ENABLED", default),
        "pii_nlp_entities": ("PII_REDACTION_ENTITIES", default),
        "pii_nlp_model": ("PII_NLP_MODEL", default),
    }
    env_key, def_val = env_map.get(name, (None, default))
    if env_key is None:
        return default
    val = os.getenv(env_key)
    if val is None:
        return def_val
    if isinstance(def_val, bool):
        return str(val).strip().lower() in {"1", "true", "yes"}
    return val


def _lazy_load_spacy():
    global _nlp
    if _nlp is not None:
        return _nlp
    if not _flag("pii_nlp_redaction_enabled", False):
        return None
    try:
        import spacy  # type: ignore
    except Exception:
        return None
    # Prefer multilingual NER for Indonesian support
    preferred_model = str(_flag("pii_nlp_model", "xx_ent_wiki_sm") or "xx_ent_wiki_sm")
    for name in [preferred_model, "xx_ent_wiki_sm", "en_core_web_sm"]:
        try:
            _nlp = spacy.load(name)  # type: ignore[arg-type]
            return _nlp
        except Exception:
            continue
    # Fallback to a blank pipeline if no models available
    for lang in ["xx", "en"]:
        try:
            _nlp = spacy.blank(lang)  # type: ignore[arg-type]
            return _nlp
        except Exception:
            continue
    _nlp = None
    return _nlp


def redact_entities(text: str, labels: Optional[List[str]] = None) -> Tuple[str, Dict[str, int]]:
    nlp = _lazy_load_spacy()
    if nlp is None:
        return text, {}
    wanted_list = labels if labels is not None else _parse_entities_env()
    wanted = set(wanted_list)
    if not wanted:
        return text, {}
    doc = nlp(text)
    # Collect spans to replace
    spans: List[Tuple[int, int, str]] = []
    for ent in getattr(doc, "ents", []):
        label = ent.label_.upper()
        if label in wanted and not ALREADY_REDACTED_RE.fullmatch(ent.text):
            placeholder = _entity_placeholder(label)
            spans.append((ent.start_char, ent.end_char, placeholder))
    if not spans:
        return text, {}
    # Replace from right to left to avoid messing up offsets
    spans.sort(key=lambda s: s[0], reverse=True)
    redacted = text
    counts: Dict[str, int] = {}
    for start, end, token in spans:
        redacted = redacted[:start] + token + redacted[end:]
        counts[token] = counts.get(token, 0) + 1
    return redacted, counts


def _entity_placeholder(label: str) -> str:
    if label == "PERSON":
        return PLACEHOLDERS["person"]
    if label in ("GPE", "LOC"):
        return PLACEHOLDERS["location"]
    if label == "ORG":
        return PLACEHOLDERS["org"]
    return "[REDACTED_ENTITY]"


def _parse_entities_env() -> List[str]:
    try:
        raw = _flag("pii_nlp_entities", "PERSON,GPE,LOC")
        entities = [e.strip().upper() for e in str(raw).split(",") if e.strip()]
        return entities
    except Exception:
        return ["PERSON", "GPE", "LOC"]


def sanitize_text(text: str, use_nlp: Optional[bool] = None) -> Tuple[str, Dict[str, Any]]:
    """Apply regex redaction and optional NLP-based entity redaction.

    Returns (sanitized_text, meta) where meta contains counts per category.
    """
    if not text:
        return "", {}
    if use_nlp is None:
        use_nlp = _flag("pii_nlp_redaction_enabled", False)

    redacted, regex_counts = redact_pii_regex(text)
    meta: Dict[str, Any] = {"regex": regex_counts}
    if use_nlp:
        entities_list = _parse_entities_env()
        redacted2, ent_counts = redact_entities(redacted, entities_list)
        meta["entities"] = ent_counts
        return redacted2, meta
    return redacted, meta


def prelog_redact(message: Optional[str]) -> str:
    if not message:
        return ""
    redacted, _ = redact_pii_regex(message)
    return redacted
