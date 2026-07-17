"""
Platform Revenue Oracle Client

Handles interactions with the PlatformRevenueOracle smart contract:
- Submit monthly revenue reports
- Query historical reports
- Track multi-sig approvals
- Monitor report status

Contract: PlatformRevenueOracle.sol
Network: SOMNIA
"""

from typing import Optional, Dict, Any
import os
import logging

from app.domains.blockchain.base_web3 import BaseWeb3Client

logger = logging.getLogger(__name__)


class OracleClient(BaseWeb3Client):
    """Client for PlatformRevenueOracle smart contract"""
    
    def __init__(self):
        """Initialize oracle client with contract address and ABI"""
        super().__init__()
        
        # Load contract address - validate before converting to checksum
        oracle_address_raw = os.getenv("PLATFORM_REVENUE_ORACLE_ADDRESS", "").strip()
        
        if oracle_address_raw and oracle_address_raw != ("0x" + "0" * 40):
            try:
                self.oracle_address = self.to_checksum_address(oracle_address_raw)
            except ValueError as e:
                logger.error(f"❌ Invalid PLATFORM_REVENUE_ORACLE_ADDRESS: {oracle_address_raw}")
                self.oracle_address = None
        else:
            self.oracle_address = None
            logger.warning("⚠️  PLATFORM_REVENUE_ORACLE_ADDRESS not set")
        
        # Load contract ABI
        self.oracle_abi = self._get_oracle_abi()
        
        # Initialize contract
        if self.oracle_address:
            self.contract = self.w3.eth.contract(
                address=self.oracle_address,
                abi=self.oracle_abi
            )
            logger.info(f"✅ PlatformRevenueOracle loaded at {self.oracle_address}")
        else:
            self.contract = None
            logger.warning("⚠️  Oracle contract not initialized (blockchain features disabled)")
        
        # Load finance team account - validate private key before loading
        self.finance_private_key = os.getenv("FINANCE_TEAM_PRIVATE_KEY", "").strip()
        if self.finance_private_key and not self.finance_private_key.startswith("YOUR_"):
            try:
                self.finance_account = self.load_account(self.finance_private_key)
                logger.info("✅ Finance team account loaded")
            except Exception as e:
                logger.error(f"❌ Failed to load finance account: {e}")
                self.finance_account = None
        else:
            self.finance_account = None
            if self.finance_private_key:
                logger.warning("⚠️  FINANCE_TEAM_PRIVATE_KEY contains placeholder value")
            else:
                logger.warning("⚠️  FINANCE_TEAM_PRIVATE_KEY not set. Submit functions will not work.")
    
    def _get_oracle_abi(self) -> list:
        """
        Get PlatformRevenueOracle contract ABI
        
        Returns:
            Contract ABI array
        """
        # Simplified ABI for submitMonthlyReport function
        # In production, load full ABI from compiled artifacts
        return [
            {
                "inputs": [
                    {"internalType": "uint256", "name": "month", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalRevenue", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalExpenses", "type": "uint256"},
                    {
                        "components": [
                            {"internalType": "uint256", "name": "wellnessFees", "type": "uint256"},
                            {"internalType": "uint256", "name": "subscriptions", "type": "uint256"},
                            {"internalType": "uint256", "name": "nftSales", "type": "uint256"},
                            {"internalType": "uint256", "name": "partnerFees", "type": "uint256"},
                            {"internalType": "uint256", "name": "treasuryReturns", "type": "uint256"},
                        ],
                        "internalType": "struct PlatformRevenueOracle.RevenueBreakdown",
                        "name": "breakdown",
                        "type": "tuple"
                    }
                ],
                "name": "submitMonthlyReport",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "month", "type": "uint256"}],
                "name": "getReport",
                "outputs": [
                    {"internalType": "uint256", "name": "totalRevenue", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalExpenses", "type": "uint256"},
                    {"internalType": "uint256", "name": "netProfit", "type": "uint256"},
                    {"internalType": "bool", "name": "finalized", "type": "bool"},
                    {"internalType": "uint8", "name": "approvalCount", "type": "uint8"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "month", "type": "uint256"}],
                "name": "approveReport",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]
    
    async def submit_monthly_report(
        self,
        month_yyyymm: int,
        total_revenue_wei: int,
        total_expenses_wei: int,
        breakdown_tuple: tuple
    ) -> Optional[Dict[str, Any]]:
        """
        Submit monthly revenue report to the oracle contract
        
        Args:
            month_yyyymm: Month in YYYYMM format (e.g., 202510)
            total_revenue_wei: Total revenue in wei
            total_expenses_wei: Total expenses in wei
            breakdown_tuple: Revenue breakdown tuple (wellnessFees, subscriptions, nftSales, partnerFees, treasuryReturns)
            
        Returns:
            Transaction result dictionary if successful, None otherwise
        """
        if not self.contract:
            logger.error("❌ Oracle contract not initialized")
            return None
        
        if not self.finance_account:
            logger.error("❌ Finance account not configured")
            return None
        
        try:
            logger.info(f"📤 Submitting monthly report to oracle...")
            logger.info(f"   Month: {month_yyyymm}")
            logger.info(f"   Revenue: {self.from_wei(total_revenue_wei)} CARE")
            logger.info(f"   Expenses: {self.from_wei(total_expenses_wei)} CARE")
            
            # Get current nonce
            nonce = self.w3.eth.get_transaction_count(self.finance_account.address)
            
            # Build transaction
            transaction = self.contract.functions.submitMonthlyReport(
                month_yyyymm,
                total_revenue_wei,
                total_expenses_wei,
                breakdown_tuple
            ).build_transaction({
                'from': self.finance_account.address,
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': await self.get_gas_price(),
            })
            
            # Send transaction
            result = await self.send_transaction(
                transaction,
                self.finance_private_key,
                wait_for_receipt=True
            )
            
            if result:
                logger.info(f"✅ Monthly report submitted successfully!")
                return result
            else:
                logger.error(f"❌ Failed to submit monthly report")
                return None
            
        except Exception as e:
            logger.error(f"❌ Error submitting monthly report: {e}")
            return None
    
    async def get_report(self, month_yyyymm: int) -> Optional[Dict[str, Any]]:
        """
        Query historical revenue report from oracle
        
        Args:
            month_yyyymm: Month in YYYYMM format (e.g., 202510)
            
        Returns:
            Report data dictionary if found, None otherwise
        """
        if not self.contract:
            logger.error("❌ Oracle contract not initialized")
            return None
        
        try:
            result = self.contract.functions.getReport(month_yyyymm).call()
            
            return {
                "month": month_yyyymm,
                "total_revenue": result[0],
                "total_expenses": result[1],
                "net_profit": result[2],
                "finalized": result[3],
                "approval_count": result[4],
                "total_revenue_formatted": self.from_wei(result[0]),
                "total_expenses_formatted": self.from_wei(result[1]),
                "net_profit_formatted": self.from_wei(result[2])
            }
            
        except Exception as e:
            logger.error(f"❌ Error querying report for {month_yyyymm}: {e}")
            return None
    
    async def approve_report(self, month_yyyymm: int) -> Optional[Dict[str, Any]]:
        """
        Approve a monthly report (multi-sig workflow)
        
        Args:
            month_yyyymm: Month in YYYYMM format (e.g., 202510)
            
        Returns:
            Transaction result if successful, None otherwise
        """
        if not self.contract:
            logger.error("❌ Oracle contract not initialized")
            return None
        
        if not self.finance_account:
            logger.error("❌ Finance account not configured")
            return None
        
        try:
            logger.info(f"✅ Approving report for {month_yyyymm}...")
            
            # Get current nonce
            nonce = self.w3.eth.get_transaction_count(self.finance_account.address)
            
            # Build transaction
            transaction = self.contract.functions.approveReport(
                month_yyyymm
            ).build_transaction({
                'from': self.finance_account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': await self.get_gas_price(),
            })
            
            # Send transaction
            result = await self.send_transaction(
                transaction,
                self.finance_private_key,
                wait_for_receipt=True
            )
            
            if result:
                logger.info(f"✅ Report approved successfully!")
                return result
            else:
                logger.error(f"❌ Failed to approve report")
                return None
            
        except Exception as e:
            logger.error(f"❌ Error approving report: {e}")
            return None
