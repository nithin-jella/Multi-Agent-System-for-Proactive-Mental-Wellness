// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CareTeamVesting
 * @dev Vesting contract for CARE token team allocation (130M CARE)
 * 
 * Features:
 * - 4-year linear vesting with 12-month cliff for team members
 * - 2-year linear vesting with 6-month cliff for advisors
 * - No tokens unlock before cliff period ends
 * - Prevents early withdrawal and ensures long-term commitment
 * - Owner can add beneficiaries but cannot withdraw tokens
 * - Emergency revocation for terminated team members (unvested tokens returned)
 * 
 * Allocation:
 * - Developers: 60M CARE (48-month vesting, 12-month cliff)
 * - Business/Marketing: 40M CARE (48-month vesting, 12-month cliff)
 * - Advisors: 30M CARE (24-month vesting, 6-month cliff)
 * 
 * Security:
 * - ReentrancyGuard prevents reentrancy attacks
 * - SafeERC20 prevents token transfer issues
 * - Immutable start time prevents manipulation
 * - Per-beneficiary tracking prevents unauthorized claims
 */
contract CareTeamVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Vesting schedule types
    enum VestingType {
        DEVELOPER,      // 48 months, 12-month cliff
        BUSINESS,       // 48 months, 12-month cliff
        ADVISOR         // 24 months, 6-month cliff
    }

    // Beneficiary information
    struct Beneficiary {
        uint256 totalAllocation;    // Total tokens allocated
        uint256 claimedAmount;      // Tokens already claimed
        uint256 startTime;          // Vesting start time
        uint256 cliffDuration;      // Cliff period in seconds
        uint256 vestingDuration;    // Total vesting duration in seconds
        VestingType vestingType;    // Type of vesting schedule
        bool revoked;               // Whether vesting has been revoked
    }

    // Constants
    uint256 public constant MAX_TEAM_ALLOCATION = 130_000_000 * 10**18; // 130M CARE
    uint256 public constant DEVELOPER_CLIFF = 365 days;      // 12 months
    uint256 public constant DEVELOPER_DURATION = 1460 days;  // 48 months
    uint256 public constant ADVISOR_CLIFF = 182 days;        // 6 months
    uint256 public constant ADVISOR_DURATION = 730 days;     // 24 months

    // State variables
    IERC20 public immutable careToken;
    uint256 public immutable vestingStartTime;
    uint256 public totalAllocated;
    uint256 public totalClaimed;

    // Beneficiary tracking
    mapping(address => Beneficiary) public beneficiaries;
    address[] public beneficiaryList;

    // Events
    event BeneficiaryAdded(
        address indexed beneficiary,
        uint256 allocation,
        VestingType vestingType,
        uint256 cliffDuration,
        uint256 vestingDuration
    );
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 unvestedAmount);

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
     * @dev Add a beneficiary to the vesting schedule
     * @param _beneficiary Address of the beneficiary
     * @param _allocation Amount of tokens to allocate
     * @param _vestingType Type of vesting schedule
     * 
     * Requirements:
     * - Only owner can call
     * - Cannot add beneficiary twice
     * - Allocation must not exceed remaining allocation
     * - Must be called before vesting starts
     */
    function addBeneficiary(
        address _beneficiary,
        uint256 _allocation,
        VestingType _vestingType
    ) external onlyOwner {
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_allocation > 0, "Allocation must be greater than 0");
        require(beneficiaries[_beneficiary].totalAllocation == 0, "Beneficiary already exists");
        require(totalAllocated + _allocation <= MAX_TEAM_ALLOCATION, "Exceeds max team allocation");
        require(block.timestamp < vestingStartTime, "Vesting already started");

        uint256 cliffDuration;
        uint256 vestingDuration;

        if (_vestingType == VestingType.ADVISOR) {
            cliffDuration = ADVISOR_CLIFF;
            vestingDuration = ADVISOR_DURATION;
        } else {
            // DEVELOPER and BUSINESS use same schedule
            cliffDuration = DEVELOPER_CLIFF;
            vestingDuration = DEVELOPER_DURATION;
        }

        beneficiaries[_beneficiary] = Beneficiary({
            totalAllocation: _allocation,
            claimedAmount: 0,
            startTime: vestingStartTime,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            vestingType: _vestingType,
            revoked: false
        });

        beneficiaryList.push(_beneficiary);
        totalAllocated += _allocation;

        emit BeneficiaryAdded(_beneficiary, _allocation, _vestingType, cliffDuration, vestingDuration);
    }

    /**
     * @dev Calculate vested amount for a beneficiary
     * @param _beneficiary Address of the beneficiary
     * @return Amount of tokens vested
     */
    function vestedAmount(address _beneficiary) public view returns (uint256) {
        Beneficiary memory b = beneficiaries[_beneficiary];
        
        if (b.revoked || b.totalAllocation == 0) {
            return 0;
        }

        // Before cliff, nothing is vested
        if (block.timestamp < b.startTime + b.cliffDuration) {
            return 0;
        }

        // After full vesting period, everything is vested
        if (block.timestamp >= b.startTime + b.vestingDuration) {
            return b.totalAllocation;
        }

        // Linear vesting after cliff
        uint256 timeVested = block.timestamp - b.startTime;
        return (b.totalAllocation * timeVested) / b.vestingDuration;
    }

    /**
     * @dev Calculate claimable amount for a beneficiary
     * @param _beneficiary Address of the beneficiary
     * @return Amount of tokens that can be claimed
     */
    function claimableAmount(address _beneficiary) public view returns (uint256) {
        uint256 vested = vestedAmount(_beneficiary);
        uint256 claimed = beneficiaries[_beneficiary].claimedAmount;
        return vested > claimed ? vested - claimed : 0;
    }

    /**
     * @dev Claim vested tokens
     * 
     * Requirements:
     * - Caller must be a beneficiary
     * - Must have claimable tokens
     * - Vesting must not be revoked
     */
    function claim() external nonReentrant {
        require(beneficiaries[msg.sender].totalAllocation > 0, "Not a beneficiary");
        require(!beneficiaries[msg.sender].revoked, "Vesting revoked");

        uint256 claimable = claimableAmount(msg.sender);
        require(claimable > 0, "No tokens to claim");

        beneficiaries[msg.sender].claimedAmount += claimable;
        totalClaimed += claimable;

        careToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @dev Revoke vesting for a beneficiary (e.g., team member leaves)
     * @param _beneficiary Address of the beneficiary
     * 
     * Requirements:
     * - Only owner can call
     * - Beneficiary must exist
     * - Vesting must not already be revoked
     * - Unvested tokens are returned to owner
     */
    function revokeVesting(address _beneficiary) external onlyOwner nonReentrant {
        Beneficiary storage b = beneficiaries[_beneficiary];
        require(b.totalAllocation > 0, "Not a beneficiary");
        require(!b.revoked, "Already revoked");

        // Calculate unvested amount
        uint256 vested = vestedAmount(_beneficiary);
        uint256 unvested = b.totalAllocation - vested;

        b.revoked = true;

        if (unvested > 0) {
            totalAllocated -= unvested;
            careToken.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(_beneficiary, unvested);
    }

    /**
     * @dev Get beneficiary details
     * @param _beneficiary Address of the beneficiary
     */
    function getBeneficiary(address _beneficiary) external view returns (
        uint256 totalAllocation,
        uint256 claimedAmount,
        uint256 vestedNow,
        uint256 claimableNow,
        uint256 startTime,
        uint256 cliffEnd,
        uint256 vestingEnd,
        VestingType vestingType,
        bool revoked
    ) {
        Beneficiary memory b = beneficiaries[_beneficiary];
        return (
            b.totalAllocation,
            b.claimedAmount,
            vestedAmount(_beneficiary),
            claimableAmount(_beneficiary),
            b.startTime,
            b.startTime + b.cliffDuration,
            b.startTime + b.vestingDuration,
            b.vestingType,
            b.revoked
        );
    }

    /**
     * @dev Get list of all beneficiaries
     */
    function getAllBeneficiaries() external view returns (address[] memory) {
        return beneficiaryList;
    }

    /**
     * @dev Get vesting statistics
     */
    function getVestingStats() external view returns (
        uint256 totalAlloc,
        uint256 totalClaim,
        uint256 totalVested,
        uint256 totalClaimable,
        uint256 beneficiaryCount
    ) {
        uint256 vested = 0;
        uint256 claimable = 0;

        for (uint256 i = 0; i < beneficiaryList.length; i++) {
            address beneficiary = beneficiaryList[i];
            vested += vestedAmount(beneficiary);
            claimable += claimableAmount(beneficiary);
        }

        return (
            totalAllocated,
            totalClaimed,
            vested,
            claimable,
            beneficiaryList.length
        );
    }

    /**
     * @dev Emergency withdraw function (only for excess tokens sent by mistake)
     * Cannot withdraw tokens allocated to beneficiaries
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = careToken.balanceOf(address(this));
        uint256 allocated = totalAllocated - totalClaimed;
        require(balance > allocated, "No excess tokens");
        
        uint256 excess = balance - allocated;
        careToken.safeTransfer(owner(), excess);
    }
}
