"""Services for managing content resources backed by MinIO."""
from __future__ import annotations

import asyncio
import io
import logging
import os
import uuid
from functools import lru_cache
from typing import Any, Dict, Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException, UploadFile
from minio import Minio
from minio.error import S3Error
from PyPDF2 import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.mental_health.models import ContentResource
from app.core.settings import settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {"text", "url", "pdf"}


class ResourceIngestionResult(Dict[str, Any]):
    """Dictionary describing processed resource details."""


@lru_cache
def get_minio_client() -> Minio:
    endpoint = os.getenv("MINIO_ENDPOINT")
    access_key = os.getenv("MINIO_ACCESS_KEY")
    secret_key = os.getenv("MINIO_SECRET_KEY")
    secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
    if not endpoint or not access_key or not secret_key:
        raise RuntimeError("MinIO configuration is incomplete")
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


def get_minio_bucket_name() -> str:
    return os.getenv("MINIO_BUCKET", "content-resources")


async def _ensure_bucket(client: Minio, bucket: str) -> None:
    exists = await asyncio.to_thread(client.bucket_exists, bucket)
    if not exists:
        await asyncio.to_thread(client.make_bucket, bucket)


async def upload_bytes(data: bytes, *, filename: Optional[str], content_type: str) -> tuple[str, str]:
    client = get_minio_client()
    bucket = get_minio_bucket_name()
    await _ensure_bucket(client, bucket)
    ext = os.path.splitext(filename or "")[1]
    object_name = f"content-resources/{uuid.uuid4()}{ext}"

    def _upload() -> None:
        client.put_object(bucket, object_name, io.BytesIO(data), length=len(data), content_type=content_type)

    await asyncio.to_thread(_upload)
    return bucket, object_name


async def download_from_minio(bucket: str, object_name: str) -> bytes:
    client = get_minio_client()

    def _download() -> bytes:
        response = client.get_object(bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    return await asyncio.to_thread(_download)


async def delete_from_minio(bucket: str, object_name: str) -> None:
    client = get_minio_client()

    def _delete() -> None:
        try:
            client.remove_object(bucket, object_name)
        except S3Error as exc:  # pragma: no cover
            logger.warning("Failed to delete object %s from bucket %s: %s", object_name, bucket, exc)

    await asyncio.to_thread(_delete)


async def _crawl_url(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        html = response.text

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = "\n".join(chunk.strip() for chunk in soup.stripped_strings)
    return text, html


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception as err:  # pragma: no cover
            logger.warning("Failed to extract page text: %s", err)
    return "\n".join(pages)


async def ingest_text_resource(payload: Dict[str, Any]) -> ResourceIngestionResult:
    return ResourceIngestionResult(
        processed_content=payload.get("content", ""),
        metadata={},
        mime_type="text/plain",
        storage_backend="database",
        object_storage_key=None,
        object_storage_bucket=None,
        chunk_count=0,
    )


async def ingest_url_resource(url: str) -> ResourceIngestionResult:
    text, html = await _crawl_url(url)
    bucket, object_name = await upload_bytes(html.encode("utf-8"), filename="page.html", content_type="text/html")
    return ResourceIngestionResult(
        processed_content=text,
        metadata={"source_url": url},
        mime_type="text/html",
        storage_backend="minio",
        object_storage_key=object_name,
        object_storage_bucket=bucket,
        chunk_count=0,
    )


async def ingest_pdf_resource(file: UploadFile) -> ResourceIngestionResult:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded PDF is empty")
    text = _extract_pdf_text(data)
    bucket, object_name = await upload_bytes(data, filename=file.filename, content_type="application/pdf")
    return ResourceIngestionResult(
        processed_content=text,
        metadata={"filename": file.filename, "bucket": bucket},
        mime_type="application/pdf",
        storage_backend="minio",
        object_storage_key=object_name,
        object_storage_bucket=bucket,
        chunk_count=0,
    )


async def enqueue_embedding_job(resource_id: int) -> None:
    logger.info("Queueing embedding job for resource %s", resource_id)

    async with AsyncSessionLocal() as db:
        resource = await db.get(ContentResource, resource_id)
        if resource is None:
            logger.warning("Embedding job skipped; resource %s not found", resource_id)
            return
        resource.embedding_status = "queued"
        await db.commit()

    if not settings.celery_broker_url:
        logger.warning("CELERY_BROKER_URL is not set; embedding job will not be processed")
        return

    try:
        from app.tasks.embedding_tasks import process_embedding_job
        process_embedding_job.delay(resource_id)
    except Exception as exc:
        logger.error("Failed to enqueue embedding job for %s: %s", resource_id, exc, exc_info=True)


async def ensure_resource_exists(db: AsyncSession, resource_id: int) -> ContentResource:
    instance = await db.scalar(select(ContentResource).where(ContentResource.id == resource_id))
    if not instance:
        raise HTTPException(status_code=404, detail="Content resource not found")
    return instance
