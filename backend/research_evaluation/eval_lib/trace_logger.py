from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from .io_utils import utc_now_iso


@dataclass(frozen=True)
class TraceEvent:
    ts: str
    event: str
    fields: dict[str, Any]


class JsonlTraceLogger:
    """Append-only JSONL logger for evaluation traceability.

    Intended for notebooks and headless runners: each test attempt emits
    start/success/error events so partial progress is always recoverable.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._path.parent.mkdir(parents=True, exist_ok=True)

    @property
    def path(self) -> Path:
        return self._path

    def log(self, event: str, **fields: Any) -> TraceEvent:
        row = {"ts": utc_now_iso(), "event": event, **fields}
        with self._path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False))
            f.write("\n")
        return TraceEvent(ts=row["ts"], event=event, fields=fields)

    def log_error(self, event: str, exc: BaseException, **fields: Any) -> TraceEvent:
        return self.log(
            event,
            error_type=type(exc).__name__,
            error=str(exc),
            **fields,
        )
