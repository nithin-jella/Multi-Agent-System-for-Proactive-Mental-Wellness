"""Route for linking an Open Campus ID (OCID) to a user's account.

The client completes the OCID OAuth/PKCE flow and receives an `id_token`
(a signed JWT from Open Campus). This endpoint:

1. Fetches the Open Campus JWKS and verifies the token signature and claims.
2. Extracts the `eth_address` (wallet) and `sub` (OCId username) claims.
3. Guards against wallet/OCId collisions across accounts.
4. Persists both values on the authenticated user's record.
5. Drains any pending badge grants that were blocked by the absent wallet.
"""

import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_current_active_user
from app.models import User
from app.schemas.user import OCIDLinkRequest, OCIDLinkResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Link OCID"])

# ---------------------------------------------------------------------------
# JWKS URLs — sandbox is used unless OCID_SANDBOX is explicitly "false".
# ---------------------------------------------------------------------------
_JWKS_SANDBOX = "https://static.opencampus.xyz/jwks/jwks-sandbox.json"
_JWKS_LIVE = "https://static.opencampus.xyz/jwks/jwks-live.json"


def _jwks_url() -> str:
    sandbox = os.getenv("OCID_SANDBOX", "true").lower()
    return _JWKS_SANDBOX if sandbox != "false" else _JWKS_LIVE


async def _fetch_jwks() -> dict:
    """Retrieve the Open Campus JSON Web Key Set over HTTPS."""
    url = _jwks_url()
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def _verify_id_token(id_token: str) -> dict:
    """Verify the OCID id_token signature and return its decoded claims.

    Raises HTTPException 401 on any verification failure so callers receive
    a clear, non-stack-trace error.
    """
    try:
        jwks_data = await _fetch_jwks()
    except Exception as exc:
        logger.error("Failed to fetch Open Campus JWKS: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Could not reach the Open Campus identity service. Please try again.",
        )

    # The OCID SDK issues tokens with algorithm RS256.
    try:
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"Malformed id_token header: {exc}")

    # Locate the matching key in the JWKS by `kid`.
    matching_key = None
    for key_data in jwks_data.get("keys", []):
        if key_data.get("kid") == kid:
            matching_key = key_data
            break

    if matching_key is None:
        # Fall back to the first available key if `kid` is absent (sandbox quirk).
        keys = jwks_data.get("keys", [])
        if keys:
            matching_key = keys[0]
        else:
            raise HTTPException(status_code=401, detail="No matching key found in OCID JWKS.")

    try:
        public_key = jwk.construct(matching_key)
        claims = jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # OCID tokens may not include `aud` in sandbox
        )
        return claims
    except JWTError as exc:
        raise HTTPException(status_code=401, detail=f"id_token verification failed: {exc}")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/link-ocid", response_model=OCIDLinkResponse)
async def link_ocid(
    payload: OCIDLinkRequest,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_active_user),
) -> OCIDLinkResponse:
    """Link an Open Campus ID and its associated wallet to the current user.

    Accepts the raw `id_token` from the OCID auth flow. The token is verified
    against the Open Campus JWKS before any mutations occur.
    """
    claims = await _verify_id_token(payload.id_token)

    # The OCID JWT carries the Ethereum address under `eth_address` and the
    # OCId identifier under `edu_username` or `sub` (documented claim names
    # vary between sandbox and live; we check both).
    eth_address: str | None = claims.get("eth_address")
    ocid_username: str | None = (
        claims.get("edu_username") or claims.get("sub") or claims.get("EDU_username")
    )

    if not eth_address:
        raise HTTPException(
            status_code=422,
            detail="id_token is missing the `eth_address` claim. Ensure this token was issued by Open Campus.",
        )
    if not ocid_username:
        raise HTTPException(
            status_code=422,
            detail="id_token is missing the OCId/username claim.",
        )

    # ------------------------------------------------------------------
    # Collision guards — prevent two accounts sharing the same identity.
    # ------------------------------------------------------------------

    wallet_conflict = await db.execute(
        select(User).where(
            User.wallet_address == eth_address,
            User.id != user.id,
        )
    )
    if wallet_conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This Ethereum wallet is already linked to another account.",
        )

    ocid_conflict = await db.execute(
        select(User).where(
            User.ocid_username == ocid_username,
            User.id != user.id,
        )
    )
    if ocid_conflict.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This Open Campus ID is already linked to another account.",
        )

    # ------------------------------------------------------------------
    # Persist — update both fields atomically.
    # ------------------------------------------------------------------

    user.wallet_address = eth_address  # type: ignore[assignment]
    user.ocid_username = ocid_username  # type: ignore[assignment]
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info(
        "User %s linked OCID '%s' with wallet %s",
        user.id,
        ocid_username,
        eth_address,
    )

    # ------------------------------------------------------------------
    # Badge drain — retroactively mint any achievements the user earned
    # before they had a wallet address.
    # ------------------------------------------------------------------

    newly_minted = []
    try:
        from app.services.achievement_service import drain_pending_grants

        newly_minted = await drain_pending_grants(db, user)
        if newly_minted:
            logger.info(
                "Drained %s pending badge grants for user %s after OCID linkage",
                len(newly_minted),
                user.id,
            )
    except Exception as exc:
        # Badge drain is non-fatal: the wallet and OCID are already saved.
        logger.warning(
            "Pending badge drain failed for user %s after OCID linkage: %s",
            user.id,
            exc,
        )

    return OCIDLinkResponse(
        status="linked",
        wallet_address=eth_address,
        ocid_username=ocid_username,
        newly_minted_badges=newly_minted,
    )
