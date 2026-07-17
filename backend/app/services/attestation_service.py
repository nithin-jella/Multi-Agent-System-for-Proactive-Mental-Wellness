from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AttestationRecord, AttestationStatusEnum, User  # Core models
from app.domains.mental_health.models import QuestInstance
from app.core.settings import settings
from app.services.compliance_service import record_audit_event

logger = logging.getLogger(__name__)


def _hash_payload(payload: Dict[str, object]) -> str:
    digest = hashlib.sha256()
    digest.update(repr(sorted(payload.items())).encode("utf-8"))
    return digest.hexdigest()


class AttestationService:
    """Queues counselor attestations for on-chain publishing."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def queue_attestation(
        self,
        *,
        quest_instance: Optional[QuestInstance],
        counselor: User,
        payload: Dict[str, object],
    ) -> AttestationRecord:
        hashed_payload = _hash_payload(payload)

        stmt = select(AttestationRecord).where(
            AttestationRecord.hashed_payload == hashed_payload,
            AttestationRecord.counselor_id == counselor.id,
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            logger.info("Attestation already queued for counselor %s", counselor.id)
            return existing

        record = AttestationRecord(
            quest_instance_id=quest_instance.id if quest_instance else None,
            counselor_id=counselor.id,
            hashed_payload=hashed_payload,
            status=AttestationStatusEnum.PENDING,
            extra_data={"payload_preview": list(payload.keys())},
        )
        self.session.add(record)
        await self.session.flush()

        await record_audit_event(
            self.session,
            actor_id=counselor.id,
            actor_role=counselor.role,
            action="attestation.recorded",
            entity_type="quest_instance",
            entity_id=str(quest_instance.id) if quest_instance else None,
            extra_data={"record_id": record.id},
        )

        if settings.celery_broker_url:
            try:
                from app.tasks.attestation_tasks import queue_attestation_job
                queue_attestation_job.delay(record.id)
            except Exception as exc:
                logger.error("Failed to enqueue attestation job for %s: %s", record.id, exc, exc_info=True)
        else:
            logger.warning("CELERY_BROKER_URL is not set; attestation job will not be processed")
        return record

    async def mark_submitted(self, record: AttestationRecord) -> None:
        record.status = AttestationStatusEnum.QUEUED
        await self.session.flush()

    async def mark_confirmed(self, record: AttestationRecord, tx_hash: str) -> None:
        record.status = AttestationStatusEnum.CONFIRMED
        record.processed_at = datetime.utcnow()
        record.extra_data["tx_hash"] = tx_hash
        await self.session.flush()


