'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to monitor session expiry and automatically sign out when backend token expires
 * 
 * This handles the case where:
 * - NextAuth JWT session is still valid (stored in cookie)
 * - But the backend access token has expired
 * - Backend returns 401 Unauthorized
 * 
 * Usage:
 * ```tsx
 * export default function AdminLayout() {
 *   useSessionExpiry({ redirectTo: '/admin' });
 *   // ... rest of component
 * }
 * ```
 */
export function useSessionExpiry(options?: {
  /** Where to redirect after sign out (default: '/admin' for admin, '/signin' for users) */
  redirectTo?: string;
  /** Whether to show a session expired message (default: true) */
  showMessage?: boolean;
  /** Role to check (default: checks session.user.role) */
  role?: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasHandledExpiry = useRef(false);

  useEffect(() => {
    // Skip if not authenticated or already handled
    if (status !== 'authenticated' || hasHandledExpiry.current) {
      return;
    }

    // Check if session has backend token expiry error
    if (session?.error === 'BackendTokenExpired') {
      hasHandledExpiry.current = true;
      
      console.warn('[SessionExpiry] Backend token has expired, signing out...');
      
      // Determine redirect location
      const redirectTo = options?.redirectTo || 
        (session.user?.role === 'admin' ? '/admin' : '/signin');
      
      // Add session expired parameter
      const redirectUrl = options?.showMessage !== false
        ? `${redirectTo}?sessionExpired=true`
        : redirectTo;

      // Sign out and redirect
      signOut({ 
        callbackUrl: redirectUrl,
        redirect: true,
      });
    }
  }, [session, status, options?.redirectTo, options?.showMessage, router]);

  return {
    isExpired: session?.error === 'BackendTokenExpired',
    session,
    status,
  };
}

/**
 * Hook specifically for admin routes
 */
export function useAdminSessionExpiry() {
  return useSessionExpiry({
    redirectTo: '/admin',
    showMessage: true,
    role: 'admin',
  });
}

/**
 * Hook specifically for user routes
 */
export function useUserSessionExpiry() {
  return useSessionExpiry({
    redirectTo: '/signin',
    showMessage: true,
    role: 'user',
  });
}
