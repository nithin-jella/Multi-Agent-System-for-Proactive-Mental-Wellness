---
id: tokenomics
title: CareToken Tokenomics v2.0
sidebar_position: 2
---

# $CARE Token Tokenomics Model v2.0

## Designed for Long-Term Value Appreciation

> **Goal**: Create sustainable token value growth while maintaining utility for mental health platform users

---

## Current State (v1.0 - Basic Model)

### [Done] What's Already Implemented in Smart Contract

| Feature | Status | Description |
|---------|--------|-------------|
| Max Supply Cap | [Done] Enforced | 1 billion CARE tokens (hard-coded) |
| Controlled Minting | [Done] Enforced | Only MINTER_ROLE can create tokens |
| Burnable | [Done] Enforced | Users can voluntarily burn tokens |
| Initial Supply | [Done] Set | 100M tokens (10% of max) |
| Role-Based Access | [Done] Enforced | Admin, Minter, Pauser roles |
| Pausable | [Done] Enforced | Emergency stop functionality |

### [Missing] Missing Elements for Value Appreciation

- No automatic deflationary pressure
- No staking/locking incentives
- No transaction fee mechanism
- No vesting schedules
- No buyback mechanism
- No holder rewards
- No liquidity mining
- No governance rights

**Result**: Basic utility token with manual burn only. **No automatic value appreciation mechanisms**.

---

## Recommended Model: "Utility + Deflationary Hybrid"

### **Core Philosophy**

- **Utility-First**: Token must be useful (rewards, purchases, access)
- **Deflationary Pressure**: Supply decreases over time
- **Staking Incentives**: Reduce circulating supply
- **User-Friendly**: No complex mechanisms that confuse students
- **Sustainable**: Long-term value growth, not pump-and-dump

---

## Phase 1: Enhanced Deflationary Mechanics

### 1.1 Transaction Burn (Optional - User-Friendly Approach)

**[Missing] NOT Recommended for $CARE**: Standard transaction tax (2-5% burn on every transfer)

- **Why Not**: Confuses users, reduces utility, feels like a "tax"
- Students won't understand why they lose tokens when sending

**[Done] RECOMMENDED Instead**: **Selective Burn on Redemption**

```solidity
// Burn tokens when users redeem for real-world value
function redeemForVoucher(uint256 amount) external {
 uint256 burnAmount = amount * 100 / 100; // 100% burned
 _burn(msg.sender, burnAmount);
 emit TokensRedeemed(msg.sender, amount, "Voucher redemption");
}

function redeemForTicket(uint256 amount) external {
 uint256 burnAmount = amount * 100 / 100; // 100% burned
 _burn(msg.sender, burnAmount);
 emit TokensRedeemed(msg.sender, amount, "Event ticket");
}
```

**Why This Works**:

- Tokens burned when converted to real value (vouchers, tickets, goods)
- No tax on normal transfers/rewards
- Creates deflationary pressure as platform grows
- User-friendly: "Use tokens to get stuff" (simple mental model)

### 1.2 Activity Burn Mechanism

```solidity
// Burn small amounts for premium features
function unlockPremiumFeature(string memory featureId) external {
 uint256 burnAmount = 10 * 10**18; // 10 CARE tokens
 _burn(msg.sender, burnAmount);
 emit FeatureUnlocked(msg.sender, featureId, burnAmount);
}
```

**Use Cases**:

- Unlock premium CBT modules: 10 CARE
- Access advanced analytics: 5 CARE
- Remove ads: 50 CARE/month
- Priority support: 20 CARE
- Custom avatars/themes: 15 CARE

---

## Phase 2: Staking System

### 2.1 Time-Locked Staking

**Purpose**: Reduce circulating supply, reward long-term holders

