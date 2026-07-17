"use client";

import { ReactNode, useState } from 'react';
import CounselorHeader from '@/components/ui/counselor/CounselorHeader';
import CounselorSidebar from '@/components/ui/counselor/CounselorSidebar';
import CounselorFooter from '@/components/ui/counselor/CounselorFooter';
import { useCounselorSessionGuard } from '@/hooks/useCounselorSessionGuard';
import { useSessionExpiry } from '@/hooks/useSessionExpiry';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CounselorLayout({ children }: { children: ReactNode }) {
  // Monitor for backend token expiry
  useSessionExpiry();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { isValid, isLoading } = useCounselorSessionGuard({
    redirectPath: '/counselor',
    checkInterval: 60000,
    onSessionExpired: () => {
      console.log('Counselor session expired. User will be redirected to login.');
    },
  });
  // Router and effect must be declared unconditionally (hooks rules)
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isValid) {
      router.push('/access-denied');
    }
  }, [isLoading, isValid, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-white/20 mb-4 animate-bounce"></div>
          <div className="text-white text-lg">Loading Counselor Portal...</div>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return null;
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] text-white flex">
      <CounselorSidebar isMobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden relative">
        <CounselorHeader onMenuToggle={() => setMobileNavOpen(!mobileNavOpen)} />
        <main className="flex-1 overflow-y-auto bg-[#001030]/30 p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <CounselorFooter />
      </div>
    </div>
  );
}
