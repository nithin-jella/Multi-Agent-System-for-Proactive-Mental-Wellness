// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // Use a recent Solidity version supported by Hardhat/EDUChain

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol"; // If needed for URI generation

contract UGMJournalBadges is ERC1155, AccessControl {
    // Role definition for who can mint new badges
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Mapping to store specific metadata URIs per badge ID (optional, improves flexibility)
    mapping(uint256 => string) private _tokenURIs;

    // Base URI (if metadata follows a pattern like ipfs://<CID>/{id}.json) - set in constructor
    string private _baseURI = "";

    // --- Events ---
    event BadgeMinted(address indexed recipient, uint256 indexed badgeId, uint256 amount);
    event TokenUriSet(uint256 indexed badgeId, string uri);
    event BaseUriSet(string uri);

    // --- Constructor ---
    constructor(string memory initialBaseUri) ERC1155(initialBaseUri) {
        _baseURI = initialBaseUri; // Store base URI if used
        // Grant the contract deployer the MINTER_ROLE and DEFAULT_ADMIN_ROLE initially
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // --- Minting Function (for Backend) ---
    // Mints 'amount' copies of 'badgeId' to the 'recipient'
    // Only accounts with MINTER_ROLE can call this
    function mintBadge(address recipient, uint256 badgeId, uint256 amount)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(recipient, badgeId, amount, ""); // The empty bytes data is unused here
        emit BadgeMinted(recipient, badgeId, amount);
    }

    // --- Metadata URI Management (Optional but Recommended) ---

    // Override ERC1155's uri function to support per-token URIs and a base URI
    function uri(uint256 badgeId) public view override returns (string memory) {
        string memory specificURI = _tokenURIs[badgeId];

        // If a specific URI is set for this ID, return it
        if (bytes(specificURI).length > 0) {
            return specificURI;
        }

        // Otherwise, try to construct from base URI (e.g., baseURI/{id}.json)
        // Requires _baseURI to be set and ideally end with '/' or handle concatenation appropriately
        if (bytes(_baseURI).length > 0) {
             // Simple concatenation (adjust if using hex IDs etc.)
             // Consider using Strings.toString(badgeId) if needed
            return string(abi.encodePacked(_baseURI, Strings.toString(badgeId), ".json"));
        }

        // Fallback if no specific or base URI is set
        return "";
    }

    // Function for admin/owner to set a specific URI for a badge ID
    function setTokenUri(uint256 badgeId, string memory newUri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _tokenURIs[badgeId] = newUri;
        emit TokenUriSet(badgeId, newUri);
    }

     // Function for admin/owner to update the base URI
    function setBaseUri(string memory newBaseUri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseURI = newBaseUri;
        emit BaseUriSet(newBaseUri);
    }


    // --- Role Management (from AccessControl) ---
    // Add functions here if you need to grant/revoke MINTER_ROLE to other backend wallets later.
    // function grantMinterRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
    //     grantRole(MINTER_ROLE, minter);
    // }
    // function revokeMinterRole(address minter) public onlyRole(DEFAULT_ADMIN_ROLE) {
    //     revokeRole(MINTER_ROLE, minter);
    // }

    // --- Required by OpenZeppelin ERC1155 & AccessControl ---
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}