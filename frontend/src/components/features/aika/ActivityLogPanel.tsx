/**
 * Activity Log Panel Component
 *
 * Floating left panel with vertical tabs:
 * - Activity timeline
 * - Technical details (metadata)
 */

'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Cpu,
  Info,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import type { ActivityLog, ActivityType } from '@/types/activity';
import type { AikaMetadata } from '@/hooks/useAika';
import type { InterventionPlanListResponse } from '@/services/interventionPlanApi';
import { MetadataDisplay } from '@/components/features/aika/AikaComponents';
import { AgentActivityIndicator } from '@/components/features/aika/AgentActivityIndicator';

export type ViewMode = 'expanded' | 'compact' | 'minimized';

type TabKey = 'activity' | 'details';

export interface ActivityLogPanelProps {
  activities: ActivityLog[];
  metadata: AikaMetadata | null;
  interventionPlans?: InterventionPlanListResponse | null;
  interventionPlansLoading?: boolean;
  interventionPlansError?: Error | null;
  onRefreshInterventionPlans?: () => void;

  /** Render as an in-layout sidebar (not a fixed floating panel) */
  embedded?: boolean;

  /** Whether the panel is visible at all (controls permanent display) */
  alwaysVisible?: boolean;
  /** Legacy prop - if true AND alwaysVisible is false, shows the panel */
  isOpen?: boolean;
  onClose?: () => void;

  onViewModeChange?: (mode: ViewMode) => void;
}

interface ActivityIndicatorProps {
  activeAgents: string[];
  latestActivity?: ActivityLog;
  className?: string;
}

export function ActivityIndicator({
  activeAgents,
  latestActivity: _latestActivity,
  className,
}: ActivityIndicatorProps) {
  void _latestActivity;
  return <AgentActivityIndicator activeAgents={activeAgents} className={className ?? ''} />;
}

const AGENT_COLORS: Record<string, string> = {
  STA: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  TCA: 'bg-green-500/20 text-green-400 border-green-500/30',
  CMA: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  IA: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  AIKA: 'bg-ugm-gold/20 text-ugm-gold border-ugm-gold/30',
  Aika: 'bg-ugm-gold/20 text-ugm-gold border-ugm-gold/30',
};

