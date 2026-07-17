"""Admin badge management routes (multi-chain).

Provides CRUD for badge templates, IPFS image/metadata upload via Pinata,
on-chain publishing (setTokenUri), and minting (mintBadge) across any
supported EVM chain.

All endpoints require admin authentication via ``get_admin_user``.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.blockchain.pinata_client import PinataError, ipfs_uri, pin_file_to_ipfs, pin_json_to_ipfs
from app.domains.blockchain.nft.chain_registry import (
    DEFAULT_BADGE_CHAIN_ID,
    SUPPORTED_CHAINS,
    get_chain_config,
    get_configured_chains,
)
from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory
from app.models import BadgeIssuance, BadgeTemplate, User, UserBadge
from app.schemas.admin.badges import (
    BadgeIssuanceListResponse,
    BadgeIssuanceResponse,
    BadgeMintRequest,
    BadgePublishResponse,
    BadgeTemplateCreate,
    BadgeTemplateListResponse,
    BadgeTemplateResponse,
    BadgeTemplateUpdate,
    ChainInfoResponse,
    ChainsListResponse,
)


router = APIRouter(prefix="/badges", tags=["Admin Badges"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_chain_display(chain_id: int) -> dict[str, Optional[str]]:
    """Return chain display metadata (name, short_name, explorer) or blanks."""
    cfg = get_chain_config(chain_id)
    if cfg is None:
        return {"chain_name": None, "chain_short_name": None, "explorer_base_url": None}
    return {
        "chain_name": cfg.name,
        "chain_short_name": cfg.short_name,
        "explorer_base_url": cfg.explorer_base_url,
    }


def _explorer_tx_url(chain_id: int, tx_hash: Optional[str]) -> Optional[str]:
    """Build a full block-explorer TX link, or None."""
    if not tx_hash:
        return None
    cfg = get_chain_config(chain_id)
    return cfg.explorer_tx_url(tx_hash) if cfg else None


def _as_template_response(template: BadgeTemplate) -> BadgeTemplateResponse:
    """Convert a BadgeTemplate ORM instance to a response schema with chain metadata."""
    image_uri = ipfs_uri(template.image_cid) if template.image_cid else None
    chain_display = _get_chain_display(template.chain_id)
    return BadgeTemplateResponse(
        id=template.id,
        chain_id=template.chain_id,
        contract_address=template.contract_address,
        token_id=template.token_id,
        name=template.name,
        description=template.description,
        image_uri=image_uri,
        metadata_uri=template.metadata_uri,
        status=template.status,
        auto_award_enabled=bool(template.auto_award_enabled),
        auto_award_action=template.auto_award_action,
        auto_award_criteria=template.auto_award_criteria,
        created_at=template.created_at,
        updated_at=template.updated_at,
        published_at=template.published_at,
        **chain_display,
    )


def _as_issuance_response(issuance: BadgeIssuance) -> BadgeIssuanceResponse:
    """Convert a BadgeIssuance ORM instance to a response schema with explorer link."""
    return BadgeIssuanceResponse(
        id=issuance.id,
        template_id=issuance.template_id,
        user_id=issuance.user_id,
        chain_id=issuance.chain_id,
        wallet_address=issuance.wallet_address,
        amount=issuance.amount,
        tx_hash=issuance.tx_hash,
        status=issuance.status,
        error_reason=issuance.error_reason,
        created_at=issuance.created_at,
        updated_at=issuance.updated_at,
        explorer_tx_url=_explorer_tx_url(issuance.chain_id, issuance.tx_hash),
    )


# ---------------------------------------------------------------------------
# Chain discovery
# ---------------------------------------------------------------------------

@router.get("/chains", response_model=ChainsListResponse)
async def list_supported_chains(
    admin_user: User = Depends(get_admin_user),
) -> ChainsListResponse:
    """Return every registered chain with its readiness status."""
    del admin_user
    factory = NFTClientFactory()
    ready_ids = set(factory.list_ready_chains())

    chains = [
        ChainInfoResponse(
            chain_id=cfg.chain_id,
            name=cfg.name,
            short_name=cfg.short_name,
            explorer_base_url=cfg.explorer_base_url,
            native_currency=cfg.native_currency,
            is_testnet=cfg.is_testnet,
            is_ready=cfg.chain_id in ready_ids,
        )
        for cfg in SUPPORTED_CHAINS.values()
    ]
    return ChainsListResponse(chains=chains)


# ---------------------------------------------------------------------------
# Badge template CRUD
# ---------------------------------------------------------------------------

@router.get("/templates", response_model=BadgeTemplateListResponse)
async def list_badge_templates(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeTemplateListResponse:
    """List all badge templates, newest first."""
    del admin_user
    result = await db.execute(
        select(BadgeTemplate).order_by(BadgeTemplate.created_at.desc())
    )
    templates = list(result.scalars())
    return BadgeTemplateListResponse(
        templates=[_as_template_response(t) for t in templates],
    )


@router.post(
    "/templates",
    response_model=BadgeTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_badge_template(
    payload: BadgeTemplateCreate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeTemplateResponse:
    """Create a new DRAFT badge template on the chosen chain."""
    del admin_user

    chain_id = payload.chain_id or DEFAULT_BADGE_CHAIN_ID
    cfg = get_chain_config(chain_id)
    if cfg is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported chain_id={chain_id}",
        )

    contract_address = (cfg.contract_address or "").strip()
    if not contract_address:
        raise HTTPException(
            status_code=500,
            detail=f"NFT contract address not configured for {cfg.name}",
        )

    if payload.auto_award_enabled:
        if not payload.auto_award_action:
            raise HTTPException(status_code=400, detail="auto_award_action is required when auto_award_enabled=true")
        if not payload.auto_award_criteria:
            raise HTTPException(status_code=400, detail="auto_award_criteria is required when auto_award_enabled=true")

    template = BadgeTemplate(
        chain_id=chain_id,
        contract_address=contract_address,
        token_id=payload.token_id,
        name=payload.name,
        description=payload.description,
        auto_award_enabled=payload.auto_award_enabled,
        auto_award_action=payload.auto_award_action,
        auto_award_criteria=payload.auto_award_criteria,
        status="DRAFT",
    )
    db.add(template)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Token ID {payload.token_id} already exists on chain {chain_id}",
        )
    await db.refresh(template)
    return _as_template_response(template)


@router.patch("/templates/{template_id}", response_model=BadgeTemplateResponse)
async def update_badge_template(
    template_id: int,
    payload: BadgeTemplateUpdate,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeTemplateResponse:
    """Update name/description of a DRAFT template."""
    del admin_user

    template = await db.get(BadgeTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Badge template not found")
    if template.status != "DRAFT":
        raise HTTPException(
            status_code=409,
            detail="Published badges are immutable; create a new token id",
        )

    if payload.name is not None:
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description

    provided = payload.model_fields_set
    if "auto_award_enabled" in provided:
        template.auto_award_enabled = bool(payload.auto_award_enabled)
    if "auto_award_action" in provided:
        template.auto_award_action = payload.auto_award_action
    if "auto_award_criteria" in provided:
        template.auto_award_criteria = payload.auto_award_criteria

    if template.auto_award_enabled:
        if not template.auto_award_action:
            raise HTTPException(status_code=400, detail="auto_award_action is required when auto_award_enabled=true")
        if not template.auto_award_criteria:
            raise HTTPException(status_code=400, detail="auto_award_criteria is required when auto_award_enabled=true")

    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _as_template_response(template)


# ---------------------------------------------------------------------------
# Image upload
# ---------------------------------------------------------------------------

@router.post("/templates/{template_id}/image", response_model=BadgeTemplateResponse)
async def upload_badge_image(
    template_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeTemplateResponse:
    """Upload or replace the badge image (IPFS via Pinata). Only allowed on DRAFT."""
    del admin_user

    template = await db.get(BadgeTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Badge template not found")
    if template.status != "DRAFT":
        raise HTTPException(status_code=409, detail="Cannot change image after publish")

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB)")

    try:
        pin = await pin_file_to_ipfs(
            file_bytes=raw,
            filename=file.filename or f"badge-{template.token_id}.png",
            content_type=content_type,
            name=f"badge-{template.token_id}-{template.name}",
        )
    except PinataError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    template.image_cid = pin.cid
    template.image_mime = content_type
    template.image_filename = file.filename
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _as_template_response(template)


# ---------------------------------------------------------------------------
# Publish (pin metadata + setTokenUri on-chain)
# ---------------------------------------------------------------------------

@router.post("/templates/{template_id}/publish", response_model=BadgePublishResponse)
async def publish_badge_template(
    template_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgePublishResponse:
    """Pin ERC-1155 metadata to IPFS and call setTokenUri on the template's chain."""
    del admin_user

    template = await db.get(BadgeTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Badge template not found")
    if template.status != "DRAFT":
        raise HTTPException(
            status_code=409,
            detail="Badge template is already published/archived",
        )
    if not template.image_cid:
        raise HTTPException(status_code=400, detail="Upload an image before publishing")

    # Build ERC-1155 metadata JSON (content-addressed, effectively immutable)
    metadata = {
        "name": template.name,
        "description": template.description or "",
        "image": ipfs_uri(template.image_cid),
        "attributes": [
            {"trait_type": "token_id", "value": template.token_id},
            {"trait_type": "contract", "value": template.contract_address},
            {"trait_type": "chain_id", "value": template.chain_id},
        ],
    }

    try:
        pinned = await pin_json_to_ipfs(
            payload=metadata,
            name=f"badge-{template.token_id}-metadata",
        )
    except PinataError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    template.metadata_cid = pinned.cid
    template.metadata_uri = ipfs_uri(pinned.cid)
    template.status = "PUBLISHED"
    template.published_at = datetime.utcnow()
    db.add(template)
    await db.commit()
    await db.refresh(template)

    # Call setTokenUri on the correct chain (sync web3, so offload to threadpool)
    tx_hash: Optional[str] = None
    factory = NFTClientFactory()
    try:
        client = await factory.get_client(template.chain_id)
        if client and client.is_ready:
            tx_hash = await run_in_threadpool(
                client.set_token_uri, template.token_id, template.metadata_uri or "",
            )
    except Exception:
        # Best-effort: publishing metadata is the critical path, not the on-chain URI
        tx_hash = None

    return BadgePublishResponse(
        template=_as_template_response(template),
        metadata_cid=pinned.cid,
        metadata_uri=template.metadata_uri or "",
        set_token_uri_tx_hash=tx_hash,
    )


# ---------------------------------------------------------------------------
# Mint to user
# ---------------------------------------------------------------------------

@router.post(
    "/templates/{template_id}/mint",
    response_model=BadgeIssuanceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def mint_badge_to_user(
    template_id: int,
    payload: BadgeMintRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeIssuanceResponse:
    """Mint a published badge to a user's wallet on the template's chain."""
    template = await db.get(BadgeTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Badge template not found")
    if template.status != "PUBLISHED":
        raise HTTPException(status_code=409, detail="Only published badges can be minted")

    user = await db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet = (user.wallet_address or "").strip()
    if not wallet:
        raise HTTPException(status_code=400, detail="User has no linked wallet_address")

    issuance = BadgeIssuance(
        template_id=template.id,
        user_id=user.id,
        requested_by_admin_id=admin_user.id,
        wallet_address=wallet,
        amount=payload.amount,
        chain_id=template.chain_id,
        status="PENDING",
    )
    db.add(issuance)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This user already has an issuance for this badge on this chain",
        )
    await db.refresh(issuance)

    # Mint on-chain via the multi-chain NFT client
    factory = NFTClientFactory()
    tx_hash: Optional[str] = None
    try:
        client = await factory.get_client(template.chain_id)
        if client and client.is_ready:
            tx_hash = await run_in_threadpool(
                client.mint_badge, wallet, template.token_id, payload.amount,
            )
    except Exception:
        tx_hash = None

    issuance.tx_hash = tx_hash
    issuance.status = "SENT" if tx_hash else "FAILED"
    issuance.error_reason = None if tx_hash else "Minting failed (no tx hash returned)"
    db.add(issuance)

    # Sync to user_badges table for existing UI compatibility
    if tx_hash:
        try:
            awarded = UserBadge(
                user_id=user.id,
                badge_id=template.token_id,
                contract_address=template.contract_address,
                transaction_hash=tx_hash,
                chain_id=template.chain_id,
            )
            db.add(awarded)
        except Exception:
            pass  # best-effort; do not fail the issuance record

    await db.commit()
    await db.refresh(issuance)
    return _as_issuance_response(issuance)


# ---------------------------------------------------------------------------
# Issuance history
# ---------------------------------------------------------------------------

@router.get("/templates/{template_id}/issuances", response_model=BadgeIssuanceListResponse)
async def list_badge_issuances(
    template_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BadgeIssuanceListResponse:
    """List all mint issuances for a specific badge template."""
    del admin_user
    stmt = (
        select(BadgeIssuance)
        .where(BadgeIssuance.template_id == template_id)
        .order_by(BadgeIssuance.created_at.desc())
    )
    result = await db.execute(stmt)
    issuances = list(result.scalars())
    return BadgeIssuanceListResponse(
        issuances=[_as_issuance_response(i) for i in issuances],
    )
