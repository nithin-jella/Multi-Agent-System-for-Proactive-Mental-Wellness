"""In-memory tracker for Gemini API key usage.

Records per-key request counts, errors, cooldowns, and model distribution.
Designed to be lightweight (no DB dependency) while giving admins real-time
visibility into key health and quota proximity.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional


@dataclass
class KeyUsageSnapshot:
    """Immutable snapshot of a single key's usage stats."""

    key_index: int
    key_label: str  # e.g. "Key 1 (..ab3f)"
    total_requests: int
    successful_requests: int
    failed_requests: int
    rate_limited_hits: int
    last_used_at: Optional[str]
    last_error_at: Optional[str]
    last_error_message: Optional[str]
    is_on_cooldown: bool
    cooldown_remaining_s: float
    requests_by_model: Dict[str, int]
    requests_last_hour: int
    requests_last_24h: int
    errors_last_hour: int


@dataclass
class _TimestampedEvent:
    timestamp: float  # monotonic
    wall_time: float  # unix epoch


@dataclass
class _KeyStats:
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    rate_limited_hits: int = 0
    last_used_at: Optional[float] = None  # unix epoch
    last_error_at: Optional[float] = None
    last_error_message: Optional[str] = None
    requests_by_model: Dict[str, int] = field(default_factory=dict)
    model_timestamps: Dict[str, List[float]] = field(default_factory=dict)
    # Rolling window events (monotonic timestamps)
    request_timestamps: List[float] = field(default_factory=list)
    error_timestamps: List[float] = field(default_factory=list)


