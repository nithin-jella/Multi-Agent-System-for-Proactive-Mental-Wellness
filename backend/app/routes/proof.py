from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.domains.blockchain.nft.chain_registry import get_chain_config
from app.domains.blockchain.attestation.chain_registry import get_attestation_chain_config
from app.domains.mental_health.models.autopilot_actions import AutopilotAction
from app.models import User

router = APIRouter(prefix="/api/v1/proof", tags=["Proof"])


class ProofActionItem(BaseModel):
    id: int
    action_type: str
    risk_level: str
    policy_decision: str
    status: str
    created_at: datetime
    executed_at: Optional[datetime] = None
    tx_hash: Optional[str] = None
    chain_id: Optional[int] = None
    explorer_tx_url: Optional[str] = None
    approval_notes: Optional[str] = None


class ProofActionListResponse(BaseModel):
    items: list[ProofActionItem]
    total: int


def _build_explorer_url(chain_id: Optional[int], tx_hash: Optional[str]) -> Optional[str]:
    if chain_id is None or not tx_hash:
        return None
    # Try NFT registry first (for badge minting)
    cfg = get_chain_config(int(chain_id))
    if cfg:
        return cfg.explorer_tx_url(tx_hash)
    # Fallback to attestation registry
    att_cfg = get_attestation_chain_config(int(chain_id))
    if att_cfg:
        return att_cfg.explorer_tx_url(tx_hash)
    return None


@router.get("/actions", response_model=ProofActionListResponse)
async def list_proof_actions(
    user_id: Optional[int] = Query(default=None, ge=1),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
) -> ProofActionListResponse:
    requested_user_id = user_id
    if requested_user_id is None:
        requested_user_id = current_user.id
    elif requested_user_id != current_user.id:
        role = (current_user.role or "").strip().lower()
        from app.core.role_utils import normalize_role, ALLOWED_ADMIN_ROLES
        if normalize_role(role) not in ALLOWED_ADMIN_ROLES - {"admin_viewer"}:
            raise HTTPException(status_code=403, detail="Insufficient permission for requested user_id")

    # user_id is stored inside payload_json to preserve flexibility across action types.
    user_id_text = str(requested_user_id)
    user_id_filter = AutopilotAction.payload_json.op("->>")("user_id") == user_id_text

    stmt = (
        select(AutopilotAction)
        .where(user_id_filter)
        .order_by(desc(AutopilotAction.created_at))
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()

    total_stmt = select(AutopilotAction).where(user_id_filter)
    total = len((await db.execute(total_stmt)).scalars().all())

    items = [
        ProofActionItem(
            id=row.id,
            action_type=row.action_type.value,
            risk_level=row.risk_level,
            policy_decision=row.policy_decision.value,
            status=row.status.value,
            created_at=row.created_at,
            executed_at=row.executed_at,
            tx_hash=row.tx_hash,
            chain_id=row.chain_id,
            explorer_tx_url=_build_explorer_url(row.chain_id, row.tx_hash),
            approval_notes=row.approval_notes,
        )
        for row in rows
    ]

    return ProofActionListResponse(items=items, total=total)
