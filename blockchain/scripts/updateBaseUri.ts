// blockchain/scripts/updateBaseUri.ts
import { ethers } from "hardhat";
import "dotenv/config"; // Make sure dotenv is configured to load your .env file

async function main() {
  // --- Get Configuration from Environment Variables ---
  const contractAddress = process.env.NFT_CONTRACT_ADDRESS; // Get deployed contract address from .env
  // --- !!! IMPORTANT: REPLACE PLACEHOLDER BELOW !!! ---
  // Get the Metadata Folder CID from Pinata (the folder containing 1, 2, 3... files)
  // Ensure it starts with "ipfs://" and ends with "/"
  const newBaseUri = "ipfs://bafybeiczy5433ndoikaj73puzpicmr4juparov7nrkyni375ho76ejq2fy/"; // <<< PASTE YOUR METADATA FOLDER URI HERE

  // --- Input Validation ---
  if (!contractAddress) {
    throw new Error("NFT_CONTRACT_ADDRESS is not set in your .env file. Please add it.");
  }
  // Simple check to prevent running with the placeholder
  if (!newBaseUri || newBaseUri.includes("REPLACE_WITH_YOUR_ACTUAL_METADATA_FOLDER_CID")) {
    throw new Error("Please replace the placeholder with your actual NEW metadata folder CID in the updateBaseUri.ts script.");
  }
  if (!newBaseUri.startsWith("ipfs://") || !newBaseUri.endsWith("/")) {
     console.warn(`WARNING: Base URI "${newBaseUri}" might not be in the standard 'ipfs://<CID>/' format. Ensure it's correct.`);
  }

  console.log(`Target Contract Address: ${contractAddress}`);
  console.log(`New Base URI to set:   ${newBaseUri}`);

  // --- Get Contract Instance ---
  // This assumes your contract artifact name is "UGMJournalBadges"
  console.log("Getting contract factory 'UGMJournalBadges'...");
  const badgeContract = await ethers.getContractAt("UGMJournalBadges", contractAddress);
  console.log("Contract instance obtained.");

  // --- Call setBaseUri Function ---
  // Make sure the wallet associated with TESTNET_PRIVATE_KEY in your .env
  // has the DEFAULT_ADMIN_ROLE on the deployed contract (usually the deployer).
  console.log(`Calling setBaseUri function with "${newBaseUri}"...`);
  const tx = await badgeContract.setBaseUri(newBaseUri);

  console.log(`Update transaction sent! Hash: ${tx.hash}`);
  console.log("Waiting for transaction confirmation (this might take a moment)...");

  // Wait for 1 confirmation (adjust if needed)
  const receipt = await tx.wait(1);

  if (receipt?.status === 1) {
    console.log(`Transaction confirmed! Base URI updated successfully for contract ${contractAddress}.`);

    // --- Optional Verification ---
    try {
        console.log("Verifying new URI by calling contract's uri(1)...");
        const testTokenId = 1; // Check URI for the first badge ID
        const tokenUri = await badgeContract.uri(testTokenId);
        console.log(`URI read back from contract for token ID ${testTokenId}: ${tokenUri}`);
        // Expected output should be similar to "ipfs://<YourMetadataCID>/1"
        if (tokenUri !== `${newBaseUri}${testTokenId}`) {
             console.warn("Warning: URI read back does not perfectly match expected format. Check contract logic and base URI format (trailing slash?).");
        }
    } catch (verifyError) {
         console.error("Could not verify URI via contract call:", verifyError);
    }
    // --- End Optional Verification ---

  } else {
    console.error("Transaction failed! Check the transaction hash on a block explorer.", receipt);
  }
}

// Standard Hardhat pattern: handle errors and exit process
main().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});