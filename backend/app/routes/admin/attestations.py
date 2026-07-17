from __future__ import annotations

from datetime import datetime
from statistics import mean
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.blockchain.attestation import (
    AttestationClientFactory,
    SUPPORTED_ATTESTATION_CHAINS,
)
from app.domains.mental_health.models.autopilot_actions import (
    AutopilotAction,
    AutopilotActionStatus,
    AutopilotActionType,
)
from app.domains.mental_health.models.quests import AttestationRecord, AttestationStatusEnum

router = APIRouter(prefix="/attestations", tags=["Admin - Attestations"])


def _network_logo_url(network: str, chain_id: int) -> Optional[str]:
    if chain_id in {56, 97} or "bnb" in network.lower():
        return "https://cryptologos.cc/logos/bnb-bnb-logo.png?v=040"
    if "edu" in network.lower():
        return "https://assets.coingecko.com/coins/images/29973/small/EDU.png"
    if "somnia" in network.lower():
        return "https://img.icons8.com/fluency/48/blockchain-technology.png"
    return "https://img.icons8.com/fluency/48/blockchain-technology.png"


class AttestationCounts(BaseModel):
    total: int = 0
    pending: int = 0
    queued: int = 0
    confirmed: int = 0
    failed: int = 0


class PublishQueueCounts(BaseModel):
    total: int = 0
    queued: int = 0
    approved: int = 0
    running: int = 0
    confirmed: int = 0
    failed: int = 0
    dead_letter: int = 0


class AttestationContractTelemetry(BaseModel):
    chain_id: int
    network: str
    short_name: str
    contract_address: Optional[str] = None
    publisher_address: Optional[str] = None
    is_ready: bool
    rpc_connected: bool
    publish_attempts: int = 0
    publish_successes: int = 0
    publish_failures: int = 0
    last_tx_hash: Optional[str] = None
    last_publish_attempt_at: Optional[datetime] = None
    last_publish_success_at: Optional[datetime] = None
    onchain_total_published: Optional[int] = None
    onchain_last_published_at: Optional[datetime] = None
    onchain_publisher_published: Optional[int] = None
    last_error: Optional[str] = None
    last_onchain_read_error: Optional[str] = None
    explorer_base_url: Optional[str] = None
    network_logo_url: Optional[str] = None


class AttestationRecordItem(BaseModel):
    id: int
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    counselor_id: int
    quest_instance_id: Optional[int] = None
    tx_hash: Optional[str] = None
    chain_id: Optional[int] = None
    attestation_id: Optional[str] = None
    last_error: Optional[str] = None
    schema_name: Optional[str] = None
    attestation_type: Optional[str] = None
    decision: Optional[str] = None
    feedback_redacted: Optional[str] = None


class PublishActionItem(BaseModel):
    id: int
    status: str
    retry_count: int
    created_at: datetime
    executed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    tx_hash: Optional[str] = None
    chain_id: Optional[int] = None
    error_message: Optional[str] = None
    attestation_record_id: Optional[int] = None
    attestation_id: Optional[str] = None


class AttestationMonitorResponse(BaseModel):
    generated_at: datetime
    counts: AttestationCounts
    publish_queue: PublishQueueCounts
    success_rate_percent: float
    avg_confirmation_seconds: Optional[float] = None
    contracts: list[AttestationContractTelemetry] = Field(default_factory=list)
    recent_records: list[AttestationRecordItem] = Field(default_factory=list)
    recent_publish_actions: list[PublishActionItem] = Field(default_factory=list)


def _to_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return int(stripped)
        except ValueError:
            return None
    return None


