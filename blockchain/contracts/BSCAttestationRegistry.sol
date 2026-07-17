// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BSCAttestationRegistry is AccessControl {
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    struct Attestation {
        bytes32 payloadHash;
        uint256 actionId;
        address publisher;
        address subject;
        uint64 publishedAt;
        string schema;
        string metadataURI;
    }

    mapping(bytes32 => Attestation) private _attestations;
    mapping(bytes32 => bool) private _exists;
    mapping(address => uint256) private _publisherPublishedCount;

    uint256 public totalPublished;
    uint64 public lastPublishedAt;

    event AttestationPublished(
        bytes32 indexed attestationId,
        bytes32 indexed payloadHash,
        uint256 indexed actionId,
        address publisher,
        address subject,
        string schema,
        string metadataURI,
        uint64 publishedAt
    );

    constructor(address admin) {
        address effectiveAdmin = admin == address(0) ? msg.sender : admin;
        _grantRole(DEFAULT_ADMIN_ROLE, effectiveAdmin);
        _grantRole(PUBLISHER_ROLE, effectiveAdmin);
    }

    function publishAttestation(
        bytes32 attestationId,
        bytes32 payloadHash,
        uint256 actionId,
        address subject,
        string calldata schema,
        string calldata metadataURI
    ) external onlyRole(PUBLISHER_ROLE) {
        require(attestationId != bytes32(0), "invalid attestation id");
        require(payloadHash != bytes32(0), "invalid payload hash");
        require(!_exists[attestationId], "attestation exists");

        uint64 timestamp = uint64(block.timestamp);
        _attestations[attestationId] = Attestation({
            payloadHash: payloadHash,
            actionId: actionId,
            publisher: msg.sender,
            subject: subject,
            publishedAt: timestamp,
            schema: schema,
            metadataURI: metadataURI
        });
        _exists[attestationId] = true;
        totalPublished += 1;
        _publisherPublishedCount[msg.sender] += 1;
        lastPublishedAt = timestamp;

        emit AttestationPublished(
            attestationId,
            payloadHash,
            actionId,
            msg.sender,
            subject,
            schema,
            metadataURI,
            timestamp
        );
    }

    function getAttestation(bytes32 attestationId)
        external
        view
        returns (
            bool exists,
            bytes32 payloadHash,
            uint256 actionId,
            address publisher,
            address subject,
            uint64 publishedAt,
            string memory schema,
            string memory metadataURI
        )
    {
        exists = _exists[attestationId];
        if (!exists) {
            return (false, bytes32(0), 0, address(0), address(0), 0, "", "");
        }

        Attestation memory item = _attestations[attestationId];
        return (
            true,
            item.payloadHash,
            item.actionId,
            item.publisher,
            item.subject,
            item.publishedAt,
            item.schema,
            item.metadataURI
        );
    }

    function hasAttestation(bytes32 attestationId) external view returns (bool) {
        return _exists[attestationId];
    }

    function getPublisherPublishedCount(address publisher) external view returns (uint256) {
        return _publisherPublishedCount[publisher];
    }

    function getRegistryStats() external view returns (uint256 _totalPublished, uint64 _lastPublishedAt) {
        return (totalPublished, lastPublishedAt);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
