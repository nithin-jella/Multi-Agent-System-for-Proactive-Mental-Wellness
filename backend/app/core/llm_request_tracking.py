"""Per-user-prompt tracking for outbound LLM requests.

Goal:
- Count how many outbound Gemini requests happen for a single user prompt.
- Include requests triggered by tool-calling loops.

Implementation notes:
- Uses contextvars so the counter flows through async call stacks.
- Intended for logging/Langfuse metadata/debugging, not as a high-cardinality Prometheus label.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Dict, Iterator, Optional


_prompt_id_var: ContextVar[Optional[str]] = ContextVar("llm_prompt_id", default=None)
_user_id_var: ContextVar[Optional[int]] = ContextVar("llm_user_id", default=None)
_session_id_var: ContextVar[Optional[str]] = ContextVar("llm_session_id", default=None)
_execution_id_var: ContextVar[Optional[str]] = ContextVar("llm_execution_id", default=None)

_total_requests_var: ContextVar[int] = ContextVar("llm_total_requests", default=0)
_requests_by_model_var: ContextVar[Dict[str, int]] = ContextVar("llm_requests_by_model", default={})


@dataclass(frozen=True)
class LLMRequestStats:
    prompt_id: Optional[str]
    user_id: Optional[int]
    session_id: Optional[str]
    execution_id: Optional[str]
    total_requests: int
    requests_by_model: Dict[str, int]


@dataclass
class _ContextTokens:
    prompt_id: Token[Optional[str]]
    user_id: Token[Optional[int]]
    session_id: Token[Optional[str]]
    execution_id: Token[Optional[str]]
    total_requests: Token[int]
    requests_by_model: Token[Dict[str, int]]


def get_prompt_id() -> Optional[str]:
    return _prompt_id_var.get()


def get_user_id() -> Optional[int]:
    return _user_id_var.get()


def get_session_id() -> Optional[str]:
    return _session_id_var.get()


def get_execution_id() -> Optional[str]:
    return _execution_id_var.get()


def get_stats() -> LLMRequestStats:
    # Copy dict to prevent accidental mutation by callers.
    by_model = dict(_requests_by_model_var.get() or {})
    return LLMRequestStats(
        prompt_id=_prompt_id_var.get(),
        user_id=_user_id_var.get(),
        session_id=_session_id_var.get(),
        execution_id=_execution_id_var.get(),
        total_requests=_total_requests_var.get(),
        requests_by_model=by_model,
    )


def increment_request(*, model: str) -> int:
    """Increment outbound request counters for the current prompt context."""
    current_total = _total_requests_var.get() + 1
    _total_requests_var.set(current_total)

    current_by_model = dict(_requests_by_model_var.get() or {})
    current_by_model[model] = current_by_model.get(model, 0) + 1
    _requests_by_model_var.set(current_by_model)

    return current_total


@contextmanager
def prompt_context(
    *,
    prompt_id: str,
    user_id: Optional[int] = None,
    session_id: Optional[str] = None,
    execution_id: Optional[str] = None,
) -> Iterator[None]:
    """Context manager that scopes LLM request counters to a single user prompt."""
    tokens = _ContextTokens(
        prompt_id=_prompt_id_var.set(prompt_id),
        user_id=_user_id_var.set(user_id),
        session_id=_session_id_var.set(session_id),
        execution_id=_execution_id_var.set(execution_id),
        total_requests=_total_requests_var.set(0),
        requests_by_model=_requests_by_model_var.set({}),
    )

    try:
        yield
    finally:
        _prompt_id_var.reset(tokens.prompt_id)
        _user_id_var.reset(tokens.user_id)
        _session_id_var.reset(tokens.session_id)
        _execution_id_var.reset(tokens.execution_id)
        _total_requests_var.reset(tokens.total_requests)
        _requests_by_model_var.reset(tokens.requests_by_model)
