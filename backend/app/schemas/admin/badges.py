from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chain info (returned by GET /chains)
# ---------------------------------------------------------------------------

class ChainInfoResponse(BaseModel):
    """Describes a supported blockchain network for badge NFTs."""
    chain_id: int
    name: str
    short_name: str
    explorer_base_url: str
    native_currency: str
    is_testnet: bool
    is_ready: bool  # True when the backend can sign txs on this chain


class ChainsListResponse(BaseModel):
    chains: List[ChainInfoResponse]


# ---------------------------------------------------------------------------
# Badge template schemas
# ---------------------------------------------------------------------------

class BadgeTemplateBase(BaseModel):
    chain_id: int
    contract_address: str
    token_id: int
    name: str
    description: Optional[str] = None
    image_uri: Optional[str] = None
    metadata_uri: Optional[str] = None
    status: str
    auto_award_enabled: bool = False
    auto_award_action: Optional[str] = None
    auto_award_criteria: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None


class BadgeTemplateCreate(BaseModel):
    token_id: int = Field(..., ge=0)
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    # Optional chain_id; defaults to EDU Chain Testnet (656476) on the server
    chain_id: Optional[int] = None
    auto_award_enabled: bool = False
    auto_award_action: Optional[str] = Field(default=None, min_length=1, max_length=64)
    auto_award_criteria: Optional[Dict[str, Any]] = None


class BadgeTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    auto_award_enabled: Optional[bool] = None
    auto_award_action: Optional[str] = Field(default=None, min_length=1, max_length=64)
    auto_award_criteria: Optional[Dict[str, Any]] = None


class BadgeTemplateResponse(BadgeTemplateBase):
    id: int
    # Additional chain metadata for the frontend
    chain_name: Optional[str] = None
    chain_short_name: Optional[str] = None
    explorer_base_url: Optional[str] = None


class BadgeTemplateListResponse(BaseModel):
    templates: List[BadgeTemplateResponse]


# ---------------------------------------------------------------------------
# Badge issuance schemas
# ---------------------------------------------------------------------------

class BadgeIssuanceResponse(BaseModel):
    id: int
    template_id: int
    user_id: int
    chain_id: int
    wallet_address: str
    amount: int
    tx_hash: Optional[str] = None
    status: str
    error_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched explorer link for convenience
    explorer_tx_url: Optional[str] = None


class BadgeIssuanceListResponse(BaseModel):
    issuances: List[BadgeIssuanceResponse]


class BadgeMintRequest(BaseModel):
    user_id: int = Field(..., ge=1)
    amount: int = Field(default=1, ge=1, le=100)


class BadgePublishResponse(BaseModel):
    template: BadgeTemplateResponse
    metadata_cid: str
    metadata_uri: str
    set_token_uri_tx_hash: Optional[str] = None
