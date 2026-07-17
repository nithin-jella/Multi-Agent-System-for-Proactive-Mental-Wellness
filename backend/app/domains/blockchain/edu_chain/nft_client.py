"""
EDU Chain NFT Badge Client

Handles UGMJournalBadges ERC1155 contract for achievement NFTs on EDU Chain Testnet.

Contract: UGMJournalBadges.sol (ERC1155)
Network: EDU Chain Testnet
RPC: https://rpc.open-campus-codex.gelato.digital
"""

import asyncio
import os
import json
from typing import Optional
import logging

logger = logging.getLogger(__name__)

try:
    from web3 import Web3  # type: ignore
    # web3.py v7+: geth_poa_middleware renamed, use try/except for compatibility
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
        "web3 unavailable in edu_chain nft_client — NFT features disabled: %s",
        _web3_err,
    )

from dotenv import load_dotenv, find_dotenv
import logging

logger = logging.getLogger(__name__)
load_dotenv(find_dotenv())

# --- Configuration ---
RPC_URL = os.getenv("EDU_TESTNET_RPC_URL")
CONTRACT_ADDRESS = os.getenv("NFT_CONTRACT_ADDRESS")
MINTER_PRIVATE_KEY = os.getenv("BACKEND_MINTER_PRIVATE_KEY")

import aiofiles  # type: ignore

# ABI path - now in same directory structure
abi_path = os.path.join(os.path.dirname(__file__), 'abi', 'UGMJournalBadges.json')


async def load_abi():
    """Load contract ABI from JSON file"""
    try:
        async with aiofiles.open(abi_path, 'r') as f:
            contract_json = json.loads(await f.read())
            return contract_json['abi']
    except FileNotFoundError:
        logger.error(f"ABI file not found at {abi_path}. Cannot interact with contract.")
        return None
    except Exception as e:
        logger.error(f"Error loading ABI file: {e}")
        return None


# Lazy-load the ABI to avoid running asyncio.run() at import time
CONTRACT_ABI = None


async def get_contract_abi():
    """Get the contract ABI, loading it if not already loaded."""
    global CONTRACT_ABI
    if CONTRACT_ABI is None:
        CONTRACT_ABI = await load_abi()
    return CONTRACT_ABI


# --- Web3 Setup ---
w3 = None
minter_account = None
contract = None
_initialized = False


async def init_blockchain():
    """Initialize EDU Chain blockchain connection lazily."""
    global w3, minter_account, contract, _initialized, CONTRACT_ABI
    
    if _initialized:
        return
    
    CONTRACT_ABI = await get_contract_abi()
    
    # Validate private key before using it
    private_key_valid = (
        MINTER_PRIVATE_KEY and 
        not MINTER_PRIVATE_KEY.startswith("YOUR_") and
        len(MINTER_PRIVATE_KEY) > 0
    )
    
    if RPC_URL and private_key_valid and CONTRACT_ADDRESS and CONTRACT_ABI:
        try:
            w3 = Web3(Web3.HTTPProvider(RPC_URL))
            
            # EDU Chain is an L3 on Arbitrum Orbit - add POA middleware for testnet
            # This handles the extraData field in block headers correctly
            if geth_poa_middleware is not None:
                w3.middleware_onion.inject(geth_poa_middleware, layer=0)

            if w3.is_connected():
                logger.info(f"✅ Connected to EDU Chain RPC: {RPC_URL}")
                logger.info(f"   Chain ID: {w3.eth.chain_id}")
                
                try:
                    minter_account = w3.eth.account.from_key(MINTER_PRIVATE_KEY)
                    logger.info(f"🔑 Backend Minter Address: {minter_account.address}")
                except Exception as e:
                    logger.error(f"❌ Failed to load minter account from private key: {e}")
                    minter_account = None

                # Load Contract
                contract = w3.eth.contract(
                    address=Web3.to_checksum_address(CONTRACT_ADDRESS),
                    abi=CONTRACT_ABI
                )
                logger.info(f"📝 NFT Contract loaded at address: {CONTRACT_ADDRESS}")
            else:
                logger.error("❌ Failed to connect to EDU Chain RPC.")
                w3 = None  # Ensure w3 is None if connection failed
        except Exception as e:
            logger.error(f"❌ Error initializing EDU Chain Web3 or Contract: {e}", exc_info=True)
            w3 = None
            minter_account = None
            contract = None
    else:
        missing = []
        if not RPC_URL:
            missing.append("EDU_TESTNET_RPC_URL")
        if not CONTRACT_ADDRESS:
            missing.append("NFT_CONTRACT_ADDRESS")
        if not private_key_valid:
            if not MINTER_PRIVATE_KEY:
                missing.append("BACKEND_MINTER_PRIVATE_KEY")
            elif MINTER_PRIVATE_KEY.startswith("YOUR_"):
                missing.append("BACKEND_MINTER_PRIVATE_KEY (contains placeholder)")
            else:
                missing.append("BACKEND_MINTER_PRIVATE_KEY (invalid format)")
        if not CONTRACT_ABI:
            missing.append("ABI file")
        
        logger.warning(
            f"⚠️  EDU Chain environment variables not fully configured. "
            f"Missing: {', '.join(missing)}. NFT minting disabled."
        )
    
    _initialized = True