```solidity
// Staking contract (separate from token contract)
contract CareStaking {
 struct Stake {
 uint256 amount;
 uint256 startTime;
 uint256 lockPeriod; // 30, 90, 180, 365 days
 uint256 rewardRate; // APY %
 }
 
 mapping(address => Stake[]) public stakes;
 
 // Staking tiers with increasing rewards
 uint256 public constant TIER_30D_APY = 5; // 5% APY for 30 days
 uint256 public constant TIER_90D_APY = 12; // 12% APY for 90 days
 uint256 public constant TIER_180D_APY = 20; // 20% APY for 180 days
 uint256 public constant TIER_365D_APY = 35; // 35% APY for 365 days
 
 function stakeTokens(uint256 amount, uint256 lockPeriod) external {
 require(amount >= 100 * 10**18, "Minimum stake: 100 CARE");
 // Transfer tokens to staking contract
 // Lock for specified period
 // Calculate rewards based on tier
 }
}
```

**Staking Tiers**:

| Lock Period | APY | Min. Stake | Benefits |
|-------------|-----|------------|----------|
| 30 days | 5% | 100 CARE | Basic rewards |
| 90 days | 12% | 500 CARE | + Priority support access |
| 180 days | 20% | 1,000 CARE | + All above + NFT badge |
| 365 days | 35% | 5,000 CARE | + All above + Governance voting |

**Economic Impact**:

- If 30% of supply is staked → 300M tokens locked
- Circulating supply drops from 1B → 700M
- Increased scarcity → Higher price pressure

### 2.2 Staking Rewards Source

**Where do staking rewards come from?**

Option A: **Controlled Minting** (Recommended)

```solidity
// Mint new tokens for staking rewards (within max supply cap)
// Reserve 200M tokens (20% of max supply) for staking rewards
uint256 constant STAKING_REWARDS_POOL = 200_000_000 * 10**18;
```

Option B: **Platform Revenue Buyback**

- Use 50% of platform revenue to buy CARE from market
- Distribute as staking rewards
- More sustainable, no inflation

**Recommended**: Start with Option A, transition to Option B as platform grows

---

## Phase 3: Token Distribution & Vesting

### 3.1 Supply Allocation

| Allocation | Amount | % | Vesting | Purpose |
|------------|--------|---|---------|---------|
| **Initial Supply** | 100M | 10% | None | Immediate rewards |
| **User Rewards** | 400M | 40% | Minted on-demand | Activity rewards, airdrops |
| **Staking Rewards** | 200M | 20% | Minted on-demand | Incentivize holding |
| **Team & Advisors** | 100M | 10% | 4-year linear | Align long-term incentives |
| **Marketing & Partnerships** | 80M | 8% | 3-year linear | Growth initiatives |
| **Ecosystem Fund** | 70M | 7% | On-demand | Grants, collaborations |
| **Liquidity Provision** | 50M | 5% | None | DEX liquidity |
| **Total** | **1,000M** | **100%** | - | Max supply |

### 3.2 Vesting Schedule Implementation

```solidity
// Vesting contract for team tokens
contract CareVesting {
 struct VestingSchedule {
 address beneficiary;
 uint256 totalAmount;
 uint256 startTime;
 uint256 duration; // 4 years = 1461 days
 uint256 released;
 }
 
 mapping(address => VestingSchedule) public schedules;
 
 function release(address beneficiary) external {
 VestingSchedule storage schedule = schedules[beneficiary];
 uint256 elapsed = block.timestamp - schedule.startTime;
 uint256 vested = (schedule.totalAmount * elapsed) / schedule.duration;
 uint256 releasable = vested - schedule.released;
 
 require(releasable > 0, "No tokens to release");
 schedule.released += releasable;
 careToken.transfer(beneficiary, releasable);
 }
}
```

**Why Vesting Matters**:

- Prevents team from dumping tokens
- Builds user trust
- Aligns incentives long-term
- Standard practice for successful tokens

---

## Phase 4: Value Appreciation Mechanisms

### 4.1 Buyback & Burn Program

**Source**: 20-30% of platform revenue