class GeminiKeyUsageTracker:
    """Thread-safe, in-memory usage tracker for Gemini API keys."""

    _instance: Optional["GeminiKeyUsageTracker"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "GeminiKeyUsageTracker":
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._stats: Dict[int, _KeyStats] = {}
        self._data_lock = asyncio.Lock()
        self._boot_time = time.time()
        self._initialized = True

    def _ensure_key(self, key_index: int) -> _KeyStats:
        if key_index not in self._stats:
            self._stats[key_index] = _KeyStats()
        return self._stats[key_index]

    async def record_request(
        self,
        key_index: int,
        model: str,
        success: bool,
        is_rate_limited: bool = False,
        error_message: Optional[str] = None,
    ) -> None:
        """Record an outbound Gemini API call."""
        now_mono = time.monotonic()
        now_epoch = time.time()

        async with self._data_lock:
            stats = self._ensure_key(key_index)
            stats.total_requests += 1
            stats.last_used_at = now_epoch
            stats.request_timestamps.append(now_mono)

            # Model distribution
            stats.requests_by_model[model] = stats.requests_by_model.get(model, 0) + 1
            stats.model_timestamps.setdefault(model, []).append(now_epoch)

            if success:
                stats.successful_requests += 1
            else:
                stats.failed_requests += 1
                stats.last_error_at = now_epoch
                stats.last_error_message = error_message
                stats.error_timestamps.append(now_mono)

            if is_rate_limited:
                stats.rate_limited_hits += 1

            # Prune timestamps older than 24h to bound memory
            cutoff = now_mono - 86400
            stats.request_timestamps = [
                t for t in stats.request_timestamps if t > cutoff
            ]
            stats.error_timestamps = [
                t for t in stats.error_timestamps if t > cutoff
            ]

            cutoff_epoch = now_epoch - 86400
            for model_name, timestamps in list(stats.model_timestamps.items()):
                stats.model_timestamps[model_name] = [
                    t for t in timestamps if t > cutoff_epoch
                ]
                if not stats.model_timestamps[model_name]:
                    stats.model_timestamps.pop(model_name, None)

    async def get_all_snapshots(
        self,
        api_keys: List[str],
        cooldowns: Dict[int, float],
    ) -> List[KeyUsageSnapshot]:
        """Build snapshots for all configured keys."""
        now_mono = time.monotonic()
        one_hour_ago = now_mono - 3600
        snapshots: List[KeyUsageSnapshot] = []

        async with self._data_lock:
            for idx in range(len(api_keys)):
                key = api_keys[idx]
                label = f"Key {idx + 1} (..{key[-4:]})" if len(key) >= 4 else f"Key {idx + 1}"
                stats = self._ensure_key(idx)

                cooldown_until = cooldowns.get(idx, 0.0)
                is_on_cooldown = cooldown_until > now_mono
                cooldown_remaining = max(0.0, cooldown_until - now_mono)

                reqs_last_hour = sum(
                    1 for t in stats.request_timestamps if t > one_hour_ago
                )
                reqs_last_24h = len(stats.request_timestamps)
                errs_last_hour = sum(
                    1 for t in stats.error_timestamps if t > one_hour_ago
                )

                snapshots.append(
                    KeyUsageSnapshot(
                        key_index=idx,
                        key_label=label,
                        total_requests=stats.total_requests,
                        successful_requests=stats.successful_requests,
                        failed_requests=stats.failed_requests,
                        rate_limited_hits=stats.rate_limited_hits,
                        last_used_at=(
                            datetime.fromtimestamp(stats.last_used_at, tz=timezone.utc).isoformat()
                            if stats.last_used_at
                            else None
                        ),
                        last_error_at=(
                            datetime.fromtimestamp(stats.last_error_at, tz=timezone.utc).isoformat()
                            if stats.last_error_at
                            else None
                        ),
                        last_error_message=stats.last_error_message,
                        is_on_cooldown=is_on_cooldown,
                        cooldown_remaining_s=round(cooldown_remaining, 2),
                        requests_by_model=dict(stats.requests_by_model),
                        requests_last_hour=reqs_last_hour,
                        requests_last_24h=reqs_last_24h,
                        errors_last_hour=errs_last_hour,
                    )
                )

        return snapshots

    async def get_summary(
        self,
        api_keys: List[str],
        cooldowns: Dict[int, float],
    ) -> Dict:
        """High-level summary for the dashboard header."""
        snapshots = await self.get_all_snapshots(api_keys, cooldowns)
        total_reqs = sum(s.total_requests for s in snapshots)
        total_errors = sum(s.failed_requests for s in snapshots)
        total_rate_limits = sum(s.rate_limited_hits for s in snapshots)
        keys_on_cooldown = sum(1 for s in snapshots if s.is_on_cooldown)
        reqs_last_hour = sum(s.requests_last_hour for s in snapshots)

        return {
            "total_keys": len(api_keys),
            "active_keys": len(api_keys) - keys_on_cooldown,
            "keys_on_cooldown": keys_on_cooldown,
            "total_requests": total_reqs,
            "total_errors": total_errors,
            "total_rate_limited": total_rate_limits,
            "error_rate": round(total_errors / max(total_reqs, 1) * 100, 2),
            "requests_last_hour": reqs_last_hour,
            "uptime_seconds": round(time.time() - self._boot_time, 0),
        }

    async def get_model_timeseries(
        self,
        api_keys: List[str],
        window_seconds: int = 3600,
        bucket_seconds: int = 300,
    ) -> Dict:
        """Return per-model request counts over time buckets."""
        if window_seconds <= 0 or bucket_seconds <= 0:
            return {
                "window_seconds": window_seconds,
                "bucket_seconds": bucket_seconds,
                "series": [],
            }

        now_epoch = time.time()
        window_start = now_epoch - window_seconds
        bucket_count = int((window_seconds + bucket_seconds - 1) / bucket_seconds)

        series_map: Dict[str, List[int]] = {}

        async with self._data_lock:
            for idx in range(len(api_keys)):
                stats = self._ensure_key(idx)
                for model_name, timestamps in stats.model_timestamps.items():
                    buckets = series_map.setdefault(model_name, [0] * bucket_count)
                    for ts in timestamps:
                        if ts < window_start or ts > now_epoch:
                            continue
                        bucket_idx = int((ts - window_start) / bucket_seconds)
                        if 0 <= bucket_idx < bucket_count:
                            buckets[bucket_idx] += 1

        series = []
        for model_name, buckets in series_map.items():
            points = [
                {
                    "ts": round(window_start + bucket_seconds * i),
                    "count": buckets[i],
                }
                for i in range(bucket_count)
            ]
            series.append({"model": model_name, "points": points})

        return {
            "window_seconds": window_seconds,
            "bucket_seconds": bucket_seconds,
            "series": sorted(series, key=lambda s: s["model"]),
        }


# Module-level singleton
gemini_tracker = GeminiKeyUsageTracker()
