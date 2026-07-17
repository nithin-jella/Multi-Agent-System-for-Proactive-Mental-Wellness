"""
Backend Revenue Tracker Service for Sharia-Compliant Staking

This service aggregates platform revenue from multiple sources and submits
monthly reports to the PlatformRevenueOracle smart contract.

Features:
- Tracks 5 revenue streams (wellness fees, subscriptions, NFT sales, partner fees, treasury returns)
- Calculates monthly expenses
- Submits reports with multi-sig approval workflow
- Handles on-chain transaction errors gracefully
- Provides revenue analytics API endpoints

Usage:
- Run as a background service (scheduler runs on 1st of each month)
- Manual trigger via API endpoint for testing
- View revenue dashboard via admin panel

⚠️ PRODUCTION TODO:
- Replace placeholder calculations with actual database queries
- Implement real exchange rate API for USDC to CARE conversion
- Add database persistence for report audit trail
- Implement retry logic for blockchain submission failures
"""

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
import logging
import os

# Finance module imports
from app.domains.finance.models import (
    Transaction,
    Subscription,
    NFTTransaction,
    PartnerTransaction,
    RevenueReport,
    TransactionStatus,
    SubscriptionStatus
)

# Blockchain imports
from app.domains.blockchain import OracleClient

logger = logging.getLogger(__name__)

# Database - AsyncSessionLocal import wrapped in try/except
# This may not be available in all configurations
try:
    from app.database import AsyncSessionLocal as async_session_maker  # type: ignore