```solidity
// Automated buyback contract
contract CareBuyback {
 IUniswapV2Router public router;
 address public careToken;
 
 // Called when platform generates revenue
 function buybackAndBurn() external payable {
 // Swap revenue (STT/SOMI) for CARE tokens
 address[] memory path = new address[](2);
 path[0] = router.WETH(); // STT/SOMI wrapped
 path[1] = careToken;
 
 router.swapExactETHForTokens{value: msg.value}(
 0,
 path,
 address(this),
 block.timestamp
 );
 
 // Burn all purchased CARE tokens
 uint256 balance = IERC20(careToken).balanceOf(address(this));
 CareToken(careToken).burn(balance);
 
 emit BuybackAndBurn(msg.value, balance);
 }
}
```

**Example Calculation**:

- Platform generates $10,000/month revenue
- Allocate 25% = $2,500 for buyback
- Buy CARE tokens from DEX at market price
- Burn all purchased tokens permanently
- **Result**: Constant buying pressure + Permanent supply reduction

### 4.2 Holder Rewards (Reflections)

**Optional**: Redistribute transaction fees to all holders

```solidity
// Reflection mechanism (like SafeMoon)
// 2% fee on transfers:
// - 1% burned
// - 1% redistributed to holders proportionally

function _transfer(address from, address to, uint256 amount) internal override {
 if (from!= owner() && to!= owner()) {
 uint256 burnFee = amount * 1 / 100;
 uint256 reflectionFee = amount * 1 / 100;
 uint256 netAmount = amount - burnFee - reflectionFee;
 
 _burn(from, burnFee);
 _reflect(reflectionFee); // Distribute to all holders
 super._transfer(from, to, netAmount);
 } else {
 super._transfer(from, to, amount);
 }
}
```

**[Warning] Caution**: This adds complexity and gas costs. Only recommend if:

- Users are crypto-savvy (not true for students)
- Platform has high transaction volume
- Benefits outweigh UX friction

**For $CARE**: **NOT RECOMMENDED** initially. Keep it simple for students.

---

## Phase 5: Gamification & Engagement

### 5.1 Achievement-Based Rewards

**Deflationary Twist**: Reward users, but with decreasing amounts over time

```solidity
// Halving mechanism (like Bitcoin)
uint256 public baseReward = 100 * 10**18; // 100 CARE
uint256 public rewardHalvingInterval = 365 days;
uint256 public lastHalvingTime;

function calculateReward() public view returns (uint256) {
 uint256 halvings = (block.timestamp - lastHalvingTime) / rewardHalvingInterval;
 return baseReward / (2 ** halvings);
}
```

**Example Rewards Schedule**:

- Year 1: 100 CARE per CBT module completion
- Year 2: 50 CARE per completion
- Year 3: 25 CARE per completion
- Year 4: 12.5 CARE per completion

**Economic Effect**:

- Early adopters get more tokens (incentive to join early)
- Total inflation decreases over time
- Creates scarcity perception

### 5.2 Streak Bonuses

```solidity
// Bonus for consecutive activity
mapping(address => uint256) public streakDays;
mapping(address => uint256) public lastActivityDate;

function claimActivityReward() external {
 uint256 baseReward = calculateReward();
 
 // Check streak
 if (block.timestamp - lastActivityDate[msg.sender] <= 1 days) {
 streakDays[msg.sender]++;
 } else {
 streakDays[msg.sender] = 1;
 }
 
 // Bonus multiplier
 uint256 bonus = 0;
 if (streakDays[msg.sender] >= 30) bonus = 50; // 50% bonus for 30-day streak
 else if (streakDays[msg.sender] >= 14) bonus = 25; // 25% bonus for 14-day streak
 else if (streakDays[msg.sender] >= 7) bonus = 10; // 10% bonus for 7-day streak
 
 uint256 finalReward = baseReward + (baseReward * bonus / 100);
 mint(msg.sender, finalReward, "Activity streak reward");
}
```

---

## Economic Projections

### Scenario Analysis: Token Value Growth

**Assumptions**:

- Platform starts with 1,000 active users
- 10% monthly user growth
- 50% of users stake tokens
- 20% of revenue used for buyback
- Average user earns 500 CARE/month
- 30% of earned tokens are redeemed (burned)

