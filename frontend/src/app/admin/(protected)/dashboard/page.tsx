'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { InsightsPanelCard } from '@/components/admin/dashboard/InsightsPanelCard';
import { AlertsFeed } from '@/components/admin/dashboard/AlertsFeed';
import { GenerateReportModal } from '@/components/admin/dashboard/GenerateReportModal';
import { Toast } from '@/components/admin/dashboard/Toast';
import { InsightsCampaignModal } from '@/components/admin/campaigns';
import { QuickLinksPanel } from '@/components/admin/dashboard/QuickLinksPanel';
import { MicroTrendsGrid } from '@/components/admin/dashboard/MicroTrendsGrid';
import { InteractiveMetricsCharts } from '@/components/admin/dashboard/InteractiveMetricsCharts';
import { OnDutyCounselorsPanel } from '@/components/admin/dashboard/OnDutyCounselorsPanel';
import type { GenerateReportParams } from '@/components/admin/dashboard/GenerateReportModal';
import {
  generateInsightsReport,
  getActiveUsers,
  getDashboardOverview,
  getDashboardTrends,
} from '@/services/adminDashboardApi';
import type {
  ActiveUsersSummary,
  DashboardOverview,
  DashboardKPIs,
  TimeRange,
  TrendsResponse,
} from '@/types/admin/dashboard';
import { useSSEEventHandler } from '@/contexts/AdminSSEContext';
import type { AlertData, IAReportGeneratedData } from '@/types/sse';

const RANGE_OPTIONS: TimeRange[] = [7, 30, 90];

interface DashboardCardModel {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down';
    value: number;
  };
  icon: ReactNode;
  severity: 'critical' | 'warning' | 'success' | 'info';
}

/**
 * Only the two "requires immediate action" KPIs live here.
 * Well-being, Active Users, and Avg Resolution are surfaced in the
 * Platform Health zone via MicroTrendsGrid (value + sparkline, no duplication).
 */
function buildCriticalStatusCards(kpis: DashboardKPIs): DashboardCardModel[] {
  return [
    {
      title: 'Critical Cases',
      value: kpis.active_critical_cases,
      subtitle: 'Requiring immediate attention',
      icon: <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />,
      severity: kpis.active_critical_cases > 0 ? 'critical' : 'success',
    },
    {
      title: 'SLA Breaches',
      value: kpis.sla_breach_count,
      subtitle: 'Cases past response deadline',
      icon: <BellAlertIcon className="h-6 w-6 text-yellow-400" />,
      severity: kpis.sla_breach_count > 0 ? 'warning' : 'success',
    },
  ];
}

