from __future__ import annotations

import hashlib
import logging
import os
import asyncio
import socket
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, OperationalError

from app.database import AsyncSessionLocal, get_database_endpoint_summary
from app.domains.blockchain.attestation import (
    AttestationClientFactory,
    DEFAULT_ATTESTATION_CHAIN_ID,
)
from app.domains.blockchain.nft.chain_registry import DEFAULT_BADGE_CHAIN_ID
from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory
from app.domains.mental_health.models.assessments import UserScreeningProfile
from app.domains.mental_health.models.autopilot_actions import (
    AutopilotAction,
    AutopilotActionStatus,
    AutopilotActionType,
)
from app.domains.mental_health.models.quests import AttestationRecord, AttestationStatusEnum
from app.domains.mental_health.models.cases import Case, CaseSeverityEnum, CaseStatusEnum
from app.domains.mental_health.services.autopilot_action_service import (
    list_due_actions,
    mark_confirmed,
    mark_dead_letter,
    mark_failed,
    mark_running,
    schedule_retry,
)
from app.domains.mental_health.services.proactive_checkins import queue_checkin_execution
from app.models import User
from app.services.compliance_service import record_audit_event

logger = logging.getLogger(__name__)


def _is_db_connectivity_error(exc: Exception) -> bool:
    if isinstance(exc, (socket.gaierror, ConnectionError, TimeoutError, OperationalError, DBAPIError, OSError)):
        return True
    message = str(exc).lower()
    connectivity_markers = (
        "getaddrinfo failed",
        "name or service not known",
        "temporary failure in name resolution",
        "could not translate host name",
        "connection refused",
        "connection timed out",
        "server closed the connection",
    )
    return any(marker in message for marker in connectivity_markers)


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "t", "yes", "y", "on"}


