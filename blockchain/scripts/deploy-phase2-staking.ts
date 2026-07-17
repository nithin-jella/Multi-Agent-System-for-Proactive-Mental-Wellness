/**
 * Deployment Script for Phase 2 Sharia-Compliant Staking Contracts
 * 
 * Deploys:
 * 1. PlatformRevenueOracle.sol - Multi-sig profit reporting
 * 2. CareStakingHalal.sol - Mudarabah profit-sharing staking
 * 
 * Requirements:
 * - CareToken already deployed
 * - CareTokenController already deployed
 * - 5 finance team wallet addresses
 * - At least 1 auditor wallet address
 * - Shariah board wallet address
 * - Admin wallet address
 * 
 * Usage:
 * npx hardhat run scripts/deploy-phase2-staking.ts --network somniaTestnet
 */

import { ethers } from "hardhat";
import { CareToken, CareTokenController, PlatformRevenueOracle, CareStakingHalal } from "../typechain-types";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  careToken: string;
  careTokenController: string;
  admin: string;
  shariahBoard: string;
  financeTeam: string[]; // 5 addresses
  auditors: string[]; // At least 1 address
}

interface DeploymentResult {
  network: string;
  timestamp: string;
  platformRevenueOracle: string;
  careStakingHalal: string;
  config: DeploymentConfig;
  transactions: {
    oracleDeployTx: string;
    stakingDeployTx: string;
    grantOracleRoleTx: string;
  };
}