@router.get("/monitor", response_model=AttestationMonitorResponse)
async def get_attestation_monitor(
    recent_limit: int = Query(default=15, ge=5, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> AttestationMonitorResponse:
    del admin_user

    status_rows = (
        await db.execute(
            select(AttestationRecord.status, func.count(AttestationRecord.id)).group_by(AttestationRecord.status)
        )
    ).all()
    status_map: dict[str, int] = {str(status.value if hasattr(status, "value") else status): int(count) for status, count in status_rows}

    counts = AttestationCounts(
        total=sum(status_map.values()),
        pending=status_map.get(AttestationStatusEnum.PENDING.value, 0),
        queued=status_map.get(AttestationStatusEnum.QUEUED.value, 0),
        confirmed=status_map.get(AttestationStatusEnum.CONFIRMED.value, 0),
        failed=status_map.get(AttestationStatusEnum.FAILED.value, 0),
    )

    publish_rows = (
        await db.execute(
            select(AutopilotAction.status, func.count(AutopilotAction.id))
            .where(AutopilotAction.action_type == AutopilotActionType.publish_attestation)
            .group_by(AutopilotAction.status)
        )
    ).all()
    publish_map: dict[str, int] = {str(status.value if hasattr(status, "value") else status): int(count) for status, count in publish_rows}
    publish_queue = PublishQueueCounts(
        total=sum(publish_map.values()),
        queued=publish_map.get(AutopilotActionStatus.queued.value, 0),
        approved=publish_map.get(AutopilotActionStatus.approved.value, 0),
        running=publish_map.get(AutopilotActionStatus.running.value, 0),
        confirmed=publish_map.get(AutopilotActionStatus.confirmed.value, 0),
        failed=publish_map.get(AutopilotActionStatus.failed.value, 0),
        dead_letter=publish_map.get(AutopilotActionStatus.dead_letter.value, 0),
    )

    success_rate_percent = 0.0
    if counts.total > 0:
        success_rate_percent = round((counts.confirmed / counts.total) * 100.0, 2)

    confirmations = (
        await db.execute(
            select(AttestationRecord.created_at, AttestationRecord.processed_at)
            .where(
                AttestationRecord.status == AttestationStatusEnum.CONFIRMED,
                AttestationRecord.processed_at.is_not(None),
            )
            .order_by(AttestationRecord.processed_at.desc())
            .limit(200)
        )
    ).all()

    confirmation_seconds = [
        max(0.0, (processed_at - created_at).total_seconds())
        for created_at, processed_at in confirmations
        if created_at is not None and processed_at is not None
    ]
    avg_confirmation_seconds = round(mean(confirmation_seconds), 2) if confirmation_seconds else None

    recent_records_rows = (
        await db.execute(
            select(AttestationRecord)
            .order_by(AttestationRecord.created_at.desc())
            .limit(recent_limit)
        )
    ).scalars().all()

    recent_records = [
        AttestationRecordItem(
            id=int(record.id),
            status=record.status.value if hasattr(record.status, "value") else str(record.status),
            created_at=record.created_at,
            processed_at=record.processed_at,
            counselor_id=int(record.counselor_id),
            quest_instance_id=record.quest_instance_id,
            tx_hash=(record.extra_data or {}).get("tx_hash"),
            chain_id=(record.extra_data or {}).get("chain_id"),
            attestation_id=(record.extra_data or {}).get("attestation_id"),
            last_error=record.last_error,
            schema_name=(record.extra_data or {}).get("schema"),
            attestation_type=(record.extra_data or {}).get("attestation_type"),
            decision=(record.extra_data or {}).get("decision"),
            feedback_redacted=(record.extra_data or {}).get("feedback_redacted"),
        )
        for record in recent_records_rows
    ]

    recent_publish_rows = (
        await db.execute(
            select(AutopilotAction)
            .where(AutopilotAction.action_type == AutopilotActionType.publish_attestation)
            .order_by(AutopilotAction.created_at.desc())
            .limit(recent_limit)
        )
    ).scalars().all()

    recent_publish_actions = [
        PublishActionItem(
            id=int(action.id),
            status=action.status.value if hasattr(action.status, "value") else str(action.status),
            retry_count=int(action.retry_count or 0),
            created_at=action.created_at,
            executed_at=action.executed_at,
            next_retry_at=action.next_retry_at,
            tx_hash=action.tx_hash,
            chain_id=action.chain_id,
            error_message=action.error_message,
            attestation_record_id=(action.payload_json or {}).get("attestation_record_id"),
            attestation_id=(action.payload_json or {}).get("attestation_id"),
        )
        for action in recent_publish_rows
    ]

    contracts: list[AttestationContractTelemetry] = []
    for cfg in SUPPORTED_ATTESTATION_CHAINS.values():
        client = await AttestationClientFactory.get_client(cfg.chain_id)
        snapshot: dict[str, Any] = client.status_snapshot() if client else {}
        onchain_total_published = _to_int(snapshot.get("onchain_total_published"))
        onchain_last_published_at_epoch = _to_int(snapshot.get("onchain_last_published_at"))
        onchain_publisher_published = _to_int(snapshot.get("onchain_publisher_published"))
        contracts.append(
            AttestationContractTelemetry(
                chain_id=cfg.chain_id,
                network=cfg.name,
                short_name=cfg.short_name,
                contract_address=cfg.contract_address,
                publisher_address=snapshot.get("publisher_address"),
                is_ready=bool(snapshot.get("is_ready")),
                rpc_connected=bool(snapshot.get("rpc_connected")),
                publish_attempts=int(snapshot.get("publish_attempts") or 0),
                publish_successes=int(snapshot.get("publish_successes") or 0),
                publish_failures=int(snapshot.get("publish_failures") or 0),
                last_tx_hash=snapshot.get("last_tx_hash"),
                last_publish_attempt_at=(
                    datetime.fromisoformat(snapshot["last_publish_attempt_at"])
                    if isinstance(snapshot.get("last_publish_attempt_at"), str)
                    else None
                ),
                last_publish_success_at=(
                    datetime.fromisoformat(snapshot["last_publish_success_at"])
                    if isinstance(snapshot.get("last_publish_success_at"), str)
                    else None
                ),
                onchain_total_published=onchain_total_published,
                onchain_last_published_at=(
                    datetime.utcfromtimestamp(onchain_last_published_at_epoch)
                    if onchain_last_published_at_epoch is not None
                    else None
                ),
                onchain_publisher_published=onchain_publisher_published,
                last_error=snapshot.get("last_error"),
                last_onchain_read_error=snapshot.get("last_onchain_read_error"),
                explorer_base_url=cfg.explorer_base_url,
                network_logo_url=_network_logo_url(cfg.name, cfg.chain_id),
            )
        )

    return AttestationMonitorResponse(
        generated_at=datetime.utcnow(),
        counts=counts,
        publish_queue=publish_queue,
        success_rate_percent=success_rate_percent,
        avg_confirmation_seconds=avg_confirmation_seconds,
        contracts=contracts,
        recent_records=recent_records,
        recent_publish_actions=recent_publish_actions,
    )