def _parse_int_env(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return max(minimum, parsed)


def _get_retry_config() -> tuple[int, int]:
    max_retries = _parse_int_env("AUTOPILOT_MAX_RETRIES", default=5, minimum=1)
    base_seconds = _parse_int_env("AUTOPILOT_RETRY_BASE_SECONDS", default=30, minimum=1)
    return max_retries, base_seconds


def _is_onchain_placeholder_enabled() -> bool:
    return _parse_bool(os.getenv("AUTOPILOT_ONCHAIN_PLACEHOLDER"), default=True)


def _risk_to_case_severity(risk_level: str) -> CaseSeverityEnum:
    normalized = (risk_level or "none").strip().lower()
    if normalized in {"critical"}:
        return CaseSeverityEnum.critical
    if normalized in {"high"}:
        return CaseSeverityEnum.high
    if normalized in {"moderate", "med", "medium"}:
        return CaseSeverityEnum.med
    return CaseSeverityEnum.low


def _simulated_tx_hash(action: AutopilotAction) -> str:
    raw = f"autopilot:{action.id}:{action.idempotency_key}:{datetime.utcnow().isoformat()}"
    return f"0x{hashlib.sha256(raw.encode('utf-8')).hexdigest()}"


def _normalize_bytes32_hex(value: str, field_name: str) -> str:
    normalized = value.strip().lower()
    if not normalized.startswith("0x"):
        normalized = f"0x{normalized}"
    if len(normalized) != 66:
        raise ValueError(f"{field_name} must be 32-byte hex")
    int(normalized[2:], 16)
    return normalized


def _derive_attestation_id(action: AutopilotAction) -> str:
    payload = action.payload_json or {}
    explicit_id = payload.get("attestation_id")
    if isinstance(explicit_id, str) and explicit_id.strip():
        return _normalize_bytes32_hex(explicit_id, "attestation_id")

    attestation_record_id = payload.get("attestation_record_id")
    if isinstance(attestation_record_id, int):
        derived = hashlib.sha256(f"attestation-record:{attestation_record_id}".encode("utf-8")).hexdigest()
        return f"0x{derived}"

    fallback = hashlib.sha256(f"autopilot-action:{action.id}:{action.idempotency_key}".encode("utf-8")).hexdigest()
    return f"0x{fallback}"


async def _resolve_wallet_from_payload(payload: dict[str, Any]) -> str | None:
    wallet = payload.get("recipient_wallet") or payload.get("wallet_address")
    if isinstance(wallet, str) and wallet.strip():
        return wallet.strip()

    user_id = payload.get("user_id")
    if isinstance(user_id, int):
        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            if user and isinstance(user.wallet_address, str) and user.wallet_address.strip():
                return user.wallet_address.strip()
    return None


async def _handle_create_case(action: AutopilotAction) -> dict[str, Any]:
    payload = action.payload_json or {}
    user_hash = str(payload.get("user_hash") or "").strip()
    user_id = payload.get("user_id")
    if not user_hash and user_id is not None:
        user_hash = hashlib.sha256(f"u:{user_id}".encode("utf-8")).hexdigest()
    if not user_hash:
        raise ValueError("create_case requires user_hash or user_id")

    severity = _risk_to_case_severity(str(payload.get("risk_level") or action.risk_level))
    session_id = payload.get("session_id")
    summary = str(payload.get("reasoning") or payload.get("intent") or "Autopilot escalation")

    sla_minutes = 15 if severity == CaseSeverityEnum.critical else 60
    case = Case(
        status=CaseStatusEnum.new,
        severity=severity,
        user_hash=user_hash,
        session_id=str(session_id) if session_id else None,
        conversation_id=None,
        summary_redacted=summary[:1500],
        sla_breach_at=datetime.utcnow() + timedelta(minutes=sla_minutes),
    )

    async with AsyncSessionLocal() as db:
        db.add(case)
        await db.flush()
        await record_audit_event(
            db,
            actor_id=(int(user_id) if isinstance(user_id, int) else None),
            actor_role="system",
            action="autopilot.case_created",
            entity_type="case",
            entity_id=str(case.id),
            extra_data={"autopilot_action_id": action.id, "risk_level": action.risk_level},
        )
        await db.commit()

    return {"entity_type": "case", "entity_id": str(case.id)}


async def _handle_create_checkin(action: AutopilotAction) -> dict[str, Any]:
    payload = action.payload_json or {}
    user_id_raw = payload.get("user_id")
    if not isinstance(user_id_raw, int):
        raise ValueError("create_checkin requires integer user_id")

    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id_raw))).scalar_one_or_none()
        if user is None:
            raise ValueError(f"User not found: {user_id_raw}")

        screening_profile = (
            await db.execute(select(UserScreeningProfile).where(UserScreeningProfile.user_id == user.id))
        ).scalar_one_or_none()

        execution = await queue_checkin_execution(
            db=db,
            user=user,
            screening_profile=screening_profile,
            now=datetime.utcnow(),
            app_url=os.getenv("FRONTEND_URL", "http://localhost:22000"),
            risk_level=str(payload.get("risk_level") or action.risk_level or "none"),
            primary_concerns=[],
        )

        await record_audit_event(
            db,
            actor_id=user.id,
            actor_role="system",
            action="autopilot.checkin_queued",
            entity_type="campaign_execution",
            entity_id=str(execution.id),
            extra_data={"autopilot_action_id": action.id, "risk_level": action.risk_level},
        )
        await db.commit()

    return {"entity_type": "campaign_execution", "entity_id": str(execution.id)}


async def _handle_onchain_placeholder(action: AutopilotAction) -> dict[str, Any]:
    # IMPORTANT:
    # This is a deterministic placeholder path for hackathon/demo mode.
    # It DOES NOT submit a real onchain transaction and returns a synthetic tx hash.
    # Replace this path with real chain submission before production rollout.
    payload = action.payload_json or {}
    chain_id = int(payload.get("chain_id") or DEFAULT_BADGE_CHAIN_ID)
    tx_hash = _simulated_tx_hash(action)
    logger.warning(
        "Autopilot placeholder tx hash generated for action_id=%s action_type=%s chain_id=%s. "
        "No real blockchain transaction was submitted.",
        action.id,
        action.action_type.value,
        chain_id,
    )
    return {"chain_id": chain_id, "tx_hash": tx_hash}


async def _handle_mint_badge(action: AutopilotAction) -> dict[str, Any]:
    payload = action.payload_json or {}
    chain_id = int(payload.get("chain_id") or DEFAULT_BADGE_CHAIN_ID)
    badge_id_raw = payload.get("badge_id", payload.get("token_id"))
    if badge_id_raw is None:
        raise ValueError("mint_badge requires badge_id or token_id")

    badge_id = int(badge_id_raw)
    amount = int(payload.get("amount") or 1)
    recipient_wallet = await _resolve_wallet_from_payload(payload)
    if not recipient_wallet:
        raise ValueError("mint_badge requires recipient_wallet/wallet_address or a user with linked wallet")

    tx_hash = await NFTClientFactory.mint_badge(chain_id, recipient_wallet, badge_id, amount)
    if not tx_hash:
        raise RuntimeError("Failed to submit mint_badge transaction")

    return {"chain_id": chain_id, "tx_hash": tx_hash, "badge_id": badge_id, "amount": amount}


