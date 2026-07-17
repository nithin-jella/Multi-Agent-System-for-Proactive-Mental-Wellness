# $CARE Token - UGM-AICare Utility Token on SOMNIA Blockchain

## Overview

**$CARE** is the utility token powering the UGM-AICare ecosystem, deployed on the high-performance SOMNIA blockchain. It enables real-world transactions, rewards, and engagement within the mental health platform for Indonesian university students.

## 🌟 Key Features

### Token Specifications

- **Name**: CARE Token
- **Symbol**: CARE
- **Blockchain**: SOMNIA Layer 1
- **Standard**: ERC-20
- **Decimals**: 18
- **Max Supply**: 1,000,000,000 CARE (1 billion)
- **Initial Supply**: 100,000,000 CARE (100 million)

### Smart Contract Features

1. **Burnable**: Users can burn tokens to reduce supply
2. **Pausable**: Emergency pause mechanism for security
3. **Access Control**: Role-based permissions (ADMIN, MINTER, PAUSER)
4. **Permit (EIP-2612)**: Gasless approvals for better UX
5. **Capped Supply**: Hard cap prevents inflation
6. **Transparent Minting**: All mints logged with reasons

## 🎯 Use Cases

### Real-World Utility

1. **Voucher Purchases**: Buy food, transportation, and retail vouchers
2. **Event Tickets**: Purchase tickets for mental health events, workshops, seminars
3. **Premium Features**: Unlock advanced AI coaching, personalized therapy plans
4. **Merchandise**: Official UGM-AICare merchandise and mental health resources
5. **Service Access**: Priority access to counseling sessions, support groups

### Platform Engagement

1. **Daily Check-ins**: Earn CARE for completing mental health assessments
2. **Module Completion**: Rewards for finishing CBT modules
3. **Community Participation**: Tokens for helping peers, sharing stories
4. **Achievements**: NFT badges can be exchanged for CARE
5. **Referrals**: Bonus tokens for inviting friends to the platform

### Future Expansion

1. **Staking**: Lock CARE for premium benefits and governance
2. **Governance**: Vote on platform features and community initiatives
3. **Partnerships**: Integration with local businesses and mental health services
4. **Scholarships**: CARE-funded mental health research and education

## 🏗️ Architecture

### Why SOMNIA?

SOMNIA is an EVM-compatible Layer 1 blockchain designed for mass-consumer applications:

- **High Performance**: 1M+ TPS (Transactions Per Second)
- **Low Fees**: Minimal transaction costs for micropayments
- **EVM Compatible**: Seamless integration with existing tools
- **MultiStream Consensus**: Novel consensus for high throughput
- **Optimized for Real-Time Apps**: Perfect for social and gaming applications

### Network Details

#### SOMNIA Mainnet

- **Chain ID**: 5031
- **RPC URL**: `https://api.infra.mainnet.somnia.network/`
- **Native Token**: SOMI
- **Explorer**: <https://explorer.somnia.network>
- **Status**: Production (use for real transactions)

#### SOMNIA Testnet (Shannon)

- **Chain ID**: 50312
- **RPC URL**: `https://dream-rpc.somnia.network/`
- **Native Token**: STT (Testnet Token)
- **Explorer**: <https://shannon-explorer.somnia.network>
- **Faucet**: <https://stakely.io/faucet/somnia-testnet-stt>
- **Status**: Testing only

## 🚀 Deployment

### Prerequisites

```bash
cd blockchain
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Configure your environment variables:

```env
# For testnet deployment
SOMNIA_TESTNET_RPC_URL=https://dream-rpc.somnia.network/
TESTNET_PRIVATE_KEY=your_private_key_without_0x

