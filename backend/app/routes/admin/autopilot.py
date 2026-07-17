from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.domains.blockchain.nft.chain_registry import get_chain_config
from app.domains.blockchain.attestation.chain_registry import get_attestation_chain_config
from app.domains.mental_health.models.autopilot_actions import (
    AutopilotAction,
    AutopilotActionStatus,
    AutopilotActionType,
)
from app.domains.mental_health.services.autopilot_action_service import (
    get_action_by_id,
    list_actions,
    review_action,
)
from app.schemas.admin.autopilot import (
    AutopilotActionListResponse,
    AutopilotActionResponse,
    AutopilotActionReviewRequest,
    AutopilotActionReviewResponse,
)

router = APIRouter(prefix="/autopilot", tags=["Admin - Autopilot"])


class AutopilotStatusResponse(BaseModel):
    enabled: bool
    onchain_placeholder: bool
    worker_interval_seconds: int


class AutopilotPolicyResponse(BaseModel):
    autopilot_enabled: bool
    onchain_placeholder: bool
    worker_interval_seconds: int


class AutopilotPolicyUpdateRequest(BaseModel):
    autopilot_enabled: bool | None = None
    onchain_placeholder: bool | None = None
    worker_interval_seconds: int | None = Field(default=None, ge=1, le=3600)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _set_env_bool(name: str, value: bool) -> None:
    os.environ[name] = "true" if value else "false"


def _set_env_int(name: str, value: int) -> None:
    os.environ[name] = str(value)


def _to_action_response(action: AutopilotAction) -> AutopilotActionResponse:
    explorer_tx_url = None
    if action.chain_id and action.tx_hash:
        # Try NFT registry first (for badge minting)
        cfg = get_chain_config(int(action.chain_id))
        if cfg is not None:
            explorer_tx_url = cfg.explorer_tx_url(action.tx_hash)
        else:
            # Fallback to attestation registry
            att_cfg = get_attestation_chain_config(int(action.chain_id))
            if att_cfg is not None:
                explorer_tx_url = att_cfg.explorer_tx_url(action.tx_hash)

    return AutopilotActionResponse(
        id=action.id,
        action_type=action.action_type.value,
        risk_level=action.risk_level,
        policy_decision=action.policy_decision.value,
        status=action.status.value,
        idempotency_key=action.idempotency_key,
        payload_hash=action.payload_hash,
        payload_json=action.payload_json or {},
        tx_hash=action.tx_hash,
        explorer_tx_url=explorer_tx_url,
        chain_id=action.chain_id,
        error_message=action.error_message,
        approval_notes=action.approval_notes,
        retry_count=int(action.retry_count or 0),
        next_retry_at=action.next_retry_at,
        executed_at=action.executed_at,
        created_at=action.created_at,
        updated_at=action.updated_at,
    )


@router.get("/actions", response_model=AutopilotActionListResponse)
async def list_autopilot_actions(
    status: str | None = Query(default=None),
    action_type: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> AutopilotActionListResponse:
    del admin_user

    parsed_status = None
    if status:
        try:
            parsed_status = AutopilotActionStatus(status)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}") from exc

    parsed_action_type = None
    if action_type:
        try:
            parsed_action_type = AutopilotActionType(action_type)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid action_type: {action_type}") from exc

    items, total = await list_actions(
        db,
        status=parsed_status,
        action_type=parsed_action_type,
        risk_level=risk_level,
        skip=skip,
        limit=limit,
    )
    return AutopilotActionListResponse(
        items=[_to_action_response(item) for item in items],
        total=total,
    )


@router.get("/status", response_model=AutopilotStatusResponse)
async def get_autopilot_status(
    admin_user=Depends(get_admin_user),
) -> AutopilotStatusResponse:
    del admin_user
    return AutopilotStatusResponse(
        enabled=_env_bool("AUTOPILOT_ENABLED", True),
        onchain_placeholder=_env_bool("AUTOPILOT_ONCHAIN_PLACEHOLDER", True),
        worker_interval_seconds=max(1, _env_int("AUTOPILOT_WORKER_INTERVAL_SECONDS", 5)),
    )


@router.get("/policy", response_model=AutopilotPolicyResponse)
async def get_autopilot_policy(
    admin_user=Depends(get_admin_user),
) -> AutopilotPolicyResponse:
    del admin_user
    return AutopilotPolicyResponse(
        autopilot_enabled=_env_bool("AUTOPILOT_ENABLED", True),
        onchain_placeholder=_env_bool("AUTOPILOT_ONCHAIN_PLACEHOLDER", True),
        worker_interval_seconds=max(1, _env_int("AUTOPILOT_WORKER_INTERVAL_SECONDS", 5)),
    )


@router.patch("/policy", response_model=AutopilotPolicyResponse)
async def update_autopilot_policy(
    payload: AutopilotPolicyUpdateRequest,
    admin_user=Depends(get_admin_user),
) -> AutopilotPolicyResponse:
    del admin_user

    if payload.autopilot_enabled is not None:
        _set_env_bool("AUTOPILOT_ENABLED", payload.autopilot_enabled)
    if payload.onchain_placeholder is not None:
        _set_env_bool("AUTOPILOT_ONCHAIN_PLACEHOLDER", payload.onchain_placeholder)
    if payload.worker_interval_seconds is not None:
        _set_env_int("AUTOPILOT_WORKER_INTERVAL_SECONDS", payload.worker_interval_seconds)

    return AutopilotPolicyResponse(
        autopilot_enabled=_env_bool("AUTOPILOT_ENABLED", True),
        onchain_placeholder=_env_bool("AUTOPILOT_ONCHAIN_PLACEHOLDER", True),
        worker_interval_seconds=max(1, _env_int("AUTOPILOT_WORKER_INTERVAL_SECONDS", 5)),
    )


@router.post("/actions/{action_id}/review", response_model=AutopilotActionReviewResponse)
async def review_autopilot_action(
    action_id: int,
    body: AutopilotActionReviewRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> AutopilotActionReviewResponse:
    """Approve or reject a pending autopilot action.

    The action must be in ``awaiting_approval`` status.  On approval the worker
    will pick it up on its next cycle; on rejection it is permanently halted.
    """
    action = await get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Autopilot action not found")

    try:
        updated = await review_action(
            db,
            action=action,
            decision=body.decision,
            reviewer_id=admin_user.id,
            reviewer_note=body.reviewer_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return AutopilotActionReviewResponse(
        id=updated.id,
        action_type=updated.action_type.value,
        status=updated.status.value,
        decision=body.decision,
        reviewer_note=updated.approval_notes,
        reviewed_at=datetime.now(timezone.utc),
    )


@router.get("/actions/{action_id}", response_model=AutopilotActionResponse)
async def get_autopilot_action(
    action_id: int,
    db: AsyncSession = Depends(get_async_db),
    admin_user=Depends(get_admin_user),
) -> AutopilotActionResponse:
    del admin_user
    action = await get_action_by_id(db, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Autopilot action not found")
    return _to_action_response(action)
