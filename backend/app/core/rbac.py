from __future__ import annotations

from enum import Enum
from typing import Iterable

from fastapi import Depends, HTTPException, status


class Role(str, Enum):
    admin = "admin"
    counselor = "counselor"
    operator = "operator"
    student = "student"


class Principal:
    def __init__(self, user_id: str, role: Role):
        self.user_id = user_id
        self.role = role


async def get_current_principal() -> Principal:
    """Fetch the authenticated principal (placeholder)."""

    raise NotImplementedError("get_current_principal must integrate with auth layer")


def require_roles(*allowed: Role):
    async def _dependency(principal: Principal = Depends(get_current_principal)) -> Principal:
        if principal.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return principal

    return _dependency
