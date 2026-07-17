"use client";

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

/**
 * useDIDLogin Hook
 * 
 * Provides decentralized identity (DID) login functionality using wallet signatures.
 * Works with any wallet supported by wagmi/RainbowKit (100+ wallets).
 * 
 * Features:
 * - Multi-wallet support (MetaMask, WalletConnect, Coinbase, etc.)
 * - Sign-In with Ethereum (SIWE) pattern
 * - Type-safe with TypeScript
 * 
 * @returns {Object} Hook interface
 * @returns {Function} loginWithDID - Initiates DID login flow
 * @returns {boolean} isLoggingIn - Loading state during login
 * @returns {boolean} isConnected - Wallet connection status
 * @returns {string | undefined} address - Connected wallet address
 * @returns {string | null} token - JWT token after successful login
 */
export const useDIDLogin = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const loginWithDID = async () => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected. Please connect your wallet first.');
    }

    setIsLoggingIn(true);

    try {
      // Create message with timestamp for replay protection
      const timestamp = Date.now();
      const message = `Login to UGM-AICare as ${address} at ${timestamp}`;

      // Sign message with connected wallet
      const signature = await signMessageAsync({ message });

      // Send to backend for verification
      const response = await fetch('/api/did-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature,
          address,
          timestamp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store token
      if (data.token) {
        setToken(data.token);
        localStorage.setItem('aicare_token', data.token);
      }

      return {
        token: data.token,
        address: data.address,
      };
    } catch (error: unknown) {
      console.error('DID login error:', error);
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  };

  return {
    loginWithDID,
    isLoggingIn,
    isConnected,
    address,
    token,
  };
};



