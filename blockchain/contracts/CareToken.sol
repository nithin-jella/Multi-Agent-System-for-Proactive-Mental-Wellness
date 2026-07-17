// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title CareToken
 * @dev $CARE is the utility token for the UGM-AICare ecosystem on SOMNIA blockchain
 * 
 * Features:
 * - ERC20 standard token
 * - Burnable: Users can burn their tokens
 * - Pausable: Admin can pause transfers in emergency situations
 * - AccessControl: Role-based permissions (MINTER_ROLE, PAUSER_ROLE)
 * - Permit: Gasless approvals via EIP-2612
 * - Capped supply: Maximum 1 billion tokens
 * 
 * Use Cases:
 * - Purchase vouchers and real-life goods
 * - Buy event tickets
 * - Unlock premium features in UGM-AICare
 * - Reward users for engagement and mental health activities
 * - Stake for premium benefits
 */
contract CareToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ERC20Permit {
    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Maximum supply: 1 billion CARE tokens (with 18 decimals)
    uint256 private constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    
    // Track total minted to enforce cap
    uint256 private _totalMinted;

    // Events
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);
    event EmergencyPause(address indexed pauser, string reason);
    event EmergencyUnpause(address indexed pauser, string reason);

    /**
     * @dev Constructor - Deploys the CARE token
     * @param initialSupply Initial token supply to mint to deployer (in tokens, not wei)
     */
    constructor(uint256 initialSupply) 
        ERC20("CARE Token", "CARE") 
        ERC20Permit("CARE Token")
    {
        // Grant roles to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Mint initial supply (convert to wei)
        uint256 initialSupplyWei = initialSupply * 10**decimals();
        require(initialSupplyWei <= MAX_SUPPLY, "Initial supply exceeds max supply");
        
        if (initialSupplyWei > 0) {
            _mint(msg.sender, initialSupplyWei);
            _totalMinted = initialSupplyWei;
            emit TokensMinted(msg.sender, initialSupplyWei, "Initial supply");
        }
    }

    /**
     * @dev Mints new tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in wei)
     * @param reason Optional reason for minting (for transparency)
     * 
     * Requirements:
     * - Caller must have MINTER_ROLE
     * - Total minted cannot exceed MAX_SUPPLY
     */
    function mint(address to, uint256 amount, string memory reason) 
        public 
        onlyRole(MINTER_ROLE) 
    {
        require(_totalMinted + amount <= MAX_SUPPLY, "Minting would exceed max supply");
        _totalMinted += amount;
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @dev Convenience function to mint tokens (amount in tokens, not wei)
     * @param to The address to mint tokens to
     * @param tokenAmount The amount of tokens (will be converted to wei)
     * @param reason Optional reason for minting
     */
    function mintTokens(address to, uint256 tokenAmount, string memory reason) 
        public 
        onlyRole(MINTER_ROLE) 
    {
        uint256 amountWei = tokenAmount * 10**decimals();
        mint(to, amountWei, reason);
    }

    /**
     * @dev Burns tokens with a reason (for tracking)
     * @param amount Amount of tokens to burn (in wei)
     * @param reason Reason for burning
     */
    function burnWithReason(uint256 amount, string memory reason) public {
        burn(amount);
        emit TokensBurned(msg.sender, amount, reason);
    }

    /**
     * @dev Pauses all token transfers
     * Only callable by accounts with PAUSER_ROLE
     * Use in emergency situations only
     */
    function pause(string memory reason) public onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @dev Unpauses all token transfers
     * Only callable by accounts with PAUSER_ROLE
     */
    function unpause(string memory reason) public onlyRole(PAUSER_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender, reason);
    }

    /**
     * @dev Returns the maximum supply of CARE tokens
     */
    function maxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @dev Returns the total amount of tokens minted
     */
    function totalMinted() public view returns (uint256) {
        return _totalMinted;
    }

    /**
     * @dev Returns the remaining mintable tokens
     */
    function remainingMintable() public view returns (uint256) {
        return MAX_SUPPLY - _totalMinted;
    }

    // The following functions are overrides required by Solidity

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
