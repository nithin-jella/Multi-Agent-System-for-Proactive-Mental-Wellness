// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CarePartnerVesting
 * @dev Vesting contract for CARE token partner allocation (100M CARE)
 * 
 * Features:
 * - 2-year linear vesting with flexible cliff (3-6 months) based on partner tier
 * - Performance bonus system (Bronze/Silver/Gold tiers: 5%/10%/20%)
 * - Service level bonuses (Basic/Advanced/Premium: 5%/10%/15%)
 * - Graduated cliff periods based on partnership tier
 * - Revocation mechanism for underperforming partners
 * 
 * Allocation:
 * - UGM Merchants: 60M CARE (24-month vesting)
 * - Clinical Partners: 40M CARE (24-month vesting)
 * 
 * Cliff Periods by Tier:
 * - Tier 1 (Premium): 3 months
 * - Tier 2 (Standard): 4 months
 * - Tier 3 (Basic): 6 months
 * 
 * Security:
 * - ReentrancyGuard prevents reentrancy attacks
 * - SafeERC20 prevents token transfer issues
 * - Bonus caps prevent excessive token inflation
 * - Performance metrics verified off-chain by owner
 */
contract CarePartnerVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Partner tier (determines cliff period)
    enum PartnerTier {
        BASIC,      // 6-month cliff
        STANDARD,   // 4-month cliff
        PREMIUM     // 3-month cliff
    }

    // Performance tier (bonus eligibility)
    enum PerformanceTier {
        BRONZE,     // 5% bonus
        SILVER,     // 10% bonus
        GOLD        // 20% bonus
    }

    // Service level tier (additional bonus)
    enum ServiceTier {
        BASIC,      // 5% bonus
        ADVANCED,   // 10% bonus
        PREMIUM     // 15% bonus
    }

    // Partner information
    struct Partner {
        uint256 baseAllocation;         // Base token allocation
        uint256 claimedAmount;          // Tokens already claimed
        uint256 performanceBonus;       // Bonus tokens earned
        uint256 serviceBonus;           // Service level bonus
        uint256 startTime;              // Vesting start time
        uint256 cliffDuration;          // Cliff period in seconds
        uint256 vestingDuration;        // Total vesting duration (24 months)
        PartnerTier tier;               // Partner tier
        PerformanceTier performanceTier;// Performance tier
        ServiceTier serviceTier;        // Service tier
        bool revoked;                   // Whether vesting has been revoked
        bool isActive;                  // Whether partner is active
    }

    // Constants
    uint256 public constant MAX_PARTNER_ALLOCATION = 100_000_000 * 10**18; // 100M CARE
    uint256 public constant VESTING_DURATION = 730 days;  // 24 months
    uint256 public constant PREMIUM_CLIFF = 90 days;      // 3 months
    uint256 public constant STANDARD_CLIFF = 120 days;    // 4 months
    uint256 public constant BASIC_CLIFF = 182 days;       // 6 months
    
    // Bonus percentages (in basis points, 100 = 1%)
    uint256 public constant BRONZE_BONUS = 500;   // 5%
    uint256 public constant SILVER_BONUS = 1000;  // 10%
    uint256 public constant GOLD_BONUS = 2000;    // 20%
    uint256 public constant BASIC_SERVICE_BONUS = 500;    // 5%
    uint256 public constant ADVANCED_SERVICE_BONUS = 1000; // 10%
    uint256 public constant PREMIUM_SERVICE_BONUS = 1500;  // 15%

    // State variables
    IERC20 public immutable careToken;
    uint256 public immutable vestingStartTime;
    uint256 public totalBaseAllocated;
    uint256 public totalBonusAllocated;
    uint256 public totalClaimed;

    // Partner tracking
    mapping(address => Partner) public partners;
    address[] public partnerList;

    // Events
    event PartnerAdded(
        address indexed partner,
        uint256 baseAllocation,
        PartnerTier tier,
        uint256 cliffDuration
    );
    event PerformanceBonusAwarded(
        address indexed partner,
        PerformanceTier tier,
        uint256 bonusAmount
    );
    event ServiceBonusAwarded(
        address indexed partner,
        ServiceTier tier,
        uint256 bonusAmount
    );
    event TokensClaimed(address indexed partner, uint256 amount);
    event VestingRevoked(address indexed partner, uint256 unvestedAmount);

    /**
     * @dev Constructor
     * @param _careToken Address of the CARE token contract
     * @param _vestingStartTime Unix timestamp when vesting starts
     */
    constructor(
        address _careToken,
        uint256 _vestingStartTime
    ) Ownable(msg.sender) {
        require(_careToken != address(0), "Invalid token address");
        require(_vestingStartTime >= block.timestamp, "Start time must be in future");

        careToken = IERC20(_careToken);
        vestingStartTime = _vestingStartTime;
    }

    /**
     * @dev Add a partner to the vesting schedule
     * @param _partner Address of the partner
     * @param _baseAllocation Base amount of tokens to allocate
     * @param _tier Partner tier (determines cliff period)
     */
    function addPartner(
        address _partner,
        uint256 _baseAllocation,
        PartnerTier _tier
    ) external onlyOwner {
        require(_partner != address(0), "Invalid partner address");
        require(_baseAllocation > 0, "Allocation must be greater than 0");
        require(!partners[_partner].isActive, "Partner already exists");
        require(
            totalBaseAllocated + _baseAllocation <= MAX_PARTNER_ALLOCATION,
            "Exceeds max partner allocation"
        );
        require(block.timestamp < vestingStartTime, "Vesting already started");

        uint256 cliffDuration;
        if (_tier == PartnerTier.PREMIUM) {
            cliffDuration = PREMIUM_CLIFF;
        } else if (_tier == PartnerTier.STANDARD) {
            cliffDuration = STANDARD_CLIFF;
        } else {
            cliffDuration = BASIC_CLIFF;
        }

        partners[_partner] = Partner({
            baseAllocation: _baseAllocation,
            claimedAmount: 0,
            performanceBonus: 0,
            serviceBonus: 0,
            startTime: vestingStartTime,
            cliffDuration: cliffDuration,
            vestingDuration: VESTING_DURATION,
            tier: _tier,
            performanceTier: PerformanceTier.BRONZE,
            serviceTier: ServiceTier.BASIC,
            revoked: false,
            isActive: true
        });

        partnerList.push(_partner);
        totalBaseAllocated += _baseAllocation;

        emit PartnerAdded(_partner, _baseAllocation, _tier, cliffDuration);
    }

    /**
     * @dev Award performance bonus to a partner
     * @param _partner Address of the partner
     * @param _performanceTier Performance tier achieved
     * 
     * Requirements:
     * - Only owner can award bonuses
     * - Partner must be active
     * - Can only upgrade, not downgrade
     */
    function awardPerformanceBonus(
        address _partner,
        PerformanceTier _performanceTier
    ) external onlyOwner {
        Partner storage p = partners[_partner];
        require(p.isActive, "Partner not active");
        require(!p.revoked, "Vesting revoked");
        require(
            _performanceTier >= p.performanceTier,
            "Cannot downgrade performance tier"
        );

        // Calculate new bonus
        uint256 bonusPercentage;
        if (_performanceTier == PerformanceTier.GOLD) {
            bonusPercentage = GOLD_BONUS;
        } else if (_performanceTier == PerformanceTier.SILVER) {
            bonusPercentage = SILVER_BONUS;
        } else {
            bonusPercentage = BRONZE_BONUS;
        }

        uint256 newBonus = (p.baseAllocation * bonusPercentage) / 10000;
        uint256 additionalBonus = newBonus - p.performanceBonus;

        require(
            totalBonusAllocated + additionalBonus <= MAX_PARTNER_ALLOCATION - totalBaseAllocated,
            "Exceeds bonus allocation limit"
        );

        p.performanceBonus = newBonus;
        p.performanceTier = _performanceTier;
        totalBonusAllocated += additionalBonus;

        emit PerformanceBonusAwarded(_partner, _performanceTier, newBonus);
    }

    /**
     * @dev Award service level bonus to a partner
     * @param _partner Address of the partner
     * @param _serviceTier Service tier achieved
     */
    function awardServiceBonus(
        address _partner,
        ServiceTier _serviceTier
    ) external onlyOwner {
        Partner storage p = partners[_partner];
        require(p.isActive, "Partner not active");
        require(!p.revoked, "Vesting revoked");
        require(
            _serviceTier >= p.serviceTier,
            "Cannot downgrade service tier"
        );

        // Calculate new bonus
        uint256 bonusPercentage;
        if (_serviceTier == ServiceTier.PREMIUM) {
            bonusPercentage = PREMIUM_SERVICE_BONUS;
        } else if (_serviceTier == ServiceTier.ADVANCED) {
            bonusPercentage = ADVANCED_SERVICE_BONUS;
        } else {
            bonusPercentage = BASIC_SERVICE_BONUS;
        }

        uint256 newBonus = (p.baseAllocation * bonusPercentage) / 10000;
        uint256 additionalBonus = newBonus - p.serviceBonus;

        require(
            totalBonusAllocated + additionalBonus <= MAX_PARTNER_ALLOCATION - totalBaseAllocated,
            "Exceeds bonus allocation limit"
        );

        p.serviceBonus = newBonus;
        p.serviceTier = _serviceTier;
        totalBonusAllocated += additionalBonus;

        emit ServiceBonusAwarded(_partner, _serviceTier, newBonus);
    }

    /**
     * @dev Calculate total allocation including bonuses
     */
    function totalAllocation(address _partner) public view returns (uint256) {
        Partner memory p = partners[_partner];
        return p.baseAllocation + p.performanceBonus + p.serviceBonus;
    }

    /**
     * @dev Calculate vested amount for a partner
     */
    function vestedAmount(address _partner) public view returns (uint256) {
        Partner memory p = partners[_partner];
        
        if (p.revoked || !p.isActive) {
            return 0;
        }

        // Before cliff, nothing is vested
        if (block.timestamp < p.startTime + p.cliffDuration) {
            return 0;
        }

        uint256 total = totalAllocation(_partner);

        // After full vesting period, everything is vested
        if (block.timestamp >= p.startTime + p.vestingDuration) {
            return total;
        }

        // Linear vesting after cliff
        uint256 timeVested = block.timestamp - p.startTime;
        return (total * timeVested) / p.vestingDuration;
    }

    /**
     * @dev Calculate claimable amount for a partner
     */
    function claimableAmount(address _partner) public view returns (uint256) {
        uint256 vested = vestedAmount(_partner);
        uint256 claimed = partners[_partner].claimedAmount;
        return vested > claimed ? vested - claimed : 0;
    }

    /**
     * @dev Claim vested tokens
     */
    function claim() external nonReentrant {
        require(partners[msg.sender].isActive, "Not an active partner");
        require(!partners[msg.sender].revoked, "Vesting revoked");

        uint256 claimable = claimableAmount(msg.sender);
        require(claimable > 0, "No tokens to claim");

        partners[msg.sender].claimedAmount += claimable;
        totalClaimed += claimable;

        careToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @dev Revoke vesting for a partner
     */
    function revokeVesting(address _partner) external onlyOwner nonReentrant {
        Partner storage p = partners[_partner];
        require(p.isActive, "Partner not active");
        require(!p.revoked, "Already revoked");

        // Calculate unvested amount
        uint256 vested = vestedAmount(_partner);
        uint256 total = totalAllocation(_partner);
        uint256 unvested = total - vested;

        p.revoked = true;

        if (unvested > 0) {
            uint256 unvestedBase = unvested * p.baseAllocation / total;
            uint256 unvestedBonus = unvested - unvestedBase;
            
            totalBaseAllocated -= unvestedBase;
            totalBonusAllocated -= unvestedBonus;
            
            careToken.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(_partner, unvested);
    }

    /**
     * @dev Get partner details
     */
    function getPartner(address _partner) external view returns (
        uint256 baseAlloc,
        uint256 perfBonus,
        uint256 servBonus,
        uint256 totalAlloc,
        uint256 claimedAmount,
        uint256 vestedNow,
        uint256 claimableNow,
        PartnerTier tier,
        PerformanceTier perfTier,
        ServiceTier servTier,
        uint256 cliffEnd,
        uint256 vestingEnd,
        bool revoked,
        bool isActive
    ) {
        Partner memory p = partners[_partner];
        return (
            p.baseAllocation,
            p.performanceBonus,
            p.serviceBonus,
            totalAllocation(_partner),
            p.claimedAmount,
            vestedAmount(_partner),
            claimableAmount(_partner),
            p.tier,
            p.performanceTier,
            p.serviceTier,
            p.startTime + p.cliffDuration,
            p.startTime + p.vestingDuration,
            p.revoked,
            p.isActive
        );
    }

    /**
     * @dev Get all partners
     */
    function getAllPartners() external view returns (address[] memory) {
        return partnerList;
    }

    /**
     * @dev Get vesting statistics
     */
    function getVestingStats() external view returns (
        uint256 totalBase,
        uint256 totalBonus,
        uint256 totalClaim,
        uint256 totalVested,
        uint256 totalClaimable,
        uint256 partnerCount
    ) {
        uint256 vested = 0;
        uint256 claimable = 0;

        for (uint256 i = 0; i < partnerList.length; i++) {
            address partner = partnerList[i];
            vested += vestedAmount(partner);
            claimable += claimableAmount(partner);
        }

        return (
            totalBaseAllocated,
            totalBonusAllocated,
            totalClaimed,
            vested,
            claimable,
            partnerList.length
        );
    }

    /**
     * @dev Emergency withdraw excess tokens
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = careToken.balanceOf(address(this));
        uint256 allocated = totalBaseAllocated + totalBonusAllocated - totalClaimed;
        require(balance > allocated, "No excess tokens");
        
        uint256 excess = balance - allocated;
        careToken.safeTransfer(owner(), excess);
    }
}
