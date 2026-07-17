// frontend/src/components/layout/AppLayout.tsx
"use client";

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Header from '@/components/ui/Header';
import AppSidebar from '@/components/ui/AppSidebar';
import FooterWrapper from '@/components/ui/FooterWrapper';
import FeedbackForm from '@/components/features/feedback/FeedBackForm';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { cn } from '@/lib/utils';
import NoSsr from '@/components/layout/NoSsr';
import { useIsGrammarlyActive } from '@/hooks/useIsGrammarlyActive';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Simple Loading Component (optional, adjust styling as needed)
const AppLoadingIndicator = () => (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-white/20 mb-4"></div>
            <div className="h-4 w-40 bg-white/20 rounded mb-2"></div>
            <div className="h-3 w-24 bg-white/10 rounded"></div>
            <p className="text-white/50 text-sm mt-2">Loading...</p>
        </div>
    </div>
);

export default function AppLayout({ children }: AppLayoutProps) {
  const { status } = useSession();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isFeedbackOpen, setFeedbackOpen] = useState(false);
  const isGrammarlyActive = useIsGrammarlyActive();

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  if (status === 'loading' || isGrammarlyActive) {
    return <AppLoadingIndicator />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-br from-[#001d58] via-[#0a2a6e] to-[#173a7a]">

      {/* Particle Background - absolute positioned, behind everything */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <ParticleBackground />
      </div>

      {/* Render Sidebar only if authenticated */}
      {status === 'authenticated' && (
        <NoSsr>
          <AppSidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setSidebarOpen(false)}
            onOpenFeedback={() => setFeedbackOpen(true)}
          />
        </NoSsr>
      )}

      {/* Main content area wrapper */}
      <div
        className={cn(
            "flex-1 flex flex-col overflow-hidden transition-filter duration-300 relative z-10",
            isSidebarOpen ? "blur-sm pointer-events-none" : ""
        )}
        >
        {/* Header */}
        <NoSsr>
          <Header onToggleSidebar={toggleSidebar}/>
        </NoSsr>

        {/* Content area */}
        <main id="app-scroll-container" className="grow relative overflow-auto">
            <div className="min-h-screen">
              {children}
            </div>
            
            {/* Footer - Smart wrapper handles which footer (or none) to show */}
            <NoSsr>
              <FooterWrapper />
            </NoSsr>
        </main>
      </div>

      {/* Feedback Form Modal - Render only if authenticated */}
      {status === 'authenticated' && (
        <NoSsr>
          <AnimatePresence>
            {isFeedbackOpen && (
              <motion.div
                className="fixed bottom-5 right-5 z-50"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
              >
                <FeedbackForm
                  onClose={() => setFeedbackOpen(false)}
                  onSubmitSuccess={() => {
                    toast.success("Thank you for your feedback!");
                    setFeedbackOpen(false);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </NoSsr>
      )}
    </div>
  );
}
