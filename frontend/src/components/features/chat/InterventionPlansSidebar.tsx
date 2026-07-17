/**
 * Floating Panel component for TCA-generated intervention plans
 * Redesigned as a compact, minimizable floating card
 * Now includes a permanently visible minimized version
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  RefreshCw,
  AlertCircle,
  X,
  ListChecks,
  Lightbulb,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useInterventionPlans } from '@/hooks/useInterventionPlans';
import { PlanCard } from '@/components/resources/PlanCard';

export type PanelViewMode = 'expanded' | 'compact' | 'minimized';

interface InterventionPlansSidebarProps {
  /** Whether the panel is visible at all (controls permanent display) */
  alwaysVisible?: boolean;
  /** Legacy prop - if true AND alwaysVisible is false, shows the panel */
  isOpen?: boolean;
  onClose?: () => void;
  onViewModeChange?: (mode: PanelViewMode) => void;
}

export const InterventionPlansSidebar: React.FC<InterventionPlansSidebarProps> = ({
  alwaysVisible = false,
  isOpen = false,
  onClose,
  onViewModeChange,
}) => {
  const { data, isLoading, error, refetch } = useInterventionPlans(true);
  const [viewModeInternal, setViewModeInternal] = useState<PanelViewMode>('minimized');

  // Wrapper to notify parent of view mode changes
  const setViewMode = (mode: PanelViewMode) => {
    setViewModeInternal(mode);
    onViewModeChange?.(mode);
  };
  const viewMode = viewModeInternal;

  const activePlans = data?.plans || [];
  const totalPlans = data?.total || 0;

  // If alwaysVisible, show the panel. Otherwise, use isOpen prop
  const shouldShow = alwaysVisible || isOpen;

  const toggleViewMode = () => {
    if (viewMode === 'minimized') setViewMode('compact');
    else if (viewMode === 'compact') setViewMode('expanded');
    else setViewMode('compact');
  };

  const handleClose = () => {
    if (alwaysVisible) {
      // For always-visible mode, just minimize instead of closing
      setViewMode('minimized');
    } else {
      onClose?.();
    }
  };

  // Calculate overall progress across all plans
  const overallProgress = activePlans.length > 0
    ? Math.round(
        activePlans.reduce((sum, p) => sum + (p.completion_tracking?.completion_percentage || 0), 0) /
          activePlans.length
      )
    : 0;

  // Get width based on view mode
  const getWidth = () => {
    switch (viewMode) {
      case 'minimized':
        return 'w-16';
      case 'compact':
        return 'w-80';
      case 'expanded':
        return 'w-96 lg:w-[420px]';
      default:
        return 'w-80';
    }
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <>
          {/* Backdrop - Only on mobile for expanded mode */}
          {viewMode === 'expanded' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-69 lg:hidden"
              onClick={() => setViewMode('compact')}
              aria-hidden="true"
            />
          )}

          {/* Floating Panel */}
          <motion.aside
            layout
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed right-4 top-24 bottom-24 ${getWidth()} bg-linear-to-b from-[#0a1628]/95 to-[#0d1d35]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/30 z-70 flex flex-col overflow-hidden transition-all duration-300`}
          >
            {/* Minimized View */}
            {viewMode === 'minimized' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4 p-2"
              >
                <button
                  onClick={() => setViewMode('compact')}
                  className="w-12 h-12 rounded-xl bg-ugm-gold/10 flex items-center justify-center hover:bg-ugm-gold/20 transition-colors group"
                  title="Buka Rencana Intervensi"
                >
                  <ListChecks className="w-5 h-5 text-ugm-gold group-hover:scale-110 transition-transform" />
                </button>
                
                {totalPlans > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-ugm-gold">{totalPlans}</span>
                    <span className="text-[9px] text-white/40">Aktif</span>
                  </div>
                )}
                
                {/* Mini Progress Ring */}
                {totalPlans > 0 && (
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90">
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        className="text-white/10"
                      />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${overallProgress} 100`}
                        strokeLinecap="round"
                        className="text-ugm-gold"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/60">
                      {overallProgress}%
                    </span>
                  </div>
                )}

                {/* Only show close button if not always visible */}
                {!alwaysVisible && (
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors mt-auto"
                    title="Tutup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/2 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-ugm-gold/10 flex items-center justify-center">
                      <ListChecks className="w-4 h-4 text-ugm-gold" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold text-white">Rencana Intervensi</h2>
                      <p className="text-[10px] text-white/40">{totalPlans} rencana aktif</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => refetch()}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={toggleViewMode}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
                      title={viewMode === 'expanded' ? 'Kompak' : 'Perbesar'}
                    >
                      {viewMode === 'expanded' ? (
                        <Minimize2 className="h-3 w-3" />
                      ) : (
                        <Maximize2 className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => setViewMode('minimized')}
                      className="p-1.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
                      title="Sembunyikan"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                    {!alwaysVisible && (
                      <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400/60 hover:bg-red-500/5 transition-colors"
                        title="Tutup"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Overall Progress Bar - Compact summary */}
                {totalPlans > 0 && viewMode === 'compact' && (
                  <div className="px-4 py-2 border-b border-white/5 bg-ugm-gold/5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/50">Progress Keseluruhan</span>
                      <span className="text-[10px] font-bold text-ugm-gold">{overallProgress}%</span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full bg-linear-to-r from-ugm-gold to-ugm-gold-light rounded-full"
                      />
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {/* Loading State */}
                  {isLoading && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="mb-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-ugm-gold/10 flex items-center justify-center">
                          <RefreshCw className="w-5 h-5 text-ugm-gold" />
                        </div>
                      </motion.div>
                      <p className="text-xs text-white/50">Memuat rencana...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {error && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <p className="text-xs text-white/70 font-medium mb-1">Gagal memuat</p>
                      <p className="text-[10px] text-white/40 mb-4 px-4">
                        {error.message || 'Silakan coba lagi.'}
                      </p>
                      <button
                        onClick={() => refetch()}
                        className="px-3 py-1.5 bg-ugm-gold/10 border border-ugm-gold/30 text-ugm-gold text-[10px] font-medium rounded-lg hover:bg-ugm-gold/20 transition-all"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {!isLoading && !error && activePlans.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-2">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Sparkles className="w-6 h-6 text-white/20" />
                      </div>
                      <h3 className="text-xs font-medium text-white/60 mb-1.5">
                        Belum Ada Rencana
                      </h3>
                      <p className="text-[10px] text-white/40 leading-relaxed mb-4">
                        Aika akan membuat rencana dukungan saat kamu butuh bantuan ekstra.
                      </p>
                      <div className="p-2.5 bg-ugm-gold/5 rounded-lg border border-ugm-gold/20">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-ugm-gold shrink-0 mt-0.5" />
                          <p className="text-[9px] text-white/50 leading-relaxed text-left">
                            Coba katakan{' '}
                            <span className="text-ugm-gold">&ldquo;Aku stress&rdquo;</span> ke Aika!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plans List */}
                  {!isLoading && !error && activePlans.length > 0 && (
                    <div className="space-y-2.5">
                      <AnimatePresence mode="popLayout">
                        {activePlans.map((plan, index) => (
                          <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <PlanCard
                              plan={plan}
                              onUpdate={() => refetch()}
                              compact={viewMode === 'compact'}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Footer Hint */}
                {totalPlans > 0 && viewMode === 'compact' && (
                  <div className="px-3 py-2 border-t border-white/5 bg-white/1">
                    <p className="text-[9px] text-white/30 text-center">
                      Klik <Maximize2 className="w-2.5 h-2.5 inline mx-0.5" /> untuk detail lengkap
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
