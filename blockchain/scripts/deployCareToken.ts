import { ethers } from "hardhat";

/**
 * Deploy script for CareToken on SOMNIA blockchain
 * 
 * Usage:
 * - Testnet: npx hardhat run scripts/deployCareToken.ts --network somniaTestnet
 * - Mainnet: npx hardhat run scripts/deployCareToken.ts --network somniaMainnet
 * 
 * Make sure to set environment variables in .env:
 * - SOMNIA_TESTNET_RPC_URL
 * - SOMNIA_MAINNET_RPC_URL
 * - TESTNET_PRIVATE_KEY (for testnet)
 * - MAINNET_PRIVATE_KEY (for mainnet)
 */

async function main() {
  console.log("🚀 Starting CareToken deployment on SOMNIA blockchain...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "SOMI/STT\n");

  // Check network
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId.toString());
  
  let explorerUrl = "";
  if (network.chainId === 5031n) {
    explorerUrl = "https://explorer.somnia.network";
    console.log("✅ Deploying to SOMNIA MAINNET");
  } else if (network.chainId === 50312n) {
    explorerUrl = "https://shannon-explorer.somnia.network";
    console.log("✅ Deploying to SOMNIA TESTNET (Shannon)");
  } else {
    console.log("⚠️  Unknown network");
  }
  console.log("");

  // Deploy parameters
  const INITIAL_SUPPLY = 100_000_000; // 100 million CARE tokens for initial distribution
  
  console.log("📋 Deployment Parameters:");
  console.log("   Token Name: CARE Token");
  console.log("   Token Symbol: CARE");
  console.log("   Initial Supply:", INITIAL_SUPPLY.toLocaleString(), "CARE");
  console.log("   Max Supply: 1,000,000,000 CARE");
  console.log("   Decimals: 18\n");

  // Get contract factory
  console.log("🔨 Compiling and getting CareToken contract factory...");
  const CareToken = await ethers.getContractFactory("CareToken");

  // Deploy contract
  console.log("📤 Deploying CareToken contract...");
  const careToken = await CareToken.deploy(INITIAL_SUPPLY) as any;
  
  console.log("⏳ Waiting for deployment transaction to be mined...");
  await careToken.waitForDeployment();

  const contractAddress = await careToken.getAddress();
  console.log("\n✅ CareToken deployed successfully!");
  console.log("📍 Contract Address:", contractAddress);
  
  if (explorerUrl) {
    console.log("🔍 View on Explorer:", `${explorerUrl}/address/${contractAddress}`);
  }

  // Display token information
  console.log("\n📊 Token Information:");
  const name = await careToken.name();
  const symbol = await careToken.symbol();
  const decimals = await careToken.decimals();
  const totalSupply = await careToken.totalSupply();
  const maxSupply = await careToken.maxSupply();
  const totalMinted = await careToken.totalMinted();
  const remainingMintable = await careToken.remainingMintable();

  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Decimals:", decimals.toString());
  console.log("   Total Supply:", ethers.formatEther(totalSupply), symbol);
  console.log("   Max Supply:", ethers.formatEther(maxSupply), symbol);
  console.log("   Total Minted:", ethers.formatEther(totalMinted), symbol);
  console.log("   Remaining Mintable:", ethers.formatEther(remainingMintable), symbol);

  // Display role information
  console.log("\n🔐 Role Information:");
  const DEFAULT_ADMIN_ROLE = await careToken.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await careToken.MINTER_ROLE();
  const PAUSER_ROLE = await careToken.PAUSER_ROLE();
  
  const hasAdminRole = await careToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  const hasMinterRole = await careToken.hasRole(MINTER_ROLE, deployer.address);
  const hasPauserRole = await careToken.hasRole(PAUSER_ROLE, deployer.address);

  console.log("   Deployer has ADMIN role:", hasAdminRole);
  console.log("   Deployer has MINTER role:", hasMinterRole);
  console.log("   Deployer has PAUSER role:", hasPauserRole);

  // Save deployment info
  console.log("\n💾 Saving deployment information...");
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    initialSupply: INITIAL_SUPPLY,
    maxSupply: 1_000_000_000,
    tokenName: name,
    tokenSymbol: symbol,
    explorerUrl: explorerUrl ? `${explorerUrl}/address/${contractAddress}` : "",
  };

  console.log("\n" + "=".repeat(70));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("=".repeat(70));

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📝 Next Steps:");
  console.log("   1. Save the contract address to your .env file");
  console.log("   2. Update backend configuration with contract address");
  console.log("   3. Verify contract on SOMNIA explorer (if supported)");
  console.log("   4. Grant MINTER_ROLE to backend wallet for reward distribution");
  console.log("   5. Test token functionality (mint, transfer, burn)");
  console.log("   6. Configure frontend to display CARE token balance");
  console.log("\n💡 Example .env entry:");
  console.log(`   CARE_TOKEN_ADDRESS=${contractAddress}`);
  console.log(`   CARE_TOKEN_NETWORK=${network.chainId === 5031n ? "mainnet" : "testnet"}`);
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
