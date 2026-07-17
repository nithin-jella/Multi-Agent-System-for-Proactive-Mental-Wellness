from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class AttestationChainConfig:
    chain_id: int
    name: str
    short_name: str
    rpc_url_env: str
    contract_address_env: str
    private_key_env: str
    explorer_base_url: str
    explorer_tx_path: str = "/tx/"
    native_currency: str = "BNB"
    is_testnet: bool = True
    requires_poa_middleware: bool = False

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
        return f"{self.explorer_base_url}{self.explorer_tx_path}{tx_hash}"


SUPPORTED_ATTESTATION_CHAINS: Dict[int, AttestationChainConfig] = {
    97: AttestationChainConfig(
        chain_id=97,
        name="BNB Smart Chain Testnet",
        short_name="BNB",
        rpc_url_env="BSC_TESTNET_RPC_URL",
        contract_address_env="BSC_ATTESTATION_CONTRACT_ADDRESS",
        private_key_env="BSC_ATTESTATION_PUBLISHER_PRIVATE_KEY",
        explorer_base_url="https://testnet.bscscan.com",
        native_currency="tBNB",
        is_testnet=True,
        requires_poa_middleware=False,
    ),
    56: AttestationChainConfig(
        chain_id=56,
        name="BNB Smart Chain",
        short_name="BNB",
        rpc_url_env="BSC_MAINNET_RPC_URL",
        contract_address_env="BSC_MAINNET_ATTESTATION_CONTRACT_ADDRESS",
        private_key_env="BSC_MAINNET_ATTESTATION_PUBLISHER_PRIVATE_KEY",
        explorer_base_url="https://bscscan.com",
        native_currency="BNB",
        is_testnet=False,
        requires_poa_middleware=False,
    ),
    5611: AttestationChainConfig(
        chain_id=5611,
        name="opBNB Testnet",
        short_name="opBNB",
        rpc_url_env="OPBNB_TESTNET_RPC_URL",
        contract_address_env="OPBNB_ATTESTATION_CONTRACT_ADDRESS",
        private_key_env="OPBNB_ATTESTATION_PUBLISHER_PRIVATE_KEY",
        explorer_base_url="https://opbnb-testnet.bscscan.com",
        native_currency="tBNB",
        is_testnet=True,
        requires_poa_middleware=False,
    ),
}


DEFAULT_ATTESTATION_CHAIN_ID: int = 97


def get_attestation_chain_config(chain_id: int) -> Optional[AttestationChainConfig]:
    return SUPPORTED_ATTESTATION_CHAINS.get(chain_id)
