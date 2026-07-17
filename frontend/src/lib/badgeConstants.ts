// frontend/src/lib/badgeConstants.ts

// --- Configuration ---
// const IMAGE_FOLDER_CID = "bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu"; // <<< REPLACE WITH YOUR ACTUAL IMAGE FOLDER CID
// ----------------------------------------------------------------
export const DEFAULT_BADGE_PLACEHOLDER_IMAGE = '/nft-asset/badge-placeholder.svg'; // Local fallback image

// --- Interface for Badge Metadata ---
export interface BadgeMeta {
    name: string;
    image: string; // Should be the ipfs:// URI
    description: string;
    attributes?: {
        trait_type: string;
        value: string | number;
        display_type?: string;
    }[];
}

// --- Badge Metadata Map ---
// Maps Badge ID (number) to its metadata
export const badgeMetadataMap: { [key: number]: BadgeMeta } = {
    1: {
        "name": "Let there be badge",
        "description": "Awarded for the first recorded journal entry or chat activity in UGM-AICare. Welcome!",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/let_there_be_badge.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Initiation"
          },
          {
            "trait_type": "Milestone",
            "value": "First Activity"
          }
        ]
      },
    2: {
        "name": "Triple Threat (of Thoughts!)",
        "description": "Awarded for recording activity (journal or chat) on 3 separate days.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/triple_threat_of_thoughts.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Consistency"
          },
          {
            "trait_type": "Milestone",
            "value": "3 Active Days"
          }
        ]
      },
    3: {
        "name": "Seven Days a Week",
        "description": "Awarded for maintaining a 7-day consecutive activity streak.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/seven_days_a_week.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Streak"
          },
          {
            "trait_type": "Duration",
            "value": "7 Days"
          }
        ]
      },
    4: {
        "name": "Two Weeks Notice (You Gave to Negativity?)",
        "description": "Awarded for maintaining a 14-day consecutive activity streak.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/two_weeks_notice_you_gave_to_negativity.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Streak"
          },
          {
            "trait_type": "Duration",
            "value": "14 Days"
          }
        ]
      },
    5: {
        "name": "Full Moon Positivity",
        "description": "Awarded for maintaining a 30-day consecutive activity streak. Amazing consistency!",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/full_moon_positivity.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Streak"
          },
          {
            "trait_type": "Duration",
            "value": "30 Days"
          }
        ]
      },
    6: {
        "name": "Quarter Century (of Journaling!)",
        "description": "Awarded for writing 25 journal entries.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/quarter_century_of_journaling.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Milestone"
          },
          {
            "trait_type": "Activity",
            "value": "Journaling"
          },
          {
            "display_type": "number",
            "trait_type": "Entries",
            "value": 25
          }
        ]
      },
    7: {
        "name": "Unleash the Words!",
        "description": "Awarded for writing a single journal entry longer than 500 words.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/unleash_the_words.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Engagement"
          },
          {
            "trait_type": "Activity",
            "value": "Journaling"
          },
          {
            "trait_type": "Detail",
            "value": "Long Entry"
          }
        ]
      },
    8: {
        "name": "Besties!",
        "description": "Awarded for having a single continuous chat session with Aika containing over 100 messages.",
        "image": "ipfs://bafybeidzdbsjft24ujpcn77hfkbhom7tmo5i5p2aqfsig2vtxvt3kd7jbu/besties.jpeg",
        "attributes": [
          {
            "trait_type": "Category",
            "value": "Interaction"
          },
          {
            "trait_type": "Activity",
            "value": "Chatting"
          },
          {
            "trait_type": "Detail",
            "value": "Extended Session"
          }
        ]
      }
    // Add more badges as needed
};

// --- IPFS Gateway Helper Function ---
// Converts ipfs:// URI to a usable HTTPS URL
export const getIpfsUrl = (ipfsUri: string | undefined | null): string => {
    if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) {
        return DEFAULT_BADGE_PLACEHOLDER_IMAGE; // Return local placeholder if URI invalid
    }
    // Use a reliable public gateway or Pinata's gateway
    const cidAndPath = ipfsUri.substring('ipfs://'.length);
    // return `https://ipfs.io/ipfs/${cidAndPath}`;
    return `https://cyan-certain-crane-60.mypinata.cloud/ipfs/${cidAndPath}`;
};

// Helper to get metadata safely
export const getBadgeMeta = (badgeId: number): BadgeMeta => {
    return badgeMetadataMap[badgeId] || {
        name: `Badge #${badgeId}`,
        image: '', // No image URI if unknown
        description: 'An unknown achievement badge.'
    };
};

// ---------------------------------------------------------------------------
// Multi-chain explorer mapping
// Updated for BNB Chain hackathon: BSC Testnet as primary, added opBNB support
// NOTE: opBNB Testnet chain ID is 5611, Mainnet is 204
// ---------------------------------------------------------------------------

/** Known chain ID to explorer base URL mapping. */
export const CHAIN_EXPLORER_MAP: Record<number, string> = {
    656476: 'https://edu-chain-testnet.blockscout.com',  // EDU Chain Testnet
    97:     'https://testnet.bscscan.com',                // BNB Smart Chain Testnet
    56:     'https://bscscan.com',                        // BNB Smart Chain Mainnet
    5611:   'https://opbnb-testnet.bscscan.com',          // opBNB Testnet
};

/** Short display names per chain. */
export const CHAIN_SHORT_NAME_MAP: Record<number, string> = {
    656476: 'EDU',
    97:     'BNB',
    56:     'BNB',
    5611:   'opBNB',
};

/**
 * Build a block-explorer transaction URL for a given chain + tx hash.
 * HACKATHON: Falls back to BSC Testnet (97) if chain is unknown.
 * TODO: Make fallback configurable via environment
 */
export const getExplorerTxUrl = (chainId: number | undefined, txHash: string): string => {
    const base = CHAIN_EXPLORER_MAP[chainId ?? 97] ?? CHAIN_EXPLORER_MAP[97];
    return `${base}/tx/${txHash}`;
};

/**
 * Get a short display name for a chain (e.g. "EDU", "BNB", "opBNB").
 * HACKATHON: Falls back to BSC Testnet (97) if chain is unknown.
 */
export const getChainShortName = (chainId: number | undefined): string => {
    return CHAIN_SHORT_NAME_MAP[chainId ?? 97] ?? 'EVM';
};