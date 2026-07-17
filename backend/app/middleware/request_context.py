"""Request context middleware.

Provides:
- A stable per-request ID (`X-Request-ID`) for correlation across logs, DB events, and traces.
- A contextvar accessor so lower layers (services, background tasks) can read the current request id.

Note: This does not attempt to persist request IDs; it only propagates them.
"""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


_request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Return the current request id if set by middleware."""

    return _request_id_ctx.get()


_SAFE_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")


def _normalize_request_id(value: Optional[str]) -> str:
    if value and _SAFE_REQUEST_ID_RE.match(value):
        return value
    return str(uuid.uuid4())


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Adds/propagates request correlation id."""

    def __init__(self, app, header_name: str = "X-Request-ID"):
        super().__init__(app)
        self._header_name = header_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = _normalize_request_id(request.headers.get(self._header_name))

        # Bind to request state for route handlers
        request.state.request_id = request_id

        # Bind to contextvar for deeper layers
        token = _request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)

        response.headers[self._header_name] = request_id
        return response
