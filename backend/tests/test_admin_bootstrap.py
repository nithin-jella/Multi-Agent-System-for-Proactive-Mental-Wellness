from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock, Mock

import pytest

from app.models import User
from app.services import admin_bootstrap


@dataclass
class _ScalarResult:
    value: Any

    def scalar_one_or_none(self) -> Any:
        return self.value


@pytest.mark.unit
async def test_ensure_default_admin_noop_when_email_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)

    db = AsyncMock()
    db.add = Mock()

    await admin_bootstrap.ensure_default_admin(db)

    db.execute.assert_not_called()
    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
async def test_ensure_default_admin_skips_when_admin_exists_by_role(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "password")

    existing = User(email="existing@example.com", role="admin")

    db = AsyncMock()
    db.add = Mock()
    db.execute = AsyncMock(side_effect=[_ScalarResult(existing), _ScalarResult(None)])

    await admin_bootstrap.ensure_default_admin(db)

    db.add.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.unit
async def test_ensure_default_admin_creates_user_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "password")

    monkeypatch.setattr(admin_bootstrap, "_hash_password", lambda _: "hashed")

    db = AsyncMock()
    db.add = Mock()
    db.execute = AsyncMock(side_effect=[_ScalarResult(None), _ScalarResult(None)])

    await admin_bootstrap.ensure_default_admin(db)

    assert db.add.call_count == 1
    created_user = db.add.call_args.args[0]
    assert isinstance(created_user, User)
    assert created_user.role == "admin"
    assert created_user.email == "admin@example.com"
    assert created_user.password_hash == "hashed"

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()


@pytest.mark.unit
async def test_ensure_default_counselor_creates_user_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COUNSELOR_EMAIL", "counselor@example.com")
    monkeypatch.setenv("COUNSELOR_PASSWORD", "password")
    monkeypatch.setenv("COUNSELOR_NAME", "Dr. A")

    monkeypatch.setattr(admin_bootstrap, "_hash_password", lambda _: "hashed")

    db = AsyncMock()
    db.add = Mock()
    db.execute = AsyncMock(side_effect=[_ScalarResult(None), _ScalarResult(None)])

    await admin_bootstrap.ensure_default_counselor(db)

    assert db.add.call_count == 1
    created_user = db.add.call_args.args[0]
    assert isinstance(created_user, User)
    assert created_user.role == "counselor"
    assert created_user.email == "counselor@example.com"
    assert created_user.name == "Dr. A"

    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once()