def mint_nft_badge(recipient_address: str, badge_id: int, amount: int = 1) -> Optional[str]:
    """
    Mint an NFT badge on EDU Chain.
    
    Args:
        recipient_address: Ethereum address to receive the badge
        badge_id: ID of the badge type to mint
        amount: Number of badges to mint (default: 1)
    
    Returns:
        Transaction hash if successful, None otherwise
    """
    if not contract or not w3 or not minter_account:
        logger.error("❌ EDU Chain Web3 setup incomplete. Cannot mint badge.")
        return None


def set_token_uri(badge_id: int, token_uri: str) -> Optional[str]:
    """Set a specific token URI for a badge id.

    Note:
    - This requires DEFAULT_ADMIN_ROLE on the contract.
    - Intended to be used once per badge id to keep metadata effectively immutable.
    """

    if not contract or not w3 or not minter_account:
        logger.error("❌ EDU Chain Web3 setup incomplete. Cannot set token URI.")
        return None

    try:
        nonce = w3.eth.get_transaction_count(minter_account.address)
        current_gas_price = w3.eth.gas_price

        try:
            estimated_gas = contract.functions.setTokenUri(
                int(badge_id),
                str(token_uri),
            ).estimate_gas({
                'from': minter_account.address,
                'nonce': nonce,
            })
            gas_limit = int(estimated_gas * 1.2)
        except Exception as estimate_error:
            logger.error(f"⚠️  Gas estimation failed for setTokenUri: {estimate_error}. Falling back to default limit.")
            gas_limit = 300000

        txn_data = contract.functions.setTokenUri(
            int(badge_id),
            str(token_uri),
        ).build_transaction({
            'chainId': w3.eth.chain_id,
            'gas': gas_limit,
            'gasPrice': current_gas_price,
            'nonce': nonce,
            'from': minter_account.address,
        })

        signed_txn = w3.eth.account.sign_transaction(txn_data, private_key=MINTER_PRIVATE_KEY)
        txn_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        hex_hash = txn_hash.hex()
        logger.info(f"✅ setTokenUri transaction sent: {hex_hash}")
        return hex_hash
    except Exception as e:
        logger.error(f"❌ Error setting token URI for badge_id={badge_id}: {e}", exc_info=True)
        return None

    try:
        logger.info(f"🎨 Attempting to mint badge ID {badge_id} for recipient {recipient_address}")
        recipient_checksum = Web3.to_checksum_address(recipient_address)
        nonce = w3.eth.get_transaction_count(minter_account.address)
        current_gas_price = w3.eth.gas_price
        logger.debug(f"⛽ Current Gas Price: {current_gas_price}")

        # --- Estimate Gas ---
        try:
            estimated_gas = contract.functions.mintBadge(
                recipient_checksum,
                badge_id,
                amount
            ).estimate_gas({
                'from': minter_account.address,
                'nonce': nonce
            })
            # Add a buffer (e.g., 20%) to the estimate for safety
            gas_limit = int(estimated_gas * 1.2)
            logger.info(f"📊 Estimated Gas: {estimated_gas}, Using Gas Limit: {gas_limit}")
        except Exception as estimate_error:
            # Handle estimation failure (might happen if tx is guaranteed to fail)
            logger.error(f"⚠️  Gas estimation failed: {estimate_error}. Falling back to default limit.")
            # Fallback to a higher default if estimation fails (adjust as needed)
            gas_limit = 300000  # Increased fallback limit
        # --------------------

        # Prepare the transaction using the estimated/fallback gas limit
        txn_data = contract.functions.mintBadge(
            recipient_checksum,
            badge_id,
            amount
        ).build_transaction({
            'chainId': w3.eth.chain_id,
            'gas': gas_limit,  # Use estimated gas limit
            'gasPrice': current_gas_price,  # Use current gas price
            'nonce': nonce,
            'from': minter_account.address
        })
        logger.debug(f"📄 Transaction Data: {txn_data}")

        # Sign the transaction
        signed_txn = w3.eth.account.sign_transaction(txn_data, private_key=MINTER_PRIVATE_KEY)

        # Send the transaction
        txn_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        hex_hash = txn_hash.hex()
        logger.info(f"✅ Badge mint transaction sent: {hex_hash}")

        # Optional: Wait for transaction receipt (can slow down API response)
        # try:
        #     receipt = w3.eth.wait_for_transaction_receipt(txn_hash, timeout=120)
        #     if receipt.status == 1:
        #         logger.info(f"✅ Transaction successful: {hex_hash}")
        #     else:
        #         logger.error(f"❌ Transaction failed: {hex_hash}")
        #         return None  # Indicate failure
        # except Exception as e:
        #      logger.error(f"❌ Error waiting for receipt {hex_hash}: {e}")
        #      # Still return hash, as TX was sent

        return hex_hash  # Return the transaction hash

    except Exception as e:
        # Log the specific error, including potential gas-related issues from the node
        logger.error(f"❌ Error minting badge ID {badge_id} for {recipient_address}: {e}", exc_info=True)
        if 'intrinsic gas too low' in str(e).lower():
            logger.error("⚠️  Consider increasing the fallback gas limit if estimation failed.")
        elif 'insufficient funds' in str(e).lower():
            logger.error(f"💰 Minter wallet {minter_account.address} may need more EDU Testnet gas tokens.")
        return None
