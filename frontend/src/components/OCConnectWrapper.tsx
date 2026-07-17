'use client';

/**
 * OCConnectWrapper
 *
 * A thin client-only wrapper around the Open Campus ID `OCConnect` provider.
 * It must be rendered on the client side because `OCConnect` accesses
 * browser globals (localStorage, window) internally.
 *
 * Sandbox mode is active by default during development. Set
 * NEXT_PUBLIC_OCID_SANDBOX=false in production to switch to the live JWKS.
 *
 * In sandbox mode, `clientId` is ignored by the Open Campus SDK — no
 * whitelist submission is required, making it safe for local testing.
 */

import { OCConnect } from '@opencampus/ocid-connect-js';
import { type ReactNode } from 'react';

interface OCConnectWrapperProps {
  children: ReactNode;
}

export default function OCConnectWrapper({ children }: OCConnectWrapperProps) {
  const isSandbox = process.env.NEXT_PUBLIC_OCID_SANDBOX !== 'false';

  // `redirectUri` falls back to a path-based URL so it works in both
  // local (http://localhost:3000) and production (https://…) environments.
  const redirectUri =
    process.env.NEXT_PUBLIC_OCID_REDIRECT_URI ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/redirect`
      : 'http://localhost:3000/redirect');

  const opts = {
    clientId: process.env.NEXT_PUBLIC_OCID_CLIENT_ID ?? '',
    redirectUri,
    referralCode: 'UGMAICARE',
  };

  return (
    <OCConnect opts={opts} sandboxMode={isSandbox}>
      {children}
    </OCConnect>
  );
}
