# Core Algorithms

This folder hosts cross-cutting logic used by services and API layers. The notes below focus on algorithmic behavior rather than API signatures. Some descriptions are necessarily partial and should be read alongside the source.

## Gemini key rotation and fallback

Source: [backend/app/core/llm.py](backend/app/core/llm.py)

The Gemini client selection in `get_gemini_client()` uses a rotating key pool with cooldowns. It appears to aim for two goals: avoid thundering the same key after quota errors, and reuse per-key client instances for lower overhead.

Algorithm sketch:
- Keys are loaded from `GOOGLE_GENAI_API_KEY` and optional `GOOGLE_GENAI_API_KEY_2` to `GOOGLE_GENAI_API_KEY_5`.
- `_select_gemini_key_index()` scans for a key whose cooldown has expired, starting from the current index unless `force_rotate=True`.
- If all keys are cooling down, it selects the earliest-ready index and logs the remaining wait time.
- `_get_or_create_gemini_client()` caches one `genai.Client` per key index.
- `_mark_gemini_key_cooldown()` records a bounded cooldown in seconds, using `retry_after_s` when available.

Fallback logic appears in `generate_gemini_response_with_fallback()` and `generate_gemini_content_with_fallback()`. The loop retries on 429 or 503, rotates keys when available, and can sleep for a server-provided retry interval before retrying the same model. It then walks the fallback model list when needed.

## Redis cache service

Source: [backend/app/core/cache.py](backend/app/core/cache.py)

`CacheService` implements a read-through style cache with explicit `get()` and `set()` calls. The cache key pattern is `cache:{prefix}:{identifier}`. Serialization is JSON-based, and decoding failures cause the key to be deleted to avoid repeated corruption.

A simple invalidation algorithm is provided by `delete_pattern()`. It scans keys by pattern and deletes them in a batch. This can be expensive at scale, so the behavior likely assumes bounded key counts per pattern.

## Redis rate limiter

Source: [backend/app/core/rate_limiter.py](backend/app/core/rate_limiter.py)

`RateLimiter` uses a sliding window approximation via Redis counters. For each endpoint and user, it maintains per-window counters with TTLs. The rate check path increments counters and uses TTL for reset timing.

The algorithm checks minute, hour, and day windows. If any window is exceeded, it blocks the request and returns a reset timestamp. Admin bypass and fail-open behavior are included, which may be a conscious trade-off between availability and strict enforcement.

## PII redaction pipeline

Source: [backend/app/core/redaction.py](backend/app/core/redaction.py)

The redaction logic is two-phase. First, regex redaction targets email, phone, and UGM student IDs. Then an optional spaCy-based entity pass can replace named entities like PERSON or LOC.

`sanitize_text()` combines both passes and returns metadata on matches. The regex substitution is idempotent by design, so repeated redaction should not cascade into nested placeholders.

## Redis connection normalization and mock fallback

Source: [backend/app/core/memory.py](backend/app/core/memory.py)

`get_redis_client()` normalizes host and port, supporting REDIS_HOST values like `host:port`. If no Redis config is present, it returns an in-memory `MockRedis` with basic get, set, incr, and expire behaviors. This design may reduce startup friction but does not provide cross-worker consistency.

## Policy guards

Source: [backend/app/core/policy.py](backend/app/core/policy.py)

Two guard functions implement policy checks:
- `ensure_k_anon()` validates k-anonymity counts against `settings.k_anon`.
- `ensure_no_crisis_experiments()` blocks experiments when crisis settings demand it.

These guards raise `PolicyViolation` and are intended to be applied as preconditions.

## Proactive scheduling

Source: [backend/app/core/scheduler.py](backend/app/core/scheduler.py)

The scheduler uses APScheduler to run several periodic jobs. The proactive check-in algorithm combines risk-weighted inactivity thresholds with a minimum time between check-ins. It queries user screening data, derives `risk_level`, and sends or queues messages while updating `last_checkin_sent_at`.

Trend detection and report jobs are also defined in the module. Their queries appear to rely on screening histories and time windows to detect deterioration. The exact statistical thresholds should be verified alongside the query logic.

## LangGraph checkpointer initialization

Source: [backend/app/core/langgraph_checkpointer.py](backend/app/core/langgraph_checkpointer.py)

`init_langgraph_checkpointer()` selects a Postgres-backed saver when a Postgres DSN is available. It normalizes SQLAlchemy async URLs into psycopg-compatible DSNs and initializes a single app-lifetime saver. The behavior is conservative and returns `None` when dependencies or connection strings do not align.

## Event and message logging

Source: [backend/app/core/events.py](backend/app/core/events.py)

The logging pipeline writes agent events, messages, and safety cases. It applies `prelog_redact()` before persisting content. The coercion helpers constrain field types and lengths, which may limit accidental PII exposure in logs.

## LLM request counters

Source: [backend/app/core/llm_request_tracking.py](backend/app/core/llm_request_tracking.py)

The request tracking uses `contextvars` to count outbound LLM calls per prompt context. `prompt_context()` scopes counters to a single prompt lifecycle and resets state on exit. This design allows aggregation without explicit threading or request objects, and it is likely useful for tool-calling loops.
