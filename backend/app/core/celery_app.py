from __future__ import annotations

import logging
from typing import Optional

from celery import Celery

from app.core.settings import settings

logger = logging.getLogger(__name__)


def _resolve_celery_url(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


broker_url = _resolve_celery_url(settings.celery_broker_url)
result_backend = None
if settings.celery_store_results:
    result_backend = _resolve_celery_url(settings.celery_result_backend)

celery_app = Celery(
    "ugm_aicare",
    broker=broker_url,
    backend=result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

if not broker_url:
    logger.warning("CELERY_BROKER_URL is not configured; task submission may fail.")