const EVENT_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string }> = {
  agent_start: { icon: Activity, color: 'text-blue-400' },
  agent_complete: { icon: CheckCircle, color: 'text-green-400' },
  agent_error: { icon: XCircle, color: 'text-red-400' },
  node_start: { icon: Sparkles, color: 'text-cyan-400' },
  node_complete: { icon: CheckCircle, color: 'text-cyan-400' },
  routing_decision: { icon: Info, color: 'text-purple-400' },
  risk_assessment: { icon: AlertTriangle, color: 'text-orange-400' },
  intervention_created: { icon: Sparkles, color: 'text-green-400' },
  case_created: { icon: AlertTriangle, color: 'text-red-400' },
  llm_call: { icon: Cpu, color: 'text-indigo-400' },
  tool_start: { icon: Zap, color: 'text-blue-400' },
  tool_use: { icon: Zap, color: 'text-ugm-gold' },
  tool_end: { icon: CheckCircle, color: 'text-green-400' },
  reasoning_trace: { icon: Cpu, color: 'text-ugm-gold' },
  info: { icon: Info, color: 'text-gray-300' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400' },
};

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function TabButton({
  active,
  onClick,
  title,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
      }`}
      title={title}
      aria-pressed={active}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ActivityLogItem({ activity, isLatest }: { activity: ActivityLog; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[activity.activity_type] ?? EVENT_CONFIG.info;
  const Icon = config.icon;
  const badgeClass = AGENT_COLORS[activity.agent] ?? 'bg-white/5 text-white/60 border-white/10';
  const hasDetails = Boolean(activity.details && Object.keys(activity.details).length > 0);

  return (
    <div
      className={`rounded-xl border ${
        isLatest ? 'border-ugm-gold/30 bg-ugm-gold/5' : 'border-white/10 bg-white/3'
      } overflow-hidden`}
    >
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-white/3 transition-colors"
        onClick={() => {
          if (hasDetails) setExpanded((v) => !v);
        }}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <div className={`mt-0.5 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-medium ${badgeClass}`}>
              {activity.agent}
            </span>
            <span className="text-[10px] text-white/40 truncate">{formatTime(activity.timestamp)}</span>
            {activity.duration_ms !== undefined && (
              <span className="ml-auto shrink-0 text-[10px] text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(activity.duration_ms)}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-white/80 leading-snug wrap-break-word">{activity.message}</div>
          {hasDetails && (
            <div className="mt-1 text-[10px] text-white/40">
              {expanded ? 'Click to hide details' : 'Click to view details'}
            </div>
          )}
        </div>
      </button>

      {hasDetails && expanded && (
        <div className="px-3 pb-3">
          <pre className="text-[10px] text-white/60 bg-black/20 border border-white/10 rounded-lg p-2 overflow-x-auto">
            {safeJson(activity.details)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ActivityLogPanel({
  activities,
  metadata,
  interventionPlans,
  interventionPlansLoading,
  interventionPlansError,
  onRefreshInterventionPlans,
  embedded = false,
  alwaysVisible = false,
  isOpen = false,
  onClose,
  onViewModeChange,
}: ActivityLogPanelProps) {
  const [viewModeInternal, setViewModeInternal] = useState<ViewMode>(() => (embedded ? 'compact' : 'minimized'));
  const [activeTab, setActiveTab] = useState<TabKey>('activity');

  const setViewMode = (mode: ViewMode) => {
    setViewModeInternal(mode);
    onViewModeChange?.(mode);
  };

  const viewMode = viewModeInternal;
  const shouldShow = embedded ? true : (alwaysVisible || isOpen);

  const orderedActivities = useMemo(() => {
    return [...activities].reverse();
  }, [activities]);

  const getWidth = () => {
    switch (viewMode) {
      case 'minimized':
        return 'w-16';
      case 'compact':
        return 'w-80';
      case 'expanded':
        return 'w-96 xl:w-105';
      default:
        return 'w-80';
    }
  };

  const toggleViewMode = () => {
    if (viewMode === 'minimized') setViewMode('compact');
    else if (viewMode === 'compact') setViewMode('expanded');
    else setViewMode('compact');
  };

  const handleClose = () => {
    if (alwaysVisible) {
      setViewMode('minimized');
      return;
    }
    onClose?.();
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <>
          {!embedded && viewMode === 'expanded' && (
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

          <motion.aside
            layout
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={
              embedded
                ? 'relative w-full h-full flex flex-col overflow-hidden'
                : `fixed left-4 top-24 bottom-24 ${getWidth()} bg-linear-to-b from-[#0a1628]/95 to-[#0d1d35]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/30 z-70 flex flex-col overflow-hidden transition-all duration-300`
            }
          >
            {viewMode === 'minimized' ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4 p-2"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('compact')}
                  className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors group"
                  title="Buka Panel"
                >
                  <Activity className="w-5 h-5 text-white/70 group-hover:scale-110 transition-transform" />
                </button>

                {orderedActivities.length > 0 && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-white/70">{orderedActivities.length}</span>
                    <span className="text-[9px] text-white/40">Logs</span>
                  </div>
                )}

                {!alwaysVisible && (
                  <button
                    type="button"
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
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/2 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-white/70" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold text-white">Aika Panel</h2>
                      <p className="text-[10px] text-white/40">{orderedActivities.length} aktivitas</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!embedded && (
                      <button
                        type="button"
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
                    )}
                    {!embedded && (
                      <button
                        type="button"
                        onClick={() => setViewMode('minimized')}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
                        title="Sembunyikan"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400/60 hover:bg-red-500/5 transition-colors"
                        title="Tutup"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex h-full min-h-0">
                  <div className="w-14 shrink-0 border-r border-white/10 bg-white/2 flex flex-col items-center gap-2 py-3">
                    <TabButton
                      active={activeTab === 'activity'}
                      onClick={() => setActiveTab('activity')}
                      title="Activity"
                      icon={Zap}
                    />
                    <TabButton
                      active={activeTab === 'details'}
                      onClick={() => setActiveTab('details')}
                      title="Details"
                      icon={Cpu}
                    />
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="h-full overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {activeTab === 'activity' && (
                        <>
                          {orderedActivities.length === 0 ? (
                            <div className="text-xs text-white/50 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Belum ada aktivitas.
                            </div>
                          ) : (
                            orderedActivities.map((activity, idx) => (
                              <ActivityLogItem
                                key={`${activity.timestamp}-${activity.activity_type}-${idx}`}
                                activity={activity}
                                isLatest={idx === 0}
                              />
                            ))
                          )}
                        </>
                      )}

                      {activeTab === 'details' && (
                        <>
                          {!metadata ? (
                            <div className="text-xs text-white/50 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Belum ada metadata.
                            </div>
                          ) : (
                            <MetadataDisplay metadata={metadata} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
