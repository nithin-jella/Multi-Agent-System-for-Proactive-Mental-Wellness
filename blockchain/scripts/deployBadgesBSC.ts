/**
 * Deploy UGMJournalBadges (ERC1155) to BNB Smart Chain.
 *
 * Usage:
 *   npx hardhat run scripts/deployBadgesBSC.ts --network bscTestnet
 *   npx hardhat run scripts/deployBadgesBSC.ts --network bscMainnet
 *
 * After deployment:
 *   1. Copy the contract address to .env as BSC_NFT_CONTRACT_ADDRESS
 *   2. Run grantMinterRoleBSC.ts to authorize the backend minter wallet
 */

import { ethers } from "hardhat";

async function main() {
  console.log("=== Deploying UGMJournalBadges to BNB Smart Chain ===\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer account : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${ethers.formatEther(balance)} BNB\n`);

  // Empty initial base URI; per-token URIs are set via setTokenUri() after publish
  const initialBaseUri = "";

  const BadgeContractFactory = await ethers.getContractFactory("UGMJournalBadges");
  console.log(`Deploying with base URI: "${initialBaseUri}"`);

  const badgeContract = await BadgeContractFactory.deploy(initialBaseUri);
  await badgeContract.waitForDeployment();

  const contractAddress = await badgeContract.getAddress();
  console.log(`\n✅ UGMJournalBadges deployed to: ${contractAddress}`);
  console.log(`   Network: BNB Smart Chain`);
  console.log(`   Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);

  // Grant MINTER_ROLE to backend wallet if env var is set
  const backendMinterAddress = process.env.BACKEND_MINTER_ADDRESS;
  if (backendMinterAddress) {
    console.log(`\nGranting MINTER_ROLE to backend wallet: ${backendMinterAddress}`);
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const tx = await badgeContract.grantRole(MINTER_ROLE, backendMinterAddress);
    await tx.wait();
    console.log(`✅ MINTER_ROLE granted (tx: ${tx.hash})`);
  } else {
    console.log("\n⚠️  BACKEND_MINTER_ADDRESS not set. Remember to grant MINTER_ROLE manually.");
  }

  console.log("\n=== Deployment complete ===");
  console.log("Next steps:");
  console.log(`  1. Add BSC_NFT_CONTRACT_ADDRESS=${contractAddress} to your .env`);
  console.log("  2. Fund the backend minter wallet with tBNB/BNB for gas");
  console.log("  3. Verify on BscScan: npx hardhat verify --network bscTestnet", contractAddress, '""');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
