/**
 * Deploy BSCAttestationRegistry to BNB Smart Chain.
 *
 * Usage:
 *   npx hardhat run scripts/deployAttestationBSC.ts --network bscTestnet
 *   npx hardhat run scripts/deployAttestationBSC.ts --network bscMainnet
 *
 * Env:
 *   ATTESTATION_ADMIN_ADDRESS=0x... (optional; defaults to deployer)
 *   BACKEND_ATTESTATION_PUBLISHER_ADDRESS=0x... (optional; role grantee)
 */

import { ethers, network } from "hardhat";

async function main() {
  console.log("=== Deploying BSCAttestationRegistry ===\n");

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const chain = await ethers.provider.getNetwork();

  console.log(`Network          : ${network.name}`);
  console.log(`Chain ID         : ${chain.chainId}`);
  console.log(`Deployer         : ${deployer.address}`);
  console.log(`Deployer balance : ${ethers.formatEther(deployerBalance)} BNB\n`);

  const adminAddress = process.env.ATTESTATION_ADMIN_ADDRESS || deployer.address;
  console.log(`Admin address    : ${adminAddress}`);

  const Factory = await ethers.getContractFactory("BSCAttestationRegistry");
  const contract = await Factory.deploy(adminAddress);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`\n✅ BSCAttestationRegistry deployed: ${contractAddress}`);

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
  if (chain.chainId === 97n) {
    console.log(`Set backend env: BSC_ATTESTATION_CONTRACT_ADDRESS=${contractAddress}`);
  } else if (chain.chainId === 56n) {
    console.log(`Set backend env: BSC_MAINNET_ATTESTATION_CONTRACT_ADDRESS=${contractAddress}`);
  } else {
    console.log("Unexpected chain id for BSC deployment.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
