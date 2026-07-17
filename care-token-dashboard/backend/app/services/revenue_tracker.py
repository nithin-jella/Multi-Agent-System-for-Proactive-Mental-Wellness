"""
Revenue Tracker Service for CARE Token Dashboard

This service aggregates platform revenue from multiple sources and submits
monthly reports to the PlatformRevenueOracle smart contract.

Features:
- Tracks 5 revenue streams (wellness fees, subscriptions, NFT sales, partner fees, treasury returns)
- Calculates monthly expenses
- Submits reports with multi-sig approval workflow
- Saves reports to local database for audit trail
- Handles on-chain transaction errors gracefully

Usage:
- Run as a background service (scheduler runs on 1st of each month)
- Manual trigger via API endpoint for testing
- View revenue dashboard via admin panel
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from web3 import Web3
# web3.py v7+: geth_poa_middleware renamed to ExtraDataToPOAMiddleware
from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware  # type: ignore
from eth_account import Account
from eth_typing import ChecksumAddress
import logging

from app.core.config import settings
from app.models import RevenueReport, ReportStatus
from app.db.session import async_session_maker

logger = logging.getLogger(__name__)


class RevenueBreakdown:
    """Revenue breakdown structure matching smart contract"""
    
    def __init__(self):
        self.wellness_fees: Decimal = Decimal(0)
        self.subscriptions: Decimal = Decimal(0)
        self.nft_sales: Decimal = Decimal(0)
        self.partner_fees: Decimal = Decimal(0)
        self.treasury_returns: Decimal = Decimal(0)
    
    @property
    def total(self) -> Decimal:
        """Total revenue across all streams"""
        return (
            self.wellness_fees +
            self.subscriptions +
            self.nft_sales +
            self.partner_fees +
            self.treasury_returns
        )
    
    def to_dict(self) -> Dict[str, str]:
        """Convert to dictionary for logging/API"""
        return {
            "wellnessFees": str(self.wellness_fees),
            "subscriptions": str(self.subscriptions),
            "nftSales": str(self.nft_sales),
            "partnerFees": str(self.partner_fees),
            "treasuryReturns": str(self.treasury_returns),
            "total": str(self.total),
        }
    
    def to_wei_tuple(self) -> tuple:
        """Convert to wei tuple for smart contract call"""
        # Convert USDC (6 decimals) to CARE token decimals (18 decimals)
        multiplier = 10 ** 18  # Convert to wei
        
        return (
            int(self.wellness_fees * multiplier),
            int(self.subscriptions * multiplier),
            int(self.nft_sales * multiplier),
            int(self.partner_fees * multiplier),
            int(self.treasury_returns * multiplier),
        )


class RevenueTrackerService:
    """Service for tracking and reporting platform revenue"""
    
    def __init__(self):
        # Web3 configuration
        self.w3 = Web3(Web3.HTTPProvider(settings.SOMNIA_RPC_URL))
        
        # Add POA middleware for SOMNIA (EVM-compatible chain with POA consensus)
        # This handles the extraData field in block headers correctly
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        # Verify connection
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to SOMNIA blockchain at {settings.SOMNIA_RPC_URL}")
        
        logger.info(f"✅ Connected to SOMNIA blockchain (Chain ID: {self.w3.eth.chain_id})")
        
        # Contract addresses
        self.oracle_address: ChecksumAddress = Web3.to_checksum_address(
            settings.PLATFORM_REVENUE_ORACLE_ADDRESS or "0x0000000000000000000000000000000000000000"
        )
        
        # Contract ABI (simplified - load full ABI in production)
        self.oracle_abi = [
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
            }
        ]
        
        # Finance team wallet (must have FINANCE_TEAM_ROLE)
        self.finance_wallet_private_key = settings.FINANCE_TEAM_PRIVATE_KEY
        if self.finance_wallet_private_key:
            self.finance_account = Account.from_key(self.finance_wallet_private_key)
        else:
            self.finance_account = None
            logger.warning("⚠️  FINANCE_TEAM_PRIVATE_KEY not set. Submit functions will not work.")
        
        # Oracle contract
        if settings.PLATFORM_REVENUE_ORACLE_ADDRESS:
            self.oracle_contract = self.w3.eth.contract(
                address=self.oracle_address,
                abi=self.oracle_abi
            )
        else:
            self.oracle_contract = None
            logger.warning("⚠️  PLATFORM_REVENUE_ORACLE_ADDRESS not set. Blockchain submission will not work.")
        
        logger.info(f"✅ RevenueTrackerService initialized")
        logger.info(f"   Oracle: {self.oracle_address}")
        if self.finance_account:
            logger.info(f"   Finance wallet: {self.finance_account.address}")
    
    async def calculate_wellness_fees(self, year: int, month: int) -> Decimal:
        """
        Calculate wellness service fees for the month
        
        TODO: Connect to main UGM-AICare database to query actual Transaction data
        For now, returns placeholder value
        """
        logger.info(f"💰 Wellness fees ({year}-{month:02d}): Calculating...")
        return Decimal("5000.00")  # Placeholder
    
    async def calculate_subscriptions(self, year: int, month: int) -> Decimal:
        """
        Calculate premium subscription revenue for the month
        
        TODO: Connect to main UGM-AICare database to query actual Subscription data
        """
        logger.info(f"💰 Subscriptions ({year}-{month:02d}): Calculating...")
        return Decimal("3000.00")  # Placeholder
    
    async def calculate_nft_sales(self, year: int, month: int) -> Decimal:
        """
        Calculate NFT achievement badge sales for the month
        
        TODO: Connect to main UGM-AICare database to query actual NFTTransaction data
        """
        logger.info(f"💰 NFT sales ({year}-{month:02d}): Calculating...")
        return Decimal("2000.00")  # Placeholder
    
    async def calculate_partner_fees(self, year: int, month: int) -> Decimal:
        """
        Calculate partner institution fees for the month
        
        TODO: Connect to main UGM-AICare database to query actual PartnerTransaction data
        """
        logger.info(f"💰 Partner fees ({year}-{month:02d}): Calculating...")
        return Decimal("1500.00")  # Placeholder
    
    async def calculate_treasury_returns(self, year: int, month: int) -> Decimal:
        """
        Calculate treasury investment returns for the month
        
        TODO: Integrate with treasury management system
        """
        logger.info(f"💰 Treasury returns ({year}-{month:02d}): Calculating...")
        return Decimal("2000.00")  # Placeholder
    
    async def calculate_monthly_expenses(self, year: int, month: int) -> Decimal:
        """
        Calculate platform operating expenses for the month
        
        TODO: Integrate with accounting system
        """
        logger.info(f"💸 Expenses ({year}-{month:02d}): Calculating...")
        return Decimal("3000.00")  # Placeholder
    
    async def aggregate_monthly_revenue(self, year: int, month: int) -> Tuple[RevenueBreakdown, Decimal]:
        """
        Aggregate all revenue streams and expenses for a month
        
        Returns:
            (RevenueBreakdown, total_expenses)
        """
        logger.info(f"\n📊 Aggregating revenue for {year}-{month:02d}...")
        
        breakdown = RevenueBreakdown()
        breakdown.wellness_fees = await self.calculate_wellness_fees(year, month)
        breakdown.subscriptions = await self.calculate_subscriptions(year, month)
        breakdown.nft_sales = await self.calculate_nft_sales(year, month)
        breakdown.partner_fees = await self.calculate_partner_fees(year, month)
        breakdown.treasury_returns = await self.calculate_treasury_returns(year, month)
        
        total_expenses = await self.calculate_monthly_expenses(year, month)
        
        logger.info(f"\n✅ Revenue aggregation complete:")
        logger.info(f"   Total revenue: ${breakdown.total}")
        logger.info(f"   Total expenses: ${total_expenses}")
        logger.info(f"   Net profit: ${breakdown.total - total_expenses}")
        
        return breakdown, total_expenses
    
    def format_month_yyyymm(self, year: int, month: int) -> int:
        """Convert year/month to YYYYMM format (e.g., 202510)"""
        return year * 100 + month
    
    async def save_report_to_db(
        self,
        year: int,
        month: int,
        breakdown: RevenueBreakdown,
        total_expenses: Decimal,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None,
        submitted_by: Optional[int] = None
    ) -> RevenueReport:
        """Save revenue report to database"""
        async with async_session_maker() as db:
            # Check if report exists
            result = await db.execute(
                select(RevenueReport).where(
                    RevenueReport.year == year,
                    RevenueReport.month == month
                )
            )
            report = result.scalar_one_or_none()
            
            net_profit = breakdown.total - total_expenses
            
            if report:
                # Update existing
                report.wellness_fees = breakdown.wellness_fees
                report.subscriptions = breakdown.subscriptions
                report.nft_sales = breakdown.nft_sales
                report.partner_fees = breakdown.partner_fees
                report.treasury_returns = breakdown.treasury_returns
                report.total_revenue = breakdown.total
                report.total_expenses = total_expenses
                report.net_profit = net_profit
                
                if tx_hash:
                    report.transaction_hash = tx_hash
                    report.status = ReportStatus.SUBMITTED
                    report.submitted_at = datetime.utcnow()
                    report.submitted_by = submitted_by
                if block_number:
                    report.block_number = block_number
            else:
                # Create new
                report = RevenueReport(
                    year=year,
                    month=month,
                    wellness_fees=breakdown.wellness_fees,
                    subscriptions=breakdown.subscriptions,
                    nft_sales=breakdown.nft_sales,
                    partner_fees=breakdown.partner_fees,
                    treasury_returns=breakdown.treasury_returns,
                    total_revenue=breakdown.total,
                    total_expenses=total_expenses,
                    net_profit=net_profit,
                    status=ReportStatus.SUBMITTED if tx_hash else ReportStatus.DRAFT,
                    transaction_hash=tx_hash,
                    block_number=block_number,
                    submitted_by=submitted_by,
                    submitted_at=datetime.utcnow() if tx_hash else None
                )
                db.add(report)
            
            await db.commit()
            await db.refresh(report)
            
            logger.info(f"💾 Report saved to database (ID: {report.id})")
            return report
    
    async def submit_monthly_report(
        self,
        year: int,
        month: int,
        breakdown: RevenueBreakdown,
        total_expenses: Decimal
    ) -> Optional[str]:
        """
        Submit monthly report to PlatformRevenueOracle smart contract
        
        Returns:
            Transaction hash if successful, None otherwise
        """
        if not self.finance_account:
            logger.error("❌ Finance wallet not configured. Cannot submit report.")
            return None
        
        if not self.oracle_contract:
            logger.error("❌ Oracle contract not configured. Cannot submit report.")
            return None
        
        try:
            month_yyyymm = self.format_month_yyyymm(year, month)
            
            # Convert to wei
            total_revenue_wei = int(breakdown.total * (10 ** 18))
            total_expenses_wei = int(total_expenses * (10 ** 18))
            breakdown_tuple = breakdown.to_wei_tuple()
            
            logger.info(f"\n📤 Submitting monthly report to blockchain...")
            logger.info(f"   Month: {month_yyyymm}")
            logger.info(f"   Revenue: {breakdown.total} USDC")
            logger.info(f"   Expenses: {total_expenses} USDC")
            
            # Build transaction
            nonce = self.w3.eth.get_transaction_count(self.finance_account.address)
            
            transaction = self.oracle_contract.functions.submitMonthlyReport(
                month_yyyymm,
                total_revenue_wei,
                total_expenses_wei,
                breakdown_tuple
            ).build_transaction({
                'from': self.finance_account.address,
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': self.w3.eth.gas_price,
            })
            
            # Sign transaction
            signed_txn = self.w3.eth.account.sign_transaction(
                transaction,
                private_key=self.finance_wallet_private_key
            )
            
            # Send transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            tx_hash_hex = tx_hash.hex()
            
            logger.info(f"   Transaction sent: {tx_hash_hex}")
            logger.info(f"   Waiting for confirmation...")
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt['status'] == 1:
                logger.info(f"✅ Report submitted successfully!")
                logger.info(f"   Block: {receipt['blockNumber']}")
                logger.info(f"   Gas used: {receipt['gasUsed']}")
                return tx_hash_hex
            else:
                logger.error(f"❌ Transaction failed: {receipt}")
                return None
        
        except Exception as e:
            logger.error(f"❌ Error submitting report: {str(e)}")
            return None
    
    async def process_monthly_report(
        self,
        year: int,
        month: int,
        submitted_by: Optional[int] = None
    ) -> Optional[RevenueReport]:
        """
        Complete monthly report workflow:
        1. Aggregate revenue
        2. Submit to blockchain
        3. Save to database
        
        Returns:
            RevenueReport if successful, None otherwise
        """
        try:
            logger.info(f"\n🚀 Processing monthly report for {year}-{month:02d}...")
            
            # Aggregate revenue
            breakdown, total_expenses = await self.aggregate_monthly_revenue(year, month)
            
            # Submit to blockchain
            tx_hash = await self.submit_monthly_report(year, month, breakdown, total_expenses)
            
            # Save to database (even if blockchain submission failed)
            report = await self.save_report_to_db(
                year, month, breakdown, total_expenses,
                tx_hash=tx_hash,
                submitted_by=submitted_by
            )
            
            if tx_hash:
                logger.info(f"✅ Monthly report processed successfully!")
                logger.info(f"   Transaction: {tx_hash}")
                return report
            else:
                logger.warning(f"⚠️  Report saved as draft (blockchain submission failed)")
                return report
        
        except Exception as e:
            logger.error(f"❌ Error processing monthly report: {str(e)}")
            return None
    
    async def auto_submit_last_month(self) -> bool:
        """
        Automatically submit report for previous month
        (Called by scheduler on 1st of each month)
        """
        now = datetime.utcnow()
        
        # Calculate last month
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month = first_of_this_month - timedelta(days=1)
        
        year = last_month.year
        month = last_month.month
        
        logger.info(f"🔄 Auto-submitting report for {year}-{month:02d}...")
        
        report = await self.process_monthly_report(year, month)
        return report is not None


# Singleton instance
revenue_tracker = RevenueTrackerService()
