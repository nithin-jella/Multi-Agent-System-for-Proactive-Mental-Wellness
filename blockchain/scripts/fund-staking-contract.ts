/**
 * Transfer 150M CARE tokens to CareStakingHalal contract
 * 
 * This script transfers the staking allocation (150M CARE) from the
 * CareTokenController to the CareStakingHalal contract.
 * 
 * Requirements:
 * - CareStakingHalal deployed
 * - Deployer has MINTER_ROLE or sufficient CARE balance
 * - Phase 2 staking contracts deployed
 * 
 * Usage:
 * npx hardhat run scripts/fund-staking-contract.ts --network somniaTestnet
 */

import { ethers } from "hardhat";
import { CareToken, CareTokenController, CareStakingHalal } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n💰 Funding CareStakingHalal Contract...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load contract addresses from environment or latest deployment
  let careTokenAddress = process.env.CARE_TOKEN_ADDRESS || "";
  let careTokenControllerAddress = process.env.CARE_TOKEN_CONTROLLER_ADDRESS || "";
  let careStakingHalalAddress = process.env.CARE_STAKING_HALAL_ADDRESS || "";

  // Try to load from latest deployment file if not in env
  if (!careStakingHalalAddress) {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (fs.existsSync(deploymentsDir)) {
      const files = fs.readdirSync(deploymentsDir)
        .filter(f => f.startsWith("phase2-staking-") && f.endsWith(".json"))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const latestDeployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8"));
        careTokenAddress = latestDeployment.config.careToken;
        careTokenControllerAddress = latestDeployment.config.careTokenController;
        careStakingHalalAddress = latestDeployment.careStakingHalal;
        console.log("📂 Loaded addresses from:", files[0]);
      }
    }
  }

  if (!careTokenAddress || !careTokenControllerAddress || !careStakingHalalAddress) {
    throw new Error("❌ Contract addresses not found. Set CARE_TOKEN_ADDRESS, CARE_TOKEN_CONTROLLER_ADDRESS, and CARE_STAKING_HALAL_ADDRESS");
  }

  console.log("📋 Contract Addresses:");
  console.log("  CARE Token:", careTokenAddress);
  console.log("  CARE Controller:", careTokenControllerAddress);
  console.log("  CARE Staking:", careStakingHalalAddress);
  console.log();

  // Get contract instances
  const careToken = await ethers.getContractAt("CareToken", careTokenAddress) as CareToken;
  const careStakingHalal = await ethers.getContractAt("CareStakingHalal", careStakingHalalAddress) as CareStakingHalal;

  // Check allocation
  const ALLOCATION = await careStakingHalal.ALLOCATION();
  console.log(`📊 Required allocation: ${ethers.formatEther(ALLOCATION)} CARE (150M)\n`);

  // Check current balance
  const currentBalance = await careToken.balanceOf(careStakingHalalAddress);
  console.log(`💵 Current staking contract balance: ${ethers.formatEther(currentBalance)} CARE`);

  if (currentBalance >= ALLOCATION) {
    console.log("✅ Staking contract already funded!\n");
    return;
  }

  const amountNeeded = ALLOCATION - currentBalance;
  console.log(`📤 Amount to transfer: ${ethers.formatEther(amountNeeded)} CARE\n`);

  // Check deployer balance
  const deployerBalance = await careToken.balanceOf(deployer.address);
  console.log(`💰 Deployer CARE balance: ${ethers.formatEther(deployerBalance)} CARE`);

  if (deployerBalance < amountNeeded) {
    console.log("⚠️  Deployer doesn't have enough CARE tokens.");
    console.log("   Attempting to mint from CareTokenController...\n");

    try {
      const careTokenController = await ethers.getContractAt("CareTokenController", careTokenControllerAddress) as CareTokenController;
      
      // Check if deployer has COMMUNITY_MINTER_ROLE (required for staking category)
      const COMMUNITY_MINTER_ROLE = await careTokenController.COMMUNITY_MINTER_ROLE();
      const hasMinterRole = await careTokenController.hasRole(COMMUNITY_MINTER_ROLE, deployer.address);
      
      if (!hasMinterRole) {
        throw new Error("❌ Deployer doesn't have COMMUNITY_MINTER_ROLE. Please transfer CARE tokens manually.");
      }

      // Mint staking allocation (COMMUNITY_STAKING category = 1)
      console.log("🏭 Minting 150M CARE for staking (COMMUNITY_STAKING category)...");
      const COMMUNITY_STAKING = 1; // MintCategory.COMMUNITY_STAKING enum value
      const mintTx = await careTokenController.mintForCategory(
        COMMUNITY_STAKING,
        deployer.address,
        amountNeeded,
        "Initial staking contract funding"
      );
      await mintTx.wait();
      console.log("  ✅ Minted successfully");
      console.log("  📝 Mint tx:", mintTx.hash);
      console.log();

      // Update deployer balance
      const newBalance = await careToken.balanceOf(deployer.address);
      console.log(`💰 New deployer balance: ${ethers.formatEther(newBalance)} CARE\n`);
    } catch (error: any) {
      throw new Error(`❌ Failed to mint tokens: ${error.message}`);
    }
  }

  // Transfer tokens to staking contract
  console.log("📤 Transferring CARE tokens to staking contract...");
  const transferTx = await careToken.transfer(careStakingHalalAddress, amountNeeded);
  await transferTx.wait();
  console.log("  ✅ Transfer successful");
  console.log("  📝 Transfer tx:", transferTx.hash);
  console.log();

  // Verify final balance
  const finalBalance = await careToken.balanceOf(careStakingHalalAddress);
  console.log(`💵 Final staking contract balance: ${ethers.formatEther(finalBalance)} CARE`);
  
  if (finalBalance >= ALLOCATION) {
    console.log("✅ Staking contract fully funded!\n");
  } else {
    console.log(`⚠️  Still need ${ethers.formatEther(ALLOCATION - finalBalance)} CARE\n`);
  }

  // Save funding info
  const network = await ethers.provider.getNetwork();
  const fundingInfo = {
    network: network.name,
    timestamp: new Date().toISOString(),
    careStakingHalal: careStakingHalalAddress,
    amountTransferred: ethers.formatEther(amountNeeded),
    finalBalance: ethers.formatEther(finalBalance),
    transactionHash: transferTx.hash,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `staking-funding-${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(fundingInfo, null, 2));

  console.log("💾 Funding info saved to:", filepath);
  console.log();

  console.log("🎉 Funding Complete!\n");
  console.log("🔜 Next Steps:");
  console.log("   1. Users can now stake CARE tokens");
  console.log("   2. Set up backend revenue tracker");
  console.log("   3. Submit first monthly profit report\n");
}

// Execute funding
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Funding failed:", error);
    process.exit(1);
  });
