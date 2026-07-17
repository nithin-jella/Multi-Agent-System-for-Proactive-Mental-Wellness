from __future__ import annotations

import logging
from typing import Dict, Optional

from app.domains.blockchain.attestation.attestation_client import AttestationClient
from app.domains.blockchain.attestation.chain_registry import (
    SUPPORTED_ATTESTATION_CHAINS,
    get_attestation_chain_config,
)

logger = logging.getLogger(__name__)


class AttestationClientFactory:
    _clients: Dict[int, AttestationClient] = {}

    @classmethod
    async def init_all(cls) -> None:
        for chain_cfg in SUPPORTED_ATTESTATION_CHAINS.values():
            if chain_cfg.chain_id in cls._clients:
                continue
            client = AttestationClient(chain_cfg)
            await client.init()
            cls._clients[chain_cfg.chain_id] = client

    @classmethod
    async def get_client(cls, chain_id: int) -> Optional[AttestationClient]:
        if chain_id in cls._clients:
            return cls._clients[chain_id]

        cfg = get_attestation_chain_config(chain_id)
        if cfg is None:
            logger.warning("Unsupported attestation chain_id: %s", chain_id)
            return None

        client = AttestationClient(cfg)
        await client.init()
        cls._clients[chain_id] = client
        return client

    @classmethod
    async def publish_attestation(
        cls,
        *,
        chain_id: int,
        attestation_id: str,
        payload_hash: str,
        action_id: int,
        subject: str | None,
        schema: str,
        metadata_uri: str,
    ) -> Optional[str]:
        client = await cls.get_client(chain_id)
        if not client or not client.is_ready:
            logger.error("No ready attestation client for chain %s", chain_id)
            return None

        return client.publish_attestation(
            attestation_id=attestation_id,
            payload_hash=payload_hash,
            action_id=action_id,
            subject=subject,
            schema=schema,
            metadata_uri=metadata_uri,
        )

    @classmethod
    def list_ready_chains(cls) -> list[int]:
        return [cid for cid, client in cls._clients.items() if client.is_ready]
