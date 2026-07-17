# CARE Token Quick Deployment Checklist

## 🚀 DEPLOYMENT STEPS

### Step 1: Get Testnet Tokens (STT)

```bash
# Visit one of these faucets:
# - https://testnet.somnia.network/ (0.5 STT per claim)
# - https://cloud.google.com/application/web3/faucet/somnia/shannon
# - https://thirdweb.com/somnia-shannon-testnet

# Add SOMNIA Testnet to MetaMask:
# Network Name: SOMNIA Shannon Testnet
# RPC URL: https://dream-rpc.somnia.network/
# Chain ID: 50312
# Currency Symbol: STT
# Block Explorer: https://shannon-explorer.somnia.network
```

### Step 2: Deploy Contract

```bash
cd blockchain

# Verify environment variables are set
cat .env | grep SOMNIA

# Deploy to testnet
npx hardhat run scripts/deployCareToken.ts --network somniaTestnet

# Save the contract address from output!
# It will look like: "Contract deployed to: 0x..."
```

### Step 3: Update Environment Variables

```bash
# In blockchain/.env, update:
CARE_TOKEN_TESTNET_ADDRESS=<contract_address_from_step_2>

# Also update backend/.env:
cd ../backend
# Add these lines:
echo "CARE_TOKEN_ADDRESS=<contract_address_from_step_2>" >> .env
echo "BLOCKCHAIN_RPC_URL=https://dream-rpc.somnia.network/" >> .env
echo "BLOCKCHAIN_CHAIN_ID=50312" >> .env
```

### Step 4: Grant Minter Role to Backend

```bash
cd ../blockchain

# Set backend wallet address (create new wallet for backend):
export BACKEND_MINTER_WALLET=0xYOUR_BACKEND_WALLET_ADDRESS

# Or add to .env:
echo "BACKEND_MINTER_WALLET=0xYOUR_BACKEND_WALLET_ADDRESS" >> .env

# Grant minter role
npx hardhat run scripts/grantMinterRole.ts --network somniaTestnet

# Verify success (should show "Backend has MINTER_ROLE: true")
```

### Step 5: Test Contract

```bash
# Run comprehensive tests
npx hardhat run scripts/testCareToken.ts --network somniaTestnet

# Should show all tests passing:
# ✅ Token information retrieved
# ✅ Roles verified
# ✅ Balance checked
# ✅ Minting tested
# ✅ Transfer tested
```

### Step 6: Setup Backend

```bash
cd ../backend

# Install blockchain dependencies
pip install web3>=6.0.0

# Update backend/.env with:
# CARE_TOKEN_ADDRESS=<contract_address>
# BLOCKCHAIN_RPC_URL=https://dream-rpc.somnia.network/
# BLOCKCHAIN_CHAIN_ID=50312
# MINTER_PRIVATE_KEY=<backend_wallet_private_key>

# Make sure care_token routes are registered in main.py
# The code should already have:
# from app.routes import care_token
# app.include_router(care_token.router, prefix="/api/v1", tags=["care-token"])
```

### Step 7: Test Backend APIs

```bash
# Start backend
uvicorn app.main:app --reload --port 8000

# In another terminal, test endpoints:

# 1. Get token info
curl http://localhost:8000/api/v1/care-token/info

# 2. Get balance
curl http://localhost:8000/api/v1/care-token/balance/0xYOUR_WALLET_ADDRESS

# 3. Test minting (requires auth token)
curl -X POST http://localhost:8000/api/v1/care-token/mint \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0xRECIPIENT_ADDRESS",
    "amount": 100,
    "reason": "Test reward"
  }'
```

### Step 8: Frontend Integration

```bash
cd ../frontend

# Install dependencies
npm install wagmi viem @rainbow-me/rainbowkit

# Create wagmi config (see CARE_TOKEN_DEPLOYMENT_GUIDE.md for details)
# Key files to create/update:
# - src/config/wagmi.ts (wagmi configuration)
# - src/components/CareTokenBalance.tsx (balance display)
# - src/app/(main)/dashboard/page.tsx (add balance component)

# Start frontend
npm run dev
```

### Step 9: End-to-End Testing