# For mainnet deployment (use with caution!)
SOMNIA_MAINNET_RPC_URL=https://api.infra.mainnet.somnia.network/
MAINNET_PRIVATE_KEY=your_mainnet_private_key_without_0x
```

### Get Testnet Tokens

1. Set up MetaMask with SOMNIA Testnet
2. Get test tokens from faucet:
   - Google Cloud Faucet: <https://cloud.google.com/application/web3/faucet/somnia/shannon>
   - Stakely Faucet: <https://stakely.io/faucet/somnia-testnet-stt>

### Deploy to Testnet

```bash
npx hardhat run scripts/deployCareToken.ts --network somniaTestnet
```

### Deploy to Mainnet

⚠️ **WARNING**: Mainnet deployment uses real funds. Test thoroughly on testnet first!

```bash
npx hardhat run scripts/deployCareToken.ts --network somniaMainnet
```

### Verify Contract (Optional)

SOMNIA verification may require custom setup. Check the official docs:
<https://docs.somnia.network/developer/how-to-guides>

## 🔐 Security & Access Control

### Roles

1. **DEFAULT_ADMIN_ROLE**
   - Manages all other roles
   - Can grant/revoke MINTER_ROLE and PAUSER_ROLE
   - Initially granted to deployer

2. **MINTER_ROLE**
   - Can mint new CARE tokens
   - Subject to max supply cap
   - Should be granted to backend reward system

3. **PAUSER_ROLE**
   - Can pause/unpause token transfers
   - Emergency use only
   - Should be monitored closely

### Best Practices

1. **Separate Wallets**: Use different wallets for admin, minting, and pausing
2. **Hardware Wallets**: Use hardware wallets for mainnet admin keys
3. **Monitor Events**: Set up alerts for minting, pausing, and large transfers
4. **Regular Audits**: Review role assignments and token distribution
5. **Test Everything**: Always test on testnet before mainnet operations

## 💻 Integration

### Backend Integration (FastAPI)

#### Install Dependencies

```bash
pip install web3 python-dotenv
```

#### Configuration

Add to `backend/.env`:

```env
CARE_TOKEN_ADDRESS=0x...deployed_contract_address
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network/
CARE_MINTER_PRIVATE_KEY=your_minter_wallet_private_key
```

#### Example: Reward Users

```python
# backend/app/services/care_token_service.py
from web3 import Web3
from eth_account import Account
import os
from decimal import Decimal

class CareTokenService:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(os.getenv("SOMNIA_RPC_URL")))
        self.contract_address = os.getenv("CARE_TOKEN_ADDRESS")
        self.minter_account = Account.from_key(os.getenv("CARE_MINTER_PRIVATE_KEY"))
        
        # Load contract ABI (generated from compiled contract)
        with open("contracts/CareToken.json") as f:
            contract_json = json.load(f)
            self.contract_abi = contract_json["abi"]
        
        self.contract = self.w3.eth.contract(
            address=self.contract_address,
            abi=self.contract_abi
        )
    
    async def mint_reward(self, user_wallet: str, amount: int, reason: str):
        """
        Mint CARE tokens to a user wallet
        
        Args:
            user_wallet: User's wallet address
            amount: Amount of CARE tokens (will be converted to wei)
            reason: Reason for minting (logged on-chain)
        """
        # Convert tokens to wei (18 decimals)
        amount_wei = amount * 10**18
        
        # Build transaction
        transaction = self.contract.functions.mint(
            user_wallet,
            amount_wei,
            reason
        ).build_transaction({
            'from': self.minter_account.address,
            'nonce': self.w3.eth.get_transaction_count(self.minter_account.address),
            'gas': 200000,
            'gasPrice': self.w3.eth.gas_price
        })
        
        # Sign and send transaction
        signed_txn = self.w3.eth.account.sign_transaction(
            transaction, 
            self.minter_account.key
        )
        tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
        
        # Wait for confirmation
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        return {
            "success": True,
            "tx_hash": tx_hash.hex(),
            "amount": amount,
            "recipient": user_wallet,
            "reason": reason
        }
    
    async def get_balance(self, wallet_address: str) -> Decimal:
        """Get CARE token balance for a wallet"""
        balance_wei = self.contract.functions.balanceOf(wallet_address).call()
        return Decimal(balance_wei) / Decimal(10**18)
```

#### Usage in Reward System

```python
# backend/app/services/reward_service.py
from app.services.care_token_service import CareTokenService

care_token = CareTokenService()

async def reward_daily_checkin(user_id: int, user_wallet: str):
    """Reward user for daily check-in"""
    amount = 10  # 10 CARE tokens
    reason = f"Daily check-in reward for user {user_id}"
    
    result = await care_token.mint_reward(user_wallet, amount, reason)
    
    # Log to database
    await log_reward_transaction(
        user_id=user_id,
        amount=amount,
        reason=reason,
        tx_hash=result["tx_hash"]
    )
    
    return result
```

### Frontend Integration (Next.js + ethers.js)

#### Install Dependencies

```bash
cd frontend
npm install ethers wagmi viem @rainbow-me/rainbowkit
```

#### Configure SOMNIA Network

```typescript
// frontend/src/config/chains.ts
import { defineChain } from 'viem'

