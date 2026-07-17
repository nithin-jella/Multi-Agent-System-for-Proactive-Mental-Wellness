# Blockchain Module Documentation

## Overview

The **blockchain/** module consolidates all smart contract interactions for the UGM-AICare platform across **multiple blockchains**, providing a clean separation of concerns from business logic.

## 🌐 Multi-Chain Architecture

UGM-AICare integrates with **two blockchains**:

### 1. SOMNIA Mainnet (Chain ID: 5031)

**Purpose**: Platform tokenomics and finance infrastructure

**Contracts**:

- **CareToken** (ERC20) - Platform utility token with role-based minting
- **PlatformRevenueOracle** - Monthly revenue reporting with multi-sig approval
- **CareStakingHalal** - Mudarabah-compliant profit-sharing staking system

**Use Cases**:

- Mint CARE tokens for rewards, staking, team allocations
- Submit monthly revenue reports to blockchain
- Track staking pools, TVL, and profit distributions

### 2. EDU Chain Testnet

**Purpose**: Achievement NFT badges for student accomplishments

**Contracts**:

- **UGMJournalBadges** (ERC1155) - Multi-token NFT for various achievement types

**Use Cases**:

- Mint NFT badges when students complete quests, journals, or milestones
- Track user badge collections on-chain

## 📁 Module Structure

```plaintext
backend/app/domains/blockchain/
├── __init__.py                  # Multi-chain exports
├── base_web3.py                 # Shared Web3 utilities
├── care_token_client.py         # CARE token operations (SOMNIA)
├── oracle_client.py             # Revenue oracle (SOMNIA)
├── staking_client.py            # Staking contract (SOMNIA)
├── routes.py                    # FastAPI blockchain endpoints
├── README.md                    # This file
│
├── edu_chain/                   # EDU Chain NFT contracts
│   ├── __init__.py
│   ├── nft_client.py           # NFT badge minting
│   └── abi/
│       └── UGMJournalBadges.json
│
└── models/                      # Blockchain domain models (future)
```

## 🎯 Purpose

This module handles:

- **CARE Token Operations**: Minting, transfers, balance queries (SOMNIA)
- **Revenue Oracle**: Submit monthly revenue reports to blockchain (SOMNIA)
- **Staking Contract**: Query TVL, staker positions, profit distributions (SOMNIA)
- **NFT Badges**: Mint achievement NFTs for user milestones (EDU Chain)
- **Web3 Utilities**: Connection management, transaction signing, gas estimation
- **API Routes**: REST endpoints for blockchain operations

## 🔧 Base Web3 Client

Located: `app/domains/blockchain/base_web3.py`

All blockchain clients extend `BaseWeb3Client` for shared functionality:

### Features

- Web3 connection management (SOMNIA network)
- POA middleware injection
- Transaction signing and submission
- Gas estimation with 20% safety buffer
- Retry logic with exponential backoff
- Address checksum conversion
- Wei ↔ Ether conversions

### Usage

```python
from app.domains.blockchain.base_web3 import BaseWeb3Client

client = BaseWeb3Client()

# Get balance
balance = client.get_balance("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9")

# Convert units
wei = client.to_wei(1.5, 'ether')
ether = client.from_wei(1500000000000000000)
```

## 🪙 CARE Token Client

Located: `app/domains/blockchain/care_token_client.py`

### Features

- Mint tokens via CareTokenController (14 categories)
- Check token balances
- Query token information (name, symbol, supply, etc.)
- Transfer tokens

### Usage

```python
from app.domains.blockchain import CareTokenClient

token_client = CareTokenClient()

# Get balance
balance = await token_client.get_balance("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9")
print(f"Balance: {balance} CARE")

# Mint tokens for community staking (category 1)
result = await token_client.mint_for_category(
    category=1,
    to="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9",
    amount=1000 * (10 ** 18),  # 1000 CARE in wei
    reason="Monthly staking rewards"
)

# Get token info
info = await token_client.get_token_info()
```

### Mint Categories

Per `CareTokenController.sol`:

0. **Platform Operations**: Operational expenses
1. **Community Staking**: Staking pool allocations
2. **Rewards**: User rewards (quest completion, milestones)
3. **Team**: Team allocations (vested)
4. **Advisors**: Advisor allocations (vested)
5. **Marketing**: Marketing campaigns, airdrops
6. **Partnerships**: Strategic partnerships
7. **Development**: Core development team
8. **Treasury**: Protocol treasury
9. **Research**: Research grants, academic partnerships
10. **Charity**: Charitable initiatives
11. **Emergency**: Emergency reserves
12. **Liquidity**: DEX liquidity provision
13. **Governance**: Governance incentives

Each category requires specific role permissions (e.g., `COMMUNITY_MINTER_ROLE` for staking).

## 📊 Platform Revenue Oracle Client

Located: `app/domains/blockchain/oracle_client.py`

### Features

- Submit monthly revenue reports
- Query historical reports
- Approve reports (multi-sig workflow)

### Usage

```python
from app.domains.blockchain import OracleClient

oracle_client = OracleClient()

# Submit monthly report
result = await oracle_client.submit_monthly_report(
    month_yyyymm=202510,
    total_revenue_wei=14000 * (10 ** 18),
    total_expenses_wei=3000 * (10 ** 18),
    breakdown_tuple=(5000, 3000, 1500, 2500, 2000)  # In wei
)

# Query historical report
report = await oracle_client.get_report(month_yyyymm=202510)

# Approve report (multi-sig)
result = await oracle_client.approve_report(month_yyyymm=202510)
```

## 🥩 Staking Client

Located: `app/domains/blockchain/staking_client.py`

### Features

- Query Total Value Locked (TVL)
- Get staker position details
- Query tier distribution (planned)

### Usage

```python
from app.domains.blockchain import StakingClient

staking_client = StakingClient()

# Get TVL
tvl = await staking_client.get_tvl()
print(f"TVL: {tvl['tvl_formatted']}")

# Get staker position
position = await staking_client.get_staker_position("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9")
print(f"Tier: {position['tier_name']}")
print(f"Staked: {position['staked_amount_care']} CARE")
print(f"Profit Share: {position['profit_share_percent']}%")
```

---

## 🎨 EDU Chain NFT Badge Client

Located: `app/domains/blockchain/edu_chain/nft_client.py`

### Overview

The NFT badge system rewards students for completing mental health milestones on EDU Chain Testnet (L3 on Arbitrum Orbit).

### Features

- Mint ERC1155 achievement badges
- Lazy initialization (connects only when needed)
- Automatic gas estimation with fallback
- Transaction tracking and logging

### Usage

```python
from app.domains.blockchain import init_nft_client, mint_nft_badge

# Initialize connection (call once at app startup)
await init_nft_client()

# Mint a badge for quest completion
tx_hash = mint_nft_badge(
    recipient_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9",
    badge_id=1,  # Quest completion badge
    amount=1
)

if tx_hash:
    print(f"✅ NFT minted! Transaction: {tx_hash}")
else:
    print("❌ Minting failed")
```

### Badge Types (Token IDs)

- **1**: Quest Completion Badge
- **2**: Journal Streak Badge (7 days)
- **3**: CBT Module Completion Badge
- **4**: Mental Health Champion Badge
- **5**: Community Helper Badge
- (More badge types defined in smart contract)

### Environment Variables

```env
EDU_TESTNET_RPC_URL=https://rpc.open-campus-codex.gelato.digital
NFT_CONTRACT_ADDRESS=0x...  # UGMJournalBadges contract
BACKEND_MINTER_PRIVATE_KEY=0x...  # Backend wallet private key
```

---

### Staking Tiers

Per `CareStakingHalal.sol`:

- **Bronze**: 25,000-99,999 CARE (25% profit share)
- **Silver**: 100,000-499,999 CARE (30% profit share)
- **Gold**: 500,000-999,999 CARE (35% profit share)
- **Platinum**: 1,000,000+ CARE (40% profit share)

## 🔐 Environment Variables

### Required

```bash
# SOMNIA Network
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network/

# Contract Addresses
CARE_TOKEN_ADDRESS=0x...
CARE_TOKEN_CONTROLLER_ADDRESS=0x...
PLATFORM_REVENUE_ORACLE_ADDRESS=0x...
CARE_STAKING_HALAL_ADDRESS=0x...

# Private Keys (keep secure!)
CARE_MINTER_PRIVATE_KEY=0x...
FINANCE_TEAM_PRIVATE_KEY=0x...
```

### Network Info

- **Chain ID**: 5031 (SOMNIA Mainnet)
- **Native Token**: STT (SOMNIA Test Token)
- **Block Time**: ~2 seconds
- **Consensus**: Proof of Authority (POA)

## 🛠️ Transaction Handling

### Gas Management

```python
# Automatic gas estimation with 20% buffer
gas = await client.estimate_gas(transaction)

# Manual gas settings
transaction['gas'] = 500000
transaction['gasPrice'] = await client.get_gas_price()
```

### Retry Logic

All transactions automatically retry up to 3 times with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: Wait 2 seconds
- Attempt 3: Wait 4 seconds

### Error Handling

```python
try:
    result = await client.send_transaction(...)
    if result:
        print(f"Success! Tx: {result['tx_hash']}")
    else:
        print("Transaction failed")
except Exception as e:
    logger.error(f"Error: {e}")
```

## 📝 Contract ABIs

### Loading ABIs

ABIs are loaded from compiled Hardhat artifacts:

```plaintext
blockchain/artifacts/contracts/
├── CareToken.sol/CareToken.json
├── CareTokenController.sol/CareTokenController.json
├── PlatformRevenueOracle.sol/PlatformRevenueOracle.json
└── CareStakingHalal.sol/CareStakingHalal.json
```

If artifacts aren't available, clients fall back to minimal ABIs for basic operations.

### Updating ABIs

After contract changes:

```bash
cd blockchain/
npx hardhat compile
# ABIs automatically updated in artifacts/
```

## 🧪 Testing

### Unit Tests

Create `backend/tests/blockchain/` with:

- `test_base_web3.py`: Test Web3 connection and utilities
- `test_care_token_client.py`: Test token operations
- `test_oracle_client.py`: Test revenue oracle
- `test_staking_client.py`: Test staking queries

### Integration Tests

- Test against SOMNIA testnet
- Mock Web3 responses for unit tests
- Verify transaction receipts

## ⚠️ Production Considerations

1. **Private Key Security**
   - Use hardware wallets or secure key management systems
   - Never commit private keys to version control
   - Rotate keys periodically

2. **Gas Price Monitoring**
   - Implement dynamic gas price strategies
   - Set maximum gas price limits
   - Monitor for gas price spikes

3. **Transaction Monitoring**
   - Log all transactions to database
   - Implement transaction status tracking
   - Set up alerts for failed transactions

4. **Rate Limiting**
   - Implement rate limits for RPC calls
   - Use backup RPC URLs for failover
   - Cache blockchain data when possible

## 🔗 Integration with Finance Module

The finance module uses blockchain clients for revenue reporting:

```python
# In app/finance/revenue_tracker.py
from app.domains.blockchain import OracleClient

oracle_client = OracleClient()
result = await oracle_client.submit_monthly_report(...)
```

## 📚 Related Documentation

- **Finance Module**: `backend/app/finance/README.md`
- **Smart Contracts**: `blockchain/README.md`
- **Deployment Scripts**: `blockchain/scripts/`
- **API Reference**: Auto-generated at `/docs`

---

**Last Updated**: October 28, 2025  
**Module Version**: 1.0.0  
**Status**: ✅ Production Ready
