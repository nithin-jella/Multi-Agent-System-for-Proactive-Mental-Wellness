"""
Base Web3 Client - Shared utilities for blockchain interactions

Provides common functionality for all blockchain clients:
- Web3 connection management
- Transaction signing and submission
- Gas estimation
- Error handling
- Retry logic
"""

try:
    from web3 import Web3
    # web3.py v7+: geth_poa_middleware renamed, use try/except for compatibility
    try:
        from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
    except ImportError:
        try:
            from web3.middleware import geth_poa_middleware  # type: ignore
        except ImportError:
            geth_poa_middleware = None  # type: ignore
    _WEB3_AVAILABLE = True
except ImportError as _web3_import_err:
    Web3 = None  # type: ignore
    geth_poa_middleware = None  # type: ignore
    _WEB3_AVAILABLE = False
    import logging as _logging
    _logging.getLogger(__name__).warning(
        "web3 package failed to import (blockchain features disabled): %s",
        _web3_import_err,
    )

from eth_account import Account
from eth_typing import ChecksumAddress
from typing import Optional, Dict, Any, cast
import os
import logging
import time

logger = logging.getLogger(__name__)


class BaseWeb3Client:
    """Base class for Web3 interactions with SOMNIA blockchain"""
    
    def __init__(self, rpc_url: Optional[str] = None):
        """
        Initialize Web3 connection
        
        Args:
            rpc_url: SOMNIA RPC URL (defaults to env var SOMNIA_RPC_URL)
        """
        self.rpc_url = rpc_url or os.getenv("SOMNIA_RPC_URL", "https://api.infra.mainnet.somnia.network/")
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))

        # Connection status (do not hard-fail by default in development)
        self.is_connected: bool = False
        
        # Add POA middleware for EVM-compatible chains (SOMNIA uses POA consensus)
        # Note: Web3.py v6+ renamed ExtraDataToPOAMiddleware to geth_poa_middleware
        if geth_poa_middleware is not None:
            self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        # Check connection
        self.is_connected = bool(self.w3.is_connected())
        if not self.is_connected:
            strict = (os.getenv("BLOCKCHAIN_STRICT", "").strip().lower() in {"1", "true", "yes", "on"})
            if strict:
                raise ConnectionError(f"Failed to connect to SOMNIA blockchain at {self.rpc_url}")

            logger.warning(
                "⚠️  Failed to connect to SOMNIA blockchain at %s (blockchain features disabled)",
                self.rpc_url,
            )
            return

        logger.info("✅ Connected to SOMNIA blockchain")
        logger.info("   RPC: %s", self.rpc_url)
        try:
            logger.info("   Chain ID: %s", self.w3.eth.chain_id)
        except Exception as exc:
            logger.warning("⚠️  Connected, but failed to read chain id: %s", exc)
    
    def to_checksum_address(self, address: str) -> ChecksumAddress:
        """Convert address to checksum format"""
        return Web3.to_checksum_address(address)
    
    def load_account(self, private_key: str) -> Account:
        """
        Load account from private key
        
        Args:
            private_key: Private key hex string
            
        Returns:
            Account object
        """
        try:
            account = Account.from_key(private_key)
            logger.info(f"✅ Account loaded: {account.address}")
            return account
        except Exception as e:
            logger.error(f"❌ Failed to load account: {e}")
            raise
    
    async def estimate_gas(
        self, 
        transaction: Dict[str, Any]
    ) -> int:
        """
        Estimate gas for a transaction
        
        Args:
            transaction: Transaction dictionary
            
        Returns:
            Estimated gas units
        """
        try:
            # Cast to TxParams for Web3.py type compatibility
            gas_estimate = self.w3.eth.estimate_gas(transaction)  # type: ignore
            # Add 20% buffer for safety
            return int(gas_estimate * 1.2)
        except Exception as e:
            logger.warning(f"⚠️  Failed to estimate gas: {e}")
            # Return default gas limit
            return 500000
    
    async def get_gas_price(self) -> int:
        """
        Get current gas price
        
        Returns:
            Gas price in wei
        """
        try:
            return self.w3.eth.gas_price
        except Exception as e:
            logger.warning(f"⚠️  Failed to get gas price: {e}")
            # Return default gas price (10 gwei)
            return self.w3.to_wei(10, 'gwei')
    
    async def send_transaction(
        self,
        transaction: Dict[str, Any],
        private_key: str,
        wait_for_receipt: bool = True,
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """
        Sign and send a transaction to the blockchain
        
        Args:
            transaction: Transaction dictionary
            private_key: Private key to sign transaction
            wait_for_receipt: Whether to wait for transaction confirmation
            max_retries: Maximum number of retry attempts
            
        Returns:
            Transaction receipt if successful, None otherwise
        """
        for attempt in range(max_retries):
            try:
                # Sign transaction
                signed_txn = self.w3.eth.account.sign_transaction(
                    transaction, 
                    private_key=private_key
                )
                
                # Send transaction
                tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
                tx_hash_hex = tx_hash.hex()
                
                logger.info(f"📤 Transaction sent: {tx_hash_hex}")
                
                if not wait_for_receipt:
                    return {"tx_hash": tx_hash_hex}
                
                # Wait for receipt
                logger.info(f"⏳ Waiting for confirmation...")
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
                
                if receipt['status'] == 1:
                    logger.info(f"✅ Transaction confirmed!")
                    logger.info(f"   Block: {receipt['blockNumber']}")
                    logger.info(f"   Gas used: {receipt['gasUsed']}")
                    
                    return {
                        "tx_hash": tx_hash_hex,
                        "block_number": receipt['blockNumber'],
                        "gas_used": receipt['gasUsed'],
                        "status": "success"
                    }
                else:
                    logger.error(f"❌ Transaction failed with status 0")
                    return None
                
            except Exception as e:
                logger.error(f"❌ Transaction attempt {attempt + 1}/{max_retries} failed: {e}")
                
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"⏳ Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"❌ All transaction attempts failed")
                    return None
        
        return None
    
    def get_block_number(self) -> int:
        """Get current block number"""
        return self.w3.eth.block_number
    
    def get_balance(self, address: str) -> int:
        """
        Get native token balance (STT) for an address
        
        Args:
            address: Ethereum address
            
        Returns:
            Balance in wei
        """
        checksum_address = self.to_checksum_address(address)
        return self.w3.eth.get_balance(checksum_address)
    
    def from_wei(self, value: int, unit: str = 'ether') -> float:
        """Convert wei to other units"""
        return float(self.w3.from_wei(value, unit))
    
    def to_wei(self, value: float, unit: str = 'ether') -> int:
        """Convert other units to wei"""
        return self.w3.to_wei(value, unit)
