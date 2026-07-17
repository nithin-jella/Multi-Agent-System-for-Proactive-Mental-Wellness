'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiCalendar,
  FiMinus,
  FiTrendingDown,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { apiCall } from '@/utils/adminApi';

interface ProgressItem {
  user_hash: string;
  user_email?: string | null;
  total_cases: number;
  active_cases: number;
  risk_scores: number[];
  trend: 'improving' | 'stable' | 'declining';
  goal_completion: number;
  last_assessment?: string | null;
}

interface ProgressResponse {
  items: ProgressItem[];
}

const trendConfig = {
  improving: {
    icon: FiTrendingUp,
    label: 'Improving',
    className: 'border-green-500/30 bg-green-500/15 text-green-300',
  },
  stable: {
    icon: FiMinus,
    label: 'Stable',
    className: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-300',
  },
  declining: {
    icon: FiTrendingDown,
    label: 'Needs Attention',
    className: 'border-red-500/30 bg-red-500/15 text-red-300',
  },
} as const;

export default function CounselorProgressPage() {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        const response = await apiCall<ProgressResponse>('/api/v1/counselor/progress');
        setItems(response.items || []);
        setError(null);
      } catch (loadError) {
        console.error('Failed to load counselor progress:', loadError);
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  const summary = useMemo(() => {
    const improving = items.filter((item) => item.trend === 'improving').length;
    const stable = items.filter((item) => item.trend === 'stable').length;
    const declining = items.filter((item) => item.trend === 'declining').length;
    const avgGoalCompletion =
      items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + item.goal_completion, 0) / items.length)
        : 0;

    return {
      improving,
      stable,
      declining,
      avgGoalCompletion,
    };
  }, [items]);

  const formatDate = (dateValue?: string | null) => {
    if (!dateValue) {
      return 'Not yet assessed';
    }
    return new Date(dateValue).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-[#FFCA40]" />
          <p className="text-white/70">Loading patient progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <FiAlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-400" />
          <p className="mb-2 font-semibold text-red-200">Unable to load progress data</p>
          <p className="mb-4 text-sm text-red-100/75">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <FiActivity className="h-8 w-8 text-[#FFCA40]" />
            Progress Tracking
          </h1>
          <p className="text-white/60">Trajectory and intervention progress for your assigned caseload.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/55">Patients Tracked</p>
          <p className="mt-1 text-2xl font-bold text-white">{items.length}</p>
        </div>
        <div className="rounded-xl border border-green-500/25 bg-green-500/10 p-4">
          <p className="text-xs text-green-200/80">Improving</p>
          <p className="mt-1 text-2xl font-bold text-green-200">{summary.improving}</p>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-xs text-red-200/80">Needs Attention</p>
          <p className="mt-1 text-2xl font-bold text-red-200">{summary.declining}</p>
        </div>
        <div className="rounded-xl border border-[#FFCA40]/30 bg-[#FFCA40]/10 p-4">
          <p className="text-xs text-[#FFCA40]">Avg Goal Completion</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.avgGoalCompletion}%</p>
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <FiBarChart2 className="mx-auto mb-3 h-12 w-12 text-white/20" />
            <p className="text-white/60">No progress data available for current caseload.</p>
          </div>
        ) : (
          items.map((item) => {
            const TrendIcon = trendConfig[item.trend].icon;
            const lastRiskScore = item.risk_scores[item.risk_scores.length - 1] ?? null;

            return (
              <div
                key={item.user_hash}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors hover:bg-white/8"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <FiUser className="h-4 w-4 text-white/45" />
                      <span className="font-mono text-sm text-white/85">{item.user_hash}</span>
                    </div>
                    {item.user_email ? <p className="text-sm text-white/55">{item.user_email}</p> : null}
                    <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                      <FiCalendar className="h-3 w-3" />
                      <span>Last assessment: {formatDate(item.last_assessment)}</span>
                    </div>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${trendConfig[item.trend].className}`}>
                    <TrendIcon className="h-4 w-4" />
                    {trendConfig[item.trend].label}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/55">Active Cases</p>
                    <p className="mt-1 text-xl font-semibold text-white">{item.active_cases}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/55">Total Cases</p>
                    <p className="mt-1 text-xl font-semibold text-white">{item.total_cases}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/55">Goal Completion</p>
                    <p className="mt-1 text-xl font-semibold text-white">{item.goal_completion}%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/55">Latest Risk Score</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {lastRiskScore !== null ? lastRiskScore.toFixed(1) : '--'}
                    </p>
                  </div>
                </div>

                {item.risk_scores.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Recent Risk Trend</p>
                    <div className="flex h-14 items-end gap-1">
                      {item.risk_scores.slice(-10).map((score, index) => {
                        const height = Math.max(8, Math.min(56, score * 8));
                        return (
                          <div
                            key={`${item.user_hash}-risk-${index}`}
                            className={`flex-1 rounded-sm ${item.trend === 'declining' ? 'bg-red-400/75' : item.trend === 'improving' ? 'bg-green-400/75' : 'bg-yellow-300/75'}`}
                            style={{ height: `${height}px` }}
                            title={`Risk score: ${score.toFixed(2)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
                  <Link
                    href={`/counselor/cases?status=all&search=${encodeURIComponent(item.user_hash)}&source=progress`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
                  >
                    View Cases
                  </Link>
                  <Link
                    href={`/counselor/patients/${item.user_hash}`}
                    className="rounded-lg border border-[#FFCA40]/30 bg-[#FFCA40]/15 px-3 py-2 text-sm font-medium text-[#FFCA40] transition-colors hover:bg-[#FFCA40]/25"
                  >
                    Open Patient Profile
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