| Time | Users | Circulating Supply | Burned | Staked | Price Pressure |
|------|-------|-------------------|--------|--------|----------------|
| Month 1 | 1,000 | 100M | 0 | 0 | Baseline |
| Month 6 | 5,000 | 150M | 5M | 70M | ↑ Moderate |
| Year 1 | 30,000 | 250M | 25M | 120M | ↑↑ Strong |
| Year 2 | 150,000 | 400M | 75M | 200M | ↑↑↑ Very Strong |
| Year 3 | 500,000 | 550M | 150M | 300M | ↑↑↑↑ Explosive |

**Key Metrics**:

- **Burn Rate**: 2.5M tokens/month by Year 1 → Permanent scarcity
- **Staked Supply**: 120M by Year 1 → 48% reduction in circulating supply
- **Effective Circulation**: 250M minted - 25M burned - 120M staked = **105M** (Year 1)
- **Supply Crunch**: Only 10.5% of max supply actively trading

### Value Drivers

1. **Deflationary Pressure**:
 - 30% of rewards burned through redemptions
 - Buyback & burn from revenue
 - **Result**: -2-5% supply per year

2. **Reduced Circulation**:
 - 40-50% of tokens staked long-term
 - **Result**: 50-60% less supply available

3. **Increasing Demand**:
 - User growth (10%/month = 214% annualized)
 - More activities = more rewards = more burns
 - **Result**: Constant buying/earning pressure

4. **Network Effects**:
 - More users → More merchant partnerships → More utility
 - More utility → Higher token value → More users
 - **Result**: Exponential growth potential

---

## ️ Implementation Roadmap

### Phase 1: Foundation (Month 1-2) [Done] DONE

- [x] Basic ERC-20 token with cap
- [x] Burnable functionality
- [x] Role-based minting
- [x] Deploy to testnet

### Phase 2: Deflationary Mechanics (Month 3-4)

- [ ] Implement redemption burn functions
- [ ] Create voucher/ticket redemption system
- [ ] Add feature unlock burns
- [ ] Deploy updated contract

### Phase 3: Staking System (Month 5-6)

- [ ] Develop staking smart contract
- [ ] Implement 4-tier lock periods
- [ ] Create staking dashboard UI
- [ ] Test rewards distribution

### Phase 4: Vesting & Distribution (Month 7-8)

- [ ] Deploy vesting contracts for team
- [ ] Set up ecosystem fund
- [ ] Create liquidity pools (DEX)
- [ ] Establish marketing budget

### Phase 5: Advanced Mechanisms (Month 9-12)

- [ ] Implement buyback contract
- [ ] Connect revenue to buyback
- [ ] Add halving mechanism
- [ ] Launch governance voting

### Phase 6: Optimization (Year 2+)

- [ ] Adjust reward rates based on data
- [ ] Optimize staking APY
- [ ] Expand merchant partnerships
- [ ] Cross-chain bridge (if needed)

---

## Recommended Next Steps

### Immediate Actions

1. **Add Redemption Burn Functions**
 - Update `CareToken.sol` with redemption functions
 - Create `RedemptionManager.sol` for voucher/ticket burns
 - Test on testnet

2. **Deploy Staking Contract**
 - Create `CareStaking.sol`
 - Implement 4-tier system
 - Build staking UI

3. **Document Tokenomics**
 - Update whitepaper with tokenomics
 - Create user-friendly explainer
 - Publish on website

4. **Set Up Treasury**
 - Create multi-sig wallet for team tokens
 - Implement vesting schedule
 - Establish buyback fund

### Long-Term Strategy

1. **Monitor & Adjust**
 - Track burn rates monthly
 - Adjust reward amounts based on token price
 - Optimize staking APY for 40-50% lock rate

2. **Expand Utility**
 - Partner with local merchants (10+ in Year 1)
 - Add more premium features
 - Create token-gated content

3. **Build Liquidity**
 - List on DEX (Uniswap-style on SOMNIA)
 - Provide initial liquidity
 - Incentivize liquidity provision

4. **Governance Transition**
 - Introduce governance voting (Year 2)
 - Decentralize decision-making
 - Build DAO structure

---

## Reference: Successful Models