async def _handle_publish_attestation(action: AutopilotAction) -> dict[str, Any]:
    payload = action.payload_json or {}
    chain_id = int(payload.get("chain_id") or DEFAULT_ATTESTATION_CHAIN_ID)
    attestation_id = _derive_attestation_id(action)
    attestation_record_id = payload.get("attestation_record_id")

    payload_hash_value = payload.get("payload_hash")
    if isinstance(payload_hash_value, str) and payload_hash_value.strip():
        payload_hash = _normalize_bytes32_hex(payload_hash_value, "payload_hash")
    else:
        payload_hash = f"0x{action.payload_hash}"

    schema = str(payload.get("schema") or "aicare.autopilot.attestation.v1")
    metadata_uri = str(payload.get("metadata_uri") or "")
    subject = payload.get("subject_wallet") or payload.get("wallet_address")
    subject_wallet = str(subject).strip() if isinstance(subject, str) and subject.strip() else None

    logger.info(
        "Autopilot attestation publish start action_id=%s chain_id=%s attestation_record_id=%s attestation_id=%s",
        action.id,
        chain_id,
        attestation_record_id,
        attestation_id,
    )

    tx_hash = await AttestationClientFactory.publish_attestation(
        chain_id=chain_id,
        attestation_id=attestation_id,
        payload_hash=payload_hash,
        action_id=int(action.id),
        subject=subject_wallet,
        schema=schema,
        metadata_uri=metadata_uri,
    )
    if not tx_hash:
        raise RuntimeError("Failed to submit publish_attestation transaction")

    if isinstance(attestation_record_id, int):
        async with AsyncSessionLocal() as db:
            record = (
                await db.execute(
                    select(AttestationRecord).where(AttestationRecord.id == attestation_record_id)
                )
            ).scalar_one_or_none()
            if record is not None:
                record.status = AttestationStatusEnum.CONFIRMED
                record.processed_at = datetime.utcnow()
                extra = dict(record.extra_data or {})
                extra["tx_hash"] = tx_hash
                extra["chain_id"] = chain_id
                extra["attestation_id"] = attestation_id
                record.extra_data = extra
                await db.commit()

    logger.info(
        "Autopilot attestation publish submitted action_id=%s chain_id=%s tx_hash=%s attestation_id=%s",
        action.id,
        chain_id,
        tx_hash,
        attestation_id,
    )

    return {
        "chain_id": chain_id,
        "tx_hash": tx_hash,
        "attestation_id": attestation_id,
        "schema": schema,
    }


async def execute_autopilot_action(action: AutopilotAction) -> dict[str, Any]:
    if action.action_type == AutopilotActionType.create_case:
        return await _handle_create_case(action)
    if action.action_type == AutopilotActionType.create_checkin:
        return await _handle_create_checkin(action)
    if action.action_type == AutopilotActionType.mint_badge:
        if _is_onchain_placeholder_enabled():
            return await _handle_onchain_placeholder(action)
        return await _handle_mint_badge(action)
    if action.action_type == AutopilotActionType.publish_attestation:
        if _is_onchain_placeholder_enabled():
            return await _handle_onchain_placeholder(action)
        return await _handle_publish_attestation(action)
    raise ValueError(f"Unsupported action type: {action.action_type.value}")


