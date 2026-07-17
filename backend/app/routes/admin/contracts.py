from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.dependencies import get_admin_user
from app.domains.blockchain.attestation import (
    AttestationClientFactory,
    SUPPORTED_ATTESTATION_CHAINS,
)
from app.domains.blockchain.care_token_client import CareTokenClient
from app.domains.blockchain.nft.chain_registry import SUPPORTED_CHAINS
from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory

router = APIRouter(prefix="/contracts", tags=["Admin - Contracts"])


def _network_logo_url(network: str, chain_id: Optional[int]) -> Optional[str]:
    normalized = network.lower()
    if chain_id in {56, 97} or "bnb" in normalized:
        return "https://cryptologos.cc/logos/bnb-bnb-logo.png?v=040"
    if "edu" in normalized:
        return "https://assets.coingecko.com/coins/images/29973/small/EDU.png"
    if "somnia" in normalized:
        return "https://img.icons8.com/fluency/48/blockchain-technology.png"
    return "https://img.icons8.com/fluency/48/blockchain-technology.png"


class ContractStatusItem(BaseModel):
    key: str
    name: str
    category: str
    network: str
    chain_id: Optional[int] = None
    contract_address: Optional[str] = None
    publisher_address: Optional[str] = None
    is_configured: bool
    is_ready: bool
    rpc_connected: bool
    is_testnet: bool
    explorer_base_url: Optional[str] = None
    tx_sample_url: Optional[str] = None
    last_error: Optional[str] = None
    network_logo_url: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)


class ContractsStatusResponse(BaseModel):
    generated_at: datetime
    status: str
    contracts: list[ContractStatusItem]


@router.get("/status", response_model=ContractsStatusResponse)
async def get_contracts_status(
    admin_user=Depends(get_admin_user),
) -> ContractsStatusResponse:
    del admin_user

    items: list[ContractStatusItem] = []

    # CARE token/controller on SOMNIA
    try:
        care_client = CareTokenClient()
        token_info = await care_client.get_token_info()
        token_error = token_info.get("error") if isinstance(token_info, dict) else None
        token_address = str(token_info.get("contract_address")) if isinstance(token_info, dict) and token_info.get("contract_address") else None
        items.append(
            ContractStatusItem(
                key="care-token",
                name="CARE Token",
                category="token",
                network="SOMNIA",
                chain_id=int(token_info.get("chain_id")) if isinstance(token_info, dict) and token_info.get("chain_id") else None,
                contract_address=token_address,
                is_configured=bool(token_address),
                is_ready=bool(care_client.is_connected and not token_error and token_address),
                rpc_connected=bool(care_client.is_connected),
                is_testnet=False,
                explorer_base_url=None,
                tx_sample_url=None,
                last_error=str(token_error) if token_error else None,
                network_logo_url=_network_logo_url("SOMNIA", None),
                details={
                    "symbol": token_info.get("symbol") if isinstance(token_info, dict) else None,
                    "name": token_info.get("name") if isinstance(token_info, dict) else None,
                },
            )
        )
    except Exception as exc:
        items.append(
            ContractStatusItem(
                key="care-token",
                name="CARE Token",
                category="token",
                network="SOMNIA",
                chain_id=None,
                contract_address=None,
                is_configured=False,
                is_ready=False,
                rpc_connected=False,
                is_testnet=False,
                last_error=str(exc),
                network_logo_url=_network_logo_url("SOMNIA", None),
                details={},
            )
        )

    # Badge contracts
    for chain_cfg in SUPPORTED_CHAINS.values():
        client = await NFTClientFactory.get_client(chain_cfg.chain_id)
        snapshot: dict[str, Any] = client.status_snapshot() if client else {}
        contract_address = chain_cfg.contract_address
        key_present = bool(chain_cfg.private_key and not chain_cfg.private_key.startswith("YOUR_"))
        rpc_present = bool(chain_cfg.rpc_url)
        is_configured = bool(contract_address and rpc_present and key_present)

        items.append(
            ContractStatusItem(
                key=f"badge-{chain_cfg.chain_id}",
                name=f"Badge Registry ({chain_cfg.short_name})",
                category="badge",
                network=chain_cfg.name,
                chain_id=chain_cfg.chain_id,
                contract_address=contract_address,
                publisher_address=snapshot.get("minter_address"),
                is_configured=is_configured,
                is_ready=bool(snapshot.get("is_ready")),
                rpc_connected=bool(snapshot.get("rpc_connected")),
                is_testnet=chain_cfg.is_testnet,
                explorer_base_url=chain_cfg.explorer_base_url,
                tx_sample_url=chain_cfg.explorer_tx_url("0x"),
                last_error=snapshot.get("last_error"),
                network_logo_url=_network_logo_url(chain_cfg.name, chain_cfg.chain_id),
                details={
                    "native_currency": chain_cfg.native_currency,
                    "detected_chain_id": snapshot.get("chain_id"),
                },
            )
        )

    # Attestation contracts
    for chain_cfg in SUPPORTED_ATTESTATION_CHAINS.values():
        client = await AttestationClientFactory.get_client(chain_cfg.chain_id)
        snapshot: dict[str, Any] = client.status_snapshot() if client else {}
        contract_address = chain_cfg.contract_address
        key_present = bool(chain_cfg.private_key and not chain_cfg.private_key.startswith("YOUR_"))
        rpc_present = bool(chain_cfg.rpc_url)
        is_configured = bool(contract_address and rpc_present and key_present)

        items.append(
            ContractStatusItem(
                key=f"attestation-{chain_cfg.chain_id}",
                name=f"Attestation Registry ({chain_cfg.short_name})",
                category="attestation",
                network=chain_cfg.name,
                chain_id=chain_cfg.chain_id,
                contract_address=contract_address,
                publisher_address=snapshot.get("publisher_address"),
                is_configured=is_configured,
                is_ready=bool(snapshot.get("is_ready")),
                rpc_connected=bool(snapshot.get("rpc_connected")),
                is_testnet=chain_cfg.is_testnet,
                explorer_base_url=chain_cfg.explorer_base_url,
                tx_sample_url=chain_cfg.explorer_tx_url("0x"),
                last_error=snapshot.get("last_error"),
                network_logo_url=_network_logo_url(chain_cfg.name, chain_cfg.chain_id),
                details={
                    "native_currency": chain_cfg.native_currency,
                    "detected_chain_id": snapshot.get("chain_id"),
                },
            )
        )

    overall_status = "healthy"
    if any(not item.is_configured for item in items):
        overall_status = "degraded"
    if any(item.is_configured and not item.is_ready for item in items):
        overall_status = "degraded"

    return ContractsStatusResponse(
        generated_at=datetime.utcnow(),
        status=overall_status,
        contracts=items,
    )
