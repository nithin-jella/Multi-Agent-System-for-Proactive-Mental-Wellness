"""
CARE Token Service - Integration with UGM-AICare Backend

This service handles all interactions with the CARE token smart contract
on the SOMNIA blockchain, including:
- Minting rewards to users
- Checking balances
- Monitoring transactions
- Managing token economics
"""

from web3 import Web3
# web3.py v7+: geth_poa_middleware renamed to ExtraDataToPOAMiddleware
from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware  # type: ignore
from eth_account import Account
from decimal import Decimal
from typing import Optional, Dict, Any
import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class CareTokenService:
    """Service for interacting with CARE token on SOMNIA blockchain"""

    def __init__(self):
        """Initialize connection to SOMNIA blockchain and CARE token contract"""
        # Load environment variables
        self.rpc_url = os.getenv("SOMNIA_RPC_URL", "https://api.infra.mainnet.somnia.network/")
        self.contract_address = Web3.to_checksum_address(os.getenv("CARE_TOKEN_ADDRESS", ""))
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # Add POA middleware for EVM-compatible chains (SOMNIA uses POA consensus)
        # Note: Web3.py v6+ renamed ExtraDataToPOAMiddleware to geth_poa_middleware
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        # Check connection
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to SOMNIA blockchain at {self.rpc_url}")
        
        logger.info(f"Connected to SOMNIA blockchain (Chain ID: {self.w3.eth.chain_id})")
        
        # Load minter account
        minter_key = os.getenv("CARE_MINTER_PRIVATE_KEY")
        if minter_key:
            self.minter_account = Account.from_key(minter_key)
            logger.info(f"Minter account loaded: {self.minter_account.address}")
        else:
            self.minter_account = None
            logger.warning("CARE_MINTER_PRIVATE_KEY not set - minting disabled")
        
        # Load contract ABI
        self.contract_abi = self._load_contract_abi()
        
        # Initialize contract
        if self.contract_address:
            self.contract = self.w3.eth.contract(
                address=self.contract_address,
                abi=self.contract_abi
            )
            logger.info(f"CARE token contract loaded at {self.contract_address}")
        else:
            self.contract = None
            logger.warning("CARE_TOKEN_ADDRESS not set - contract interactions disabled")

    def _load_contract_abi(self) -> list:
        """Load contract ABI from compiled artifacts"""
        # Try to load from Hardhat artifacts
        artifact_path = Path(__file__).parent.parent.parent.parent / "blockchain" / "artifacts" / "contracts" / "CareToken.sol" / "CareToken.json"
        
        if artifact_path.exists():
            with open(artifact_path, "r") as f:
                artifact = json.load(f)
                return artifact["abi"]
        
        # Fallback: minimal ABI for basic operations
        logger.warning("Could not load full ABI, using minimal ABI")
        return [
            {
                "inputs": [{"name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "to", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "reason", "type": "string"}
                ],
                "name": "mint",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

    async def get_balance(self, wallet_address: str) -> Decimal:
        """
        Get CARE token balance for a wallet
        
        Args:
            wallet_address: Ethereum address to check
            
        Returns:
            Balance in CARE tokens (not wei)
        """
        if not self.contract:
            raise ValueError("Contract not initialized")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            balance_wei = self.contract.functions.balanceOf(checksum_address).call()
            balance = Decimal(balance_wei) / Decimal(10**18)
            
            logger.info(f"Balance for {wallet_address}: {balance} CARE")
            return balance
            
        except Exception as e:
            logger.error(f"Error getting balance for {wallet_address}: {e}")
            raise

    async def mint_reward(
        self,
        user_wallet: str,
        amount: int,
        reason: str
    ) -> Dict[str, Any]:
        """
        Mint CARE tokens to a user wallet
        
        Args:
            user_wallet: User's wallet address
            amount: Amount of CARE tokens (will be converted to wei)
            reason: Reason for minting (logged on-chain)
            
        Returns:
            Dictionary with transaction details
        """
        if not self.contract:
            raise ValueError("Contract not initialized")
        
        if not self.minter_account:
            raise ValueError("Minter account not configured")
        
        try:
            # Validate inputs
            checksum_address = Web3.to_checksum_address(user_wallet)
            amount_wei = amount * 10**18
            
            logger.info(f"Minting {amount} CARE to {user_wallet} for: {reason}")
            
            # Build transaction
            transaction = self.contract.functions.mint(
                checksum_address,
                amount_wei,
                reason
            ).build_transaction({
                'from': self.minter_account.address,
                'nonce': self.w3.eth.get_transaction_count(self.minter_account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price
            })
            
            # Sign transaction
            signed_txn = self.w3.eth.account.sign_transaction(
                transaction,
                self.minter_account.key
            )
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            logger.info(f"Transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            success = receipt["status"] == 1
            
            if success:
                logger.info(f"Successfully minted {amount} CARE to {user_wallet}")
            else:
                logger.error(f"Transaction failed: {tx_hash.hex()}")
            
            return {
                "success": success,
                "tx_hash": tx_hash.hex(),
                "amount": amount,
                "recipient": user_wallet,
                "reason": reason,
                "block_number": receipt["blockNumber"],
                "gas_used": receipt["gasUsed"]
            }
            
        except Exception as e:
            logger.error(f"Error minting tokens: {e}")
            raise

    async def get_token_info(self) -> Dict[str, Any]:
        """Get basic token information"""
        if not self.contract:
            raise ValueError("Contract not initialized")
        
        try:
            name = self.contract.functions.name().call()
            symbol = self.contract.functions.symbol().call()
            decimals = self.contract.functions.decimals().call()
            total_supply = self.contract.functions.totalSupply().call()
            max_supply = self.contract.functions.maxSupply().call()
            
            return {
                "name": name,
                "symbol": symbol,
                "decimals": decimals,
                "total_supply": Decimal(total_supply) / Decimal(10**18),
                "max_supply": Decimal(max_supply) / Decimal(10**18),
                "contract_address": self.contract_address
            }
            
        except Exception as e:
            logger.error(f"Error getting token info: {e}")
            raise


# Singleton instance
care_token_service: Optional[CareTokenService] = None


def get_care_token_service() -> CareTokenService:
    """Get or create CareTokenService singleton"""
    global care_token_service
    
    if care_token_service is None:
        care_token_service = CareTokenService()
    
    return care_token_service
