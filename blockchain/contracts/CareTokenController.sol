// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CareToken.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CareTokenController
 * @dev Enhanced controller for CareToken with category-based mint caps
 * 
 * Features:
 * - Enforces per-category mint limits to prevent inflation
 * - Tracks minting across all categories
 * - Role-based access control for different minting operations
 * - Burn tracking by category for transparency
 * - Cannot exceed 1B max supply
 * 
 * Categories and Caps:
 * - Community: 350M CARE (Airdrops 100M, Staking 150M, Governance 50M, Events 50M)
 * - Wellness: 200M CARE (CBT/Therapy 100M, Daily Engagement 70M, Milestones 30M)
 * - Team: 130M CARE (Vested through CareTeamVesting contract)
 * - Partners: 100M CARE (Vested through CarePartnerVesting contract)
 * - Treasury: 100M CARE (Operations 50M, Buyback 50M)
 * - Liquidity: 80M CARE (Locked in CareLiquidityLock contract)
 * - Grants: 40M CARE (Research 20M, Developer Ecosystem 20M)
 * 
 * Security:
 * - Immutable category caps prevent manipulation
 * - Role-based minting prevents unauthorized issuance
 * - Per-category tracking enables auditing
 * - ReentrancyGuard prevents reentrancy attacks
 */
