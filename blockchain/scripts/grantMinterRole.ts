import { ethers } from "hardhat";

/**
 * Script to grant MINTER_ROLE to backend wallet
 * 
 * Usage:
 * npx hardhat run scripts/grantMinterRole.ts --network somniaTestnet
 * 
 * Make sure to set these environment variables:
 * - CARE_TOKEN_ADDRESS: The deployed CARE token contract address
 * - BACKEND_MINTER_WALLET: The wallet address that needs minting permission
 */

async function main() {
  console.log("🔐 Granting MINTER_ROLE to backend wallet...\n");

  // Get parameters from environment
  const contractAddress = process.env.CARE_TOKEN_TESTNET_ADDRESS || process.env.CARE_TOKEN_ADDRESS;
  const backendWallet = process.env.BACKEND_MINTER_WALLET;

  if (!contractAddress) {
    throw new Error("CARE_TOKEN_ADDRESS not set in environment variables");
  }

  if (!backendWallet) {
    throw new Error("BACKEND_MINTER_WALLET not set in environment variables");
  }

  console.log("📋 Configuration:");
  console.log("   Contract Address:", contractAddress);
  console.log("   Backend Wallet:", backendWallet);
  console.log("");

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("📍 Granting from account:", signer.address);

  // Get contract instance
  console.log("🔗 Connecting to CARE token contract...");
  const CareToken = await ethers.getContractFactory("CareToken");
  const careToken = CareToken.attach(contractAddress) as any;

  // Get role bytes
  const MINTER_ROLE = await careToken.MINTER_ROLE();
  const DEFAULT_ADMIN_ROLE = await careToken.DEFAULT_ADMIN_ROLE();

  console.log("🔑 Role identifiers:");
  console.log("   MINTER_ROLE:", MINTER_ROLE);
  console.log("   DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);
  console.log("");

  // Check if signer has admin role
  const hasAdminRole = await careToken.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  if (!hasAdminRole) {
    throw new Error(`❌ Signer ${signer.address} does not have DEFAULT_ADMIN_ROLE. Cannot grant roles.`);
  }
  console.log("✅ Signer has admin privileges");

  // Check if backend already has minter role
  const alreadyHasRole = await careToken.hasRole(MINTER_ROLE, backendWallet);
  if (alreadyHasRole) {
    console.log("⚠️  Backend wallet already has MINTER_ROLE");
    console.log("✅ No action needed");
    return;
  }

  // Grant minter role
  console.log("\n📤 Granting MINTER_ROLE...");
  const tx = await careToken.grantRole(MINTER_ROLE, backendWallet);
  console.log("⏳ Transaction sent:", tx.hash);
  console.log("   Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

  // Verify role was granted
  const hasRole = await careToken.hasRole(MINTER_ROLE, backendWallet);
  console.log("\n🔍 Verification:");
  console.log("   Backend has MINTER_ROLE:", hasRole);

  if (!hasRole) {
    throw new Error("❌ Role grant failed - verification returned false");
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 SUCCESS!");
  console.log("=".repeat(70));
  console.log(`Backend wallet ${backendWallet} now has MINTER_ROLE`);
  console.log("Backend can now mint CARE tokens to reward users");
  console.log("=".repeat(70));

  // Get network info for explorer link
  const network = await ethers.provider.getNetwork();
  const explorerBase = network.chainId === 5031n 
    ? "https://explorer.somnia.network" 
    : "https://shannon-explorer.somnia.network";
  
  console.log(`\n🔍 View transaction: ${explorerBase}/tx/${tx.hash}`);
  console.log(`🔍 View contract: ${explorerBase}/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error granting minter role:");
    console.error(error);
    process.exit(1);
  });
