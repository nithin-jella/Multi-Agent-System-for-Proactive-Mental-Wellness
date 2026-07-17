"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import AdminHeader from '../ui/admin/AdminHeader';
import AdminSidebar from '../ui/admin/AdminSidebar';
import AdminFooter from '../ui/admin/AdminFooter';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Admin authentication check
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/admin');
    } else if (status === "authenticated") {
      // Check if user has admin role (this would come from your session data)
      // For now just checking for UGM email domain
      const isAdmin = session?.user?.email?.endsWith('@ugm.ac.id');
      if (!isAdmin) {
        router.push('/access-denied');
      }
    }
  }, [status, router, session]);
  
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-white/20 mb-4"></div>
          <div className="h-4 w-40 bg-white/20 rounded mb-2"></div>
          <div className="h-3 w-24 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] text-white flex flex-col">
      <div className="flex flex-1">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          
          <main className="p-4 sm:p-6 flex-1 overflow-auto">
            {children}
          </main>
          
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}