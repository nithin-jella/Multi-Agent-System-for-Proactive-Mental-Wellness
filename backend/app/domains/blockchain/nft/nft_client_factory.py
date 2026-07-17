"""
NFT Client Factory

Manages per-chain NFTClient singletons. The rest of the application should
use this module to obtain a client for a given chain_id instead of
constructing clients directly.

Usage:
    from app.domains.blockchain.nft.nft_client_factory import NFTClientFactory

    client = await NFTClientFactory.get_client(656476)  # EDU Chain
    if client and client.is_ready:
        tx = client.mint_badge(wallet, badge_id)

    # Or use the convenience wrappers:
    tx = await NFTClientFactory.mint_badge(656476, wallet, badge_id)
"""

from __future__ import annotations

import logging
from typing import Dict, Optional

from app.domains.blockchain.nft.base_nft_client import BaseNFTClient
from app.domains.blockchain.nft.chain_registry import (
    DEFAULT_BADGE_CHAIN_ID,
    SUPPORTED_CHAINS,
    ChainConfig,
    get_chain_config,
    get_configured_chains,
)

logger = logging.getLogger(__name__)


class NFTClientFactory:
    """
    Singleton factory that lazily creates and caches one BaseNFTClient per chain.

    Thread safety: ``init_all`` and ``get_client`` are async and meant to be
    called from the FastAPI event loop. The returned clients' ``mint_badge``
    and ``set_token_uri`` methods are synchronous and should be dispatched
    through ``run_in_threadpool``.
    """

    _clients: Dict[int, BaseNFTClient] = {}

    @classmethod
    async def init_all(cls) -> None:
        """
        Initialize clients for every chain that has env vars configured.

        Call this once during application startup (e.g. in the FastAPI lifespan).
        """
        for chain_cfg in get_configured_chains():
            if chain_cfg.chain_id not in cls._clients:
                client = BaseNFTClient(chain_cfg)
                await client.init()
                cls._clients[chain_cfg.chain_id] = client
                status = "ready" if client.is_ready else "NOT ready"
                logger.info("[NFTFactory] %s (%d) -> %s", chain_cfg.name, chain_cfg.chain_id, status)

    @classmethod
    async def get_client(cls, chain_id: int) -> Optional[BaseNFTClient]:
        """
        Get (or lazily create) a client for the given chain_id.

        Returns None if the chain is unsupported or not configured.
        """
        # Return cached client if already initialized
        if chain_id in cls._clients:
            return cls._clients[chain_id]

        # Try lazy init for a supported but not-yet-initialized chain
        cfg = get_chain_config(chain_id)
        if cfg is None:
            logger.warning("Chain %d is not in SUPPORTED_CHAINS", chain_id)
            return None

        client = BaseNFTClient(cfg)
        await client.init()
        cls._clients[chain_id] = client
        return client

    # ------------------------------------------------------------------
    # Convenience wrappers (combine lookup + operation)
    # ------------------------------------------------------------------

    @classmethod
    async def mint_badge(
        cls,
        chain_id: int,
        recipient_address: str,
        badge_id: int,
        amount: int = 1,
    ) -> Optional[str]:
        """Mint a badge on the specified chain. Returns tx hash or None."""
        client = await cls.get_client(chain_id)
        if not client or not client.is_ready:
            logger.error("No ready NFT client for chain %d", chain_id)
            return None
        return client.mint_badge(recipient_address, badge_id, amount)

    @classmethod
    async def set_token_uri(
        cls,
        chain_id: int,
        badge_id: int,
        token_uri: str,
    ) -> Optional[str]:
        """Set token URI on the specified chain. Returns tx hash or None."""
        client = await cls.get_client(chain_id)
        if not client or not client.is_ready:
            logger.error("No ready NFT client for chain %d", chain_id)
            return None
        return client.set_token_uri(badge_id, token_uri)

    @classmethod
    def list_ready_chains(cls) -> list[int]:
        """Return chain IDs for which we have a ready client."""
        return [cid for cid, c in cls._clients.items() if c.is_ready]
