// blockchain/scripts/deployPhase1.ts
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Phase 1 Contract Deployment for $CARE Token");
  console.log("═".repeat(60));

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH/SOMI/STT");
  console.log("");

  // Deployment parameters
  const VESTING_START_TIME = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
  const EMERGENCY_AUTHORIZER = deployer.address; // CHANGE THIS TO MULTI-SIG IN PRODUCTION

  // Step 1: Deploy CareToken
  console.log("1️⃣  Deploying CareToken...");
  const INITIAL_SUPPLY = 0; // 0 tokens initially, will mint through controller
  const CareToken = await ethers.getContractFactory("CareToken");
  const careToken = await CareToken.deploy(INITIAL_SUPPLY);
  await careToken.waitForDeployment();
  const careTokenAddress = await careToken.getAddress();
  console.log("✅ CareToken deployed to:", careTokenAddress);
  console.log("   Initial supply:", INITIAL_SUPPLY, "CARE");
  console.log("");

  // Step 2: Deploy CareTokenController
  console.log("2️⃣  Deploying CareTokenController...");
  const CareTokenController = await ethers.getContractFactory("CareTokenController");
  const controller = await CareTokenController.deploy(careTokenAddress);
  await controller.waitForDeployment();
  const controllerAddress = await controller.getAddress();
  console.log("✅ CareTokenController deployed to:", controllerAddress);
  console.log("");

  // Step 3: Deploy CareTeamVesting
  console.log("3️⃣  Deploying CareTeamVesting...");
  const CareTeamVesting = await ethers.getContractFactory("CareTeamVesting");
  const teamVesting = await CareTeamVesting.deploy(careTokenAddress, VESTING_START_TIME);
  await teamVesting.waitForDeployment();
  const teamVestingAddress = await teamVesting.getAddress();
  console.log("✅ CareTeamVesting deployed to:", teamVestingAddress);
  console.log("   Vesting starts:", new Date(VESTING_START_TIME * 1000).toISOString());
  console.log("");

  // Step 4: Deploy CarePartnerVesting
  console.log("4️⃣  Deploying CarePartnerVesting...");
  const CarePartnerVesting = await ethers.getContractFactory("CarePartnerVesting");
  const partnerVesting = await CarePartnerVesting.deploy(careTokenAddress, VESTING_START_TIME);
  await partnerVesting.waitForDeployment();
  const partnerVestingAddress = await partnerVesting.getAddress();
  console.log("✅ CarePartnerVesting deployed to:", partnerVestingAddress);
  console.log("   Vesting starts:", new Date(VESTING_START_TIME * 1000).toISOString());
  console.log("");

  // Step 5: Deploy CareLiquidityLock
  console.log("5️⃣  Deploying CareLiquidityLock...");
  const CareLiquidityLock = await ethers.getContractFactory("CareLiquidityLock");
  const liquidityLock = await CareLiquidityLock.deploy(careTokenAddress, EMERGENCY_AUTHORIZER);
  await liquidityLock.waitForDeployment();
  const liquidityLockAddress = await liquidityLock.getAddress();
  console.log("✅ CareLiquidityLock deployed to:", liquidityLockAddress);
  console.log("   Emergency authorizer:", EMERGENCY_AUTHORIZER);
  console.log("");

  // Step 6: Grant roles
  console.log("6️⃣  Granting roles...");
  
  // Grant MINTER_ROLE to CareTokenController
  const MINTER_ROLE = await careToken.MINTER_ROLE();
  let tx = await careToken.grantRole(MINTER_ROLE, controllerAddress);
  await tx.wait();
  console.log("✅ Granted MINTER_ROLE to CareTokenController");

  // Grant category manager roles to deployer (CHANGE IN PRODUCTION)
  const COMMUNITY_MINTER_ROLE = await controller.COMMUNITY_MINTER_ROLE();
  const WELLNESS_MINTER_ROLE = await controller.WELLNESS_MINTER_ROLE();
  const TEAM_MANAGER_ROLE = await controller.TEAM_MANAGER_ROLE();
  const PARTNER_MANAGER_ROLE = await controller.PARTNER_MANAGER_ROLE();
  const TREASURY_ROLE = await controller.TREASURY_ROLE();
  const LIQUIDITY_MANAGER_ROLE = await controller.LIQUIDITY_MANAGER_ROLE();
  const GRANTS_MANAGER_ROLE = await controller.GRANTS_MANAGER_ROLE();

  tx = await controller.grantRole(COMMUNITY_MINTER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted COMMUNITY_MINTER_ROLE to deployer");

  tx = await controller.grantRole(WELLNESS_MINTER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted WELLNESS_MINTER_ROLE to deployer");

  tx = await controller.grantRole(TEAM_MANAGER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted TEAM_MANAGER_ROLE to deployer");

  tx = await controller.grantRole(PARTNER_MANAGER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted PARTNER_MANAGER_ROLE to deployer");

  tx = await controller.grantRole(TREASURY_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted TREASURY_ROLE to deployer");

  tx = await controller.grantRole(LIQUIDITY_MANAGER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted LIQUIDITY_MANAGER_ROLE to deployer");

  tx = await controller.grantRole(GRANTS_MANAGER_ROLE, deployer.address);
  await tx.wait();
  console.log("✅ Granted GRANTS_MANAGER_ROLE to deployer");
  console.log("");

  // Step 7: Fund vesting contracts (commented out for safety)
  console.log("7️⃣  Funding vesting contracts...");
  console.log("⚠️  SKIPPED - Must be done manually after verification");
  console.log("   Required actions:");
  console.log("   1. Mint 130M CARE to CareTeamVesting");
  console.log("   2. Mint 100M CARE to CarePartnerVesting");
  console.log("   3. Mint 80M CARE to CareLiquidityLock");
  console.log("");

  // Deployment summary
  console.log("═".repeat(60));
  console.log("✨ Phase 1 Deployment Complete!");
  console.log("═".repeat(60));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("   CareToken:", careTokenAddress);
  console.log("   CareTokenController:", controllerAddress);
  console.log("   CareTeamVesting:", teamVestingAddress);
  console.log("   CarePartnerVesting:", partnerVestingAddress);
  console.log("   CareLiquidityLock:", liquidityLockAddress);
  console.log("");
  console.log("⏰ Vesting Timeline:");
  console.log("   Start:", new Date(VESTING_START_TIME * 1000).toLocaleString());
  console.log("   Team cliff ends:", new Date((VESTING_START_TIME + 365 * 24 * 60 * 60) * 1000).toLocaleString(), "(12 months)");
  console.log("   Team vesting ends:", new Date((VESTING_START_TIME + 1460 * 24 * 60 * 60) * 1000).toLocaleString(), "(48 months)");
  console.log("   Partner cliff ends:", new Date((VESTING_START_TIME + 182 * 24 * 60 * 60) * 1000).toLocaleString(), "(6 months)");
  console.log("   Partner vesting ends:", new Date((VESTING_START_TIME + 730 * 24 * 60 * 60) * 1000).toLocaleString(), "(24 months)");
  console.log("   Liquidity unlock starts:", new Date((VESTING_START_TIME + 730 * 24 * 60 * 60) * 1000).toLocaleString(), "(24 months)");
  console.log("   Liquidity fully unlocked:", new Date((VESTING_START_TIME + 912 * 24 * 60 * 60) * 1000).toLocaleString(), "(30 months)");
  console.log("");
  console.log("⚠️  CRITICAL NEXT STEPS:");
  console.log("   1. Verify all contracts on block explorer");
  console.log("   2. Set up multi-sig wallet (Gnosis Safe recommended)");
  console.log("   3. Transfer ownership of all contracts to multi-sig");
  console.log("   4. Fund vesting contracts via CareTokenController");
  console.log("   5. Add beneficiaries/partners to vesting contracts");
  console.log("   6. Get security audit from CertiK/Hacken/OpenZeppelin");
  console.log("   7. Update frontend with contract addresses");
  console.log("   8. Publish addresses on docs/website");
  console.log("");
  console.log("📄 Save this output to docs/CARE_TOKEN/DEPLOYMENT_ADDRESSES.md");
  console.log("═".repeat(60));

  // Generate deployment config for backend
  const deploymentConfig = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    vestingStartTime: VESTING_START_TIME,
    contracts: {
      CareToken: careTokenAddress,
      CareTokenController: controllerAddress,
      CareTeamVesting: teamVestingAddress,
      CarePartnerVesting: partnerVestingAddress,
      CareLiquidityLock: liquidityLockAddress,
    },
    roles: {
      MINTER_ROLE: MINTER_ROLE,
      COMMUNITY_MINTER_ROLE: COMMUNITY_MINTER_ROLE,
      WELLNESS_MINTER_ROLE: WELLNESS_MINTER_ROLE,
      TEAM_MANAGER_ROLE: TEAM_MANAGER_ROLE,
      PARTNER_MANAGER_ROLE: PARTNER_MANAGER_ROLE,
      TREASURY_ROLE: TREASURY_ROLE,
      LIQUIDITY_MANAGER_ROLE: LIQUIDITY_MANAGER_ROLE,
      GRANTS_MANAGER_ROLE: GRANTS_MANAGER_ROLE,
    },
  };

  console.log("\n📦 Deployment Config (copy to backend .env):");
  console.log("CARE_TOKEN_ADDRESS=" + careTokenAddress);
  console.log("CARE_CONTROLLER_ADDRESS=" + controllerAddress);
  console.log("CARE_TEAM_VESTING_ADDRESS=" + teamVestingAddress);
  console.log("CARE_PARTNER_VESTING_ADDRESS=" + partnerVestingAddress);
  console.log("CARE_LIQUIDITY_LOCK_ADDRESS=" + liquidityLockAddress);
  console.log("");
  
  return deploymentConfig;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
