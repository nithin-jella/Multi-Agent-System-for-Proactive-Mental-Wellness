"""
CareStakingHalal Client

Handles interactions with the CareStakingHalal smart contract:
- Query staking pools and tiers
- Get staker positions
- Query profit distributions
- Monitor staking analytics

Contract: CareStakingHalal.sol
Network: SOMNIA
"""

from typing import Optional, Dict, Any, List
import os
import json
import logging
from pathlib import Path

from app.domains.blockchain.base_web3 import BaseWeb3Client

logger = logging.getLogger(__name__)


class StakingClient(BaseWeb3Client):
    """Client for CareStakingHalal contract operations"""
    
    def __init__(self):
        """Initialize staking client"""
        super().__init__()
        
        # Load contract address - validate before converting to checksum
        staking_address_raw = os.getenv("CARE_STAKING_HALAL_ADDRESS", "").strip()
        
        if staking_address_raw:
            try:
                self.staking_address = self.to_checksum_address(staking_address_raw)
            except ValueError as e:
                logger.error(f"❌ Invalid CARE_STAKING_HALAL_ADDRESS: {staking_address_raw}")
                self.staking_address = None
        else:
            self.staking_address = None
        
        # Load contract ABI
        self.staking_abi = self._load_staking_abi()
        
        # Initialize contract
        if self.staking_address:
            self.contract = self.w3.eth.contract(
                address=self.staking_address,
                abi=self.staking_abi
            )
            logger.info(f"✅ CareStakingHalal loaded at {self.staking_address}")
        else:
            self.contract = None
            logger.warning("⚠️  CARE_STAKING_HALAL_ADDRESS not set (blockchain features disabled)")
    
    def _load_staking_abi(self) -> list:
        """Load staking contract ABI from compiled artifacts"""
        artifact_path = Path(__file__).parent.parent.parent.parent / "blockchain" / "artifacts" / "contracts" / "CareStakingHalal.sol" / "CareStakingHalal.json"
        
        if artifact_path.exists():
            with open(artifact_path, "r") as f:
                artifact = json.load(f)
                return artifact["abi"]
        
        # Fallback: minimal ABI for read operations
        logger.warning("Could not load full staking ABI, using minimal ABI")
        return [
            {
                "inputs": [],
                "name": "getTVL",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "staker", "type": "address"}],
                "name": "getStakerPosition",
                "outputs": [
                    {"name": "tier", "type": "uint8"},
                    {"name": "stakedAmount", "type": "uint256"},
                    {"name": "profitShareBPS", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ]
    
    async def get_tvl(self) -> Optional[Dict[str, Any]]:
        """
        Get Total Value Locked in staking contract
        
        Returns:
            TVL info dictionary
        """
        if not self.contract:
            logger.error("❌ Staking contract not initialized")
            return None
        
        try:
            tvl_wei = self.contract.functions.getTVL().call()
            tvl_care = self.from_wei(tvl_wei)
            
            return {
                "tvl_wei": tvl_wei,
                "tvl_care": tvl_care,
                "tvl_formatted": f"{tvl_care:,.2f} CARE"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get TVL: {e}")
            return None
    
    async def get_staker_position(self, staker_address: str) -> Optional[Dict[str, Any]]:
        """
        Get staker position details
        
        Args:
            staker_address: Ethereum address of staker
            
        Returns:
            Staker position info
        """
        if not self.contract:
            logger.error("❌ Staking contract not initialized")
            return None
        
        try:
            checksum_address = self.to_checksum_address(staker_address)
            result = self.contract.functions.getStakerPosition(checksum_address).call()
            
            tier_names = ["Bronze", "Silver", "Gold", "Platinum"]
            
            return {
                "staker": staker_address,
                "tier": result[0],
                "tier_name": tier_names[result[0]] if result[0] < len(tier_names) else "Unknown",
                "staked_amount_wei": result[1],
                "staked_amount_care": self.from_wei(result[1]),
                "profit_share_bps": result[2],
                "profit_share_percent": result[2] / 100  # BPS to percentage
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get staker position: {e}")
            return None
    
    async def get_tier_distribution(self) -> Optional[Dict[str, int]]:
        """
        Get distribution of stakers across tiers
        
        Returns:
            Dictionary with tier counts
        """
        # TODO: Implement event parsing or add view function to contract
        logger.warning("⚠️  get_tier_distribution not yet implemented")
        return {
            "bronze": 0,
            "silver": 0,
            "gold": 0,
            "platinum": 0
        }
