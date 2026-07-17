/**
 * Deploy BSCAttestationRegistry to opBNB Testnet.
 *
 * Usage:
 *   npx hardhat run scripts/deployAttestationOpBNB.ts --network opbnbTestnet
 *
 * NOTE: opBNB Testnet chain ID is 5611, Mainnet is 204
 *
 * Env:
 *   ATTESTATION_ADMIN_ADDRESS=0x... (optional; defaults to deployer)
 *   BACKEND_ATTESTATION_PUBLISHER_ADDRESS=0x... (optional; role grantee)
 */

import { ethers, network } from "hardhat";

async function main() {
  console.log("=== Deploying BSCAttestationRegistry to opBNB ===\n");

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const chain = await ethers.provider.getNetwork();

  console.log(`Network          : ${network.name}`);
  console.log(`Chain ID         : ${chain.chainId}`);
  console.log(`Deployer         : ${deployer.address}`);
  console.log(`Deployer balance : ${ethers.formatEther(deployerBalance)} tBNB\n`);

  const adminAddress = process.env.ATTESTATION_ADMIN_ADDRESS || deployer.address;
  console.log(`Admin address    : ${adminAddress}`);

  const Factory = await ethers.getContractFactory("BSCAttestationRegistry");
  const contract = await Factory.deploy(adminAddress);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`\n✅ BSCAttestationRegistry deployed: ${contractAddress}`);
  console.log(`   Explorer: https://opbnb-testnet.bscscan.com/address/${contractAddress}`);

  const publisherAddress = process.env.BACKEND_ATTESTATION_PUBLISHER_ADDRESS;
  if (publisherAddress) {
    const PUBLISHER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PUBLISHER_ROLE"));
    const tx = await contract.grantRole(PUBLISHER_ROLE, publisherAddress);
    await tx.wait();
    console.log(`✅ PUBLISHER_ROLE granted to ${publisherAddress} (tx: ${tx.hash})`);
  } else {
    console.log("⚠️  BACKEND_ATTESTATION_PUBLISHER_ADDRESS not set, role not granted.");
  }

  console.log("\n=== Deployment complete ===");
  console.log(`Set backend env: OPBNB_ATTESTATION_CONTRACT_ADDRESS=${contractAddress}`);
  console.log("Don't forget to add OPBNB_ATTESTATION_PUBLISHER_PRIVATE_KEY to backend .env");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
