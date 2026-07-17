"""Reusable Gemini fallback-chain execution loop."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Sequence, TypeVar

from app.core.llm_gemini_fallback_policy import build_fallback_model_chain

T = TypeVar("T")


async def run_gemini_fallback_chain(
    *,
    model: str,
    fallback_chain: Sequence[str],
    key_count: int,
    allow_retry_sleep: bool,
    contents_mode: bool,
    call_model: Callable[[str], Awaitable[T]],
    is_model_open: Callable[[str], bool],
    record_model_success: Callable[[str], None],
    record_model_failure: Callable[[str], None],
    record_request: Callable[..., Awaitable[Any]],
    current_key_fingerprint: Callable[[], tuple[int, str]],
    parse_retry_after_s: Callable[[str], float | None],
    extract_error_code: Callable[[Exception], int],
    is_invalid_model_error: Callable[[int, str], bool],
    is_resource_exhausted_error: Callable[[int, str], bool],
    should_fallback_on_error: Callable[[int, str], bool],
    mark_key_cooldown: Callable[[float | None], Awaitable[Any]],
    rotate_key: Callable[[], Awaitable[Any]],
    exhausted_error_factory: Callable[..., Exception],
    logger: logging.Logger,
) -> T:
    """Execute fallback-chain retries for Gemini calls.

    The caller provides provider-specific call logic and state callbacks; this
    runner handles retry/fallback/rotation behavior consistently.
    """

    from google.genai.errors import ClientError, ServerError

    models_to_try = build_fallback_model_chain(model, fallback_chain)
    all_models_open = all(is_model_open(candidate) for candidate in models_to_try)

    last_error: Exception | None = None
    last_error_model: str | None = None
    last_error_key: tuple[int, str] | None = None
    last_error_retry_after_s: float | None = None

    for model_idx, current_model in enumerate(models_to_try):
        if is_model_open(current_model) and not all_models_open:
            if contents_mode:
                logger.warning("Skipping model %s due to open circuit breaker", current_model)
            else:
                logger.warning(
                    "⚡ Skipping model %s — circuit breaker open. Trying next fallback.",
                    current_model,
                )
            continue

        max_retries_per_model = max(3, key_count)

        for retry_attempt in range(max_retries_per_model):
            try:
                if contents_mode:
                    logger.info(
                        "🔄 Attempting Gemini request with model: %s (model_idx=%s, retry=%s, contents_mode=True)",
                        current_model,
                        model_idx,
                        retry_attempt,
                    )
                else:
                    logger.info(
                        "🔄 Attempting Gemini request with model: %s (model_idx=%s, retry=%s)",
                        current_model,
                        model_idx,
                        retry_attempt,
                    )

                response = await call_model(current_model)

                key_idx, _ = current_key_fingerprint()
                await record_request(key_index=key_idx, model=current_model, success=True)
                record_model_success(current_model)

                if model_idx > 0 or retry_attempt > 0:
                    logger.warning("✅ Fallback/Retry successful! Used model: %s", current_model)

                return response

            except (ClientError, ServerError) as error:
                last_error = error
                last_error_model = current_model
                last_error_key = current_key_fingerprint()
                last_error_retry_after_s = parse_retry_after_s(str(error))
                error_code = extract_error_code(error)
                error_msg = str(error)

                record_model_failure(current_model)

                key_idx_err, _ = current_key_fingerprint()
                is_rate_limited = error_code == 429 or "RESOURCE_EXHAUSTED" in error_msg
                await record_request(
                    key_index=key_idx_err,
                    model=current_model,
                    success=False,
                    is_rate_limited=is_rate_limited,
                    error_message=error_msg[:200],
                )

                if is_invalid_model_error(error_code, error_msg):
                    logger.warning(
                        "⚠️ Model %s not available (code=%s). Skipping to next fallback model...",
                        current_model,
                        error_code,
                    )
                    break

                if should_fallback_on_error(error_code, error_msg):
                    await mark_key_cooldown(last_error_retry_after_s)
                    key_idx, key_last4 = current_key_fingerprint()
                    log_suffix = " contents_mode=True" if contents_mode else ""
                    logger.warning(
                        "Gemini request throttled/quota-limited: model=%s code=%s key_idx=%s key_last4=%s retry=%s/%s%s",
                        current_model,
                        error_code,
                        key_idx,
                        key_last4,
                        retry_attempt,
                        max_retries_per_model,
                        log_suffix,
                    )

                    if key_count > 1 and retry_attempt < key_count - 1:
                        logger.warning("🔑 Rotating Gemini API key and retrying immediately...")
                        await rotate_key()
                        continue

                    retry_after_s = parse_retry_after_s(error_msg)
                    if allow_retry_sleep and retry_after_s is not None and retry_attempt < max_retries_per_model - 1:
                        delay_seconds = min(retry_after_s, 60.0)
                        logger.warning(
                            "⏳ Rate limit hit. Sleeping for %.2fs before retrying same model...",
                            delay_seconds,
                        )
                        await asyncio.sleep(delay_seconds + 1.0)
                        continue

                    if model_idx < len(models_to_try) - 1:
                        logger.warning(
                            "⚠️ Model %s unavailable (code=%s). Trying fallback model %s...",
                            current_model,
                            error_code,
                            models_to_try[model_idx + 1],
                        )
                        break

                    raise

                logger.error("❌ Unexpected error with model %s: %s", current_model, error)
                raise

            except Exception as error:
                last_error = error
                logger.error("❌ Unexpected error with model %s: %s", current_model, error)
                raise

    logger.error("❌ All fallback models exhausted. Last error: %s", last_error)

    if last_error is not None and last_error_model is not None and last_error_key is not None:
        error_code = extract_error_code(last_error)
        error_msg = str(last_error)
        if is_resource_exhausted_error(int(error_code), error_msg):
            key_idx, key_last4 = last_error_key
            raise exhausted_error_factory(
                model=last_error_model,
                api_key_index=key_idx,
                api_key_last4=key_last4,
                retry_after_s=last_error_retry_after_s,
                message=error_msg,
            ) from last_error

        raise last_error

    raise Exception("All Gemini models failed with unknown error")
