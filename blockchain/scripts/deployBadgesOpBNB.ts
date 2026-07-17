/**
 * Deploy UGMJournalBadges (ERC1155) to opBNB Testnet.
 *
 * Usage:
 *   npx hardhat run scripts/deployBadgesOpBNB.ts --network opbnbTestnet
 *
 * NOTE: opBNB Testnet chain ID is 5611, Mainnet is 204
 *
 * After deployment:
 *   1. Copy the contract address to .env as OPBNB_NFT_CONTRACT_ADDRESS
 *   2. Run grantMinterRoleOpBNB.ts to authorize the backend minter wallet
 */

import { ethers, network } from "hardhat";

async function main() {
  console.log("=== Deploying UGMJournalBadges to opBNB ===\n");

  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();

  console.log(`Network          : ${network.name}`);
  console.log(`Chain ID         : ${chain.chainId}`);
  console.log(`Deployer         : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${ethers.formatEther(balance)} tBNB\n`);

  // Empty initial base URI; per-token URIs are set via setTokenUri() after publish
  const initialBaseUri = "";

  const BadgeContractFactory = await ethers.getContractFactory("UGMJournalBadges");
  console.log(`Deploying with base URI: "${initialBaseUri}"`);

  const badgeContract = await BadgeContractFactory.deploy(initialBaseUri);
  await badgeContract.waitForDeployment();

  const contractAddress = await badgeContract.getAddress();
  console.log(`\n✅ UGMJournalBadges deployed to: ${contractAddress}`);
  console.log(`   Network: opBNB Testnet`);
  console.log(`   Chain ID: ${chain.chainId}`);
  console.log(`   Explorer: https://opbnb-testnet.bscscan.com/address/${contractAddress}`);

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
  console.log(`  1. Add OPBNB_NFT_CONTRACT_ADDRESS=${contractAddress} to your .env`);
  console.log("  2. Fund the backend minter wallet with tBNB for gas");
  console.log("  3. Add OPBNB_MINTER_PRIVATE_KEY to backend .env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
