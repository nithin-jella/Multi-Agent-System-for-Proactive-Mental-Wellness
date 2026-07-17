/**
 * Admin Session Guard Hook
 * Monitors session validity and automatically redirects to login on expiry
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

interface UseAdminSessionGuardOptions {
  /**
   * Callback fired when session expires or becomes invalid
   */
  onSessionExpired?: () => void;
  
  /**
   * Redirect path on session expiry (default: '/admin')
   */
  redirectPath?: string;
  
  /**
   * How often to check session validity in milliseconds (default: 60000 = 1 minute)
   */
  checkInterval?: number;
  
  /**
   * Whether to check session on mount (default: true)
   */
  checkOnMount?: boolean;
}

export function useAdminSessionGuard(options: UseAdminSessionGuardOptions = {}) {
  const {
    onSessionExpired,
    redirectPath = '/admin',
    checkInterval = 60000, // Check every minute
    checkOnMount = true,
  } = options;

  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirectedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleSessionExpired = useCallback(() => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    console.warn('Admin session expired or invalid. Redirecting to login...');
    
    // Call custom callback if provided
    onSessionExpired?.();
    
    // Clear any stored session data
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.removeItem('admin-last-activity');
    }

    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(pathname || '/admin/conversations');
    router.push(`${redirectPath}?returnUrl=${returnUrl}`);
  }, [onSessionExpired, redirectPath, pathname, router]);

  const checkSession = useCallback(async () => {
    // Skip if loading or already redirected
    if (status === 'loading' || hasRedirectedRef.current) return;

    // Check 1: No session at all
    if (status === 'unauthenticated') {
      handleSessionExpired();
      return;
    }

    // Check 2: Session exists but no user data
    if (status === 'authenticated' && !session?.user) {
      handleSessionExpired();
      return;
    }

    // Check 3: User is not an admin or read-only admin viewer
    const userRole = session?.user?.role;
    const hasAdminAccess = userRole === 'admin' || userRole === 'admin_viewer' || userRole === 'therapist';
    if (status === 'authenticated' && !hasAdminAccess) {
      console.warn('User is not an admin. Redirecting...');
      hasRedirectedRef.current = true;
      router.push('/access-denied');
      return;
    }

    // Check 4: No access token (session might be expired on backend)
    if (status === 'authenticated' && !session?.accessToken) {
      console.warn('No access token found. Session may be expired.');
      handleSessionExpired();
      return;
    }

    // Check 5: Verify token is still valid with backend (optional but recommended)
    if (status === 'authenticated' && session?.accessToken) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        // If token is invalid/expired, backend returns 401
        if (response.status === 401) {
          console.warn('Backend returned 401. Token is invalid or expired.');
          handleSessionExpired();
          return;
        }

        // If other error, try to refresh session
        if (!response.ok) {
          console.warn('Session validation failed. Attempting to refresh...');
          await update(); // Trigger NextAuth session refresh
        }
      } catch (error) {
        console.error('Error validating session:', error);
        // Don't redirect on network errors, just log
      }
    }

    // Update last activity timestamp
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin-last-activity', Date.now().toString());
    }
  }, [status, session, handleSessionExpired, router, update]);

  // Check session on mount
  useEffect(() => {
    if (checkOnMount && !hasRedirectedRef.current) {
      checkSession();
    }
  }, [checkOnMount, checkSession]);

  // Set up periodic session checks
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Don't start interval if loading or already redirected
    if (status === 'loading' || hasRedirectedRef.current) {
      return;
    }

    // Start periodic checks
    intervalRef.current = setInterval(() => {
      checkSession();
    }, checkInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, checkInterval, checkSession]);

  // Listen for storage events (logout in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // If session was cleared in another tab
      if (e.key === 'admin-session-cleared' && e.newValue === 'true') {
        handleSessionExpired();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleSessionExpired]);

  // Listen for visibility change (check session when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !hasRedirectedRef.current) {
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkSession]);

  return {
    isValid: status === 'authenticated' && 
             (session?.user?.role === 'admin' || session?.user?.role === 'admin_viewer' || session?.user?.role === 'therapist') && 
             !!session?.accessToken,
    isLoading: status === 'loading',
    session,
    manualCheck: checkSession,
  };
}
