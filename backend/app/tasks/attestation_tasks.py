from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.core.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.domains.mental_health.models import AttestationRecord, AttestationStatusEnum

logger = logging.getLogger(__name__)


def _run_async(coro) -> None:
    try:
        asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(coro)


async def _queue_attestation(record_id: int) -> None:
    async with AsyncSessionLocal() as db:
        record: Optional[AttestationRecord] = await db.get(AttestationRecord, record_id)
        if record is None:
            logger.warning("Attestation job skipped; record %s not found", record_id)
            return

        if record.status in {AttestationStatusEnum.QUEUED, AttestationStatusEnum.CONFIRMED}:
            logger.info("Attestation record %s already queued or confirmed", record_id)
            return

        record.status = AttestationStatusEnum.QUEUED
        record.extra_data["queued_at"] = datetime.utcnow().isoformat()
        await db.commit()

        logger.info("Attestation record %s queued for downstream publishing", record_id)


@celery_app.task(name="ugm_aicare.queue_attestation_job")
def queue_attestation_job(record_id: int) -> None:
    logger.info("Queueing attestation job for record %s", record_id)
    _run_async(_queue_attestation(record_id))
