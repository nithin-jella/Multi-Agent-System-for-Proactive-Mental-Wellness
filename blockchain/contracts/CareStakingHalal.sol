// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CareStakingHalal
 * @notice Sharia-compliant staking contract using Mudarabah (profit-sharing) model
 * @dev Replaces interest-based APY with platform revenue profit distribution
 * 
 * Islamic Finance Compliance:
 * - ✅ NO Riba (interest) - No fixed APY rates
 * - ✅ Mudarabah Model - Profit-sharing partnership between stakers and platform
 * - ✅ Real Revenue - Rewards from platform fees, not minted interest
 * - ✅ Risk-Sharing - Variable returns based on platform performance
 * - ✅ Transparent - All profits on-chain via PlatformRevenueOracle
 * 
 * Allocation: 150M CARE tokens
 * Certification: Pending Shariah Advisory Board review
 */
contract CareStakingHalal is ReentrancyGuard, Pausable, AccessControl {
    
    // ============ STRUCTS ============
    
    struct StakeTier {
        uint256 minStakeAmount;      // Minimum CARE tokens to stake
        uint16 profitShareBPS;       // Profit share in basis points (e.g., 6000 = 60%)
        uint16 serviceFeeWaiverBPS;  // Service fee waiver percentage (e.g., 2500 = 25%)
        uint8 minWellnessActivities; // Required wellness activities completed
        uint256 totalStaked;         // Total CARE staked in this tier
    }

    struct UserStake {
        uint96 amount;               // Staked amount (packed)
        uint32 startTime;            // Stake start timestamp (packed)
        uint32 lastClaimTime;        // Last profit claim timestamp (packed)
        uint8 tier;                  // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum (packed)
        uint16 wellnessActivitiesCompleted; // Activities completed (packed)
        uint256 unclaimedProfit;     // Unclaimed profit in CARE
    }

    struct MonthlyProfit {
        uint256 totalRevenue;        // Platform revenue for the month
        uint256 totalExpenses;       // Platform expenses for the month
        uint256 netProfit;           // Revenue - Expenses
        uint256 distributedAmount;   // Total CARE distributed to stakers
        uint32 settlementTime;       // When profit was settled
        bool settled;                // Whether month has been settled
    }

    // ============ STATE VARIABLES ============
    
    // Tier configurations (0=Bronze, 1=Silver, 2=Gold, 3=Platinum)
    mapping(uint8 => StakeTier) public stakeTiers;
    
    // User stakes
    mapping(address => UserStake[]) public userStakes;
    
    // Monthly profit tracking (format: YYYYMM, e.g., 202510 = October 2025)
    mapping(uint256 => MonthlyProfit) public monthlyProfits;
    uint256 public currentMonth;
    
    // Platform contracts
    IERC20 public immutable careToken;
    address public careTokenController;
    address public platformRevenueOracle;
    address public careWellnessContract;
    address public shariahBoard;
    
    // Totals
    uint256 public totalStaked;
    uint256 public totalProfitDistributed;
    
    // Roles
    bytes32 public constant REVENUE_ORACLE_ROLE = keccak256("REVENUE_ORACLE_ROLE");
    bytes32 public constant SHARIAH_BOARD_ROLE = keccak256("SHARIAH_BOARD_ROLE");
    bytes32 public constant WELLNESS_CONTRACT_ROLE = keccak256("WELLNESS_CONTRACT_ROLE");
    
    // Constants
    uint256 public constant WAKALA_FEE_BPS = 1000; // 10% platform Wakala (agency) fee
    uint256 public constant ALLOCATION = 150_000_000e18; // 150M CARE
    uint256 public constant EARLY_WITHDRAWAL_PENALTY_BPS = 1000; // 10% penalty
    uint256 public constant MAX_BPS = 10000; // 100%
    
    // ============ EVENTS ============
    
    event Staked(address indexed user, uint256 amount, uint8 tier, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint8 tier, uint256 penalty);
    event ProfitClaimed(address indexed user, uint256 amount, uint256 month);
    event MonthlyProfitSettled(uint256 indexed month, uint256 netProfit, uint256 distributedAmount);
    event TierUpgraded(address indexed user, uint8 oldTier, uint8 newTier);
    event WellnessActivityRecorded(address indexed user, uint256 activityCount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    
    // ============ ERRORS ============
    
    error InvalidAmount();
    error InvalidTier();
    error BelowMinimumStake();
    error InsufficientWellnessActivities();
    error InvalidStakeIndex();
    error NoProfitToClaim();
    error MonthAlreadySettled();
    error MonthMismatch();
    error RevenueExceedsExpenses();
    error NotAuthorized();
    error TransferFailed();
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _careToken,
        address _careTokenController,
        address _platformRevenueOracle,
        address _shariahBoard,
        address _admin
    ) {
        require(_careToken != address(0), "Invalid CARE token");
        require(_careTokenController != address(0), "Invalid controller");
        require(_platformRevenueOracle != address(0), "Invalid oracle");
        require(_shariahBoard != address(0), "Invalid Shariah board");
        require(_admin != address(0), "Invalid admin");
        
        careToken = IERC20(_careToken);
        careTokenController = _careTokenController;
        platformRevenueOracle = _platformRevenueOracle;
        shariahBoard = _shariahBoard;
        
        // Initialize tiers (participation-based, NOT time-based)
        stakeTiers[0] = StakeTier({
            minStakeAmount: 1_000e18,      // 1K CARE minimum
            profitShareBPS: 6000,          // 60% profit share
            serviceFeeWaiverBPS: 0,        // 0% fee waiver
            minWellnessActivities: 0,      // No activity requirement
            totalStaked: 0
        });
        
        stakeTiers[1] = StakeTier({
            minStakeAmount: 10_000e18,     // 10K CARE minimum
            profitShareBPS: 7000,          // 70% profit share
            serviceFeeWaiverBPS: 2500,     // 25% fee waiver
            minWellnessActivities: 5,      // 5 activities required
            totalStaked: 0
        });
        
        stakeTiers[2] = StakeTier({
            minStakeAmount: 50_000e18,     // 50K CARE minimum
            profitShareBPS: 8000,          // 80% profit share
            serviceFeeWaiverBPS: 5000,     // 50% fee waiver
            minWellnessActivities: 15,     // 15 activities required
            totalStaked: 0
        });
        
        stakeTiers[3] = StakeTier({
            minStakeAmount: 100_000e18,    // 100K CARE minimum
            profitShareBPS: 9000,          // 90% profit share
            serviceFeeWaiverBPS: 7500,     // 75% fee waiver
            minWellnessActivities: 30,     // 30 activities required
            totalStaked: 0
        });
        
        // Set initial month (October 2025 = 202510)
        currentMonth = 202510;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REVENUE_ORACLE_ROLE, _platformRevenueOracle);
        _grantRole(SHARIAH_BOARD_ROLE, _shariahBoard);
    }
    
    // ============ STAKING FUNCTIONS ============
    
    /**
     * @notice Stake CARE tokens in a specific tier
     * @param amount Amount of CARE to stake
     * @param tier Tier level (0=Bronze, 1=Silver, 2=Gold, 3=Platinum)
     */
    function stake(uint256 amount, uint8 tier) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (tier >= 4) revert InvalidTier();
        
        StakeTier storage tierConfig = stakeTiers[tier];
        if (amount < tierConfig.minStakeAmount) revert BelowMinimumStake();
        
        // Check wellness activity requirement
        uint256 userActivityCount = getUserWellnessActivityCount(msg.sender);
        if (userActivityCount < tierConfig.minWellnessActivities) {
            revert InsufficientWellnessActivities();
        }
        
        // Transfer CARE from user
        bool success = careToken.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // Create stake record
        UserStake memory newStake = UserStake({
            amount: uint96(amount),
            startTime: uint32(block.timestamp),
            lastClaimTime: uint32(block.timestamp),
            tier: tier,
            wellnessActivitiesCompleted: uint16(userActivityCount),
            unclaimedProfit: 0
        });
        
        userStakes[msg.sender].push(newStake);
        
        // Update totals
        tierConfig.totalStaked += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, tier, block.timestamp);
    }
    
    /**
     * @notice Unstake CARE tokens (10% penalty if within first 30 days)
     * @param stakeIndex Index of the stake to unstake
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        if (stakeIndex >= userStakes[msg.sender].length) revert InvalidStakeIndex();
        
        UserStake memory userStake = userStakes[msg.sender][stakeIndex];
        if (userStake.amount == 0) revert InvalidAmount();
        
        // Claim any unclaimed profits first
        if (userStake.unclaimedProfit > 0) {
            _claimProfit(msg.sender, stakeIndex);
        }
        
        uint256 unstakeAmount = userStake.amount;
        uint256 penalty = 0;
        
        // Apply 10% early withdrawal penalty if unstaking within 30 days
        // (This is a service term, NOT riba - it discourages gaming the system)
        if (block.timestamp < userStake.startTime + 30 days) {
            penalty = (unstakeAmount * EARLY_WITHDRAWAL_PENALTY_BPS) / MAX_BPS;
            unstakeAmount -= penalty;
            
            // Penalty goes to treasury (via controller)
            if (penalty > 0) {
                careToken.transfer(careTokenController, penalty);
            }
        }
        
        // Transfer CARE back to user
        bool success = careToken.transfer(msg.sender, unstakeAmount);
        if (!success) revert TransferFailed();
        
        // Update state
        uint8 tier = userStake.tier;
        stakeTiers[tier].totalStaked -= userStake.amount;
        totalStaked -= userStake.amount;
        
        // Remove stake (swap with last and pop for gas efficiency)
        uint256 lastIndex = userStakes[msg.sender].length - 1;
        if (stakeIndex != lastIndex) {
            userStakes[msg.sender][stakeIndex] = userStakes[msg.sender][lastIndex];
        }
        userStakes[msg.sender].pop();
        
        emit Unstaked(msg.sender, unstakeAmount, tier, penalty);
    }
    
    // ============ PROFIT DISTRIBUTION ============
    
    /**
     * @notice Settle monthly profit (called by PlatformRevenueOracle)
     * @param month Month in YYYYMM format (e.g., 202510)
     * @param totalRevenue Total platform revenue for the month
     * @param totalExpenses Total platform expenses for the month
     */
    function settleMonthlyProfit(
        uint256 month,
        uint256 totalRevenue,
        uint256 totalExpenses
    ) external onlyRole(REVENUE_ORACLE_ROLE) {
        if (month != currentMonth) revert MonthMismatch();
        if (monthlyProfits[month].settled) revert MonthAlreadySettled();
        if (totalRevenue < totalExpenses) revert RevenueExceedsExpenses();
        
        uint256 netProfit = totalRevenue - totalExpenses;
        
        // Deduct Wakala fee (10% platform agency fee - permissible in Islamic finance)
        uint256 wakalaFee = (netProfit * WAKALA_FEE_BPS) / MAX_BPS;
        uint256 distributableProfit = netProfit - wakalaFee;
        
        // Calculate profit distribution per tier
        uint256 totalDistributed = 0;
        
        if (totalStaked > 0) {
            for (uint8 tier = 0; tier < 4; tier++) {
                StakeTier memory tierConfig = stakeTiers[tier];
                if (tierConfig.totalStaked > 0) {
                    // Tier's share = distributableProfit × profitShareRatio × (tierStaked / totalStaked)
                    uint256 tierShare = (distributableProfit * tierConfig.profitShareBPS * tierConfig.totalStaked) 
                                      / (MAX_BPS * totalStaked);
                    totalDistributed += tierShare;
                }
            }
        }
        
        // Record monthly profit
        monthlyProfits[month] = MonthlyProfit({
            totalRevenue: totalRevenue,
            totalExpenses: totalExpenses,
            netProfit: netProfit,
            distributedAmount: totalDistributed,
            settlementTime: uint32(block.timestamp),
            settled: true
        });
        
        // Move to next month
        currentMonth = _incrementMonth(month);
        
        emit MonthlyProfitSettled(month, netProfit, totalDistributed);
    }
    
    /**
     * @notice Claim profit for a specific stake
     * @param stakeIndex Index of the stake
     */
    function claimProfit(uint256 stakeIndex) external nonReentrant {
        _claimProfit(msg.sender, stakeIndex);
    }
    
    /**
     * @notice Internal function to claim profit
     */
    function _claimProfit(address user, uint256 stakeIndex) internal {
        if (stakeIndex >= userStakes[user].length) revert InvalidStakeIndex();
        
        UserStake storage userStake = userStakes[user][stakeIndex];
        
        // Calculate unclaimed profit from previous months
        uint256 unclaimedProfit = calculateUnclaimedProfit(user, stakeIndex);
        if (unclaimedProfit == 0) revert NoProfitToClaim();
        
        // Transfer CARE profit to user
        bool success = careToken.transfer(user, unclaimedProfit);
        if (!success) revert TransferFailed();
        
        // Update state
        userStake.lastClaimTime = uint32(block.timestamp);
        userStake.unclaimedProfit = 0;
        totalProfitDistributed += unclaimedProfit;
        
        emit ProfitClaimed(user, unclaimedProfit, currentMonth);
    }
    
    /**
     * @notice Calculate unclaimed profit for a stake
     * @param user User address
     * @param stakeIndex Index of the stake
     * @return Total unclaimed profit
     */
    function calculateUnclaimedProfit(address user, uint256 stakeIndex) public view returns (uint256) {
        if (stakeIndex >= userStakes[user].length) return 0;
        
        UserStake memory userStake = userStakes[user][stakeIndex];
        if (userStake.amount == 0) return 0;
        
        StakeTier memory tierConfig = stakeTiers[userStake.tier];
        uint256 totalProfit = 0;
        
        // Iterate through settled months since last claim
        uint256 checkMonth = _getMonthFromTimestamp(userStake.lastClaimTime);
        uint256 currentCheckMonth = currentMonth;
        
        while (checkMonth < currentCheckMonth) {
            MonthlyProfit memory monthProfit = monthlyProfits[checkMonth];
            
            if (monthProfit.settled && tierConfig.totalStaked > 0) {
                // Calculate user's share of tier profit for this month
                // userProfit = monthlyDistributed × profitShareRatio × (userStaked / tierStaked)
                uint256 userShare = (monthProfit.distributedAmount * tierConfig.profitShareBPS * userStake.amount) 
                                  / (MAX_BPS * tierConfig.totalStaked);
                totalProfit += userShare;
            }
            
            checkMonth = _incrementMonth(checkMonth);
            
            // Safety: Prevent infinite loop
            if (checkMonth > currentMonth + 100) break;
        }
        
        return totalProfit;
    }
    
    // ============ WELLNESS ACTIVITY INTEGRATION ============
    
    /**
     * @notice Record wellness activity completion (called by CareWellness contract)
     * @param user User address
     */
    function recordWellnessActivity(address user) external onlyRole(WELLNESS_CONTRACT_ROLE) {
        // Update activity count for all user's stakes
        uint256 stakesLength = userStakes[user].length;
        for (uint256 i = 0; i < stakesLength; i++) {
            userStakes[user][i].wellnessActivitiesCompleted++;
        }
        
        if (stakesLength > 0) {
            emit WellnessActivityRecorded(user, userStakes[user][0].wellnessActivitiesCompleted);
            
            // Check if user can upgrade tier
            _checkTierUpgrade(user);
        }
    }
    
    /**
     * @notice Check and auto-upgrade user tier if eligible
     */
    function _checkTierUpgrade(address user) internal {
        uint256 stakesLength = userStakes[user].length;
        for (uint256 i = 0; i < stakesLength; i++) {
            UserStake storage userStake = userStakes[user][i];
            uint8 currentTier = userStake.tier;
            
            // Check if eligible for higher tier
            for (uint8 newTier = currentTier + 1; newTier < 4; newTier++) {
                StakeTier memory newTierConfig = stakeTiers[newTier];
                
                if (userStake.amount >= newTierConfig.minStakeAmount &&
                    userStake.wellnessActivitiesCompleted >= newTierConfig.minWellnessActivities) {
                    // Upgrade tier
                    stakeTiers[currentTier].totalStaked -= userStake.amount;
                    stakeTiers[newTier].totalStaked += userStake.amount;
                    userStake.tier = newTier;
                    
                    emit TierUpgraded(user, currentTier, newTier);
                    break;
                }
            }
        }
    }
    
    /**
     * @notice Get user's wellness activity count from CareWellness contract
     * @param user User address
     * @return Activity count
     */
    function getUserWellnessActivityCount(address user) public view returns (uint256) {
        // TODO: Query CareWellness contract for user's total activities
        // For now, return 0 (will be implemented when CareWellness is deployed)
        if (careWellnessContract == address(0)) return 0;
        
        // Example integration:
        // return ICareWellness(careWellnessContract).getUserActivityCount(user);
        return 0;
    }
    
    // ============ GOVERNANCE INTEGRATION ============
    
    /**
     * @notice Get voting power for user (Platinum tier only)
     * @param user User address
     * @return Total voting power
     */
    function getVotingPower(address user) public view returns (uint256) {
        uint256 votingPower = 0;
        uint256 stakesLength = userStakes[user].length;
        
        for (uint256 i = 0; i < stakesLength; i++) {
            // Only Platinum tier (tier 3) gets voting power
            if (userStakes[user][i].tier == 3) {
                votingPower += userStakes[user][i].amount;
            }
        }
        
        return votingPower;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get all stakes for a user
     */
    function getUserStakes(address user) external view returns (UserStake[] memory) {
        return userStakes[user];
    }
    
    /**
     * @notice Get monthly profit details
     */
    function getMonthlyProfit(uint256 month) external view returns (MonthlyProfit memory) {
        return monthlyProfits[month];
    }
    
    /**
     * @notice Get tier configuration
     */
    function getTierConfig(uint8 tier) external view returns (StakeTier memory) {
        return stakeTiers[tier];
    }
    
    /**
     * @notice Get user's total staked amount across all stakes
     */
    function getUserTotalStaked(address user) external view returns (uint256) {
        uint256 total = 0;
        uint256 stakesLength = userStakes[user].length;
        
        for (uint256 i = 0; i < stakesLength; i++) {
            total += userStakes[user][i].amount;
        }
        
        return total;
    }
    
    // ============ HELPER FUNCTIONS ============
    
    /**
     * @notice Increment month (YYYYMM format)
     */
    function _incrementMonth(uint256 month) internal pure returns (uint256) {
        uint256 year = month / 100;
        uint256 monthNum = month % 100;
        
        monthNum++;
        if (monthNum > 12) {
            year++;
            monthNum = 1;
        }
        
        return year * 100 + monthNum;
    }
    
    /**
     * @notice Convert timestamp to YYYYMM format
     */
    function _getMonthFromTimestamp(uint256 timestamp) internal pure returns (uint256) {
        // Simple conversion (can be improved with actual date library)
        // For now, assume October 2025 as baseline
        uint256 monthsSinceStart = (timestamp - 1730419200) / 30 days; // Oct 1, 2025
        uint256 year = 2025 + (monthsSinceStart / 12);
        uint256 month = 10 + (monthsSinceStart % 12);
        
        if (month > 12) {
            year++;
            month -= 12;
        }
        
        return year * 100 + month;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Update tier configuration (Shariah board only)
     */
    function updateTierConfig(
        uint8 tier,
        uint256 minStakeAmount,
        uint16 profitShareBPS,
        uint16 serviceFeeWaiverBPS,
        uint8 minWellnessActivities
    ) external onlyRole(SHARIAH_BOARD_ROLE) {
        if (tier >= 4) revert InvalidTier();
        
        stakeTiers[tier].minStakeAmount = minStakeAmount;
        stakeTiers[tier].profitShareBPS = profitShareBPS;
        stakeTiers[tier].serviceFeeWaiverBPS = serviceFeeWaiverBPS;
        stakeTiers[tier].minWellnessActivities = minWellnessActivities;
    }
    
    /**
     * @notice Set CareWellness contract address
     */
    function setCareWellnessContract(address _careWellnessContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_careWellnessContract != address(0), "Invalid address");
        careWellnessContract = _careWellnessContract;
        _grantRole(WELLNESS_CONTRACT_ROLE, _careWellnessContract);
    }
    
    /**
     * @notice Emergency withdraw (only when paused)
     */
    function emergencyWithdraw(address token, address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        whenPaused 
    {
        require(to != address(0), "Invalid recipient");
        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert TransferFailed();
        
        emit EmergencyWithdraw(token, to, amount);
    }
}
