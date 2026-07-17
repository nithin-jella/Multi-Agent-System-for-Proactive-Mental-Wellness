"use client";

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useOCAuth } from '@opencampus/ocid-connect-js';
import { useAccount, useSignMessage } from 'wagmi';
import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { FiCheckCircle, FiLink, FiLoader, FiUser } from 'react-icons/fi';
import apiClient from '@/services/api';

/**
 * WalletLinkButton
 *
 * Provides two flows for linking a Web3 identity to a UGM-AICare account:
 *
 *  1. Open Campus ID (primary) — PKCE-based OAuth via the OCID SDK. Produces
 *     a verified id_token that the backend exchanges for an eth_address + OCId.
 *     This is the recommended path for students with an Open Campus account.
 *
 *  2. Generic wallet (fallback) — RainbowKit + sign-in-with-Ethereum pattern for
 *     users who do not have an Open Campus ID but want badge minting support.
 *
 * The OCID button initiates a redirect; the callback lands on /redirect where
 * OCIDRedirectPage completes the exchange and updates the session.
 */
export default function WalletLinkButton() {
  const { data: session, status, update } = useSession();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { ocAuth } = useOCAuth();

  const [isLinking, setIsLinking] = useState(false);
  const [linkedAddress, setLinkedAddress] = useState<string | null>(null);
  const [linkedOCId, setLinkedOCId] = useState<string | null>(null);

  // Keep local state in sync with the session.
  useEffect(() => {
    const user = session?.user as { wallet_address?: string; ocid_username?: string } | undefined;
    setLinkedAddress(typeof user?.wallet_address === 'string' ? user.wallet_address : null);
    setLinkedOCId(typeof user?.ocid_username === 'string' ? user.ocid_username : null);
  }, [session?.user]);

  const isCurrentWalletLinked = useMemo(() => {
    if (!address || !linkedAddress) return false;
    return address.toLowerCase() === linkedAddress.toLowerCase();
  }, [address, linkedAddress]);

  const shortAddress = useMemo(() => {
    if (!linkedAddress) return null;
    return `${linkedAddress.slice(0, 6)}…${linkedAddress.slice(-4)}`;
  }, [linkedAddress]);

  // ------------------------------------------------------------------
  // Flow 1: Initiate the OCID PKCE redirect
  // ------------------------------------------------------------------

  const handleOCIDSignIn = () => {
    try {
      ocAuth.signInWithRedirect({ state: 'ugm-aicare-link' });
    } catch (err) {
      console.error('OCID redirect failed:', err);
      toast.error('Could not start Open Campus sign-in. Please try again.');
    }
  };

  // ------------------------------------------------------------------
  // Flow 2: Generic SIWE wallet link (fallback for non-EDU users)
  // ------------------------------------------------------------------

  const handleLinkWallet = async () => {
    if (status !== 'authenticated') {
      toast.error('Please sign in before linking a wallet.');
      return;
    }
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first.');
      return;
    }

    setIsLinking(true);

    try {
      const message = 'Linking DID to UGM-AICare';
      const signature = await signMessageAsync({ message });

      const { data } = await apiClient.post('/link-did', {
        wallet_address: address,
        signature,
      });

      const normalisedAddress = data?.address ?? address;
      await update({ wallet_address: normalisedAddress });
      setLinkedAddress(normalisedAddress);
      toast.success('Wallet linked successfully!');
    } catch (error: unknown) {
      console.error('Failed to link wallet', error);
      const detail =
        (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ??
        (error as Error)?.message ??
        'Something went wrong while linking your wallet.';

      if (detail.toLowerCase().includes('already linked')) {
        toast(detail);
      } else if (detail.toLowerCase().includes('user rejected')) {
        toast('Wallet signature was cancelled.');
      } else {
        toast.error(detail);
      }
    } finally {
      setIsLinking(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60">
        <FiLoader className="h-4 w-4 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ---- Linked status (OCID) ---- */}
      {linkedOCId && (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          <FiCheckCircle className="h-4 w-4" />
          <span>Open Campus ID:</span>
          <code className="font-mono text-xs">{linkedOCId}</code>
        </div>
      )}

      {/* ---- Primary: OCID sign-in (only show if not yet OCID-linked) ---- */}
      {status === 'authenticated' && !linkedOCId && (
        <button
          type="button"
          onClick={handleOCIDSignIn}
          className="inline-flex items-center gap-2 rounded-full border border-[#FFCA40]/40 bg-[#FFCA40]/10 px-4 py-2 text-sm font-medium text-[#FFCA40] transition hover:bg-[#FFCA40]/20"
        >
          <FiUser className="h-4 w-4" />
          <span>Connect with Open Campus ID</span>
        </button>
      )}

      {/* ---- Divider (show both options when unauthenticated or no wallet) ---- */}
      {status === 'authenticated' && !linkedOCId && (
        <div className="flex items-center gap-2 text-xs text-white/30">
          <hr className="flex-1 border-white/10" />
          <span>or link any wallet</span>
          <hr className="flex-1 border-white/10" />
        </div>
      )}

      {/* ---- Fallback: RainbowKit multi-wallet connector ---- */}
      <ConnectButton
        accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
        chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }}
        showBalance={{ smallScreen: false, largeScreen: true }}
      />

      {/* ---- SIWE link button (for generic wallet fallback) ---- */}
      {status === 'authenticated' && isConnected && !isCurrentWalletLinked && !linkedOCId && (
        <button
          type="button"
          onClick={handleLinkWallet}
          disabled={isLinking}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLinking ? (
            <>
              <FiLoader className="h-4 w-4 animate-spin" />
              <span>Linking…</span>
            </>
          ) : (
            <>
              <FiLink className="h-4 w-4" />
              <span>Link this wallet</span>
            </>
          )}
        </button>
      )}

      {/* ---- Linked wallet address (generic wallet flow) ---- */}
      {linkedAddress && isCurrentWalletLinked && !linkedOCId && (
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          <FiCheckCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Wallet linked:</span>
          <code className="font-mono text-xs">{shortAddress}</code>
        </div>
      )}

      {/* ---- Warning when connected wallet differs from linked wallet ---- */}
      {linkedAddress && isConnected && !isCurrentWalletLinked && !linkedOCId && (
        <p className="text-xs text-yellow-400/80">
          ℹ️ Connected wallet differs from your linked wallet ({shortAddress})
        </p>
      )}
    </div>
  );
}