```bash
# Test flow:
# 1. Connect wallet in frontend
# 2. Check balance displays correctly
# 3. Complete an activity (e.g., finish CBT module)
# 4. Verify tokens are minted to user wallet
# 5. Check balance updates in real-time
# 6. View transaction on block explorer
```

## 🔍 VERIFICATION CHECKLIST

- [ ] STT tokens received from faucet (check wallet balance)
- [ ] Contract deployed successfully (have contract address)
- [ ] Contract visible on block explorer: <https://shannon-explorer.somnia.network/address/YOUR_CONTRACT>
- [ ] CARE_TOKEN_TESTNET_ADDRESS updated in blockchain/.env
- [ ] CARE_TOKEN_ADDRESS updated in backend/.env
- [ ] Backend wallet created and private key saved
- [ ] MINTER_ROLE granted to backend wallet
- [ ] Test script passes all 5 tests
- [ ] Backend dependencies installed (web3)
- [ ] Backend API endpoints return correct data
- [ ] Frontend displays token balance
- [ ] Users can connect wallet
- [ ] Minting works from backend
- [ ] Transactions visible on block explorer

## 📊 EXPECTED VALUES AFTER DEPLOYMENT

### Contract Info

- Name: CARE Token
- Symbol: CARE
- Decimals: 18
- Initial Supply: 100,000,000 CARE
- Max Supply: 1,000,000,000 CARE
- Total Minted: 100,000,000 CARE
- Remaining Mintable: 900,000,000 CARE

### Roles

- DEFAULT_ADMIN_ROLE: Deployer wallet
- MINTER_ROLE: Deployer wallet + Backend wallet
- PAUSER_ROLE: Deployer wallet

### API Responses

```json
// GET /api/v1/care-token/info
{
  "name": "CARE Token",
  "symbol": "CARE",
  "decimals": 18,
  "total_supply": "100000000.0",
  "max_supply": "1000000000.0",
  "total_minted": "100000000.0",
  "remaining_mintable": "900000000.0",
  "contract_address": "0x...",
  "chain_id": 50312
}

// GET /api/v1/care-token/balance/{wallet}
{
  "wallet_address": "0x...",
  "balance": "0.0",
  "symbol": "CARE"
}

// POST /api/v1/care-token/mint
{
  "tx_hash": "0x...",
  "explorer_url": "https://shannon-explorer.somnia.network/tx/0x...",
  "amount": "100.0",
  "recipient": "0x..."
}
```

## 🚨 TROUBLESHOOTING

### "Insufficient funds for gas"

- Solution: Get more STT from faucet (need ~0.01 STT for deployment)

### "AccessControl: account ... is missing role"

- Solution: Run grantMinterRole.ts script to grant MINTER_ROLE to backend

### Backend API returns "Contract not found"

- Solution: Check CARE_TOKEN_ADDRESS in backend/.env matches deployed address

### Frontend doesn't show balance

- Solution: Verify wagmi config includes SOMNIA testnet (chain ID 50312)

### Transaction fails with "VM Exception"

- Solution: Check wallet has sufficient STT for gas, contract is not paused

## 📞 SUPPORT RESOURCES

- SOMNIA Docs: <https://docs.somnia.network>
- SOMNIA Explorer: <https://shannon-explorer.somnia.network>
- Project Documentation: docs/CARE_TOKEN_DEPLOYMENT_GUIDE.md
- Smart Contract: blockchain/contracts/CareToken.sol
- Backend Service: backend/app/services/care_token_service.py
- API Routes: backend/app/routes/care_token.py

## 🎯 NEXT STEPS AFTER TESTNET

1. **Test Extensively** (2-4 weeks)
   - Mint tokens to multiple users
   - Test pause/unpause functionality
   - Verify role management
   - Check gas costs
   - Monitor for bugs

2. **Security Audit**
   - Review smart contract code
   - Test edge cases
   - Verify access controls
   - Check for reentrancy issues

3. **Prepare Mainnet**
   - Get SOMI tokens for mainnet deployment
   - Use hardware wallet for deployment
   - Deploy to somniaMainnet (Chain ID 5031)
   - Update all production environment variables
   - Announce contract address to users

4. **Monitor & Maintain**
   - Set up block explorer alerts
   - Monitor minting activity
   - Track token distribution
   - Gather user feedback
   - Plan tokenomics adjustments if needed