async def process_autopilot_queue_once(batch_limit: int = 20) -> int:
    max_retries, base_seconds = _get_retry_config()
    processed = 0

    async with AsyncSessionLocal() as db:
        actions = await list_due_actions(db, limit=batch_limit)

        for action in actions:
            logger.info(
                "Autopilot worker processing action_id=%s action_type=%s status=%s retry_count=%s",
                action.id,
                action.action_type.value,
                action.status.value,
                int(action.retry_count or 0),
            )
            if action.status == AutopilotActionStatus.failed and int(action.retry_count or 0) >= max_retries:
                await mark_dead_letter(
                    db,
                    action,
                    error_message=action.error_message or "Exceeded max retries",
                    commit=False,
                )
                await record_audit_event(
                    db,
                    actor_id=None,
                    actor_role="system",
                    action="autopilot.action_dead_letter",
                    entity_type="autopilot_action",
                    entity_id=str(action.id),
                    extra_data={"retry_count": int(action.retry_count or 0)},
                )
                processed += 1
                continue

            await mark_running(db, action, commit=False)
            try:
                result = await execute_autopilot_action(action)
                await mark_confirmed(
                    db,
                    action,
                    tx_hash=str(result.get("tx_hash")) if result.get("tx_hash") else None,
                    chain_id=int(result.get("chain_id")) if result.get("chain_id") else None,
                    commit=False,
                )
                await record_audit_event(
                    db,
                    actor_id=None,
                    actor_role="system",
                    action="autopilot.action_confirmed",
                    entity_type="autopilot_action",
                    entity_id=str(action.id),
                    extra_data=result,
                )
                logger.info(
                    "Autopilot action confirmed action_id=%s tx_hash=%s chain_id=%s",
                    action.id,
                    action.tx_hash,
                    action.chain_id,
                )
            except Exception as exc:
                logger.error(
                    "Autopilot action execution failed action_id=%s action_type=%s error=%s",
                    action.id,
                    action.action_type.value,
                    str(exc),
                )
                await mark_failed(db, action, error_message=str(exc), commit=False)
                retries = int(action.retry_count or 0)
                if retries >= max_retries:
                    await mark_dead_letter(db, action, error_message=str(exc), commit=False)
                    await record_audit_event(
                        db,
                        actor_id=None,
                        actor_role="system",
                        action="autopilot.action_dead_letter",
                        entity_type="autopilot_action",
                        entity_id=str(action.id),
                        extra_data={"error": str(exc), "retry_count": retries},
                    )
                else:
                    await schedule_retry(db, action, base_seconds=base_seconds, commit=False)
                    await record_audit_event(
                        db,
                        actor_id=None,
                        actor_role="system",
                        action="autopilot.action_retry_scheduled",
                        entity_type="autopilot_action",
                        entity_id=str(action.id),
                        extra_data={
                            "error": str(exc),
                            "retry_count": retries,
                            "next_retry_at": action.next_retry_at.isoformat() if action.next_retry_at else None,
                        },
                    )
            processed += 1

        await db.commit()

    return processed


async def run_autopilot_worker_loop(stop_event, *, poll_seconds: int | None = None) -> None:
    interval = poll_seconds or _parse_int_env("AUTOPILOT_WORKER_INTERVAL_SECONDS", default=5, minimum=1)
    max_db_backoff = _parse_int_env("AUTOPILOT_DB_ERROR_MAX_BACKOFF_SECONDS", default=60, minimum=5)
    logger.info("Autopilot worker started (interval=%ss)", interval)

    consecutive_db_errors = 0
    last_db_error_log_at: datetime | None = None

    while not stop_event.is_set():
        wait_seconds = interval
        try:
            await process_autopilot_queue_once(batch_limit=20)
            consecutive_db_errors = 0
        except Exception as exc:
            if _is_db_connectivity_error(exc):
                consecutive_db_errors += 1
                wait_seconds = min(max_db_backoff, interval * (2 ** min(consecutive_db_errors - 1, 5)))

                now = datetime.utcnow()
                should_log_trace = (
                    consecutive_db_errors == 1
                    or consecutive_db_errors % 5 == 0
                    or last_db_error_log_at is None
                    or (now - last_db_error_log_at).total_seconds() >= 60
                )

                if should_log_trace:
                    logger.error(
                        "Autopilot worker DB connectivity failure (attempt=%s, backoff=%ss, db=%s): %s",
                        consecutive_db_errors,
                        wait_seconds,
                        get_database_endpoint_summary(),
                        exc,
                        exc_info=True,
                    )
                    last_db_error_log_at = now
                else:
                    logger.warning(
                        "Autopilot worker DB connectivity failure (attempt=%s, backoff=%ss, db=%s): %s",
                        consecutive_db_errors,
                        wait_seconds,
                        get_database_endpoint_summary(),
                        exc,
                    )
            else:
                logger.error("Autopilot worker iteration failed: %s", exc, exc_info=True)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=wait_seconds)
        except asyncio.TimeoutError:
            pass

    logger.info("Autopilot worker stopped")
