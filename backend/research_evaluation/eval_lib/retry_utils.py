from __future__ import annotations

import random
import time
from dataclasses import dataclass
from typing import Any, Callable, Optional, TypeVar


T = TypeVar("T")


class NonRetriableError(Exception):
    """Raised to indicate a failure that should not be retried.

    This is useful for quota exhaustion, invalid inputs, or other deterministic
    errors where retries would waste time and may produce noisy logs.
    """


@dataclass(frozen=True)
class RetryConfig:
    attempts: int = 3
    base_delay_s: float = 1.0
    max_delay_s: float = 10.0
    jitter_s: float = 0.25


def retry_sync(
    fn: Callable[[int], T],
    *,
    config: RetryConfig,
    on_attempt: Optional[Callable[[int], None]] = None,
    on_error: Optional[Callable[[int, BaseException], None]] = None,
) -> tuple[Optional[T], int, Optional[BaseException]]:
    """Run `fn(attempt)` with retries.

    Returns: (result_or_none, attempts_used, last_exception_or_none)
    """
    if config.attempts < 1:
        raise ValueError("attempts must be >= 1")

    delay = config.base_delay_s
    last_exc: Optional[BaseException] = None

    for attempt in range(1, config.attempts + 1):
        if on_attempt:
            on_attempt(attempt)
        try:
            return fn(attempt), attempt, None
        except BaseException as exc:  # noqa: BLE001 - notebook ergonomics
            if isinstance(exc, NonRetriableError):
                if on_error:
                    on_error(attempt, exc)
                raise
            last_exc = exc
            if on_error:
                on_error(attempt, exc)
            if attempt >= config.attempts:
                break
            sleep_for = min(delay, config.max_delay_s) + random.uniform(0, config.jitter_s)
            time.sleep(max(0.0, sleep_for))
            delay = min(delay * 2, config.max_delay_s)

    return None, config.attempts, last_exc
