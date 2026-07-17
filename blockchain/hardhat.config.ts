// blockchain/hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

// --- Environment Variables ---
const eduTestnetRpcUrl = process.env.EDU_TESTNET_RPC_URL;
const somniaMainnetRpcUrl = process.env.SOMNIA_MAINNET_RPC_URL;
const somniaTestnetRpcUrl = process.env.SOMNIA_TESTNET_RPC_URL;
const bscTestnetRpcUrl = process.env.BSC_TESTNET_RPC_URL;
const bscMainnetRpcUrl = process.env.BSC_MAINNET_RPC_URL;
const opbnbTestnetRpcUrl = process.env.OPBNB_TESTNET_RPC_URL;
const privateKey = process.env.TESTNET_PRIVATE_KEY;
const mainnetPrivateKey = process.env.MAINNET_PRIVATE_KEY;

// Warn on missing keys so deployments fail fast with a clear message
const warnIfMissing = (name: string, value: string | undefined) => {
  if (!value) console.warn(`${name} environment variable not set.`);
};

warnIfMissing("EDU_TESTNET_RPC_URL", eduTestnetRpcUrl);
warnIfMissing("SOMNIA_MAINNET_RPC_URL", somniaMainnetRpcUrl);
warnIfMissing("SOMNIA_TESTNET_RPC_URL", somniaTestnetRpcUrl);
warnIfMissing("BSC_TESTNET_RPC_URL", bscTestnetRpcUrl);
warnIfMissing("BSC_MAINNET_RPC_URL", bscMainnetRpcUrl);
warnIfMissing("OPBNB_TESTNET_RPC_URL", opbnbTestnetRpcUrl);
warnIfMissing("TESTNET_PRIVATE_KEY", privateKey);
warnIfMissing("MAINNET_PRIVATE_KEY", mainnetPrivateKey);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {},

    // --- EDU Chain (Badge NFTs - original deployment) ---
    eduTestnet: {
      url: eduTestnetRpcUrl || "",
      chainId: 656476,
      accounts: privateKey ? [`0x${privateKey}`] : [],
    },

    // --- SOMNIA (CARE Token ecosystem) ---
    somniaMainnet: {
      url: somniaMainnetRpcUrl || "https://api.infra.mainnet.somnia.network/",
      chainId: 5031,
      accounts: mainnetPrivateKey ? [`0x${mainnetPrivateKey}`] : [],
      gasPrice: "auto",
    },
    somniaTestnet: {
      url: somniaTestnetRpcUrl || "https://dream-rpc.somnia.network/",
      chainId: 50312,
      accounts: privateKey ? [`0x${privateKey}`] : [],
      gasPrice: "auto",
    },

    // --- BNB Smart Chain (Badge NFTs - multi-chain expansion) ---
    bscTestnet: {
      url: bscTestnetRpcUrl || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts: privateKey ? [`0x${privateKey}`] : [],
      gasPrice: "auto",
    },
    bscMainnet: {
      url: bscMainnetRpcUrl || "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts: mainnetPrivateKey ? [`0x${mainnetPrivateKey}`] : [],
      gasPrice: "auto",
    },

    // --- opBNB (L2 on BNB Chain)
    // NOTE: opBNB Testnet chain ID is 5611, Mainnet is 204
    opbnbTestnet: {
      url: opbnbTestnetRpcUrl || "https://opbnb-testnet-rpc.bnbchain.org",
      chainId: 5611,
      accounts: privateKey ? [`0x${privateKey}`] : [],
      gasPrice: "auto",
    },
  },
  // Optional: Add Etherscan verification config later
  // Note: SOMNIA uses its own explorer, verification may require custom setup
  // etherscan: { 
  //   apiKey: {
  //     somniaMainnet: process.env.SOMNIA_EXPLORER_API_KEY || "",
  //     somniaTestnet: process.env.SOMNIA_EXPLORER_API_KEY || "",
  //   },
  //   customChains: [
  //     {
  //       network: "somniaMainnet",
  //       chainId: 5031,
  //       urls: {
  //         apiURL: "https://explorer.somnia.network/api",
  //         browserURL: "https://explorer.somnia.network"
  //       }
  //     },
  //     {
  //       network: "somniaTestnet",
  //       chainId: 50312,
  //       urls: {
  //         apiURL: "https://shannon-explorer.somnia.network/api",
  //         browserURL: "https://shannon-explorer.somnia.network"
  //       }
  //     }
  //   ]
  // }
};

export default config;