async function main() {
  console.log("\n🚀 Starting Phase 2 Staking Deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ============ CONFIGURATION ============
  // Load configuration from environment or use defaults
  const config: DeploymentConfig = {
    // Phase 1 contracts (must be already deployed)
    careToken: process.env.CARE_TOKEN_ADDRESS || "",
    careTokenController: process.env.CARE_TOKEN_CONTROLLER_ADDRESS || "",
    
    // Admin & governance addresses
    admin: process.env.ADMIN_ADDRESS || deployer.address,
    shariahBoard: process.env.SHARIAH_BOARD_ADDRESS || deployer.address,
    
    // Finance team (5 members for 3-of-5 multi-sig)
    financeTeam: [
      process.env.FINANCE_TEAM_1 || deployer.address,
      process.env.FINANCE_TEAM_2 || deployer.address,
      process.env.FINANCE_TEAM_3 || deployer.address,
      process.env.FINANCE_TEAM_4 || deployer.address,
      process.env.FINANCE_TEAM_5 || deployer.address,
    ],
    
    // Auditors (at least 1)
    auditors: [
      process.env.AUDITOR_1 || deployer.address,
    ],
  };

  // Validate configuration
  if (!config.careToken) {
    throw new Error("❌ CARE_TOKEN_ADDRESS not set. Deploy Phase 1 contracts first.");
  }
  if (!config.careTokenController) {
    throw new Error("❌ CARE_TOKEN_CONTROLLER_ADDRESS not set. Deploy Phase 1 contracts first.");
  }
  if (config.financeTeam.length !== 5) {
    throw new Error("❌ Must have exactly 5 finance team members.");
  }
  if (config.auditors.length === 0) {
    throw new Error("❌ Must have at least 1 auditor.");
  }

  console.log("📋 Configuration:");
  console.log("  CARE Token:", config.careToken);
  console.log("  CARE Controller:", config.careTokenController);
  console.log("  Admin:", config.admin);
  console.log("  Shariah Board:", config.shariahBoard);
  console.log("  Finance Team:", config.financeTeam.join(", "));
  console.log("  Auditors:", config.auditors.join(", "));
  console.log();

  // Verify CareToken exists
  console.log("🔍 Verifying Phase 1 contracts...");
  const careToken = await ethers.getContractAt("CareToken", config.careToken) as CareToken;
  const tokenName = await careToken.name();
  const tokenSymbol = await careToken.symbol();
  console.log(`  ✅ CareToken found: ${tokenName} (${tokenSymbol})`);
  
  const careTokenController = await ethers.getContractAt("CareTokenController", config.careTokenController) as CareTokenController;
  console.log(`  ✅ CareTokenController found\n`);

  // ============ DEPLOY PLATFORMREVENUEORACLE ============
  console.log("📦 Deploying PlatformRevenueOracle...");
  
  const PlatformRevenueOracle = await ethers.getContractFactory("PlatformRevenueOracle");
  
  // Note: We'll deploy oracle first with placeholder staking address, then update it
  const placeholderStaking = ethers.ZeroAddress;
  const multiSigWallet = config.admin; // In production, use actual multi-sig wallet
  
  const platformRevenueOracle = await PlatformRevenueOracle.deploy(
    placeholderStaking, // Will be set after staking contract deployment
    multiSigWallet,
    config.admin,
    config.financeTeam,
    config.auditors
  ) as PlatformRevenueOracle;

  await platformRevenueOracle.waitForDeployment();
  const oracleAddress = await platformRevenueOracle.getAddress();
  const oracleDeployTx = platformRevenueOracle.deploymentTransaction()?.hash || "";

  console.log("  ✅ PlatformRevenueOracle deployed to:", oracleAddress);
  console.log("  📝 Deployment tx:", oracleDeployTx);
  console.log();

  // ============ DEPLOY CARESTAKINGHALAL ============
  console.log("📦 Deploying CareStakingHalal...");
  
  const CareStakingHalal = await ethers.getContractFactory("CareStakingHalal");
  
  const careStakingHalal = await CareStakingHalal.deploy(
    config.careToken,
    config.careTokenController,
    oracleAddress, // PlatformRevenueOracle address
    config.shariahBoard,
    config.admin
  ) as CareStakingHalal;

  await careStakingHalal.waitForDeployment();
  const stakingAddress = await careStakingHalal.getAddress();
  const stakingDeployTx = careStakingHalal.deploymentTransaction()?.hash || "";

  console.log("  ✅ CareStakingHalal deployed to:", stakingAddress);
  console.log("  📝 Deployment tx:", stakingDeployTx);
  console.log();

  // ============ UPDATE ORACLE WITH STAKING ADDRESS ============
  console.log("🔗 Updating PlatformRevenueOracle with CareStakingHalal address...");
  const updateTx = await platformRevenueOracle.setCareStakingHalal(stakingAddress);
  await updateTx.wait();
  console.log("  ✅ Oracle updated with staking address");
  console.log("  📝 Update tx:", updateTx.hash);
  console.log();

  // ============ VERIFY ROLES ============
  console.log("🔐 Verifying role assignments...");
  
  // Check oracle has REVENUE_ORACLE_ROLE in staking contract
  const REVENUE_ORACLE_ROLE = await careStakingHalal.REVENUE_ORACLE_ROLE();
  const hasOracleRole = await careStakingHalal.hasRole(REVENUE_ORACLE_ROLE, oracleAddress);
  console.log(`  Oracle has REVENUE_ORACLE_ROLE: ${hasOracleRole ? "✅" : "❌"}`);
  
  // Check admin has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await careStakingHalal.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await careStakingHalal.hasRole(DEFAULT_ADMIN_ROLE, config.admin);
  console.log(`  Admin has DEFAULT_ADMIN_ROLE: ${hasAdminRole ? "✅" : "❌"}`);
  
  // Check shariah board has SHARIAH_BOARD_ROLE
  const SHARIAH_BOARD_ROLE = await careStakingHalal.SHARIAH_BOARD_ROLE();
  const hasBoardRole = await careStakingHalal.hasRole(SHARIAH_BOARD_ROLE, config.shariahBoard);
  console.log(`  Shariah Board has SHARIAH_BOARD_ROLE: ${hasBoardRole ? "✅" : "❌"}`);
  console.log();

  // ============ VERIFY INITIAL STATE ============
  console.log("🔍 Verifying initial state...");
  
  const currentMonth = await careStakingHalal.currentMonth();
  console.log(`  Current month: ${currentMonth} (YYYYMM format)`);
  
  const allocation = await careStakingHalal.ALLOCATION();
  console.log(`  Allocation: ${ethers.formatEther(allocation)} CARE (150M expected)`);
  
  const wakalaFee = await careStakingHalal.WAKALA_FEE_BPS();
  console.log(`  Wakala fee: ${wakalaFee} bps (${Number(wakalaFee) / 100}%)`);
  
  // Check tier configurations
  for (let tier = 0; tier < 4; tier++) {
    const tierConfig = await careStakingHalal.stakeTiers(tier);
    const tierNames = ["Bronze", "Silver", "Gold", "Platinum"];
    console.log(`  ${tierNames[tier]} tier: ${ethers.formatEther(tierConfig.minStakeAmount)} CARE min, ${Number(tierConfig.profitShareBPS) / 100}% profit share`);
  }
  console.log();

  // ============ SAVE DEPLOYMENT INFO ============
  const network = await ethers.provider.getNetwork();
  const deploymentResult: DeploymentResult = {
    network: network.name,
    timestamp: new Date().toISOString(),
    platformRevenueOracle: oracleAddress,
    careStakingHalal: stakingAddress,
    config: config,
    transactions: {
      oracleDeployTx,
      stakingDeployTx,
      grantOracleRoleTx: updateTx.hash,
    },
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `phase2-staking-${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentResult, null, 2));

  console.log("💾 Deployment info saved to:", filepath);
  console.log();

  // ============ NEXT STEPS ============
  console.log("✅ Phase 2 Staking Deployment Complete!\n");
  console.log("📋 Contract Addresses:");
  console.log(`   PlatformRevenueOracle: ${oracleAddress}`);
  console.log(`   CareStakingHalal: ${stakingAddress}\n`);
  
  console.log("🔜 Next Steps:");
  console.log("   1. Verify contracts on block explorer");
  console.log("   2. Transfer 150M CARE tokens to staking contract");
  console.log("   3. Set up backend revenue tracker service");
  console.log("   4. Configure CareWellness contract address (when deployed)");
  console.log("   5. Test staking flow end-to-end");
  console.log("   6. Set up multi-sig wallet for finance team");
  console.log("   7. Submit to Shariah Advisory Board for certification\n");

  console.log("📝 Environment Variables for Backend:");
  console.log(`   PLATFORM_REVENUE_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`   CARE_STAKING_HALAL_ADDRESS=${stakingAddress}\n`);

  return deploymentResult;
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
