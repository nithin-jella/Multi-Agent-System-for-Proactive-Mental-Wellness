'use client';

/**
 * /redirect — Open Campus ID OAuth callback page.
 *
 * After the user completes the OCID sign-in flow, Open Campus redirects them
 * here with an authorisation code in the query string. The SDK's `LoginCallBack`
 * component exchanges that code for tokens (access_token + id_token) and signals
 * completion via `successCallback`.
 *
 * Once the token exchange succeeds, `BackendLinker` reads the raw id_token via
 * `useOCAuth()`, posts it to the backend for verification and persistence, then
 * pushes the user back to their profile page.
 */

import { LoginCallBack, useOCAuth } from '@opencampus/ocid-connect-js';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import apiClient from '@/services/api';

// ---------------------------------------------------------------------------
// Inner component — only mounted after the OCID exchange completes
// so useOCAuth() is guaranteed to hold the populated auth state.
// ---------------------------------------------------------------------------

function BackendLinker() {
  const { authState, ocAuth } = useOCAuth();
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Wait for the OCConnect context to propagate the authenticated state.
    if (!authState?.isAuthenticated) return;

    const linkAccount = async () => {
      try {
        const state = ocAuth.getAuthState();
        const idToken: string = (state as { idToken: string }).idToken;

        const { data } = await apiClient.post<{
          wallet_address: string;
          ocid_username: string;
          newly_minted_badges: unknown[];
        }>('/link-ocid', { id_token: idToken });

        // Propagate the new wallet + OCId into the NextAuth session so
        // WalletLinkButton re-renders immediately without a full page reload.
        await update({
          wallet_address: data.wallet_address,
          ocid_username: data.ocid_username,
        });

        const badgeCount = data.newly_minted_badges?.length ?? 0;
        const badgeNote = badgeCount > 0 ? ` (+${badgeCount} badge${badgeCount > 1 ? 's' : ''} unlocked)` : '';
        toast.success(`Open Campus ID linked: ${data.ocid_username}${badgeNote}`);
        router.push('/profile');
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Failed to link Open Campus ID. Please try again.';
        toast.error(detail);
        router.push('/profile');
      }
    };

    linkAccount();
  }, [authState?.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function OCIDRedirectPage() {
  const router = useRouter();
  const [authDone, setAuthDone] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  const handleSuccess = () => {
    setAuthDone(true);
  };

  const handleError = (error: unknown) => {
    console.error('[OCID] Callback error:', error);
    setAuthFailed(true);
    toast.error('Open Campus sign-in was unsuccessful. Please try again.');
    router.push('/profile');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F]">
      {/* SDK handles the code → token exchange. No children needed here. */}
      <LoginCallBack
        successCallback={handleSuccess}
        errorCallback={handleError}
        customErrorComponent={
          <div className="flex flex-col items-center gap-3 text-red-400">
            <FiAlertCircle className="h-10 w-10" />
            <p className="text-sm">Authentication error — redirecting…</p>
          </div>
        }
        customLoadingComponent={
          <div className="flex flex-col items-center gap-4 text-white/60">
            <FiLoader className="h-10 w-10 animate-spin text-[#FFCA40]" />
            <p className="text-sm">Verifying your Open Campus ID…</p>
          </div>
        }
      />

      {/* Visible feedback while the exchange is pending */}
      {!authDone && !authFailed && (
        <div className="flex flex-col items-center gap-4 text-white/60">
          <FiLoader className="h-10 w-10 animate-spin text-[#FFCA40]" />
          <p className="text-sm">Completing Open Campus ID authentication…</p>
        </div>
      )}

      {authFailed && (
        <div className="flex flex-col items-center gap-3 text-red-400">
          <FiAlertCircle className="h-10 w-10" />
          <p className="text-sm">Authentication failed. Redirecting…</p>
        </div>
      )}

      {/* BackendLinker only mounts after a successful code exchange */}
      {authDone && <BackendLinker />}
    </div>
  );
}
