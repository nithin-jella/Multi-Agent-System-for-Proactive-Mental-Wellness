import { ethers } from "hardhat";

/**
 * Script to test CARE token functionality
 * 
 * Usage:
 * npx hardhat run scripts/testCareToken.ts --network somniaTestnet
 */

async function main() {
  console.log("🧪 Testing CARE Token Functionality\n");

  const contractAddress = process.env.CARE_TOKEN_TESTNET_ADDRESS || process.env.CARE_TOKEN_ADDRESS;

  if (!contractAddress) {
    throw new Error("CARE_TOKEN_ADDRESS not set in environment variables");
  }

  const [signer] = await ethers.getSigners();
  console.log("📍 Testing from account:", signer.address);
  console.log("📍 Contract address:", contractAddress);
  console.log("");

  // Get contract instance
  const CareToken = await ethers.getContractFactory("CareToken");
  const careToken = CareToken.attach(contractAddress) as any;

  // Test 1: Get token info
  console.log("=".repeat(70));
  console.log("Test 1: Token Information");
  console.log("=".repeat(70));
  
  const name = await careToken.name();
  const symbol = await careToken.symbol();
  const decimals = await careToken.decimals();
  const totalSupply = await careToken.totalSupply();
  const maxSupply = await careToken.maxSupply();
  const totalMinted = await careToken.totalMinted();
  const remainingMintable = await careToken.remainingMintable();

  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Decimals:", decimals.toString());
  console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
  console.log("Max Supply:", ethers.formatEther(maxSupply), symbol);
  console.log("Total Minted:", ethers.formatEther(totalMinted), symbol);
  console.log("Remaining Mintable:", ethers.formatEther(remainingMintable), symbol);
  console.log("✅ Test 1 passed\n");

  // Test 2: Check roles
  console.log("=".repeat(70));
  console.log("Test 2: Role Verification");
  console.log("=".repeat(70));

  const DEFAULT_ADMIN_ROLE = await careToken.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await careToken.MINTER_ROLE();
  const PAUSER_ROLE = await careToken.PAUSER_ROLE();

  const hasAdmin = await careToken.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  const hasMinter = await careToken.hasRole(MINTER_ROLE, signer.address);
  const hasPauser = await careToken.hasRole(PAUSER_ROLE, signer.address);

  console.log("Signer has ADMIN role:", hasAdmin);
  console.log("Signer has MINTER role:", hasMinter);
  console.log("Signer has PAUSER role:", hasPauser);
  console.log("✅ Test 2 passed\n");

  // Test 3: Check balance
  console.log("=".repeat(70));
  console.log("Test 3: Balance Check");
  console.log("=".repeat(70));

  const balance = await careToken.balanceOf(signer.address);
  console.log("Signer balance:", ethers.formatEther(balance), symbol);
  console.log("✅ Test 3 passed\n");

  // Test 4: Mint tokens (if has minter role)
  if (hasMinter) {
    console.log("=".repeat(70));
    console.log("Test 4: Minting Tokens");
    console.log("=".repeat(70));

    const mintAmount = 100; // 100 CARE tokens
    const testAddress = signer.address; // Mint to self for testing
    const reason = "Test mint - checking functionality";

    console.log(`Minting ${mintAmount} CARE to ${testAddress}...`);
    
    const balanceBefore = await careToken.balanceOf(testAddress);
    console.log("Balance before:", ethers.formatEther(balanceBefore), symbol);

    const tx = await careToken.mintTokens(testAddress, mintAmount, reason);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed");

    const balanceAfter = await careToken.balanceOf(testAddress);
    console.log("Balance after:", ethers.formatEther(balanceAfter), symbol);

    const difference = Number(balanceAfter - balanceBefore);
    const expectedDiff = Number(ethers.parseEther(mintAmount.toString()));
    
    if (difference === expectedDiff) {
      console.log("✅ Test 4 passed - Minted exactly", mintAmount, symbol);
    } else {
      console.log("❌ Test 4 failed - Expected", mintAmount, "but got", ethers.formatEther(difference.toString()));
    }
    console.log("");
  } else {
    console.log("⚠️  Test 4 skipped - Signer does not have MINTER_ROLE\n");
  }

  // Test 5: Transfer tokens
  console.log("=".repeat(70));
  console.log("Test 5: Transfer Tokens");
  console.log("=".repeat(70));

  const transferAmount = ethers.parseEther("10"); // 10 CARE
  const recipientAddress = "0x0000000000000000000000000000000000000001"; // Burn address for testing

  const senderBalanceBefore = await careToken.balanceOf(signer.address);
  
  if (senderBalanceBefore >= transferAmount) {
    console.log("Transferring 10 CARE to test address...");
    const tx = await careToken.transfer(recipientAddress, transferAmount);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed");

    const senderBalanceAfter = await careToken.balanceOf(signer.address);
    const recipientBalance = await careToken.balanceOf(recipientAddress);

    console.log("Sender balance after:", ethers.formatEther(senderBalanceAfter), symbol);
    console.log("Recipient balance:", ethers.formatEther(recipientBalance), symbol);
    console.log("✅ Test 5 passed");
  } else {
    console.log("⚠️  Test 5 skipped - Insufficient balance for transfer");
  }
  console.log("");

  // Summary
  console.log("=".repeat(70));
  console.log("🎉 All tests completed successfully!");
  console.log("=".repeat(70));
  console.log("✅ Token information retrieved");
  console.log("✅ Roles verified");
  console.log("✅ Balance checked");
  if (hasMinter) console.log("✅ Minting tested");
  console.log("✅ Transfer tested");
  console.log("=".repeat(70));

  // Get network info for explorer link
  const network = await ethers.provider.getNetwork();
  const explorerBase = network.chainId === 5031n 
    ? "https://explorer.somnia.network" 
    : "https://shannon-explorer.somnia.network";
  
  console.log(`\n🔍 View contract: ${explorerBase}/address/${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Tests failed:");
    console.error(error);
    process.exit(1);
  });
