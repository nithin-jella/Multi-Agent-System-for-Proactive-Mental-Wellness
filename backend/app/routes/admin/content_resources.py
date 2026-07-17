"""Content resource management endpoints for the admin panel."""
from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import User  # Core model
from app.domains.mental_health.models import ContentResource
from app.schemas.admin.content_resources import (
    ContentResourceItem,
    ContentResourceResponse,
)
from app.services import content_resource_service as resource_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Content Resources"])


def _parse_tags(raw_tags: Optional[str]) -> list[str]:
    return [tag.strip() for tag in (raw_tags or "").split(",") if tag.strip()]


@router.post("/content-resources", response_model=ContentResourceItem, status_code=status.HTTP_201_CREATED)
async def create_content_resource(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    type: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ContentResourceItem:
    """Create a new content resource suitable for retrieval augmented generation pipelines."""

    logger.info("Admin %s creating content resource '%s'", admin_user.id, title)
    resource_type = type.lower()
    if resource_type not in resource_service.SUPPORTED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported resource type")

    parsed_tags = _parse_tags(tags)

    ingestion_result: resource_service.ResourceIngestionResult

    if resource_type == "text":
        if not content:
            raise HTTPException(status_code=400, detail="Text resources require content")
        ingestion_result = await resource_service.ingest_text_resource({"content": content})
    elif resource_type == "url":
        if not source:
            raise HTTPException(status_code=400, detail="URL resources require a source URL")
        ingestion_result = await resource_service.ingest_url_resource(source)
    else:  # pdf
        if file is None:
            raise HTTPException(status_code=400, detail="PDF resources require an uploaded file")
        ingestion_result = await resource_service.ingest_pdf_resource(file)
        if not source:
            source = file.filename

    db_resource = ContentResource(
        title=title,
        type=resource_type,
        description=description,
        tags=parsed_tags,
        source=source,
        content=ingestion_result.get("processed_content", ""),
        resource_metadata=ingestion_result.get("metadata", {}),
        mime_type=ingestion_result.get("mime_type"),
        embedding_status="pending",
        chunk_count=ingestion_result.get("chunk_count", 0),
        storage_backend=ingestion_result.get("storage_backend", "database"),
        object_storage_key=ingestion_result.get("object_storage_key"),
        object_storage_bucket=ingestion_result.get("object_storage_bucket"),
    )

    db.add(db_resource)
    await db.commit()
    await db.refresh(db_resource)

    background_tasks.add_task(resource_service.enqueue_embedding_job, db_resource.id)
    return ContentResourceItem.model_validate(db_resource)


@router.get("/content-resources", response_model=ContentResourceResponse)
async def get_content_resources(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None, alias="type"),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ContentResourceResponse:
    """Get a paginated list of content resources with filtering and sorting."""

    logger.info(
        "Admin %s requesting content resources (page=%s, limit=%s, search=%s, type=%s)",
        admin_user.id,
        page,
        limit,
        search,
        resource_type,
    )

    filters = []
    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                ContentResource.title.ilike(pattern),
                ContentResource.description.ilike(pattern),
            )
        )
    if resource_type:
        filters.append(ContentResource.type == resource_type)

    sort_column_map = {
        "title": ContentResource.title,
        "type": ContentResource.type,
        "created_at": ContentResource.created_at,
        "updated_at": ContentResource.updated_at,
        "embedding_status": ContentResource.embedding_status,
    }
    sort_column = sort_column_map.get(sort_by, ContentResource.created_at)
    sort_method = desc if sort_order.lower() == "desc" else asc

    base_query = select(ContentResource)
    for clause in filters:
        base_query = base_query.where(clause)

    total_count = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar() or 0

    results = await db.execute(
        base_query.order_by(sort_method(sort_column)).offset((page - 1) * limit).limit(limit)
    )
    items = [ContentResourceItem.model_validate(row) for row in results.scalars().all()]

    return ContentResourceResponse(items=items, total_count=total_count)


