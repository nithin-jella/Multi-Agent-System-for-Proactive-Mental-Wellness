from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Optional


@dataclass(frozen=True)
class SSEEvent:
    event: str
    data: str


def iter_sse_events(lines: Iterable[str]) -> Iterator[SSEEvent]:
    """Parse Server-Sent Events from an iterable of text lines.

    Supports the common format:
      event: metadata
      data: {"foo": "bar"}

    Also supports "legacy" payloads where only `data:` lines are present.
    """
    event_name: str = "message"
    data_lines: list[str] = []

    def flush() -> Optional[SSEEvent]:
        nonlocal event_name, data_lines
        if not data_lines:
            return None
        payload = "\n".join(data_lines)
        data_lines = []
        return SSEEvent(event=event_name, data=payload)

    for raw in lines:
        line = raw.rstrip("\n")
        if not line:
            out = flush()
            if out is not None:
                yield out
            event_name = "message"
            continue

        if line.startswith(":"):
            continue

        if line.startswith("event:"):
            # Flush previous event before starting a new one
            out = flush()
            if out is not None:
                yield out
            event_name = line[len("event:") :].strip() or "message"
            continue

        if line.startswith("data:"):
            data_lines.append(line[len("data:") :].lstrip())
            continue

    out = flush()
    if out is not None:
        yield out


def try_parse_json(text: str) -> Optional[dict[str, Any]]:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return None
    if isinstance(value, dict):
        return value
    return None


def normalize_metadata_dict(metadata: dict[str, Any]) -> dict[str, Any]:
    """Normalize backend metadata to a stable notebook-friendly shape.

    The backend has evolved over time:
    - Older streams emitted an explicit `event: metadata` payload with keys like
      `risk_level` (str) and `agents_invoked`.
    - Current streams often emit `data: {"type": "complete", "metadata": {...}}`.
      The nested metadata may include `risk_assessment` instead of a top-level
      `risk_level`.

    This function preserves existing keys but also adds a best-effort
    `risk_level` (str) when it can be derived.
    """

    def _map_numeric_risk(level: Any) -> Optional[str]:
        try:
            n = int(level)
        except (TypeError, ValueError):
            return None
        return {0: "low", 1: "moderate", 2: "high", 3: "critical"}.get(n)

    out: dict[str, Any] = dict(metadata)

    # Normalize top-level risk_level if present.
    raw_risk = out.get("risk_level")
    if isinstance(raw_risk, str) and raw_risk.strip():
        out["risk_level"] = raw_risk.strip().lower()
        return out
    mapped = _map_numeric_risk(raw_risk)
    if mapped is not None:
        out["risk_level"] = mapped
        return out

    # Derive from structured risk_assessment.
    ra = out.get("risk_assessment")
    if isinstance(ra, dict):
        sev = ra.get("severity")
        if isinstance(sev, str) and sev.strip():
            out["risk_level"] = sev.strip().lower()
            return out

        ra_level = ra.get("risk_level")
        if isinstance(ra_level, str) and ra_level.strip():
            out["risk_level"] = ra_level.strip().lower()
            return out

        mapped = _map_numeric_risk(ra_level)
        if mapped is not None:
            out["risk_level"] = mapped
            return out

    # Fallbacks (some pipelines may emit severity/immediate_risk at top level).
    sev2 = out.get("severity")
    if isinstance(sev2, str) and sev2.strip():
        out["risk_level"] = sev2.strip().lower()
        return out

    immediate = out.get("immediate_risk")
    if isinstance(immediate, str) and immediate.strip():
        out["risk_level"] = immediate.strip().lower()
        return out

    return out


def extract_first_metadata_dict(lines: Iterable[str]) -> Optional[dict[str, Any]]:
    """Notebook-compatible metadata extraction.

    The notebook scans SSE `data:` lines and treats the first JSON object
    containing `agents_invoked` as the metadata payload.
    """
    for event in iter_sse_events(lines):
        # New format: explicit metadata event
        if event.event == "metadata":
            parsed = try_parse_json(event.data)
            if parsed is not None:
                return normalize_metadata_dict(parsed)

        parsed = try_parse_json(event.data)
        if parsed is None:
            continue

        # Current format: wrapper payloads (e.g., type=complete, type=agent_activity)
        nested = parsed.get("metadata")
        if isinstance(nested, dict):
            return normalize_metadata_dict(nested)

        if parsed.get("type") == "agent_activity":
            data = parsed.get("data")
            if isinstance(data, dict):
                return normalize_metadata_dict(data)

        # Legacy: JSON embedded directly in events
        if "agents_invoked" in parsed:
            return normalize_metadata_dict(parsed)

    return None


def extract_first_error_dict(lines: Iterable[str]) -> Optional[dict[str, Any]]:
    """Extract the first structured error payload from an SSE stream.

    The backend streaming endpoint emits JSON wrapper payloads, including errors:
      data: {"type": "error", "message": "...", "error": "...", ...}

    We keep this separate from metadata parsing so callers can decide how to
    handle failures (retry, pause/resume, etc.).
    """

    for event in iter_sse_events(lines):
        if event.event == "error":
            parsed = try_parse_json(event.data)
            if parsed is not None:
                return parsed

        parsed = try_parse_json(event.data)
        if parsed is None:
            continue

        if parsed.get("type") == "error":
            return parsed

    return None