export const somniaMainnet = defineChain({
  id: 5031,
  name: 'SOMNIA Mainnet',
  nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.infra.mainnet.somnia.network/'] },
    public: { http: ['https://somnia-json-rpc.stakely.io'] },
  },
  blockExplorers: {
    default: { name: 'SOMNIA Explorer', url: 'https://explorer.somnia.network' },
  },
})

export const somniaTestnet = defineChain({
  id: 50312,
  name: 'SOMNIA Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network/'] },
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
})
```

#### Display CARE Balance

```typescript
// frontend/src/components/CareTokenBalance.tsx
'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'

const CARE_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CARE_TOKEN_ADDRESS as `0x${string}`

const CARE_TOKEN_ABI = [
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const

export function CareTokenBalance() {
  const { address } = useAccount()
  
  const { data: balance, isLoading } = useReadContract({
    address: CARE_TOKEN_ADDRESS,
    abi: CARE_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  if (isLoading) return <div>Loading balance...</div>
  if (!address) return <div>Connect wallet to see balance</div>

  return (
    <div className="care-balance">
      <span className="label">CARE Balance:</span>
      <span className="amount">{formatEther(balance || 0n)}</span>
    </div>
  )
}
```

## 📊 Token Economics

### Distribution Plan

| Allocation | Percentage | Amount | Purpose |
|------------|-----------|--------|---------|
| Initial Supply | 10% | 100M CARE | Platform operations, liquidity |
| User Rewards | 40% | 400M CARE | Daily check-ins, achievements, engagement |
| Partnerships | 15% | 150M CARE | Merchant partnerships, voucher inventory |
| Team & Advisors | 15% | 150M CARE | Core team, advisors (vested) |
| Community Treasury | 10% | 100M CARE | Community-driven initiatives |
| Reserve | 10% | 100M CARE | Emergency fund, future development |

### Reward Schedule (Example)

| Activity | CARE Reward | Frequency |
|----------|------------|-----------|
| Daily Check-in | 10 CARE | Daily |
| Complete CBT Module | 50 CARE | Per module |
| Weekly Streak (7 days) | 100 CARE | Weekly |
| Monthly Streak (30 days) | 500 CARE | Monthly |
| Refer a Friend | 200 CARE | Per referral |
| Share Story | 30 CARE | Per story |
| Help Peer (upvoted) | 20 CARE | Per upvote |

### Merchant Voucher Prices (Example)

| Voucher Type | CARE Price | Real Value (IDR) |
|--------------|-----------|------------------|
| Gojek Ride | 100 CARE | 20,000 IDR |
| Grab Food | 200 CARE | 50,000 IDR |
| Indomaret | 500 CARE | 100,000 IDR |
| Movie Ticket | 800 CARE | 50,000 IDR |
| Book Store | 1,000 CARE | 150,000 IDR |

## 🛠️ Useful Commands

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Deploy to Testnet

```bash
npx hardhat run scripts/deployCareToken.ts --network somniaTestnet
```

### Check Balance

```bash
npx hardhat console --network somniaTestnet
```

Then in console:

```javascript
const CareToken = await ethers.getContractFactory("CareToken")
const token = await CareToken.attach("YOUR_CONTRACT_ADDRESS")
const balance = await token.balanceOf("WALLET_ADDRESS")
console.log(ethers.formatEther(balance))
```

## 📚 Resources

### Official Documentation

- SOMNIA Docs: <https://docs.somnia.network/>
- SOMNIA Developer Discord: <https://discord.gg/Somnia>
- OpenZeppelin Contracts: <https://docs.openzeppelin.com/contracts/>

### Explorers

- SOMNIA Mainnet: <https://explorer.somnia.network>
- SOMNIA Testnet: <https://shannon-explorer.somnia.network>

### Faucets

- Google Cloud Faucet: <https://cloud.google.com/application/web3/faucet/somnia/shannon>
- Stakely Faucet: <https://stakely.io/faucet/somnia-testnet-stt>

## 🤝 Support

For questions or issues:

1. Check the documentation
2. Join the UGM-AICare Discord
3. Open an issue on GitHub
4. Contact the development team

## ⚠️ Disclaimer

$CARE is a utility token designed for use within the UGM-AICare platform. It is not intended as an investment or security. Always follow local regulations regarding digital tokens.

---

Built with ❤️ by the UGM-AICare Team on SOMNIA Blockchain
