"""Shared chat-completion transport for OpenRouter and direct Z.AI endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx
import logging

logger = logging.getLogger(__name__)


def convert_history_to_chat_messages(
    history: List[Dict[str, str]],
    system_prompt: Optional[str],
) -> List[Dict[str, str]]:
    """Convert generic history into OpenAI-compatible chat messages."""
    messages: List[Dict[str, str]] = []

    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})

    for msg in history:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(content, str) or not content.strip():
            continue

        if role == "system":
            messages.append({"role": "system", "content": content.strip()})
            continue

        chat_role = "assistant" if role == "assistant" else "user"
        messages.append({"role": chat_role, "content": content.strip()})

    return messages


def _extract_text_content(content: Any) -> Optional[str]:
    """Normalize provider content payload into plain text."""
    if isinstance(content, str):
        stripped = content.strip()
        return stripped or None

    if isinstance(content, list):
        text_parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text_parts.append(str(part.get("text", "")))
        merged = "".join(text_parts).strip()
        return merged or None

    return None


async def request_chat_completion(
    *,
    endpoint: str,
    api_key: str,
    timeout_s: float,
    model: str,
    history: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    system_prompt: Optional[str],
    json_mode: bool,
    empty_response_error: str,
    request_failed_prefix: str,
    connection_failed_prefix: str,
    rate_limit_prefix: str,
    unexpected_failed_prefix: str,
    accept_language: Optional[str] = None,
    json_schema: Optional[Dict[str, Any]] = None,
) -> str:
    """Call an OpenAI-compatible chat-completions endpoint and return text."""
    messages = convert_history_to_chat_messages(history, system_prompt)

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_schema is not None:
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "decision", "schema": json_schema}
        }
    elif json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if accept_language and accept_language.strip():
        headers["Accept-Language"] = accept_language.strip()

    try:
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()

        data = response.json()
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return f"Error: {empty_response_error}"

        first_choice = choices[0]
        message = first_choice.get("message") if isinstance(first_choice, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        normalized = _extract_text_content(content)

        if not normalized:
            return f"Error: {empty_response_error}"

        return normalized

    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        try:
            error_payload = exc.response.json()
            error_detail = str(error_payload.get("error", error_payload))
        except Exception:
            error_detail = exc.response.text

        if status_code == 429:
            return f"Error: {rate_limit_prefix} (429). {error_detail[:200]}"

        return f"Error: {request_failed_prefix} ({status_code}). {error_detail[:200]}"
    except httpx.RequestError as exc:
        return f"Error: {connection_failed_prefix}. {str(exc)[:200]}"
    except Exception as exc:
        logger.error("Unexpected chat completion error: %s", exc, exc_info=True)
        return f"Error: {unexpected_failed_prefix}. {str(exc)[:200]}"
