# backend/app/routes/link_did.py
import logging
from fastapi import APIRouter, Depends, HTTPException # type: ignore
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User
from app.dependencies import get_current_active_user
from app.database import get_async_db
from app.schemas.user import LinkDIDRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Link DID"])

@router.post("/link-did")
async def link_did(payload: LinkDIDRequest, db: AsyncSession = Depends(get_async_db), user: User = Depends(get_current_active_user)):
    if not payload.wallet_address:
        raise HTTPException(status_code=400, detail="Missing wallet address")

    # Prevent collision
    result = await db.execute(select(User).filter(User.wallet_address == payload.wallet_address))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="This wallet is already linked to another account")

    setattr(user, 'wallet_address', payload.wallet_address)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Retroactively mint any badges the user qualified for while they had no wallet.
    try:
        from app.services.achievement_service import drain_pending_grants
        newly_minted = await drain_pending_grants(db, user)
        if newly_minted:
            logger.info(
                "Drained %s pending badge grants for user %s after wallet linkage",
                len(newly_minted),
                user.id,
            )
    except Exception as exc:
        # Non-fatal: wallet is already linked; badge drain can be retried via manual sync.
        logger.warning(
            "Pending badge drain failed for user %s after wallet linkage: %s", user.id, exc
        )

    return {"status": "linked", "address": payload.wallet_address}