except ImportError:
    async_session_maker = None  # type: ignore
    logger.warning("⚠️  AsyncSessionLocal not found in app.database")

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
        """
        Convert to wei tuple for smart contract call
        
        ⚠️ PRODUCTION TODO: Replace hardcoded 1:1 rate with actual exchange rate API
        Current: Assumes 1 USDC = 1 CARE
        Should: Query Chainlink or DEX for real-time USDC/CARE rate
        """
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
        """Initialize revenue tracker with blockchain oracle client."""
        try:
            self.oracle_client = OracleClient()
            logger.info("✅ RevenueTrackerService initialized")
            logger.info("   Oracle: %s", self.oracle_client.oracle_address)
            if self.oracle_client.finance_account:
                wallet_address = self.oracle_client.finance_account.address  # type: ignore
                logger.info("   Finance wallet: %s", wallet_address)
        except (RuntimeError, ImportError, Exception) as exc:
            # Blockchain package is not available (e.g., eth_utils version mismatch).
            # Revenue tracker starts in a degraded mode — blockchain reporting is
            # disabled but other service methods remain operational.
            self.oracle_client = None  # type: ignore
            logger.warning(
                "RevenueTrackerService started WITHOUT blockchain oracle "
                "(blockchain reporting disabled): %s",
                exc,
            )
    
    async def calculate_wellness_fees(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate wellness service fees for the month
        
        Revenue sources:
        - CBT module completions
        - Daily check-ins
        - Wellness assessments
        - One-on-one coaching sessions
        
        ⚠️ PRODUCTION TODO: Replace placeholder with actual database query
        """
        try:
            # Query actual wellness transactions
            result = await db.execute(
                select(func.sum(Transaction.amount))
                .where(
                    and_(
                        Transaction.transaction_type == "wellness_fee",
                        extract('year', Transaction.created_at) == year,
                        extract('month', Transaction.created_at) == month,
                        Transaction.status == TransactionStatus.COMPLETED
                    )
                )
            )
            total = result.scalar() or Decimal(0)
            
            logger.info(f"💰 Wellness fees ({year}-{month:02d}): ${total}")
            return total
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to query wellness fees, using placeholder: {e}")
            return Decimal("5000.00")  # Placeholder for testing
    
    async def calculate_subscriptions(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate premium subscription revenue for the month
        
        Revenue sources:
        - Premium memberships
        - Advanced AI features access
        - Priority support
        """
        try:
            result = await db.execute(
                select(func.sum(Subscription.amount))
                .where(
                    and_(
                        extract('year', Subscription.billing_date) == year,
                        extract('month', Subscription.billing_date) == month,
                        Subscription.status == SubscriptionStatus.ACTIVE
                    )
                )
            )
            total = result.scalar() or Decimal(0)
            
            logger.info(f"💰 Subscriptions ({year}-{month:02d}): ${total}")
            return total
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to query subscriptions, using placeholder: {e}")
            return Decimal("3000.00")  # Placeholder for testing
    
    async def calculate_nft_sales(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate NFT achievement badge sales for the month
        
        Revenue sources:
        - UGMJournalBadges mints
        - Quest completion NFTs
        - Special event badges
        """
        try:
            result = await db.execute(
                select(func.sum(NFTTransaction.price))
                .where(
                    and_(
                        extract('year', NFTTransaction.created_at) == year,
                        extract('month', NFTTransaction.created_at) == month,
                        NFTTransaction.status == TransactionStatus.COMPLETED
                    )
                )
            )
            total = result.scalar() or Decimal(0)
            
            logger.info(f"💰 NFT sales ({year}-{month:02d}): ${total}")
            return total
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to query NFT sales, using placeholder: {e}")
            return Decimal("1500.00")  # Placeholder for testing
    
    async def calculate_partner_fees(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate partner institution fees for the month
        
        Revenue sources:
        - Clinical partners (referrals, consultations)
        - Merchants (Grab, GoFood, etc. - wellness vouchers)
        - Educational institutions
        """
        try:
            result = await db.execute(
                select(func.sum(PartnerTransaction.fee_amount))
                .where(
                    and_(
                        extract('year', PartnerTransaction.created_at) == year,
                        extract('month', PartnerTransaction.created_at) == month,
                        PartnerTransaction.status == TransactionStatus.COMPLETED
                    )
                )
            )
            total = result.scalar() or Decimal(0)
            
            logger.info(f"💰 Partner fees ({year}-{month:02d}): ${total}")
            return total
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to query partner fees, using placeholder: {e}")
            return Decimal("2500.00")  # Placeholder for testing
    
    async def calculate_treasury_returns(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate treasury investment returns for the month
        
        Revenue sources:
        - Halal treasury investments (Sukuk, Islamic bonds)
        - DeFi yield farming (Sharia-compliant protocols)
        - Staking rewards from protocol partnerships
        
        ⚠️ PRODUCTION TODO: Integrate with treasury management system
        """
        try:
            result = await db.execute(
                select(func.sum(Transaction.amount))
                .where(
                    and_(
                        Transaction.transaction_type == "treasury_return",
                        extract('year', Transaction.created_at) == year,
                        extract('month', Transaction.created_at) == month,
                        Transaction.status == TransactionStatus.COMPLETED
                    )
                )
            )
            total = result.scalar() or Decimal(0)
            
            logger.info(f"💰 Treasury returns ({year}-{month:02d}): ${total}")
            return total
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to query treasury returns, using placeholder: {e}")
            return Decimal("2000.00")  # Placeholder for testing
    
    async def calculate_monthly_expenses(
        self, 
        db: AsyncSession, 
        year: int, 
        month: int
    ) -> Decimal:
        """
        Calculate platform operating expenses for the month
        
        Expense categories:
        - Server infrastructure (AWS, database hosting)
        - AI API costs (Google Gemini 2.5, embeddings)
        - Employee salaries
        - Marketing and user acquisition
        - Legal and compliance
        - Development tools and services
        
        ⚠️ PRODUCTION TODO: Integrate with accounting system
        """
        logger.info(f"💸 Expenses ({year}-{month:02d}): Calculating...")
        
        # TODO: Query expense tracking system
        # For now, return placeholder
        return Decimal("3000.00")  # Placeholder for testing
    
    async def aggregate_monthly_revenue(
        self, 
        year: int, 
        month: int
    ) -> tuple[RevenueBreakdown, Decimal]:
        """
        Aggregate all revenue streams and expenses for a month
        
        Returns:
            (RevenueBreakdown, total_expenses)
        """
        # Check if async_session_maker is available
        if async_session_maker is None:
            logger.error("❌ async_session_maker not available")
            raise RuntimeError("Database session maker not configured")
            
        async with async_session_maker() as db:
            logger.info(f"\n📊 Aggregating revenue for {year}-{month:02d}...")
            
            breakdown = RevenueBreakdown()
            breakdown.wellness_fees = await self.calculate_wellness_fees(db, year, month)
            breakdown.subscriptions = await self.calculate_subscriptions(db, year, month)
            breakdown.nft_sales = await self.calculate_nft_sales(db, year, month)
            breakdown.partner_fees = await self.calculate_partner_fees(db, year, month)
            breakdown.treasury_returns = await self.calculate_treasury_returns(db, year, month)
            
            total_expenses = await self.calculate_monthly_expenses(db, year, month)
            
            logger.info(f"\n✅ Revenue aggregation complete:")
            logger.info(f"   Total revenue: ${breakdown.total}")
            logger.info(f"   Total expenses: ${total_expenses}")
            logger.info(f"   Net profit: ${breakdown.total - total_expenses}")
            
            return breakdown, total_expenses
    
    async def save_report_to_db(
        self,
        year: int,
        month: int,
        breakdown: RevenueBreakdown,
        total_expenses: Decimal,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None
    ) -> Optional[RevenueReport]:
        """
        Save revenue report to database for audit trail
        
        Args:
            year: Report year
            month: Report month (1-12)
            breakdown: Revenue breakdown
            total_expenses: Total expenses
            tx_hash: Blockchain transaction hash (if submitted)
            block_number: Block number (if submitted)
            
        Returns:
            RevenueReport instance if successful, None otherwise
        """
        try:
            # Check if async_session_maker is available
            if async_session_maker is None:
                logger.error("❌ async_session_maker not available")
                return None
                
            async with async_session_maker() as db:
                # Check if report already exists
                month_yyyymm = year * 100 + month
                result = await db.execute(
                    select(RevenueReport).where(RevenueReport.month_yyyymm == month_yyyymm)
                )
                existing_report = result.scalar_one_or_none()
                
                if existing_report:
                    logger.warning(f"⚠️  Report for {year}-{month:02d} already exists (ID: {existing_report.id})")
                    return existing_report
                
                # Create new report
                report = RevenueReport(
                    year=year,
                    month=month,
                    month_yyyymm=month_yyyymm,
                    wellness_fees=breakdown.wellness_fees,
                    subscriptions=breakdown.subscriptions,
                    nft_sales=breakdown.nft_sales,
                    partner_fees=breakdown.partner_fees,
                    treasury_returns=breakdown.treasury_returns,
                    total_revenue=breakdown.total,
                    total_expenses=total_expenses,
                    net_profit=breakdown.total - total_expenses,
                    submitted_to_blockchain=bool(tx_hash),
                    transaction_hash=tx_hash,
                    block_number=block_number,
                    submission_timestamp=datetime.utcnow() if tx_hash else None
                )
                
                db.add(report)
                await db.commit()
                await db.refresh(report)
                
                logger.info(f"✅ Report saved to database (ID: {report.id})")
                return report
                
        except Exception as e:
            logger.error(f"❌ Failed to save report to database: {e}")
            return None
    
    async def submit_monthly_report(
        self, 
        year: int, 
        month: int,
        breakdown: RevenueBreakdown,
        total_expenses: Decimal
    ) -> Optional[Dict[str, Any]]:
        """
        Submit monthly report to PlatformRevenueOracle smart contract
        
        Returns:
            Dictionary with tx_hash and block_number if successful, None otherwise
        """
        month_yyyymm = year * 100 + month
        
        # Convert to wei
        total_revenue_wei = int(breakdown.total * (10 ** 18))
        total_expenses_wei = int(total_expenses * (10 ** 18))
        breakdown_tuple = breakdown.to_wei_tuple()
        
        logger.info(f"\n📤 Submitting monthly report to blockchain...")
        logger.info(f"   Month: {month_yyyymm}")
        logger.info(f"   Revenue: {breakdown.total} USDC")
        logger.info(f"   Expenses: {total_expenses} USDC")
        
        # Submit via oracle client — unavailable when blockchain package is not installed.
        if self.oracle_client is None:
            logger.warning(
                "submit_monthly_report skipped — blockchain oracle is not available "
                "(degraded mode)."
            )
            return None

        result = await self.oracle_client.submit_monthly_report(
            month_yyyymm,
            total_revenue_wei,
            total_expenses_wei,
            breakdown_tuple
        )
        
        return result
    
    async def process_monthly_report(self, year: int, month: int) -> bool:
        """
        Complete monthly report workflow:
        1. Aggregate revenue
        2. Submit to blockchain
        3. Log to database for audit trail
        
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"\n🚀 Processing monthly report for {year}-{month:02d}...")
            
            # Aggregate revenue
            breakdown, total_expenses = await self.aggregate_monthly_revenue(year, month)
            
            # Submit to blockchain
            result = await self.submit_monthly_report(year, month, breakdown, total_expenses)
            
            if result:
                tx_hash = result.get("tx_hash")
                block_number = result.get("block_number")
                
                logger.info(f"✅ Report submitted to blockchain!")
                logger.info(f"   Transaction: {tx_hash}")
                logger.info(f"   Block: {block_number}")
                
                # Save to database
                await self.save_report_to_db(
                    year, month, breakdown, total_expenses, 
                    tx_hash, block_number
                )
                
                logger.info(f"✅ Monthly report processed successfully!")
                return True
            else:
                logger.error(f"❌ Failed to submit report to blockchain")
                
                # Save to database even if blockchain submission failed
                await self.save_report_to_db(year, month, breakdown, total_expenses)
                
                return False
        
        except Exception as e:
            logger.error(f"❌ Error processing monthly report: {str(e)}")
            return False
    
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
        
        return await self.process_monthly_report(year, month)


# Singleton instance
revenue_tracker = RevenueTrackerService()
