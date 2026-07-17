"""
NFT Multi-Chain Module

Provides chain-agnostic badge minting and metadata management.

Public API:
    - NFTClientFactory   : Get/create per-chain NFT clients
    - ChainConfig        : Dataclass describing a supported chain
    - SUPPORTED_CHAINS   : Dict of all registered chains
    - get_chain_config   : Lookup a chain by ID
    - get_configured_chains : List chains with env vars set
    - DEFAULT_BADGE_CHAIN_ID : Fallback chain for auto-badges
"""

from app.domains.blockchain.nft.chain_registry import (
    ChainConfig,
    DEFAULT_BADGE_CHAIN_ID,
    SUPPORTED_CHAINS,
    get_chain_config,
    get_configured_chains,
)
from app.domains.blockchain.nft.base_nft_client import BaseNFTClient
from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory

__all__ = [
    "BaseNFTClient",
    "ChainConfig",
    "DEFAULT_BADGE_CHAIN_ID",
    "NFTClientFactory",
    "SUPPORTED_CHAINS",
    "get_chain_config",
    "get_configured_chains",
]
