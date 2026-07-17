"""
Base NFT Client

Chain-agnostic ERC1155 badge contract client. Handles Web3 setup, transaction
signing, gas estimation, and the two core operations: mintBadge + setTokenUri.

Each chain gets its own instance via the NFTClientFactory. All instances share
the same ABI since UGMJournalBadges.sol is deployed identically on every chain.
"""

from __future__ import annotations

import json
import os
import logging
from typing import Optional

import aiofiles  # type: ignore

logger = logging.getLogger(__name__)

try:
    from web3 import Web3  # type: ignore
    # web3.py v7+ renamed the middleware; graceful fallback for older versions
    try:
        from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
    except ImportError:
        try:
            from web3.middleware import geth_poa_middleware  # type: ignore
        except ImportError:
            geth_poa_middleware = None  # type: ignore
    _WEB3_AVAILABLE = True
except (ImportError, Exception) as _web3_err:
    Web3 = None  # type: ignore
    geth_poa_middleware = None  # type: ignore
    _WEB3_AVAILABLE = False
    logger.warning("web3 unavailable in base_nft_client — NFT features disabled: %s", _web3_err)

from app.domains.blockchain.nft.chain_registry import ChainConfig

# Path to the shared ABI (same contract on every chain)
_ABI_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),  # blockchain/
    "edu_chain", "abi", "UGMJournalBadges.json",
)

# Module-level ABI cache so we only read the file once
_CACHED_ABI: Optional[list] = None


async def _load_abi() -> Optional[list]:
    """Read the contract ABI from disk (async) and cache it."""
    global _CACHED_ABI
    if _CACHED_ABI is not None:
        return _CACHED_ABI

    try:
        async with aiofiles.open(_ABI_PATH, "r") as f:
            contract_json = json.loads(await f.read())
            _CACHED_ABI = contract_json["abi"]
            return _CACHED_ABI
    except FileNotFoundError:
        logger.error("ABI file not found at %s", _ABI_PATH)
        return None
    except Exception as exc:
        logger.error("Failed to load ABI: %s", exc)
        return None


