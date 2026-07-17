# Finance Module Documentation

## Overview

The **finance/** module consolidates all financial operations for the UGM-AICare platform, providing a clean separation of concerns from mental health services.

## 📁 Module Structure

```
backend/app/finance/
├── __init__.py                  # Module exports
├── models.py                    # Database models (RevenueReport, Transaction, etc.)
├── schemas.py                   # Pydantic request/response models
├── revenue_tracker.py           # Revenue aggregation and blockchain submission
└── revenue_scheduler.py         # Automated monthly reporting (APScheduler)
```

## 🎯 Purpose

This module handles:

- **Revenue Tracking**: Aggregates revenue from 5 streams (wellness fees, subscriptions, NFT sales, partner fees, treasury returns)
- **Expense Tracking**: Calculates monthly operating expenses
- **Blockchain Submission**: Submits monthly reports to PlatformRevenueOracle smart contract
- **Automated Reporting**: Monthly scheduler runs on 1st of every month at 1:00 AM UTC
- **Audit Trail**: Database persistence of all financial reports

## 🗄️ Database Models

### RevenueReport
Monthly revenue reports submitted to blockchain.

**Key Fields:**
- `year`, `month`, `month_yyyymm`: Time period
- `wellness_fees`, `subscriptions`, `nft_sales`, `partner_fees`, `treasury_returns`: Revenue breakdown
- `total_revenue`, `total_expenses`, `net_profit`: Financial totals
- `transaction_hash`, `block_number`: Blockchain submission details
- `approvals_count`, `finalized`: Multi-sig approval tracking

### Transaction
Platform transactions for revenue tracking (wellness fees, general payments).

### Subscription
Premium subscription payments.

### NFTTransaction
NFT achievement badge sales.

### PartnerTransaction
Partner institution fees (clinical partners, merchants).

### RevenueApproval
Multi-sig approval tracking for revenue reports.

## 🔄 Revenue Tracker Service

Located: `app/finance/revenue_tracker.py`

### Usage

```python
from app.finance import revenue_tracker

# Process monthly report (aggregates revenue + submits to blockchain)
success = await revenue_tracker.process_monthly_report(year=2025, month=10)

# Automatic submission for last month (called by scheduler)
success = await revenue_tracker.auto_submit_last_month()
```

### Revenue Streams

1. **Wellness Fees**: CBT module completions, daily check-ins, coaching sessions
2. **Subscriptions**: Premium memberships, advanced AI features
3. **NFT Sales**: UGMJournalBadges, quest completion NFTs
4. **Partner Fees**: Clinical partners, merchant partnerships (Grab, GoFood)
5. **Treasury Returns**: Halal treasury investments, DeFi yield farming

### Workflow

```
1. Aggregate revenue from database queries
   ↓
2. Calculate total expenses
   ↓
3. Submit report to PlatformRevenueOracle smart contract
   ↓
4. Save to database for audit trail
```

## ⏰ Revenue Scheduler

Located: `app/finance/revenue_scheduler.py`

### Configuration

**Environment Variables:**
- `ENABLE_REVENUE_SCHEDULER`: Enable/disable scheduler (default: `true`)
- `REVENUE_SCHEDULER_TEST_MODE`: Enable test mode (runs every minute, default: `false`)

### Schedule

- **Production**: 1st of every month at 1:00 AM UTC
- **Test Mode**: Every minute (for debugging)

### Integration

In `main.py`:

```python
from app.finance.revenue_scheduler import revenue_scheduler_lifespan

app = FastAPI(lifespan=revenue_scheduler_lifespan)
```

### Manual Trigger

```python
from app.finance.revenue_scheduler import trigger_now

# Manually trigger revenue report job
await trigger_now()

# Get scheduler status
status = get_scheduler_status()
```

## 🔗 Blockchain Integration

The finance module integrates with the **blockchain/** module for smart contract interactions:

```python
from app.blockchain import OracleClient

oracle_client = OracleClient()
result = await oracle_client.submit_monthly_report(...)
```

## ⚠️ Production TODOs

### High Priority

1. **Replace Placeholder Calculations**
   - `calculate_wellness_fees()`: Currently returns `$5000` placeholder
   - `calculate_treasury_returns()`: Currently returns `$2000` placeholder
   - `calculate_monthly_expenses()`: Currently returns `$3000` placeholder
   - **Action**: Implement actual database queries

2. **Implement Exchange Rate API**
   - `to_wei_tuple()`: Currently assumes 1 USDC = 1 CARE
   - **Action**: Integrate Chainlink or DEX for real-time USDC/CARE rate

3. **Add Retry Logic**
   - Blockchain submission failures should retry with exponential backoff
   - **Action**: Implement in `submit_monthly_report()`

4. **Load Full Contract ABIs**
   - Currently using simplified ABIs
   - **Action**: Load from compiled artifacts in `blockchain/artifacts/`

### Medium Priority

5. **Implement Revenue Analytics API**
   - Historical reports query
   - Monthly comparisons
   - Revenue stream trends
   - **Action**: Create `app/routes/finance.py` endpoints

6. **Add Transaction Validation**
   - Verify revenue amounts before submission
   - Cross-check with external systems
   - **Action**: Add validation layer

## 🛣️ API Routes

Create `app/routes/finance.py` for finance endpoints:

```python
GET    /api/v1/finance/reports              # List all revenue reports
GET    /api/v1/finance/reports/{id}         # Get specific report
POST   /api/v1/finance/reports              # Create draft report
PUT    /api/v1/finance/reports/{id}         # Update report
POST   /api/v1/finance/reports/{id}/submit  # Submit to blockchain
GET    /api/v1/finance/analytics            # Revenue analytics
```

## 🔐 Security Considerations

1. **Environment Variables Required:**
   - `PLATFORM_REVENUE_ORACLE_ADDRESS`: Oracle contract address
   - `FINANCE_TEAM_PRIVATE_KEY`: Private key for blockchain submission (must have FINANCE_TEAM_ROLE)

2. **Access Control:**
   - Only finance team can submit reports
   - Multi-sig approval required for finalization
   - Admin-only access to financial data

3. **Audit Trail:**
   - All reports stored in database
   - Blockchain transactions immutable
   - Approval history tracked

## 📊 Monitoring

### Logs

```python
logger.info("💰 Wellness fees (2025-10): $5000.00")
logger.info("✅ Report submitted successfully!")
logger.info("   Transaction: 0xabc123...")
```

### Scheduler Status

```python
status = get_scheduler_status()
# Returns: {"status": "running", "running": True, "jobs": [...]}
```

## 🧪 Testing

### Unit Tests

Create `backend/tests/finance/` with:
- `test_revenue_tracker.py`: Test revenue calculations
- `test_models.py`: Test database models
- `test_scheduler.py`: Test scheduler logic

### Integration Tests

- Test blockchain submission with testnet
- Test scheduler triggers
- Test database persistence

## 🔄 Migration from Old Structure

**Old Location → New Location:**

- `app/services/revenue_tracker.py` → `app/finance/revenue_tracker.py` ✅
- `app/services/revenue_scheduler.py` → `app/finance/revenue_scheduler.py` ✅
- `app/models/revenue_report.py` → `app/finance/models.py` (consolidated) ✅

**Update Imports:**

```python
# Old (deprecated)
from app.services.revenue_tracker import revenue_tracker
from app.models.revenue_report import RevenueReport

# New
from app.finance import revenue_tracker
from app.finance.models import RevenueReport
```

## 📚 Related Documentation

- **Blockchain Module**: `backend/app/blockchain/README.md`
- **Smart Contracts**: `blockchain/README.md`
- **Sharia Compliance**: `docs/sharia-compliance.md`
- **API Reference**: Auto-generated at `/docs`

---

**Last Updated**: October 28, 2025
**Module Version**: 1.0.0
**Status**: ✅ Production Ready (pending TODO fixes)