/** Horizontal divider with a floating zone label for scannable dashboard hierarchy. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-white/35">
        {children}
      </span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>(7);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUsersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showInsightsCampaignModal, setShowInsightsCampaignModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const [overviewRes, trendsRes, activeUsersRes] = await Promise.allSettled([
        getDashboardOverview(timeRange),
        getDashboardTrends(timeRange),
        getActiveUsers(),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value);
      } else {
        throw new Error(overviewRes.reason?.message ?? 'Failed to load dashboard overview');
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value);
      }

      if (activeUsersRes.status === 'fulfilled') {
        setActiveUsers(activeUsersRes.value);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  const loadRef = useRef<((silent?: boolean) => Promise<void>) | undefined>(undefined);
  loadRef.current = loadDashboard;

  useSSEEventHandler('alert_created', useCallback((data: AlertData) => {
    if (data.severity === 'critical' || data.severity === 'high') {
      setToast({
        message: `${data.title}: ${data.message}`,
        type: data.severity === 'critical' ? 'error' : 'info',
      });
    }
    loadRef.current?.(true);
  }, []));

  useSSEEventHandler('case_updated', useCallback(() => {
    loadRef.current?.(true);
  }, []));

  useSSEEventHandler('sla_breach', useCallback((data: AlertData) => {
    setToast({
      message: `SLA BREACH: ${data.message}`,
      type: 'error',
    });
    loadRef.current?.(true);
  }, []));

  useSSEEventHandler('ia_report_generated', useCallback((data: IAReportGeneratedData) => {
    setToast({
      message: `New IA Report: ${data.message}`,
      type: 'success',
    });
    loadRef.current?.(true);
  }, []));

  const handleGenerateReport = async (params: GenerateReportParams) => {
    try {
      await generateInsightsReport(params);
      setToast({
        message: 'IA Report generated successfully! Dashboard will refresh in a moment.',
        type: 'success',
      });
      setTimeout(() => {
        loadRef.current?.(true);
      }, 1500);
    } catch (err) {
      setToast({
        message: 'Failed to generate report. Please try again.',
        type: 'error',
      });
      throw err;
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const kpis = overview?.kpis;

  const criticalCards = useMemo(() => {
    if (!kpis) return [];
    return buildCriticalStatusCards(kpis);
  }, [kpis]);

  // True when any emergency metric is non-zero — drives the zone 1 tint.
  const hasCriticalIssues = kpis
    ? kpis.active_critical_cases > 0 || kpis.sla_breach_count > 0
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-[#FFCA40]" />
          <p className="text-white/60">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Error Loading Dashboard</h3>
          <p className="text-white/60">{error}</p>
          <button
            type="button"
            onClick={() => loadDashboard()}
            className="rounded-xl bg-[#FFCA40] px-6 py-3 font-semibold text-[#00153a] shadow-lg shadow-[#FFCA40]/20 transition-all duration-200 hover:bg-[#FFCA40]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!overview || !kpis) {
    return <div className="p-6 text-white/70">No data available</div>;
  }

  const { insights, alerts } = overview;

  return (
    <div className="space-y-6">
      {/* ── Page Header ───────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-white">Mental Health Admin Dashboard</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/55">
            {lastRefreshed && <span>Last refreshed: {lastRefreshed.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/agent-decisions"
            className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm font-medium text-white hover:bg-white/12"
          >
            Agent Decisions
          </Link>
          <Link
            href="/admin/testing"
            className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm font-medium text-white hover:bg-white/12"
          >
            Testing Console
          </Link>
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white disabled:opacity-60"
            title="Refresh dashboard"
          >
            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                timeRange === range
                  ? 'bg-[#FFCA40] text-[#00153a] shadow-lg shadow-[#FFCA40]/30'
                  : 'border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              {range}d
            </button>
          ))}
        </div>
      </motion.header>

      {/* ── Zone 1: Requires Immediate Attention ──────────────── */}
      {/*
       * Critical KPIs and the live alert feed are grouped together so an admin
       * can answer "what needs my attention right now?" in a single glance.
       * The zone gains a subtle red tint whenever active issues exist.
       */}
      <SectionLabel>Requires Immediate Attention</SectionLabel>
      <section
        aria-label="Critical status and live alerts"
        className={`rounded-2xl border p-4 transition-colors duration-500 ${
          hasCriticalIssues
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-white/8 bg-white/3'
        }`}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Left column: two critical KPI cards stacked */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-1 xl:gap-4">
            {criticalCards.map((item) => (
              <KPICard
                key={item.title}
                title={item.title}
                value={item.value}
                subtitle={item.subtitle}
                trend={item.trend}
                icon={item.icon}
                severity={item.severity}
              />
            ))}
          </div>
          {/* Right column: live alerts feed */}
          <div className="xl:col-span-2">
            <AlertsFeed alerts={alerts} maxItems={5} />
          </div>
        </div>
      </section>

      {/* ── Zone 2: Platform Health ────────────────────────────── */}
      {/*
       * Point-in-time values merged with their sparklines into a single card each.
       * Eliminates duplication that previously existed between the KPI grid and
       * the micro-trend strip.
       */}
      <SectionLabel>Platform Health</SectionLabel>
      <MicroTrendsGrid
        trends={trends}
        sentimentValue={kpis.overall_sentiment}
        avgResolutionHours={kpis.avg_case_resolution_time}
        activeUsers={activeUsers}
      />

      {/* ── Zone 3: Trend Analysis ─────────────────────────────── */}
      {/*
       * Historical pattern charts for deeper diagnostic work. Positioned after
       * current-state metrics so the admin first knows "where we are", then
       * investigates "how we got here".
       */}
      <SectionLabel>Trend Analysis</SectionLabel>
      <InteractiveMetricsCharts overview={overview} trends={trends} />

      {/* ── Zone 4: Operations & Intelligence ─────────────────── */}
      {/*
       * Two distinct but complementary management layers:
       *   - On-duty counselors  →  who is available, how loaded, how effective
       *   - AI Insights         →  what patterns and interventions the system recommends
       * Pairing them reflects the "decide, then act" management workflow.
       */}
      <SectionLabel>Operations &amp; Intelligence</SectionLabel>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3" aria-label="Operations and AI intelligence">
        <div className="xl:col-span-2">
          <OnDutyCounselorsPanel />
        </div>
        <div>
          <InsightsPanelCard
            insights={insights}
            onGenerateReport={() => setShowGenerateModal(true)}
            onGenerateCampaign={() => setShowInsightsCampaignModal(true)}
          />
        </div>
      </section>

      {/* ── Zone 5: Quick Navigation ───────────────────────────── */}
      {/*
       * Navigation links carry zero informational value and should not compete
       * with operational content for visual attention. Placed last as a utility
       * tier, styled smaller to signal secondary importance.
       */}
      <SectionLabel>Quick Navigation</SectionLabel>
      <QuickLinksPanel />

      <GenerateReportModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerateReport}
      />

      <InsightsCampaignModal
        isOpen={showInsightsCampaignModal}
        onClose={() => setShowInsightsCampaignModal(false)}
        onSuccess={() => {
          setToast({ message: 'Campaign created successfully from insights!', type: 'success' });
          loadRef.current?.(true);
        }}
        insightsSummary={insights.ia_summary || ''}
        trendingTopics={insights.trending_topics || []}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={!!toast}
          onClose={() => setToast(null)}
        />
      )}

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="pt-2 text-center text-xs text-white/40"
      >
        {lastRefreshed ? `Data as of ${lastRefreshed.toLocaleString()}` : 'Loading...'}
        {' '}
        &bull; Time range: Last {timeRange} days
      </motion.footer>
    </div>
  );
}