class BaseNFTClient:
    """
    Manages a Web3 connection to a single chain and exposes mint / setTokenUri.

    Lifecycle:
      1. Construct with a ChainConfig
      2. Call ``await init()`` once (lazy, safe to call multiple times)
      3. Use ``mint_badge()`` / ``set_token_uri()`` (sync, runs in threadpool)
    """

    def __init__(self, chain_config: ChainConfig) -> None:
        self.chain = chain_config
        self._w3: Optional[Web3] = None
        self._account = None
        self._contract = None
        self._initialized = False
        self._last_error: Optional[str] = None

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    async def init(self) -> None:
        """Connect to the chain RPC. Idempotent."""
        if self._initialized:
            return

        abi = await _load_abi()
        rpc_url = self.chain.rpc_url
        contract_address = self.chain.contract_address
        private_key = self.chain.private_key

        # Validate that the private key is not a placeholder
        key_valid = (
            private_key
            and not private_key.startswith("YOUR_")
            and len(private_key) > 0
        )

        if not (rpc_url and contract_address and key_valid and abi):
            missing = []
            if not rpc_url:
                missing.append(self.chain.rpc_url_env)
            if not contract_address:
                missing.append(self.chain.contract_address_env)
            if not key_valid:
                missing.append(f"{self.chain.private_key_env} (missing or placeholder)")
            if not abi:
                missing.append("ABI file")
            logger.warning(
                "⚠️  [%s] Not fully configured. Missing: %s. NFT ops disabled.",
                self.chain.name, ", ".join(missing),
            )
            self._last_error = f"Missing configuration: {', '.join(missing)}"
            self._initialized = True
            return

        # Normalize private key to have 0x prefix for web3.py
        normalized_key = private_key.strip()
        if not normalized_key.startswith("0x"):
            normalized_key = f"0x{normalized_key}"

        try:
            self._w3 = Web3(Web3.HTTPProvider(rpc_url))

            # Some chains (EDU Chain / Arbitrum Orbit) encode extra data in
            # block headers that the default middleware cannot parse.
            if self.chain.requires_poa_middleware and geth_poa_middleware is not None:
                self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            if not self._w3.is_connected():
                logger.error("❌ [%s] Failed to connect to RPC: %s", self.chain.name, rpc_url)
                self._last_error = f"RPC not reachable: {rpc_url}"
                self._w3 = None
                self._initialized = True
                return

            logger.info("✅ [%s] Connected (chain %s)", self.chain.name, self._w3.eth.chain_id)

            self._account = self._w3.eth.account.from_key(normalized_key)
            logger.info("🔑 [%s] Minter: %s", self.chain.name, self._account.address)

            self._contract = self._w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=abi,
            )
            logger.info("📝 [%s] Contract: %s", self.chain.name, contract_address)
            self._last_error = None

        except Exception as exc:
            logger.error("❌ [%s] Init error: %s", self.chain.name, exc, exc_info=True)
            self._last_error = str(exc)
            self._w3 = None
            self._account = None
            self._contract = None

        self._initialized = True

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    @property
    def is_ready(self) -> bool:
        """True when the client can sign and send transactions."""
        return all([self._w3, self._account, self._contract])

    def status_snapshot(self) -> dict[str, Optional[object]]:
        rpc_connected = bool(self._w3 and self._w3.is_connected())
        chain_id: Optional[int] = None
        if self._w3 and rpc_connected:
            try:
                chain_id = int(self._w3.eth.chain_id)
            except Exception:
                chain_id = None

        minter_address = None
        if self._account is not None:
            minter_address = self._account.address

        return {
            "is_ready": bool(self.is_ready),
            "rpc_connected": rpc_connected,
            "chain_id": chain_id,
            "contract_address": self.chain.contract_address,
            "minter_address": minter_address,
            "last_error": self._last_error,
        }

    # ------------------------------------------------------------------
    # Core operations (synchronous - run via ``run_in_threadpool``)
    # ------------------------------------------------------------------

    def mint_badge(
        self,
        recipient_address: str,
        badge_id: int,
        amount: int = 1,
    ) -> Optional[str]:
        """
        Mint ``amount`` copies of ``badge_id`` to ``recipient_address``.

        Returns the transaction hash hex string, or None on failure.
        """
        if not self.is_ready:
            logger.error("❌ [%s] Not ready. Cannot mint.", self.chain.name)
            return None

        assert self._w3 and self._account and self._contract  # for type checker

        try:
            logger.info(
                "🎨 [%s] Minting badge %d -> %s (x%d)",
                self.chain.name, badge_id, recipient_address, amount,
            )

            recipient = Web3.to_checksum_address(recipient_address)
            nonce = self._w3.eth.get_transaction_count(self._account.address)
            gas_price = self._w3.eth.gas_price

            # Estimate gas with a 20% safety buffer
            try:
                estimated = self._contract.functions.mintBadge(
                    recipient, badge_id, amount,
                ).estimate_gas({"from": self._account.address, "nonce": nonce})
                gas_limit = int(estimated * 1.2)
            except Exception as est_err:
                logger.warning("⚠️  [%s] Gas estimation failed: %s. Using fallback.", self.chain.name, est_err)
                gas_limit = 300_000

            txn = self._contract.functions.mintBadge(
                recipient, badge_id, amount,
            ).build_transaction({
                "chainId": self._w3.eth.chain_id,
                "gas": gas_limit,
                "gasPrice": gas_price,
                "nonce": nonce,
                "from": self._account.address,
            })

            signed = self._w3.eth.account.sign_transaction(txn, private_key=self.chain.private_key)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction).hex()
            logger.info("✅ [%s] Mint tx sent: %s", self.chain.name, tx_hash)
            return tx_hash

        except Exception as exc:
            logger.error("❌ [%s] Mint failed for badge %d: %s", self.chain.name, badge_id, exc, exc_info=True)
            if "insufficient funds" in str(exc).lower():
                logger.error("💰 Minter wallet may need more %s for gas.", self.chain.native_currency)
            return None

    def set_token_uri(self, badge_id: int, token_uri: str) -> Optional[str]:
        """
        Set the metadata URI for ``badge_id`` on-chain.

        This calls ``setTokenUri()`` which requires DEFAULT_ADMIN_ROLE.
        Intended to be called once per badge to keep metadata immutable.
        """
        if not self.is_ready:
            logger.error("❌ [%s] Not ready. Cannot set URI.", self.chain.name)
            return None

        assert self._w3 and self._account and self._contract

        try:
            nonce = self._w3.eth.get_transaction_count(self._account.address)
            gas_price = self._w3.eth.gas_price

            try:
                estimated = self._contract.functions.setTokenUri(
                    int(badge_id), str(token_uri),
                ).estimate_gas({"from": self._account.address, "nonce": nonce})
                gas_limit = int(estimated * 1.2)
            except Exception as est_err:
                logger.warning("⚠️  [%s] Gas estimation failed for setTokenUri: %s", self.chain.name, est_err)
                gas_limit = 300_000

            txn = self._contract.functions.setTokenUri(
                int(badge_id), str(token_uri),
            ).build_transaction({
                "chainId": self._w3.eth.chain_id,
                "gas": gas_limit,
                "gasPrice": gas_price,
                "nonce": nonce,
                "from": self._account.address,
            })

            signed = self._w3.eth.account.sign_transaction(txn, private_key=self.chain.private_key)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction).hex()
            logger.info("✅ [%s] setTokenUri tx sent: %s", self.chain.name, tx_hash)
            return tx_hash

        except Exception as exc:
            logger.error("❌ [%s] setTokenUri failed for badge %d: %s", self.chain.name, badge_id, exc, exc_info=True)
            return None
