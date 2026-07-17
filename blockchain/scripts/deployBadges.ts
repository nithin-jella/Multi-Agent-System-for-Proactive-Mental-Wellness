// blockchain/scripts/deployBadges.ts
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying UGMJournalBadges contract...");

  // **IMPORTANT**: Define your initial Base URI for the NFT metadata.
  // This often points to an IPFS folder containing your JSON metadata files,
  // structured so the token ID can be appended (e.g., "ipfs://YOUR_CID_HERE/").
  // For initial testing, you can use a placeholder, but update it later.
  const initialBaseUri = "" // "ipfs://METADATA_CID/"; //! <<< CHANGE TO IPFS SOMETIME LATER!

  // Get the contract factory
  const BadgeContractFactory = await ethers.getContractFactory("UGMJournalBadges");

  // Start the deployment, passing constructor arguments
  console.log(`Deploying with Base URI: ${initialBaseUri}`);
  const badgeContract = await BadgeContractFactory.deploy(initialBaseUri);

  // Wait for the deployment transaction to be mined and confirmed
  await badgeContract.waitForDeployment();

  // Get the deployed contract address
  const contractAddress = await badgeContract.getAddress();
  console.log(`UGMJournalBadges deployed to: ${contractAddress}`);

  // Optional: Log the deployer address
  const [deployer] = await ethers.getSigners();
  console.log(`Deployed by account: ${deployer.address}`);

  // Optional: You might want to grant the MINTER_ROLE to your backend wallet here
  // if the deployer wallet is different from the backend minter wallet.
  // const backendMinterAddress = process.env.BACKEND_MINTER_WALLET_ADDRESS;
  // if (backendMinterAddress) {
  //   console.log(`Granting MINTER_ROLE to ${backendMinterAddress}...`);
  //   const minterRole = await badgeContract.MINTER_ROLE();
  //   const tx = await badgeContract.grantRole(minterRole, backendMinterAddress);
  //   await tx.wait(); // Wait for the transaction to be mined
  //   console.log(`MINTER_ROLE granted to ${backendMinterAddress}`);
  // } else {
  //    console.warn("BACKEND_MINTER_WALLET_ADDRESS not set in .env - MINTER_ROLE only held by deployer.");
  // }

}

// Standard Hardhat pattern: handle errors and exit process
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});