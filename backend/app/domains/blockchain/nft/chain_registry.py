"""
Chain Registry

Centralized registry of all supported blockchain networks for the badge NFT system.
Each chain entry contains RPC, explorer, contract address, and display metadata.

To add a new chain:
  1. Add a new ChainConfig entry to SUPPORTED_CHAINS
  2. Add the corresponding env vars (RPC URL, contract address)
  3. Deploy UGMJournalBadges.sol to the new chain
  4. Run the Alembic migration if schema changes are needed
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass(frozen=True)
class ChainConfig:
    """Immutable configuration for a single blockchain network."""

    chain_id: int
    name: str
    short_name: str  # Compact label for UI badges (e.g., "EDU", "BNB")
    rpc_url_env: str  # Name of the env var holding the RPC URL
    contract_address_env: str  # Name of the env var holding the NFT contract address
    private_key_env: str  # Name of the env var holding the minter private key
    explorer_base_url: str
    explorer_tx_path: str = "/tx/"  # Appended with tx hash for direct links
    native_currency: str = "ETH"
    is_testnet: bool = True
    requires_poa_middleware: bool = False  # EDU Chain (Arbitrum Orbit L3) needs this

    @property
    def rpc_url(self) -> Optional[str]:
        return os.getenv(self.rpc_url_env) or None

    @property
    def contract_address(self) -> Optional[str]:
        return os.getenv(self.contract_address_env) or None

    @property
    def private_key(self) -> Optional[str]:
        return os.getenv(self.private_key_env) or None

    def explorer_tx_url(self, tx_hash: str) -> str:
        """Build a full explorer URL for a transaction hash."""
        return f"{self.explorer_base_url}{self.explorer_tx_path}{tx_hash}"


# ---------------------------------------------------------------------------
# Supported chains
#
# Adding a chain here is all the backend needs; the NFTClientFactory will
# automatically pick it up and the admin API will expose it via /chains.
# ---------------------------------------------------------------------------

SUPPORTED_CHAINS: Dict[int, ChainConfig] = {
    656476: ChainConfig(
        chain_id=656476,
        name="EDU Chain Testnet",
        short_name="EDU",
        rpc_url_env="EDU_TESTNET_RPC_URL",
        contract_address_env="NFT_CONTRACT_ADDRESS",
        private_key_env="BACKEND_MINTER_PRIVATE_KEY",
        explorer_base_url="https://edu-chain-testnet.blockscout.com",
        native_currency="EDU",
        is_testnet=True,
        requires_poa_middleware=True,  # Arbitrum Orbit L3 extraData quirk
    ),
    97: ChainConfig(
        chain_id=97,
        name="BNB Smart Chain Testnet",
        short_name="BNB",
        rpc_url_env="BSC_TESTNET_RPC_URL",
        contract_address_env="BSC_NFT_CONTRACT_ADDRESS",
        private_key_env="BSC_MINTER_PRIVATE_KEY",
        explorer_base_url="https://testnet.bscscan.com",
        native_currency="tBNB",
        is_testnet=True,
        requires_poa_middleware=False,
    ),
    56: ChainConfig(
        chain_id=56,
        name="BNB Smart Chain",
        short_name="BNB",
        rpc_url_env="BSC_MAINNET_RPC_URL",
        contract_address_env="BSC_MAINNET_NFT_CONTRACT_ADDRESS",
        private_key_env="BSC_MAINNET_MINTER_PRIVATE_KEY",
        explorer_base_url="https://bscscan.com",
        native_currency="BNB",
        is_testnet=False,
        requires_poa_middleware=False,
    ),
    5611: ChainConfig(
        chain_id=5611,
        name="opBNB Testnet",
        short_name="opBNB",
        rpc_url_env="OPBNB_TESTNET_RPC_URL",
        contract_address_env="OPBNB_NFT_CONTRACT_ADDRESS",
        private_key_env="OPBNB_MINTER_PRIVATE_KEY",
        explorer_base_url="https://opbnb-testnet.bscscan.com",
        native_currency="tBNB",
        is_testnet=True,
        requires_poa_middleware=False,
    ),
}

# HACKATHON: Default chain changed to BSC Testnet for BNB Chain hackathon.
# TODO: Make this configurable via environment variable (e.g., DEFAULT_BADGE_CHAIN_ID=97)
DEFAULT_BADGE_CHAIN_ID: int = 97


def get_chain_config(chain_id: int) -> Optional[ChainConfig]:
    """Look up a chain config by its chain ID. Returns None if unsupported."""
    return SUPPORTED_CHAINS.get(chain_id)


def get_configured_chains() -> list[ChainConfig]:
    """Return only chains whose env vars (RPC + contract) are fully set."""
    return [
        cfg for cfg in SUPPORTED_CHAINS.values()
        if cfg.rpc_url and cfg.contract_address and cfg.private_key
    ]
