import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SessionGuardOptions {
  redirectPath?: string;
  checkInterval?: number;
  onSessionExpired?: () => void;
}

export function useCounselorSessionGuard(options: SessionGuardOptions = {}) {
  const {
    redirectPath = '/counselor',
    checkInterval = 60000,
    onSessionExpired,
  } = options;

  const { data: session, status } = useSession();
  const router = useRouter();
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (status === 'unauthenticated') {
      setIsValid(false);
      setIsLoading(false);
      // Redirect to site-wide sign-in page with a callback to return the user to the counselor area after login
      const callback = encodeURIComponent(redirectPath || '/counselor/dashboard');
      router.push(`/api/auth/signin?callbackUrl=${callback}`);
      return;
    }

    if (status === 'authenticated') {
      const userRole = session?.user?.role;
      
      // Allow both counselor and admin roles
      if (userRole === 'counselor' || userRole === 'admin') {
        setIsValid(true);
        setIsLoading(false);
      } else {
        setIsValid(false);
        setIsLoading(false);
        router.push('/access-denied');
      }
    }
  }, [status, session, redirectPath, router]);

  // Periodic session validation
  useEffect(() => {
    if (!isValid || status !== 'authenticated') return;

    const intervalId = setInterval(() => {
      if (status !== 'authenticated') {
        onSessionExpired?.();
        router.push(`${redirectPath}?sessionExpired=true`);
      }
    }, checkInterval);

    return () => clearInterval(intervalId);
  }, [isValid, status, checkInterval, redirectPath, router, onSessionExpired]);

  return { isValid, isLoading };
}
