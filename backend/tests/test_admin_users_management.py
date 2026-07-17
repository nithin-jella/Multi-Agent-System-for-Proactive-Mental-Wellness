from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, List
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from app.models import User
from app.routes.admin import users as admin_users
from app.schemas.admin.users import AdminCreateUserRequest, AdminUpdateUserRequest


@dataclass
class _ScalarResult:
    value: Any

    def scalar_one_or_none(self) -> Any:
        return self.value


@dataclass
class _ScalarsResult:
    values: List[Any]

    def scalars(self) -> "_ScalarsResult":
        return self

    def all(self) -> List[Any]:
        return self.values


@pytest.mark.unit
async def test_admin_create_user_generates_temp_password(monkeypatch: pytest.MonkeyPatch) -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)
    db = AsyncMock()
    db.add = Mock()
    db.execute = AsyncMock(return_value=_ScalarResult(None))

    async def _refresh(obj: Any) -> None:
        # Mimic DB-assigned primary key.
        if getattr(obj, "id", None) is None:
            obj.id = 1

    db.refresh = AsyncMock(side_effect=_refresh)

    monkeypatch.setattr(admin_users, "_hash_password", lambda _: "hashed")
    monkeypatch.setattr(admin_users.secrets, "token_urlsafe", lambda _: "temp_pw")
    monkeypatch.setattr(admin_users.uuid, "uuid4", lambda: type("U", (), {"hex": "code"})())

    payload = AdminCreateUserRequest(email="NewUser@Example.com", name="New", role="user", password=None)
    result = await admin_users.create_user(payload=payload, db=db, admin_user=admin_user)

    assert result.user_id == 1
    assert result.email == "newuser@example.com"
    assert result.role == "user"
    assert result.temporary_password == "temp_pw"

    assert db.add.call_count == 1
    created_user = db.add.call_args.args[0]
    assert isinstance(created_user, User)
    assert created_user.email == "newuser@example.com"
    assert created_user.role == "user"
    assert created_user.password_hash == "hashed"
    assert created_user.check_in_code == "code"

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.unit
async def test_admin_create_user_conflict_on_email(monkeypatch: pytest.MonkeyPatch) -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)
    db = AsyncMock()
    db.add = Mock()

    existing = User(email="exists@example.com", role="user")
    db.execute = AsyncMock(return_value=_ScalarResult(existing))

    payload = AdminCreateUserRequest(email="exists@example.com", name=None, role="user", password="password123")

    with pytest.raises(HTTPException) as exc:
        await admin_users.create_user(payload=payload, db=db, admin_user=admin_user)

    assert exc.value.status_code == 409
    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
async def test_admin_update_user_updates_email_and_role(monkeypatch: pytest.MonkeyPatch) -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)
    target_user = User(email="old@example.com", role="user", is_active=True)
    target_user.id = 123

    db = AsyncMock()
    db.add = Mock()
    db.get = AsyncMock(return_value=target_user)
    db.execute = AsyncMock(return_value=_ScalarResult(None))

    payload = AdminUpdateUserRequest(email="NEW@Example.com", role="admin")
    result = await admin_users.update_user(user_id=123, payload=payload, db=db, admin_user=admin_user)

    assert result["message"] == "User updated"
    assert target_user.email == "new@example.com"
    assert target_user.role == "admin"
    assert isinstance(target_user.updated_at, datetime)

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.unit
async def test_admin_delete_user_soft_deactivates() -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)
    target_user = User(email="u@example.com", role="user", is_active=True)
    target_user.id = 55

    db = AsyncMock()
    db.get = AsyncMock(return_value=target_user)

    result = await admin_users.delete_user(user_id=55, permanent=False, db=db, admin_user=admin_user)

    assert result["message"] == "User 55 deactivated"
    assert target_user.is_active is False
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()
    db.delete.assert_not_called()


@pytest.mark.unit
async def test_admin_delete_user_permanent_deletes() -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)
    target_user = User(email="u@example.com", role="user", is_active=True)
    target_user.id = 77

    db = AsyncMock()
    db.get = AsyncMock(return_value=target_user)

    result = await admin_users.delete_user(user_id=77, permanent=True, db=db, admin_user=admin_user)

    assert result["message"] == "User 77 deleted"
    db.delete.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.unit
async def test_admin_get_user_logs_formats_activity() -> None:
    admin_user = User(email="admin@example.com", role="admin", is_active=True)

    target_user = User(email="u@example.com", role="user", is_active=True)
    target_user.id = 10

    class _Row:
        def __init__(self) -> None:
            self.action = "updated"
            self.table_name = "users"
            self.change_reason = "admin edited profile"
            self.timestamp = datetime(2026, 1, 1, tzinfo=timezone.utc)

    db = AsyncMock()
    db.get = AsyncMock(return_value=target_user)
    db.execute = AsyncMock(return_value=_ScalarsResult([_Row()]))

    out = await admin_users.get_user_logs(user_id=10, limit=50, db=db, admin_user=admin_user)
    assert len(out) == 1
    assert out[0].timestamp.year == 2026
    assert out[0].activity == "updated users: admin edited profile"
