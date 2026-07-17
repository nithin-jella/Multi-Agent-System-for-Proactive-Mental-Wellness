"""
Blockchain Domain Module

Multi-Chain Architecture:
- SOMNIA Mainnet: CARE token, revenue oracle, staking contracts
- EDU Chain Testnet: NFT achievement badges (ERC-1155)
- BNB Smart Chain: NFT achievement badges (ERC-1155) -- added for multi-chain

This module handles all blockchain interactions for the UGM-AICare platform:
- CARE token operations (minting, transfers, balances)
- PlatformRevenueOracle interactions (revenue reporting)
- CareStakingHalal interactions (staking operations)
- Multi-chain NFT badge minting for achievements (via NFTClientFactory)
- Web3 utilities and base client
- Blockchain API routes

Contains:
- base_web3.py: Shared Web3 utilities and connection management
- care_token_client.py: CareToken smart contract client (SOMNIA)
- oracle_client.py: PlatformRevenueOracle smart contract client (SOMNIA)
- staking_client.py: CareStakingHalal smart contract client (SOMNIA)
- nft/: Multi-chain NFT client (chain_registry, base_nft_client, factory)
- edu_chain/: Legacy EDU Chain NFT contracts (deprecated, use nft/ instead)
- routes.py: FastAPI routes for blockchain operations
"""

import logging as _logging

_logger = _logging.getLogger(__name__)

try:
    from app.domains.blockchain.base_web3 import BaseWeb3Client
    from app.domains.blockchain.care_token_client import CareTokenClient
    from app.domains.blockchain.oracle_client import OracleClient
    from app.domains.blockchain.staking_client import StakingClient
    from app.domains.blockchain.routes import router as blockchain_router

    # Multi-chain NFT client (preferred for new code)
    from app.domains.blockchain.nft import (
        NFTClientFactory,
        SUPPORTED_CHAINS,
        DEFAULT_BADGE_CHAIN_ID,
        get_chain_config,
        get_configured_chains,
    )
    from app.domains.blockchain.attestation import (
        AttestationClientFactory,
        SUPPORTED_ATTESTATION_CHAINS,
        DEFAULT_ATTESTATION_CHAIN_ID,
        get_attestation_chain_config,
    )

    # Legacy EDU Chain imports (kept for backward compatibility)
    from app.domains.blockchain.edu_chain import (
        init_blockchain as init_nft_client,
        mint_nft_badge,
        w3 as edu_w3,
        contract as nft_contract,
    )

    BLOCKCHAIN_AVAILABLE = True

except ImportError as _blockchain_import_err:
    _logger.warning(
        "Blockchain domain failed to import (all blockchain features disabled): %s",
        _blockchain_import_err,
    )
    BLOCKCHAIN_AVAILABLE = False

    # ---------------------------------------------------------------------------
    # Stub objects so the rest of the app can import from this module without
    # crashing.  All stubs raise RuntimeError when instantiated/called so
    # developers get a clear error if they accidentally use them in a path that
    # should not reach here.
    # ---------------------------------------------------------------------------
    from fastapi import APIRouter as _APIRouter

    class _BlockchainUnavailable:
        """Raised at instantiation time to make misuse explicit."""
        def __init__(self, *args, **kwargs):  # type: ignore[override]
            raise RuntimeError(
                "Blockchain package failed to import — features are disabled. "
                "Check that web3, eth_utils, and ens are installed and compatible."
            )

    BaseWeb3Client = _BlockchainUnavailable  # type: ignore
    CareTokenClient = _BlockchainUnavailable  # type: ignore
    OracleClient = _BlockchainUnavailable  # type: ignore
    StakingClient = _BlockchainUnavailable  # type: ignore
    blockchain_router = _APIRouter()  # empty router — mounts cleanly, returns 404

    class _NFTClientFactoryStub:
        @classmethod
        def create(cls, *args, **kwargs):  # type: ignore
            raise RuntimeError("NFT client unavailable — blockchain package not importable.")

    NFTClientFactory = _NFTClientFactoryStub  # type: ignore
    SUPPORTED_CHAINS: dict = {}
    DEFAULT_BADGE_CHAIN_ID: int = 0

    def get_chain_config(*args, **kwargs):  # type: ignore
        return None

    def get_configured_chains(*args, **kwargs):  # type: ignore
        return []

    class _AttestationFactoryStub:
        @classmethod
        async def init_all(cls):  # type: ignore
            _logger.warning("Attestation client unavailable — blockchain package not importable.")

    AttestationClientFactory = _AttestationFactoryStub  # type: ignore
    SUPPORTED_ATTESTATION_CHAINS: dict = {}
    DEFAULT_ATTESTATION_CHAIN_ID: int = 0

    def get_attestation_chain_config(*args, **kwargs):  # type: ignore
        return None

    def init_nft_client(*args, **kwargs):  # type: ignore
        return None

    def mint_nft_badge(*args, **kwargs):  # type: ignore
        return None

    edu_w3 = None
    nft_contract = None

__all__ = [
    # Base
    "BaseWeb3Client",

    # SOMNIA contracts
    "CareTokenClient",
    "OracleClient",
    "StakingClient",

    # API routes
    "blockchain_router",

    # Multi-chain NFT (preferred)
    "NFTClientFactory",
    "SUPPORTED_CHAINS",
    "DEFAULT_BADGE_CHAIN_ID",
    "get_chain_config",
    "get_configured_chains",
    "AttestationClientFactory",
    "SUPPORTED_ATTESTATION_CHAINS",
    "DEFAULT_ATTESTATION_CHAIN_ID",
    "get_attestation_chain_config",

    # Legacy EDU Chain (deprecated)
    "init_nft_client",
    "mint_nft_badge",
    "edu_w3",
    "nft_contract",
]
