"""Gemini model circuit-breaker primitives for fallback routing."""

from __future__ import annotations

import threading
import time
from typing import Any, Optional, Sequence


class GeminiCircuitBreaker:
    """Track model failures and open/close breakers per model."""

    def __init__(
        self,
        *,
        failure_window_s: float,
        failure_threshold: int,
        cooldown_s: float,
    ) -> None:
        self._failure_window_s = failure_window_s
        self._failure_threshold = failure_threshold
        self._cooldown_s = cooldown_s
        self._model_failures: dict[str, list[float]] = {}
        self._model_open_until: dict[str, float] = {}
        self._model_breaker_events: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def _get_breaker_event_entry(self, model: str) -> dict[str, Any]:
        if model not in self._model_breaker_events:
            self._model_breaker_events[model] = {
                "total_opens": 0,
                "total_closes": 0,
                "last_opened_at": None,
                "last_closed_at": None,
            }
        return self._model_breaker_events[model]

    def _close_expired_breakers(self, now_mono: float, now_epoch: float) -> None:
        for model, until in list(self._model_open_until.items()):
            if until <= now_mono:
                self._model_open_until.pop(model, None)
                entry = self._get_breaker_event_entry(model)
                entry["total_closes"] = int(entry.get("total_closes", 0)) + 1
                entry["last_closed_at"] = now_epoch

    def record_failure(self, model: str) -> None:
        now = time.monotonic()
        now_epoch = time.time()
        with self._lock:
            failures = self._model_failures.get(model, [])
            failures = [timestamp for timestamp in failures if now - timestamp <= self._failure_window_s]
            failures.append(now)
            self._model_failures[model] = failures

            if len(failures) >= self._failure_threshold:
                is_open = self._model_open_until.get(model, 0.0) > now
                if not is_open:
                    self._model_open_until[model] = now + self._cooldown_s
                    entry = self._get_breaker_event_entry(model)
                    entry["total_opens"] = int(entry.get("total_opens", 0)) + 1
                    entry["last_opened_at"] = now_epoch

    def record_success(self, model: str) -> None:
        now_epoch = time.time()
        with self._lock:
            was_open = model in self._model_open_until
            self._model_failures.pop(model, None)
            self._model_open_until.pop(model, None)
            if was_open:
                entry = self._get_breaker_event_entry(model)
                entry["total_closes"] = int(entry.get("total_closes", 0)) + 1
                entry["last_closed_at"] = now_epoch

    def is_open(self, model: str) -> bool:
        now = time.monotonic()
        with self._lock:
            return self._model_open_until.get(model, 0.0) > now

    def get_status(self, models: Sequence[str]) -> list[dict[str, Any]]:
        """Return observability snapshot for provided model names."""
        now_mono = time.monotonic()
        now_epoch = time.time()

        with self._lock:
            self._close_expired_breakers(now_mono, now_epoch)
            statuses: list[dict[str, Any]] = []

            for model in models:
                failures = self._model_failures.get(model, [])
                failures = [timestamp for timestamp in failures if now_mono - timestamp <= self._failure_window_s]
                if failures:
                    self._model_failures[model] = failures
                else:
                    self._model_failures.pop(model, None)

                open_until = self._model_open_until.get(model, 0.0)
                is_open = open_until > now_mono
                remaining_s = max(0.0, open_until - now_mono) if is_open else 0.0
                entry = self._get_breaker_event_entry(model)

                statuses.append(
                    {
                        "model": model,
                        "is_open": is_open,
                        "open_remaining_s": round(remaining_s, 2),
                        "failures_in_window": len(failures),
                        "total_opens": int(entry.get("total_opens", 0)),
                        "total_closes": int(entry.get("total_closes", 0)),
                        "last_opened_at": entry["last_opened_at"],
                        "last_closed_at": entry["last_closed_at"],
                    }
                )

            return statuses
