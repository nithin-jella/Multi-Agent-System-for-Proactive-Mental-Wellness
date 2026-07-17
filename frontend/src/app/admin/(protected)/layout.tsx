"use client";

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminHeader from '@/components/ui/admin/AdminHeader';
import AdminSidebar from '@/components/ui/admin/AdminSidebar';
import AdminFooter from '@/components/ui/admin/AdminFooter';
import AikaChatWidget from '@/components/admin/chat/AikaChatWidget';
import { useAdminSessionGuard } from '@/hooks/useAdminSessionGuard';
import { useAdminSessionExpiry } from '@/hooks/useSessionExpiry';
import { AdminSSEProvider } from '@/contexts/AdminSSEContext';
import { I18nProvider } from '@/i18n/I18nProvider';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Monitor for backend token expiry and auto sign-out
  useAdminSessionExpiry();

  // Use the session guard hook to automatically handle expiry and validation
  const { isValid, isLoading } = useAdminSessionGuard({
    redirectPath: '/admin',
    checkInterval: 60000, // Check every minute
    onSessionExpired: () => {
      console.log('Admin session expired. User will be redirected to login.');
    },
  });

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-white/20 mb-4 animate-bounce"></div>
          <div className="text-white text-lg">Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  // If session is invalid, show redirecting message (hook handles actual redirect)
  if (!isValid) {
    return (
      <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="text-white text-lg mb-2">Session Expired</div>
          <div className="text-white/60 text-sm">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  // Pages that handle their own padding/layout
  const isFullWidthPage = false;
  // const isFullWidthPage = pathname?.includes('/langgraph') ||
    // pathname?.includes('/insights') ||
    // pathname?.includes('/dashboard') ||
    // pathname?.includes('/screening') ||
    // pathname?.includes('/retention');

  // Render layout if authenticated as admin
  return (
    <AdminSSEProvider>
      <I18nProvider storageKey="admin_locale">
        <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] text-white flex">
          <AdminSidebar isMobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
          <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden relative">
            <AdminHeader onMenuToggle={() => setMobileNavOpen(!mobileNavOpen)} />
            <main className={`flex-1 overflow-y-auto bg-[#001030]/30 ${isFullWidthPage ? '' : 'p-4 md:p-6 lg:p-8'}`}>
              {children}
            </main>
            <AdminFooter />
            <AikaChatWidget />
          </div>
        </div>
      </I18nProvider>
    </AdminSSEProvider>
  );
}
