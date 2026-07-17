'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { useState, useEffect, useMemo } from 'react';

// Polyfill localStorage for server-side rendering
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
}

// Define SOMNIA Testnet (Chain ID: 50312)
const somniaTestnet = defineChain({
  id: 50312,
  name: 'SOMNIA Testnet',
  network: 'somnia-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SOMNIA Testnet Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
    public: { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { 
      name: 'Shannon Explorer', 
      url: 'https://shannon-explorer.somnia.network' 
    },
  },
  testnet: true,
});

// Define SOMNIA Mainnet (Chain ID: 5031)
const somniaMainnet = defineChain({
  id: 5031,
  name: 'SOMNIA',
  network: 'somnia',
  nativeCurrency: {
    decimals: 18,
    name: 'SOMNIA',
    symbol: 'SOMNIA',
  },
  rpcUrls: {
    default: { http: ['https://rpc.somnia.network'] },
    public: { http: ['https://rpc.somnia.network'] },
  },
  blockExplorers: {
    default: { 
      name: 'SOMNIA Explorer', 
      url: 'https://explorer.somnia.network' 
    },
  },
  testnet: false,
});

// Define Open Campus CodeX (EDU Chain Testnet, Chain ID: 656476)
// This is the chain used by the OCID badge smart contracts.
const eduChainTestnet = defineChain({
  id: 656476,
  name: 'Open Campus Codex Sepolia',
  network: 'edu-chain-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'EDU',
    symbol: 'EDU',
  },
  rpcUrls: {
    default: { http: ['https://rpc.open-campus-codex.gelato.digital'] },
    public: { http: ['https://rpc.open-campus-codex.gelato.digital'] },
  },
  blockExplorers: {
    default: {
      name: 'Open Campus Explorer',
      url: 'https://opencampus-codex.blockscout.com',
    },
  },
  testnet: true,
});

// Wagmi configuration with SOMNIA chains
const config = getDefaultConfig({
  appName: 'UGM-AICare',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
  chains: [eduChainTestnet, somniaTestnet, somniaMainnet],
  ssr: true, // Enable Server-Side Rendering for Next.js
});

/**
 * Web3Provider
 * 
 * Wraps the application with wagmi, RainbowKit, and React Query providers.
 * This enables multi-wallet support (MetaMask, WalletConnect, Coinbase Wallet, etc.)
 * 
 * Only mounts on client-side to prevent localStorage access during SSR
 * 
 * @param children - React children to wrap with providers
 */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Create QueryClient instance with useMemo to prevent recreation on hot reload
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Suppress query errors in console during development
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  }), []);

  useEffect(() => {
    try {
      // Verify localStorage is available
      if (typeof window !== 'undefined' && window.localStorage) {
        setMounted(true);
      }
    } catch (err) {
      console.error('Web3Provider initialization error:', err);
      setError(err as Error);
      // Still mount but without wallet functionality
      setMounted(true);
    }
  }, []);

  // Don't render wallet providers during SSR to prevent localStorage errors
  if (!mounted) {
    return <>{children}</>;
  }

  // If there's an error, render children without wallet providers
  if (error) {
    console.warn('Web3 functionality disabled due to initialization error:', error.message);
    return <>{children}</>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
