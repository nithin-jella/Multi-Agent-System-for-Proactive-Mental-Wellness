"""
CARE Token Client

Handles interactions with the CareToken smart contract:
- Mint tokens for various categories (rewards, staking, etc.)
- Check token balances
- Query token information
- Transfer tokens

Contract: CareToken.sol via CareTokenController.sol
Network: SOMNIA
"""

from typing import Optional, Dict, Any
from decimal import Decimal
import os
import json
import logging
from pathlib import Path

from app.domains.blockchain.base_web3 import BaseWeb3Client

logger = logging.getLogger(__name__)


class CareTokenClient(BaseWeb3Client):
    """Client for CARE token operations via CareTokenController"""
    
    def __init__(self):
        """Initialize CARE token client"""
        super().__init__()
        
        # Load contract addresses - validate before converting to checksum
        token_address_raw = os.getenv("CARE_TOKEN_ADDRESS", "").strip()
        controller_address_raw = os.getenv("CARE_TOKEN_CONTROLLER_ADDRESS", "").strip()
        
        if token_address_raw:
            try:
                self.token_address = self.to_checksum_address(token_address_raw)
            except ValueError as e:
                logger.error(f"❌ Invalid CARE_TOKEN_ADDRESS: {token_address_raw}")
                self.token_address = None
        else:
            self.token_address = None
        
        if controller_address_raw:
            try:
                self.controller_address = self.to_checksum_address(controller_address_raw)
            except ValueError as e:
                logger.error(f"❌ Invalid CARE_TOKEN_CONTROLLER_ADDRESS: {controller_address_raw}")
                self.controller_address = None
        else:
            self.controller_address = None
        
        # Load contract ABIs
        self.token_abi = self._load_token_abi()
        self.controller_abi = self._load_controller_abi()
        
        # Initialize contracts
        if self.token_address:
            self.token_contract = self.w3.eth.contract(
                address=self.token_address,
                abi=self.token_abi
            )
            logger.info(f"✅ CARE token loaded at {self.token_address}")
        else:
            self.token_contract = None
            logger.warning("⚠️  CARE_TOKEN_ADDRESS not set (blockchain features disabled)")
        
        if self.controller_address:
            self.controller_contract = self.w3.eth.contract(
                address=self.controller_address,
                abi=self.controller_abi
            )
            logger.info(f"✅ CARE token controller loaded at {self.controller_address}")
        else:
            self.controller_contract = None
            logger.warning("⚠️  CARE_TOKEN_CONTROLLER_ADDRESS not set (blockchain features disabled)")
        
        # Load minter account - validate private key before loading
        self.minter_private_key = os.getenv("CARE_MINTER_PRIVATE_KEY", "").strip()
        if self.minter_private_key and not self.minter_private_key.startswith("YOUR_"):
            try:
                self.minter_account = self.load_account(self.minter_private_key)
                logger.info("✅ CARE minter account loaded")
            except Exception as e:
                logger.error(f"❌ Failed to load minter account: {e}")
                self.minter_account = None
        else:
            self.minter_account = None
            if self.minter_private_key:
                logger.warning("⚠️  CARE_MINTER_PRIVATE_KEY contains placeholder value")
            else:
                logger.warning("⚠️  CARE_MINTER_PRIVATE_KEY not set. Minting disabled.")
    
    def _load_token_abi(self) -> list:
        """Load CARE token ABI from compiled artifacts"""
        artifact_path = Path(__file__).parent.parent.parent.parent / "blockchain" / "artifacts" / "contracts" / "CareToken.sol" / "CareToken.json"
        
        if artifact_path.exists():
            with open(artifact_path, "r") as f:
                artifact = json.load(f)
                return artifact["abi"]
        
        # Fallback: minimal ABI
        logger.warning("Could not load full token ABI, using minimal ABI")
        return [
            {
                "inputs": [{"name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]
    
    def _load_controller_abi(self) -> list:
        """Load CARE token controller ABI"""
        artifact_path = Path(__file__).parent.parent.parent.parent / "blockchain" / "artifacts" / "contracts" / "CareTokenController.sol" / "CareTokenController.json"
        
        if artifact_path.exists():
            with open(artifact_path, "r") as f:
                artifact = json.load(f)
                return artifact["abi"]
        
        # Fallback: minimal ABI
        logger.warning("Could not load full controller ABI, using minimal ABI")
        return [
            {
                "inputs": [
                    {"name": "category", "type": "uint8"},
                    {"name": "to", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                    {"name": "reason", "type": "string"}
                ],
                "name": "mintForCategory",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
    
    async def get_balance(self, wallet_address: str) -> Decimal:
        """
        Get CARE token balance for a wallet
        
        Args:
            wallet_address: Ethereum address
            
        Returns:
            Balance in CARE tokens (18 decimals)
        """
        if not self.token_contract:
            logger.error("❌ Token contract not initialized")
            return Decimal(0)
        
        try:
            checksum_address = self.to_checksum_address(wallet_address)
            balance_wei = self.token_contract.functions.balanceOf(checksum_address).call()
            balance = Decimal(balance_wei) / Decimal(10 ** 18)
            return balance
            
        except Exception as e:
            logger.error(f"❌ Failed to get balance: {e}")
            return Decimal(0)
    
    async def mint_for_category(
        self,
        category: int,
        to: str,
        amount: int,
        reason: str
    ) -> Optional[Dict[str, Any]]:
        """
        Mint CARE tokens for a specific category via controller
        
        Args:
            category: Mint category (0=Platform Ops, 1=Community Staking, etc.)
            to: Recipient address
            amount: Amount in wei (not CARE tokens!)
            reason: Reason for minting
            
        Returns:
            Transaction result if successful, None otherwise
        """
        if not self.controller_contract:
            logger.error("❌ Controller contract not initialized")
            return None
        
        if not self.minter_account:
            logger.error("❌ Minter account not configured")
            return None
        
        try:
            logger.info(f"🪙 Minting CARE tokens...")
            logger.info(f"   Category: {category}")
            logger.info(f"   To: {to}")
            logger.info(f"   Amount: {self.from_wei(amount)} CARE")
            logger.info(f"   Reason: {reason}")
            
            # Get current nonce
            nonce = self.w3.eth.get_transaction_count(self.minter_account.address)
            
            # Build transaction
            transaction = self.controller_contract.functions.mintForCategory(
                category,
                self.to_checksum_address(to),
                amount,
                reason
            ).build_transaction({
                'from': self.minter_account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': await self.get_gas_price(),
            })
            
            # Send transaction
            result = await self.send_transaction(
                transaction,
                self.minter_private_key,
                wait_for_receipt=True
            )
            
            if result:
                logger.info(f"✅ Tokens minted successfully!")
                return result
            else:
                logger.error(f"❌ Failed to mint tokens")
                return None
            
        except Exception as e:
            logger.error(f"❌ Error minting tokens: {e}")
            return None
    
    async def get_token_info(self) -> Dict[str, Any]:
        """
        Get CARE token information
        
        Returns:
            Token info dictionary
        """
        if not self.token_contract:
            return {"error": "Token contract not initialized"}
        
        try:
            # Call contract view functions
            name = self.token_contract.functions.name().call()
            symbol = self.token_contract.functions.symbol().call()
            decimals = self.token_contract.functions.decimals().call()
            total_supply_wei = self.token_contract.functions.totalSupply().call()
            
            return {
                "name": name,
                "symbol": symbol,
                "decimals": decimals,
                "total_supply": self.from_wei(total_supply_wei),
                "contract_address": self.token_address,
                "chain_id": self.w3.eth.chain_id
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get token info: {e}")
            return {"error": str(e)}