@router.get("/content-resources/{resource_id}", response_model=ContentResourceItem)
async def get_content_resource(
    resource_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ContentResourceItem:
    """Get a single content resource by ID."""

    logger.info("Admin %s requesting content resource %s", admin_user.id, resource_id)
    resource = await resource_service.ensure_resource_exists(db, resource_id)
    return ContentResourceItem.model_validate(resource)


@router.get("/content-resources/types", response_model=list[str])
async def get_content_resource_types(
    admin_user: User = Depends(get_admin_user),
) -> list[str]:
    """Return the supported resource types for the admin UI."""

    logger.info("Admin %s requesting content resource types", admin_user.id)
    return sorted(resource_service.SUPPORTED_TYPES)


@router.get("/content-resources/{resource_id}/file")
async def download_content_resource_file(
    resource_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> StreamingResponse:
    """Stream the raw binary backing the resource (PDF or crawled HTML)."""

    logger.info("Admin %s downloading content resource file %s", admin_user.id, resource_id)
    resource = await resource_service.ensure_resource_exists(db, resource_id)

    media_type = resource.mime_type or "application/octet-stream"
    filename = resource.source or f"resource-{resource_id}"

    if resource.storage_backend == "minio" and resource.object_storage_key:
        bucket = resource.object_storage_bucket or resource_service.get_minio_bucket_name()
        binary = await resource_service.download_from_minio(bucket, resource.object_storage_key)
    else:
        raise HTTPException(status_code=404, detail="Resource has no stored binary")

    return StreamingResponse(
        io.BytesIO(binary),
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename=\"{filename}\""},
    )


@router.put("/content-resources/{resource_id}", response_model=ContentResourceItem)
async def update_content_resource(
    resource_id: int,
    background_tasks: BackgroundTasks,
    title: Optional[str] = Form(None),
    type: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ContentResourceItem:
    """Update a content resource and optionally re-ingest new source material."""

    logger.info("Admin %s updating content resource %s", admin_user.id, resource_id)
    db_resource = await resource_service.ensure_resource_exists(db, resource_id)

    new_type = (type or db_resource.type).lower()
    if new_type not in resource_service.SUPPORTED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported resource type")

    ingestion_result: Optional[resource_service.ResourceIngestionResult] = None

    if new_type == "text" and content is not None:
        ingestion_result = await resource_service.ingest_text_resource({"content": content})
    elif new_type == "url" and source is not None:
        ingestion_result = await resource_service.ingest_url_resource(source)
    elif new_type == "pdf" and file is not None:
        ingestion_result = await resource_service.ingest_pdf_resource(file)
        if not source:
            source = file.filename

    if title is not None:
        db_resource.title = title
    if description is not None:
        db_resource.description = description
    if tags is not None:
        db_resource.tags = _parse_tags(tags)
    if source is not None:
        db_resource.source = source

    db_resource.type = new_type

    if ingestion_result:
        if db_resource.storage_backend == "minio" and db_resource.object_storage_key:
            bucket_to_delete = db_resource.object_storage_bucket or resource_service.get_minio_bucket_name()
            await resource_service.delete_from_minio(bucket_to_delete, db_resource.object_storage_key)

        db_resource.content = ingestion_result.get("processed_content", "")
        db_resource.resource_metadata = ingestion_result.get("metadata", {})
        db_resource.mime_type = ingestion_result.get("mime_type")
        db_resource.embedding_status = "pending"
        db_resource.chunk_count = ingestion_result.get("chunk_count", 0)
        db_resource.storage_backend = ingestion_result.get("storage_backend", db_resource.storage_backend)
        db_resource.object_storage_key = ingestion_result.get("object_storage_key")
        db_resource.object_storage_bucket = ingestion_result.get("object_storage_bucket")
        background_tasks.add_task(resource_service.enqueue_embedding_job, db_resource.id)

    db_resource.updated_at = datetime.now()
    db.add(db_resource)
    await db.commit()
    await db.refresh(db_resource)
    return ContentResourceItem.model_validate(db_resource)


@router.delete("/content-resources/{resource_id}", status_code=status.HTTP_200_OK)
async def delete_content_resource(
    resource_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> dict[str, str]:
    """Delete a content resource."""

    logger.info("Admin %s deleting content resource %s", admin_user.id, resource_id)
    db_resource = await resource_service.ensure_resource_exists(db, resource_id)

    if db_resource.storage_backend == "minio" and db_resource.object_storage_key:
        bucket = db_resource.object_storage_bucket or resource_service.get_minio_bucket_name()
        await resource_service.delete_from_minio(bucket, db_resource.object_storage_key)

    await db.delete(db_resource)
    await db.commit()
    return {"detail": "deleted"}