### Case Study 1: BNB (Binance Coin)

- **Model**: Utility + Quarterly Burns
- **Result**: $3 → $600 (200x in 4 years)
- **Lesson**: Consistent buyback & burn with real utility

### Case Study 2: LINK (Chainlink)

- **Model**: Utility-First, Staking Added Later
- **Result**: $0.20 → $50 (250x in 5 years)
- **Lesson**: Focus on utility first, add staking for maturity

### Case Study 3: MATIC (Polygon)

- **Model**: Staking + Ecosystem Growth
- **Result**: $0.01 → $2.50 (250x in 3 years)
- **Lesson**: Staking + network effects = value growth

### What NOT to Do: Failed Models

[Missing] **SafeMoon** (Reflection Tax Model)

- 10% tax on every transaction
- Complex UX, confused users
- Whale manipulation, pump-and-dump
- **Lesson**: Don't over-complicate

[Missing] **Unlimited Supply Tokens**

- No cap = continuous inflation
- Value dilution over time
- **Lesson**: Hard cap is essential

---

## $CARE-Specific Recommendations

Given your target audience (Indonesian university students) and use case (mental health platform):

### [Done] DO Implement

1. **Redemption Burns** - Simple, clear value destruction
2. **Staking (Simple Tiers)** - Familiar concept, passive income
3. **Buyback from Revenue** - Sustainable, builds trust
4. **Vesting for Team** - Prevents dumps, shows commitment
5. **Halving Rewards** - Creates urgency, early adopter advantage

### [Missing] DON'T Implement (Yet)

1. **Transaction Taxes** - Confusing for non-crypto users
2. **Complex Reflection** - High gas costs, UX friction
3. **Aggressive Deflation** - Can hurt utility if too extreme
4. **Short-Term Gimmicks** - Focus on sustainable growth

### Target Metrics (Year 1)

- **Burn Rate**: 3-5% of circulating supply/year
- **Staking Rate**: 40-50% of supply locked
- **User Growth**: 10%/month (conservative)
- **Token Velocity**: 0.5 (half of supply moves per year)
- **Price Appreciation Target**: 2-5x from listing price

---

## Questions to Answer Before Implementation

1. **Reward Budget**: How many tokens to allocate per user action?
2. **Staking APY**: What % can we sustainably offer?
3. **Burn Rate Target**: What % of supply should burn annually?
4. **Vesting Duration**: 2 years or 4 years for team tokens?
5. **Buyback %**: What % of revenue goes to buyback?

**Recommendation**: Start conservative, increase later based on data.

---

## Final Recommendation

**Implement This Tokenomics Stack**:

```
Layer 1: BASE MECHANICS (Already Done)
├── Fixed max supply (1B)
├── Burnable tokens
└── Controlled minting

Layer 2: DEFLATIONARY (Implement Next)
├── Redemption burns (vouchers, tickets)
├── Feature unlock burns
└── Buyback & burn (from revenue)

Layer 3: STAKING (Month 5-6)
├── 4-tier lock periods (30/90/180/365 days)
├── 5-35% APY
└── 200M token reward pool

Layer 4: DISTRIBUTION (Month 7-8)
├── Vesting for team (4 years)
├── Halving rewards (annual)
└── Ecosystem fund allocation

Layer 5: GOVERNANCE (Year 2+)
├── Voting rights for stakers
├── DAO treasury management
└── Community proposals
```

**Expected Outcome**:

- **Year 1**: 2-5x price increase (from deflationary pressure + user growth)
- **Year 2**: 5-10x cumulative (staking locks 50% supply, buybacks intensify)
- **Year 3**: 10-25x cumulative (network effects, merchant adoption, scarcity)

**This model balances**:

- [Done] Utility (students can use tokens for real value)
- [Done] Sustainability (not a pump-and-dump)
- [Done] Simplicity (easy to understand)
- [Done] Value Growth (multiple appreciation mechanisms)
- [Done] Community (rewards long-term holders)

---

**Ready to implement?** Start with Phase 2 (Deflationary Mechanics) next week! [Start]
