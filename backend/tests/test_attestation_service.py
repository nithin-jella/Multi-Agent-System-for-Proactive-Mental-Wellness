from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.models import User
from app.services.attestation_service import AttestationService, _hash_payload


@dataclass
class _ScalarResult:
    value: Any

    def scalar_one_or_none(self) -> Any:
        return self.value


class _FakeAsyncSession:
    def __init__(self, *, existing: Any | None = None) -> None:
        self._existing = existing
        self.added: list[Any] = []
        self.execute = AsyncMock(side_effect=self._execute)
        self.flush = AsyncMock(side_effect=self._flush)

    async def _execute(self, stmt: Any) -> _ScalarResult:  # noqa: ARG002
        return _ScalarResult(self._existing)

    def add(self, obj: Any) -> None:
        self.added.append(obj)

    async def _flush(self) -> None:
        # Mimic SQLAlchemy assigning PKs on flush.
        if self.added and getattr(self.added[-1], "id", None) is None:
            setattr(self.added[-1], "id", 123)


@pytest.mark.unit
def test_hash_payload_is_order_insensitive() -> None:
    payload1 = {"a": 1, "b": 2}
    payload2 = {"b": 2, "a": 1}

    assert _hash_payload(payload1) == _hash_payload(payload2)


@pytest.mark.unit
async def test_queue_attestation_returns_existing_and_does_not_audit(monkeypatch: pytest.MonkeyPatch) -> None:
    existing_record = object()
    session = _FakeAsyncSession(existing=existing_record)

    audit_mock = AsyncMock()
    monkeypatch.setattr("app.services.attestation_service.record_audit_event", audit_mock)

    service = AttestationService(session)  # type: ignore[arg-type]

    counselor = User(email="c@example.com", role="counselor")
    counselor.id = 99

    result = await service.queue_attestation(
        quest_instance=None,
        counselor=counselor,
        payload={"x": 1},
    )

    assert result is existing_record
    assert session.added == []
    audit_mock.assert_not_awaited()


@pytest.mark.unit
async def test_queue_attestation_creates_record_and_audits(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeAsyncSession(existing=None)

    service = AttestationService(session)  # type: ignore[arg-type]

    counselor = User(email="c@example.com", role="counselor")
    counselor.id = 99

    payload = {"hello": "world"}
    record = await service.queue_attestation(
        quest_instance=None,
        counselor=counselor,
        payload=payload,
    )

    assert len(session.added) == 2  # AttestationRecord + ComplianceAuditLog (via record_audit_event)
    assert getattr(record, "counselor_id") == 99
    assert getattr(record, "status").value == "pending"  # AttestationStatusEnum.PENDING
    assert record.extra_data["payload_preview"] == ["hello"]

    # Two flushes: one for AttestationRecord, one for ComplianceAuditLog.
    assert session.flush.await_count == 2
