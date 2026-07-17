from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx


@dataclass(frozen=True)
class AuthContext:
    access_token: str
    user_id: int


class EvaluationHttpError(RuntimeError):
    pass


async def login_and_get_user_id(
    client: httpx.AsyncClient,
    base_url: str,
    email: str,
    password: str,
) -> AuthContext:
    token_resp = await client.post(
        f"{base_url}/api/v1/auth/token",
        data={"username": email, "password": password},
        timeout=30.0,
    )
    if token_resp.status_code >= 400:
        raise EvaluationHttpError(
            f"Login failed ({token_resp.status_code}): {token_resp.text[:500]}"
        )

    token_payload = token_resp.json()
    access_token = str(token_payload.get("access_token", ""))
    if not access_token:
        raise EvaluationHttpError("Login response missing access_token")

    me_resp = await client.get(
        f"{base_url}/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30.0,
    )
    if me_resp.status_code >= 400:
        raise EvaluationHttpError(
            f"/auth/me failed ({me_resp.status_code}): {me_resp.text[:500]}"
        )

    me = me_resp.json()
    user_id_raw = me.get("id")
    if not isinstance(user_id_raw, int):
        raise EvaluationHttpError("/auth/me response missing integer id")

    return AuthContext(access_token=access_token, user_id=user_id_raw)


async def with_retries(
    coro_factory,
    *,
    retries: int = 3,
    base_delay_s: float = 1.0,
    max_delay_s: float = 8.0,
) -> Any:
    last_exc: Optional[BaseException] = None
    delay = base_delay_s
    for _ in range(retries):
        try:
            return await coro_factory()
        except (httpx.HTTPError, asyncio.TimeoutError) as exc:
            last_exc = exc
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay_s)

    if last_exc is None:
        raise EvaluationHttpError("Request failed")
    raise EvaluationHttpError(str(last_exc)) from last_exc