contract CareTokenController is AccessControl, ReentrancyGuard {
    // Minting categories
    enum MintCategory {
        COMMUNITY_AIRDROP,      // 100M
        COMMUNITY_STAKING,      // 150M
        COMMUNITY_GOVERNANCE,   // 50M
        COMMUNITY_EVENTS,       // 50M
        WELLNESS_THERAPY,       // 100M
        WELLNESS_ENGAGEMENT,    // 70M
        WELLNESS_MILESTONES,    // 30M
        TEAM_ALLOCATION,        // 130M (managed by vesting contract)
        PARTNER_ALLOCATION,     // 100M (managed by vesting contract)
        TREASURY_OPERATIONS,    // 50M
        TREASURY_BUYBACK,       // 50M
        LIQUIDITY_POOLS,        // 80M (managed by lock contract)
        GRANTS_RESEARCH,        // 20M
        GRANTS_ECOSYSTEM        // 20M
    }

    // Burn reasons
    enum BurnReason {
        REDEMPTION,         // User redeems CARE for vouchers/services
        BUYBACK,            // Treasury buyback and burn
        PENALTY,            // Early unstaking penalty
        MANUAL              // Manual burn by holder
    }

    // Category information
    struct CategoryInfo {
        uint256 cap;            // Maximum mintable for this category
        uint256 minted;         // Amount already minted
        uint256 burned;         // Amount burned from this category
        bool isActive;          // Whether minting is allowed
    }

    // Burn tracking
    struct BurnTracking {
        uint256 redemptionBurns;
        uint256 buybackBurns;
        uint256 penaltyBurns;
        uint256 manualBurns;
    }

    // Roles
    bytes32 public constant COMMUNITY_MINTER_ROLE = keccak256("COMMUNITY_MINTER_ROLE");
    bytes32 public constant WELLNESS_MINTER_ROLE = keccak256("WELLNESS_MINTER_ROLE");
    bytes32 public constant TEAM_MANAGER_ROLE = keccak256("TEAM_MANAGER_ROLE");
    bytes32 public constant PARTNER_MANAGER_ROLE = keccak256("PARTNER_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    bytes32 public constant GRANTS_MANAGER_ROLE = keccak256("GRANTS_MANAGER_ROLE");

    // State variables
    CareToken public immutable careToken;
    mapping(MintCategory => CategoryInfo) public categories;
    BurnTracking public burnTracking;

    // Events
    event CategoryMinted(
        MintCategory indexed category,
        address indexed recipient,
        uint256 amount,
        string reason
    );
    event CategoryBurned(
        MintCategory indexed category,
        BurnReason indexed burnReason,
        address indexed from,
        uint256 amount
    );
    event CategoryStatusChanged(MintCategory indexed category, bool isActive);

    /**
     * @dev Constructor
     * @param _careToken Address of the CareToken contract
     */
    constructor(address _careToken) {
        require(_careToken != address(0), "Invalid token address");
        careToken = CareToken(_careToken);

        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Initialize category caps (in wei, 18 decimals)
        categories[MintCategory.COMMUNITY_AIRDROP] = CategoryInfo(100_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.COMMUNITY_STAKING] = CategoryInfo(150_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.COMMUNITY_GOVERNANCE] = CategoryInfo(50_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.COMMUNITY_EVENTS] = CategoryInfo(50_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.WELLNESS_THERAPY] = CategoryInfo(100_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.WELLNESS_ENGAGEMENT] = CategoryInfo(70_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.WELLNESS_MILESTONES] = CategoryInfo(30_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.TEAM_ALLOCATION] = CategoryInfo(130_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.PARTNER_ALLOCATION] = CategoryInfo(100_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.TREASURY_OPERATIONS] = CategoryInfo(50_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.TREASURY_BUYBACK] = CategoryInfo(50_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.LIQUIDITY_POOLS] = CategoryInfo(80_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.GRANTS_RESEARCH] = CategoryInfo(20_000_000 * 10**18, 0, 0, true);
        categories[MintCategory.GRANTS_ECOSYSTEM] = CategoryInfo(20_000_000 * 10**18, 0, 0, true);
    }

    /**
     * @dev Mint tokens for a specific category
     * @param _category Mint category
     * @param _recipient Address to receive tokens
     * @param _amount Amount to mint
     * @param _reason Reason for minting
     * 
     * Requirements:
     * - Caller must have appropriate role for the category
     * - Amount must not exceed category cap
     * - Category must be active
     */
    function mintForCategory(
        MintCategory _category,
        address _recipient,
        uint256 _amount,
        string memory _reason
    ) external nonReentrant {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than 0");
        require(hasRequiredRole(_category), "Unauthorized for this category");

        CategoryInfo storage category = categories[_category];
        require(category.isActive, "Category not active");
        require(category.minted + _amount <= category.cap, "Exceeds category cap");

        category.minted += _amount;
        careToken.mint(_recipient, _amount, _reason);

        emit CategoryMinted(_category, _recipient, _amount, _reason);
    }

    /**
     * @dev Burn tokens and track by category and reason
     * @param _category Category to attribute the burn to
     * @param _burnReason Reason for burning
     * @param _amount Amount to burn
     * 
     * Requirements:
     * - Caller must have sufficient balance
     * - Tokens will be burned from caller's balance
     */
    function burnForCategory(
        MintCategory _category,
        BurnReason _burnReason,
        uint256 _amount
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(careToken.balanceOf(msg.sender) >= _amount, "Insufficient balance");

        // Track burn by reason
        if (_burnReason == BurnReason.REDEMPTION) {
            burnTracking.redemptionBurns += _amount;
        } else if (_burnReason == BurnReason.BUYBACK) {
            burnTracking.buybackBurns += _amount;
        } else if (_burnReason == BurnReason.PENALTY) {
            burnTracking.penaltyBurns += _amount;
        } else {
            burnTracking.manualBurns += _amount;
        }

        // Track burn by category
        categories[_category].burned += _amount;

        // Transfer tokens to this contract then burn
        careToken.transferFrom(msg.sender, address(this), _amount);
        careToken.burnWithReason(_amount, getReasonString(_burnReason));

        emit CategoryBurned(_category, _burnReason, msg.sender, _amount);
    }

    /**
     * @dev Check if caller has required role for category
     */
    function hasRequiredRole(MintCategory _category) internal view returns (bool) {
        if (_category == MintCategory.COMMUNITY_AIRDROP ||
            _category == MintCategory.COMMUNITY_STAKING ||
            _category == MintCategory.COMMUNITY_GOVERNANCE ||
            _category == MintCategory.COMMUNITY_EVENTS) {
            return hasRole(COMMUNITY_MINTER_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.WELLNESS_THERAPY ||
            _category == MintCategory.WELLNESS_ENGAGEMENT ||
            _category == MintCategory.WELLNESS_MILESTONES) {
            return hasRole(WELLNESS_MINTER_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.TEAM_ALLOCATION) {
            return hasRole(TEAM_MANAGER_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.PARTNER_ALLOCATION) {
            return hasRole(PARTNER_MANAGER_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.TREASURY_OPERATIONS ||
            _category == MintCategory.TREASURY_BUYBACK) {
            return hasRole(TREASURY_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.LIQUIDITY_POOLS) {
            return hasRole(LIQUIDITY_MANAGER_ROLE, msg.sender);
        }
        
        if (_category == MintCategory.GRANTS_RESEARCH ||
            _category == MintCategory.GRANTS_ECOSYSTEM) {
            return hasRole(GRANTS_MANAGER_ROLE, msg.sender);
        }
        
        return false;
    }

    /**
     * @dev Get reason string for burn reason enum
     */
    function getReasonString(BurnReason _reason) internal pure returns (string memory) {
        if (_reason == BurnReason.REDEMPTION) return "Voucher/Service Redemption";
        if (_reason == BurnReason.BUYBACK) return "Treasury Buyback";
        if (_reason == BurnReason.PENALTY) return "Early Unstaking Penalty";
        return "Manual Burn";
    }

    /**
     * @dev Toggle category active status
     */
    function setCategoryStatus(MintCategory _category, bool _isActive) external onlyRole(DEFAULT_ADMIN_ROLE) {
        categories[_category].isActive = _isActive;
        emit CategoryStatusChanged(_category, _isActive);
    }

    /**
     * @dev Get category details
     */
    function getCategory(MintCategory _category) external view returns (
        uint256 cap,
        uint256 minted,
        uint256 burned,
        uint256 remaining,
        uint256 netMinted,
        bool isActive
    ) {
        CategoryInfo memory category = categories[_category];
        return (
            category.cap,
            category.minted,
            category.burned,
            category.cap - category.minted,
            category.minted - category.burned,
            category.isActive
        );
    }

    /**
     * @dev Get total minted across all categories
     */
    function getTotalMinted() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < 14; i++) {
            total += categories[MintCategory(i)].minted;
        }
        return total;
    }

    /**
     * @dev Get total burned across all categories
     */
    function getTotalBurned() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < 14; i++) {
            total += categories[MintCategory(i)].burned;
        }
        return total;
    }

    /**
     * @dev Get burn statistics
     */
    function getBurnStats() external view returns (
        uint256 redemption,
        uint256 buyback,
        uint256 penalty,
        uint256 manual,
        uint256 total
    ) {
        return (
            burnTracking.redemptionBurns,
            burnTracking.buybackBurns,
            burnTracking.penaltyBurns,
            burnTracking.manualBurns,
            burnTracking.redemptionBurns + burnTracking.buybackBurns + 
            burnTracking.penaltyBurns + burnTracking.manualBurns
        );
    }

    /**
     * @dev Get community allocation stats (350M total)
     */
    function getCommunityStats() external view returns (
        uint256 airdropMinted,
        uint256 stakingMinted,
        uint256 governanceMinted,
        uint256 eventsMinted,
        uint256 totalMinted,
        uint256 totalCap
    ) {
        return (
            categories[MintCategory.COMMUNITY_AIRDROP].minted,
            categories[MintCategory.COMMUNITY_STAKING].minted,
            categories[MintCategory.COMMUNITY_GOVERNANCE].minted,
            categories[MintCategory.COMMUNITY_EVENTS].minted,
            categories[MintCategory.COMMUNITY_AIRDROP].minted +
            categories[MintCategory.COMMUNITY_STAKING].minted +
            categories[MintCategory.COMMUNITY_GOVERNANCE].minted +
            categories[MintCategory.COMMUNITY_EVENTS].minted,
            350_000_000 * 10**18
        );
    }

    /**
     * @dev Get wellness allocation stats (200M total)
     */
    function getWellnessStats() external view returns (
        uint256 therapyMinted,
        uint256 engagementMinted,
        uint256 milestonesMinted,
        uint256 totalMinted,
        uint256 totalCap
    ) {
        return (
            categories[MintCategory.WELLNESS_THERAPY].minted,
            categories[MintCategory.WELLNESS_ENGAGEMENT].minted,
            categories[MintCategory.WELLNESS_MILESTONES].minted,
            categories[MintCategory.WELLNESS_THERAPY].minted +
            categories[MintCategory.WELLNESS_ENGAGEMENT].minted +
            categories[MintCategory.WELLNESS_MILESTONES].minted,
            200_000_000 * 10**18
        );
    }
}
