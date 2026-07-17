// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CareLiquidityLock
 * @dev Time-lock contract for CARE token liquidity pool allocation (80M CARE)
 * 
 * Features:
 * - 24-month hard lock period (no withdrawals possible)
 * - 6-month linear unlock after lock period ends
 * - Prevents rug pulls and ensures long-term liquidity
 * - Emergency unlock requires multi-sig (owner + authorized address)
 * - Tracks multiple liquidity pools independently
 * 
 * Allocation:
 * - Primary Pool (DEX): 50M CARE (Uniswap/SushiSwap equivalent on SOMNIA)
 * - Secondary Pools: 30M CARE (CEX listings, bridge liquidity)
 * 
 * Timeline:
 * - Month 0-24: 100% locked (no withdrawals)
 * - Month 24-30: Linear unlock (0% → 100%)
 * - Month 30+: Fully unlocked
 * 
 * Security:
 * - Immutable lock period prevents manipulation
 * - Two-step emergency unlock (owner + authorized signer)
 * - Per-pool tracking prevents cross-contamination
 * - ReentrancyGuard prevents reentrancy attacks
 */
contract CareLiquidityLock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Liquidity pool type
    enum PoolType {
        PRIMARY_DEX,    // Main DEX pool
        SECONDARY_DEX,  // Secondary DEX pools
        CEX_LISTING,    // Centralized exchange listing
        BRIDGE          // Cross-chain bridge liquidity
    }

    // Pool information
    struct LiquidityPool {
        uint256 totalLocked;        // Total tokens locked
        uint256 withdrawnAmount;    // Tokens already withdrawn
        uint256 lockStartTime;      // When lock started
        uint256 lockDuration;       // Hard lock period (24 months)
        uint256 unlockDuration;     // Linear unlock period (6 months)
        PoolType poolType;          // Type of liquidity pool
        bool isActive;              // Whether pool is active
        bool emergencyUnlocked;     // Whether emergency unlock was triggered
    }

    // Constants
    uint256 public constant MAX_LIQUIDITY_ALLOCATION = 80_000_000 * 10**18; // 80M CARE
    uint256 public constant LOCK_DURATION = 730 days;    // 24 months
    uint256 public constant UNLOCK_DURATION = 182 days;  // 6 months linear unlock
    uint256 public constant PRIMARY_POOL_ALLOCATION = 50_000_000 * 10**18;  // 50M CARE
    uint256 public constant SECONDARY_POOL_ALLOCATION = 30_000_000 * 10**18; // 30M CARE

    // State variables
    IERC20 public immutable careToken;
    uint256 public totalLocked;
    uint256 public totalWithdrawn;
    address public emergencyUnlockAuthorizer;  // Second signature for emergency unlock

    // Pool tracking
    mapping(bytes32 => LiquidityPool) public pools;
    bytes32[] public poolIds;

    // Events
    event LiquidityPoolCreated(
        bytes32 indexed poolId,
        string poolName,
        PoolType poolType,
        uint256 amount,
        uint256 lockStartTime,
        uint256 unlockStartTime
    );
    event TokensWithdrawn(bytes32 indexed poolId, address indexed recipient, uint256 amount);
    event EmergencyUnlockAuthorized(bytes32 indexed poolId, address indexed authorizer);
    event EmergencyUnlockExecuted(bytes32 indexed poolId, uint256 amount);
    event EmergencyAuthorizerUpdated(address indexed oldAuthorizer, address indexed newAuthorizer);

    /**
     * @dev Constructor
     * @param _careToken Address of the CARE token contract
     * @param _emergencyUnlockAuthorizer Address that can co-sign emergency unlocks
     */
    constructor(
        address _careToken,
        address _emergencyUnlockAuthorizer
    ) Ownable(msg.sender) {
        require(_careToken != address(0), "Invalid token address");
        require(_emergencyUnlockAuthorizer != address(0), "Invalid authorizer address");

        careToken = IERC20(_careToken);
        emergencyUnlockAuthorizer = _emergencyUnlockAuthorizer;
    }

    /**
     * @dev Create a new liquidity pool lock
     * @param _poolName Name of the pool (e.g., "Uniswap CARE/SOMI")
     * @param _poolType Type of liquidity pool
     * @param _amount Amount of tokens to lock
     * @param _lockStartTime Unix timestamp when lock starts
     * 
     * Requirements:
     * - Only owner can create pools
     * - Pool name must be unique
     * - Amount must not exceed remaining allocation
     */
    function createPool(
        string memory _poolName,
        PoolType _poolType,
        uint256 _amount,
        uint256 _lockStartTime
    ) external onlyOwner returns (bytes32 poolId) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_lockStartTime >= block.timestamp, "Start time must be in future");
        require(totalLocked + _amount <= MAX_LIQUIDITY_ALLOCATION, "Exceeds max liquidity allocation");

        poolId = keccak256(abi.encodePacked(_poolName, _poolType, _lockStartTime));
        require(!pools[poolId].isActive, "Pool already exists");

        pools[poolId] = LiquidityPool({
            totalLocked: _amount,
            withdrawnAmount: 0,
            lockStartTime: _lockStartTime,
            lockDuration: LOCK_DURATION,
            unlockDuration: UNLOCK_DURATION,
            poolType: _poolType,
            isActive: true,
            emergencyUnlocked: false
        });

        poolIds.push(poolId);
        totalLocked += _amount;

        emit LiquidityPoolCreated(
            poolId,
            _poolName,
            _poolType,
            _amount,
            _lockStartTime,
            _lockStartTime + LOCK_DURATION
        );

        return poolId;
    }

    /**
     * @dev Calculate unlocked amount for a pool
     * @param _poolId ID of the liquidity pool
     * @return Amount of tokens unlocked
     */
    function unlockedAmount(bytes32 _poolId) public view returns (uint256) {
        LiquidityPool memory pool = pools[_poolId];
        
        if (!pool.isActive) {
            return 0;
        }

        // Emergency unlock releases everything
        if (pool.emergencyUnlocked) {
            return pool.totalLocked;
        }

        // Before lock period ends, nothing is unlocked
        uint256 lockEndTime = pool.lockStartTime + pool.lockDuration;
        if (block.timestamp < lockEndTime) {
            return 0;
        }

        // After full unlock period, everything is unlocked
        uint256 unlockEndTime = lockEndTime + pool.unlockDuration;
        if (block.timestamp >= unlockEndTime) {
            return pool.totalLocked;
        }

        // Linear unlock between lockEndTime and unlockEndTime
        uint256 timeSinceLockEnd = block.timestamp - lockEndTime;
        return (pool.totalLocked * timeSinceLockEnd) / pool.unlockDuration;
    }

    /**
     * @dev Calculate withdrawable amount for a pool
     * @param _poolId ID of the liquidity pool
     * @return Amount of tokens that can be withdrawn
     */
    function withdrawableAmount(bytes32 _poolId) public view returns (uint256) {
        LiquidityPool memory pool = pools[_poolId];
        uint256 unlocked = unlockedAmount(_poolId);
        uint256 withdrawn = pool.withdrawnAmount;
        return unlocked > withdrawn ? unlocked - withdrawn : 0;
    }

    /**
     * @dev Withdraw unlocked tokens from a pool
     * @param _poolId ID of the liquidity pool
     * @param _recipient Address to receive the tokens
     * @param _amount Amount to withdraw
     * 
     * Requirements:
     * - Only owner can withdraw
     * - Amount must be available for withdrawal
     */
    function withdraw(
        bytes32 _poolId,
        address _recipient,
        uint256 _amount
    ) external onlyOwner nonReentrant {
        require(_recipient != address(0), "Invalid recipient");
        require(pools[_poolId].isActive, "Pool not active");
        
        uint256 withdrawable = withdrawableAmount(_poolId);
        require(_amount <= withdrawable, "Insufficient unlocked tokens");

        pools[_poolId].withdrawnAmount += _amount;
        totalWithdrawn += _amount;

        careToken.safeTransfer(_recipient, _amount);

        emit TokensWithdrawn(_poolId, _recipient, _amount);
    }

    /**
     * @dev Emergency unlock mechanism (requires owner + authorizer)
     * @param _poolId ID of the liquidity pool
     * @param _authorizerSignature Signature from emergency unlock authorizer
     * 
     * WARNING: This is a critical function. Use only in extreme emergencies
     * (e.g., smart contract vulnerability, critical bug in DEX contract)
     */
    function emergencyUnlock(
        bytes32 _poolId,
        bytes memory _authorizerSignature
    ) external onlyOwner nonReentrant {
        LiquidityPool storage pool = pools[_poolId];
        require(pool.isActive, "Pool not active");
        require(!pool.emergencyUnlocked, "Already emergency unlocked");

        // Verify authorizer signature
        bytes32 messageHash = keccak256(abi.encodePacked(_poolId, block.chainid, address(this)));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recoveredSigner = recoverSigner(ethSignedMessageHash, _authorizerSignature);
        
        require(recoveredSigner == emergencyUnlockAuthorizer, "Invalid authorizer signature");

        pool.emergencyUnlocked = true;

        emit EmergencyUnlockExecuted(_poolId, pool.totalLocked - pool.withdrawnAmount);
    }

    /**
     * @dev Update emergency unlock authorizer
     * @param _newAuthorizer New authorizer address
     */
    function updateEmergencyAuthorizer(address _newAuthorizer) external onlyOwner {
        require(_newAuthorizer != address(0), "Invalid authorizer address");
        address oldAuthorizer = emergencyUnlockAuthorizer;
        emergencyUnlockAuthorizer = _newAuthorizer;
        emit EmergencyAuthorizerUpdated(oldAuthorizer, _newAuthorizer);
    }

    /**
     * @dev Recover signer from signature
     */
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature 'v' value");

        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    /**
     * @dev Get pool details
     */
    function getPool(bytes32 _poolId) external view returns (
        uint256 totalLock,
        uint256 withdrawn,
        uint256 unlockedNow,
        uint256 withdrawableNow,
        uint256 lockStartTime,
        uint256 lockEndTime,
        uint256 unlockEndTime,
        PoolType poolType,
        bool isActive,
        bool emergencyUnlocked
    ) {
        LiquidityPool memory pool = pools[_poolId];
        return (
            pool.totalLocked,
            pool.withdrawnAmount,
            unlockedAmount(_poolId),
            withdrawableAmount(_poolId),
            pool.lockStartTime,
            pool.lockStartTime + pool.lockDuration,
            pool.lockStartTime + pool.lockDuration + pool.unlockDuration,
            pool.poolType,
            pool.isActive,
            pool.emergencyUnlocked
        );
    }

    /**
     * @dev Get all pool IDs
     */
    function getAllPools() external view returns (bytes32[] memory) {
        return poolIds;
    }

    /**
     * @dev Get lock statistics
     */
    function getLockStats() external view returns (
        uint256 totalLock,
        uint256 totalWithdraw,
        uint256 totalUnlocked,
        uint256 totalWithdrawable,
        uint256 poolCount
    ) {
        uint256 unlocked = 0;
        uint256 withdrawable = 0;

        for (uint256 i = 0; i < poolIds.length; i++) {
            bytes32 poolId = poolIds[i];
            unlocked += unlockedAmount(poolId);
            withdrawable += withdrawableAmount(poolId);
        }

        return (
            totalLocked,
            totalWithdrawn,
            unlocked,
            withdrawable,
            poolIds.length
        );
    }

    /**
     * @dev Get time until unlock for a pool
     */
    function timeUntilUnlock(bytes32 _poolId) external view returns (uint256) {
        LiquidityPool memory pool = pools[_poolId];
        uint256 lockEndTime = pool.lockStartTime + pool.lockDuration;
        
        if (block.timestamp >= lockEndTime) {
            return 0;
        }
        
        return lockEndTime - block.timestamp;
    }

    /**
     * @dev Emergency withdraw excess tokens
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = careToken.balanceOf(address(this));
        uint256 locked = totalLocked - totalWithdrawn;
        require(balance > locked, "No excess tokens");
        
        uint256 excess = balance - locked;
        careToken.safeTransfer(owner(), excess);
    }
}
