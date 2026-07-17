from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.core.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.domains.mental_health.models import ContentResource

logger = logging.getLogger(__name__)


def _run_async(coro) -> None:
    try:
        asyncio.run(coro)
    except RuntimeError:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(coro)


async def _process_embedding(resource_id: int) -> None:
    async with AsyncSessionLocal() as db:
        resource: Optional[ContentResource] = await db.get(ContentResource, resource_id)
        if resource is None:
            logger.warning("Embedding job skipped; resource %s not found", resource_id)
            return

        resource.embedding_status = "processing"
        resource.embedding_last_processed_at = datetime.utcnow()
        await db.commit()

        # Placeholder: actual embedding pipeline is not configured yet.
        resource.embedding_status = "failed"
        metadata = dict(resource.resource_metadata or {})
        metadata["embedding_error"] = "embedding_pipeline_not_configured"
        resource.resource_metadata = metadata
        resource.embedding_last_processed_at = datetime.utcnow()
        await db.commit()


@celery_app.task(name="ugm_aicare.process_embedding_job")
def process_embedding_job(resource_id: int) -> None:
    logger.info("Processing embedding job for resource %s", resource_id)
    _run_async(_process_embedding(resource_id))
