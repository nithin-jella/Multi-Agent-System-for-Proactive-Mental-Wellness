from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

try:
    from web3 import Web3  # type: ignore
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
    logger.warning(
        "web3 unavailable in attestation_client — attestation features disabled: %s",
        _web3_err,
    )

from app.domains.blockchain.attestation.chain_registry import AttestationChainConfig


_ABI_PATH = os.path.join(
    os.path.dirname(__file__),
    "abi",
    "BSCAttestationRegistry.json",
)


class AttestationClient:
    def __init__(self, chain_config: AttestationChainConfig) -> None:
        self.chain = chain_config
        self._w3: Optional[Web3] = None
        self._account = None
        self._contract = None
        self._initialized = False
        self._last_error: Optional[str] = None
        self._publish_attempts = 0
        self._publish_successes = 0
        self._publish_failures = 0
        self._last_tx_hash: Optional[str] = None
        self._last_publish_attempt_at: Optional[datetime] = None
        self._last_publish_success_at: Optional[datetime] = None
        self._last_onchain_read_error: Optional[str] = None

    @staticmethod
    def _is_valid_private_key(private_key: Optional[str]) -> bool:
        return bool(private_key and not private_key.startswith("YOUR_") and len(private_key.strip()) > 0)

    @staticmethod
    def _normalize_private_key(private_key: str) -> str:
        """Ensure private key has 0x prefix for web3.py."""
        key = private_key.strip()
        if not key.startswith("0x"):
            return f"0x{key}"
        return key

    @staticmethod
    def _normalize_bytes32(value: str, field_name: str) -> str:
        normalized = value.strip().lower()
        if not normalized.startswith("0x"):
            normalized = f"0x{normalized}"
        if len(normalized) != 66:
            raise ValueError(f"{field_name} must be a 32-byte hex string")
        int(normalized[2:], 16)
        return normalized

    @staticmethod
    def _load_abi() -> Optional[list[dict[str, Any]]]:
        try:
            with open(_ABI_PATH, "r", encoding="utf-8") as file:
                return json.load(file).get("abi")
        except FileNotFoundError:
            logger.error("Attestation ABI file not found at %s", _ABI_PATH)
            return None
        except Exception as exc:
            logger.error("Failed to load attestation ABI: %s", exc)
            return None

    async def init(self) -> None:
        if self._initialized:
            return

        abi = self._load_abi()
        rpc_url = self.chain.rpc_url
        contract_address = self.chain.contract_address
        private_key = self.chain.private_key

        if not abi or not rpc_url or not contract_address or not self._is_valid_private_key(private_key):
            missing = []
            if not abi:
                missing.append("ABI file")
            if not rpc_url:
                missing.append(self.chain.rpc_url_env)
            if not contract_address:
                missing.append(self.chain.contract_address_env)
            if not self._is_valid_private_key(private_key):
                missing.append(f"{self.chain.private_key_env} (missing or placeholder)")
            self._last_error = f"Missing configuration: {', '.join(missing)}"
            logger.warning("[%s] Attestation client not ready. %s", self.chain.name, self._last_error)
            self._initialized = True
            return

        try:
            self._w3 = Web3(Web3.HTTPProvider(rpc_url))
            if self.chain.requires_poa_middleware and geth_poa_middleware is not None:
                self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            if not self._w3.is_connected():
                self._last_error = f"RPC not reachable: {rpc_url}"
                logger.error("[%s] %s", self.chain.name, self._last_error)
                self._w3 = None
                self._initialized = True
                return

            self._account = self._w3.eth.account.from_key(self._normalize_private_key(private_key))
            self._contract = self._w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=abi,
            )
            self._last_error = None
            logger.info(
                "[%s] Attestation client initialized. chain_id=%s publisher=%s contract=%s",
                self.chain.name,
                self._w3.eth.chain_id,
                self._account.address,
                contract_address,
            )
        except Exception as exc:
            self._last_error = str(exc)
            logger.error("[%s] Attestation client init failed: %s", self.chain.name, exc, exc_info=True)
            self._w3 = None
            self._account = None
            self._contract = None
        finally:
            self._initialized = True

    @property
    def is_ready(self) -> bool:
        return all([self._w3, self._account, self._contract])

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def status_snapshot(self) -> dict[str, Any]:
        rpc_connected = bool(self._w3 and self._w3.is_connected())
        chain_id: Optional[int] = None
        if self._w3 and rpc_connected:
            try:
                chain_id = int(self._w3.eth.chain_id)
            except Exception:
                chain_id = None

        publisher_address = None
        if self._account is not None:
            publisher_address = self._account.address

        onchain_total_published: Optional[int] = None
        onchain_last_published_at: Optional[int] = None
        onchain_publisher_published: Optional[int] = None
        if self.is_ready:
            stats = self.get_registry_stats()
            onchain_total_published = stats.get("total_published")
            onchain_last_published_at = stats.get("last_published_at")

            publisher_stats = self.get_publisher_stats()
            onchain_publisher_published = publisher_stats.get("publisher_published_count")

        return {
            "is_ready": self.is_ready,
            "rpc_connected": rpc_connected,
            "chain_id": chain_id,
            "contract_address": self.chain.contract_address,
            "publisher_address": publisher_address,
            "last_error": self._last_error,
            "publish_attempts": self._publish_attempts,
            "publish_successes": self._publish_successes,
            "publish_failures": self._publish_failures,
            "last_tx_hash": self._last_tx_hash,
            "last_publish_attempt_at": self._last_publish_attempt_at.isoformat() if self._last_publish_attempt_at else None,
            "last_publish_success_at": self._last_publish_success_at.isoformat() if self._last_publish_success_at else None,
            "onchain_total_published": onchain_total_published,
            "onchain_last_published_at": onchain_last_published_at,
            "onchain_publisher_published": onchain_publisher_published,
            "last_onchain_read_error": self._last_onchain_read_error,
        }

    def get_registry_stats(self) -> dict[str, Optional[int]]:
        if not self.is_ready:
            return {"total_published": None, "last_published_at": None}

        assert self._contract
        try:
            total_published, last_published_at = self._contract.functions.getRegistryStats().call()
            self._last_onchain_read_error = None
            return {
                "total_published": int(total_published),
                "last_published_at": int(last_published_at),
            }
        except Exception as exc:
            self._last_onchain_read_error = str(exc)
            logger.warning("[%s] Failed to read getRegistryStats: %s", self.chain.name, exc)
            return {"total_published": None, "last_published_at": None}

    def get_publisher_stats(self) -> dict[str, Optional[int]]:
        if not self.is_ready:
            return {"publisher_published_count": None}

        assert self._contract and self._account
        try:
            published_count = self._contract.functions.getPublisherPublishedCount(self._account.address).call()
            self._last_onchain_read_error = None
            return {"publisher_published_count": int(published_count)}
        except Exception as exc:
            self._last_onchain_read_error = str(exc)
            logger.warning("[%s] Failed to read getPublisherPublishedCount: %s", self.chain.name, exc)
            return {"publisher_published_count": None}

    def publish_attestation(
        self,
        *,
        attestation_id: str,
        payload_hash: str,
        action_id: int,
        subject: Optional[str],
        schema: str,
        metadata_uri: str,
    ) -> Optional[str]:
        if not self.is_ready:
            logger.error("[%s] Attestation client not ready", self.chain.name)
            return None

        assert self._w3 and self._account and self._contract

        try:
            self._publish_attempts += 1
            self._last_publish_attempt_at = datetime.utcnow()
            attestation_id_hex = self._normalize_bytes32(attestation_id, "attestation_id")
            payload_hash_hex = self._normalize_bytes32(payload_hash, "payload_hash")

            if subject:
                subject_checksum = Web3.to_checksum_address(subject)
            else:
                subject_checksum = Web3.to_checksum_address("0x0000000000000000000000000000000000000000")

            nonce = self._w3.eth.get_transaction_count(self._account.address)
            gas_price = self._w3.eth.gas_price

            function_call = self._contract.functions.publishAttestation(
                Web3.to_bytes(hexstr=attestation_id_hex),
                Web3.to_bytes(hexstr=payload_hash_hex),
                int(action_id),
                subject_checksum,
                str(schema),
                str(metadata_uri),
            )

            try:
                estimated_gas = function_call.estimate_gas(
                    {
                        "from": self._account.address,
                        "nonce": nonce,
                    }
                )
                gas_limit = int(estimated_gas * 1.2)
            except Exception as exc:
                logger.warning("[%s] Gas estimation failed for attestation publish: %s", self.chain.name, exc)
                gas_limit = 350_000

            tx_data = function_call.build_transaction(
                {
                    "chainId": self._w3.eth.chain_id,
                    "gas": gas_limit,
                    "gasPrice": gas_price,
                    "nonce": nonce,
                    "from": self._account.address,
                }
            )

            signed = self._w3.eth.account.sign_transaction(tx_data, private_key=self.chain.private_key)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction).hex()
            self._publish_successes += 1
            self._last_tx_hash = tx_hash
            self._last_publish_success_at = datetime.utcnow()
            logger.info("[%s] Attestation publish tx sent: %s", self.chain.name, tx_hash)
            self._last_error = None
            return tx_hash
        except Exception as exc:
            self._publish_failures += 1
            self._last_error = str(exc)
            logger.error("[%s] Failed to publish attestation: %s", self.chain.name, exc, exc_info=True)
            return None
