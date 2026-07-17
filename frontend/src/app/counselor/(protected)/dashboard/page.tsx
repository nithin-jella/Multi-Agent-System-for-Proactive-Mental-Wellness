'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiMessageSquare,
  FiTrendingDown,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi';
import { apiCall } from '@/utils/adminApi';

interface CaseStats {
  total_cases: number;
  open_cases: number;
  in_progress_cases: number;
  closed_cases: number;
  critical_cases: number;
  high_priority_cases: number;
}

interface TodayAppointment {
  id: number;
  appointment_datetime: string;
  duration_minutes: number;
  status: string;
  notes?: string;
  user: {
    name?: string;
    email?: string;
  };
}

interface ProgressItem {
  user_hash: string;
  active_cases: number;
  trend: 'improving' | 'stable' | 'declining';
  goal_completion: number;
  last_assessment?: string | null;
}

interface ProgressResponse {
  items: ProgressItem[];
}

interface UnreadAlertStats {
  total_unread: number;
}

const EMPTY_CASE_STATS: CaseStats = {
  total_cases: 0,
  open_cases: 0,
  in_progress_cases: 0,
  closed_cases: 0,
  critical_cases: 0,
  high_priority_cases: 0,
};

const EMPTY_ALERT_STATS: UnreadAlertStats = {
  total_unread: 0,
};

const APPOINTMENT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

const DASHBOARD_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};

const StatCard = ({
  label,
  value,
  subtitle,
  icon,
  tone = 'gold',
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  tone?: 'gold' | 'blue' | 'green' | 'red';
}) => {
  const toneClasses = {
    gold: 'border-[#FFCA40]/30 from-[#FFCA40]/15 to-[#FFCA40]/5 text-[#FFCA40]',
    blue: 'border-blue-500/30 from-blue-500/15 to-blue-500/5 text-blue-300',
    green: 'border-emerald-500/30 from-emerald-500/15 to-emerald-500/5 text-emerald-300',
    red: 'border-red-500/30 from-red-500/20 to-red-500/5 text-red-300',
  };

  return (
    <div className={`rounded-2xl border bg-linear-to-br p-5 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/55">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          <p className="mt-1 text-xs text-white/55">{subtitle}</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
          {icon}
        </span>
      </div>
    </div>
  );
};

export default function CounselorDashboard() {
  const [caseStats, setCaseStats] = useState<CaseStats | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [alertStats, setAlertStats] = useState<UnreadAlertStats | null>(null);
  const [isLoadingCaseStats, setIsLoadingCaseStats] = useState(true);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(true);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const dashboardDateLabel = useMemo(() => DASHBOARD_DATE_FORMATTER.format(new Date()), []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadDashboardData = async () => {
      const failedSections: string[] = [];

      try {
        setIsLoadingCaseStats(true);
        setIsLoadingAppointments(true);
        setIsLoadingProgress(true);
        setIsLoadingAlerts(true);
        setError(null);

        const tasks = [
          apiCall<CaseStats>('/api/v1/counselor/cases/stats', { signal: controller.signal })
            .then((nextCaseStats) => {
              if (isMounted) {
                setCaseStats(nextCaseStats);
              }
            })
            .catch((loadError) => {
              if (!isAbortError(loadError)) {
                console.error('Failed to load counselor case stats:', loadError);
                failedSections.push('case stats');
              }
            })
            .finally(() => {
              if (isMounted) {
                setIsLoadingCaseStats(false);
              }
            }),
          apiCall<TodayAppointment[]>('/api/v1/counselor/upcoming-today', { signal: controller.signal })
            .then((nextAppointments) => {
              if (isMounted) {
                setTodayAppointments(nextAppointments);
              }
            })
            .catch((loadError) => {
              if (!isAbortError(loadError)) {
                console.error('Failed to load upcoming appointments:', loadError);
                failedSections.push('appointments');
              }
            })
            .finally(() => {
              if (isMounted) {
                setIsLoadingAppointments(false);
              }
            }),
          apiCall<ProgressResponse>('/api/v1/counselor/progress', { signal: controller.signal })
            .then((nextProgress) => {
              if (isMounted) {
                setProgressItems(nextProgress.items || []);
              }
            })
            .catch((loadError) => {
              if (!isAbortError(loadError)) {
                console.error('Failed to load progress insights:', loadError);
                failedSections.push('progress');
              }
            })
            .finally(() => {
              if (isMounted) {
                setIsLoadingProgress(false);
              }
            }),
          apiCall<UnreadAlertStats>('/api/v1/counselor/alerts/stats/unread', { signal: controller.signal })
            .then((nextAlertStats) => {
              if (isMounted) {
                setAlertStats(nextAlertStats);
              }
            })
            .catch((loadError) => {
              if (!isAbortError(loadError)) {
                console.error('Failed to load unread alert stats:', loadError);
                failedSections.push('alerts');
              }
            })
            .finally(() => {
              if (isMounted) {
                setIsLoadingAlerts(false);
              }
            }),
        ];

        await Promise.allSettled(tasks);

        if (isMounted && failedSections.length > 0) {
          setError(`Some sections failed to load (${failedSections.join(', ')}).`);
        }
      } catch (loadError) {
        if (!isMounted || isAbortError(loadError)) {
          return;
        }

        console.error('Failed to load counselor dashboard data:', loadError);
        setError('Failed to load counselor dashboard data.');
      } finally {
        if (isMounted) {
          setIsLoadingCaseStats(false);
          setIsLoadingAppointments(false);
          setIsLoadingProgress(false);
          setIsLoadingAlerts(false);
        }
      }
    };

    void loadDashboardData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reloadKey]);

  const { trendSummary, urgentFocusPatients } = useMemo(() => {
    const summary = {
      improving: 0,
      stable: 0,
      declining: 0,
      activePatients: 0,
    };

    const decliningPatients: ProgressItem[] = [];

    for (const item of progressItems) {
      if (item.trend === 'improving') {
        summary.improving += 1;
      } else if (item.trend === 'stable') {
        summary.stable += 1;
      } else if (item.trend === 'declining') {
        summary.declining += 1;
        decliningPatients.push(item);
      }

      if (item.active_cases > 0) {
        summary.activePatients += 1;
      }
    }

    decliningPatients.sort((left, right) => right.active_cases - left.active_cases);

    return {
      trendSummary: summary,
      urgentFocusPatients: decliningPatients.slice(0, 3),
    };
  }, [progressItems]);

  const formatAppointmentTime = (dateTimeIso: string) => {
    const date = new Date(dateTimeIso);
    if (Number.isNaN(date.getTime())) {
      return '--:--';
    }

    return APPOINTMENT_TIME_FORMATTER.format(date);
  };

  const currentCaseStats = caseStats ?? EMPTY_CASE_STATS;
  const currentAlertStats = alertStats ?? EMPTY_ALERT_STATS;
  const hasAppointments = todayAppointments.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Care Operations</h1>
        <p className="mt-1 text-white/60">
          Prioritize risk intake, continue active interventions, and follow patient trajectory signals.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <button
              onClick={() => setReloadKey((previous) => previous + 1)}
              className="rounded-lg border border-yellow-500/40 bg-yellow-500/20 px-3 py-1.5 text-xs font-medium text-yellow-50 transition-colors hover:bg-yellow-500/30"
            >
              Retry failed sections
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Intake Queue"
          value={isLoadingCaseStats ? '--' : currentCaseStats.open_cases}
          subtitle={isLoadingCaseStats ? 'Loading intake metrics...' : `${currentCaseStats.critical_cases} critical in intake`}
          icon={<FiAlertTriangle className="h-5 w-5" />}
          tone={currentCaseStats.critical_cases > 0 ? 'red' : 'gold'}
        />
        <StatCard
          label="Active Cases"
          value={isLoadingCaseStats ? '--' : currentCaseStats.in_progress_cases}
          subtitle={isLoadingCaseStats ? 'Loading active caseload...' : `${currentCaseStats.total_cases} total assigned`}
          icon={<FiClipboard className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="High-Risk Active"
          value={isLoadingCaseStats ? '--' : currentCaseStats.critical_cases + currentCaseStats.high_priority_cases}
          subtitle={isLoadingCaseStats ? 'Loading risk distribution...' : 'Critical + high severity'}
          icon={<FiActivity className="h-5 w-5" />}
          tone="red"
        />
        <StatCard
          label="Patients In Care"
          value={isLoadingProgress ? '--' : trendSummary.activePatients}
          subtitle={isLoadingProgress ? 'Loading trajectory signals...' : `${trendSummary.declining} need attention`}
          icon={<FiUsers className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Unread Alerts"
          value={isLoadingAlerts ? '--' : currentAlertStats.total_unread}
          subtitle={isLoadingAlerts ? 'Loading notification state...' : 'Clinical system notifications'}
          icon={<FiMessageSquare className="h-5 w-5" />}
          tone={currentAlertStats.total_unread > 0 ? 'gold' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Today&apos;s Appointments</h2>
                <p className="mt-1 text-sm text-white/55">{dashboardDateLabel}</p>
              </div>
              <FiCalendar className="h-6 w-6 text-[#FFCA40]" />
            </div>

            {isLoadingAppointments && !hasAppointments ? (
              <div className="space-y-3">
                <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              </div>
            ) : !hasAppointments ? (
              <div className="rounded-xl border border-white/10 bg-white/5 py-12 text-center">
                <FiCheckCircle className="mx-auto mb-3 h-12 w-12 text-white/30" />
                <p className="text-white/65">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <p className="font-medium text-white">
                            {appointment.user.name || appointment.user.email || 'Patient'}
                          </p>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                              appointment.status === 'scheduled'
                                ? 'border border-blue-500/30 bg-blue-500/15 text-blue-300'
                                : 'border border-white/15 bg-white/10 text-white/60'
                            }`}
                          >
                            {appointment.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-white/60">
                          <span className="inline-flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {formatAppointmentTime(appointment.appointment_datetime)}
                          </span>
                          <span>{appointment.duration_minutes} min</span>
                        </div>
                        {appointment.notes ? (
                          <p className="mt-2 text-sm text-white/50">{appointment.notes}</p>
                        ) : null}
                      </div>

                      <Link
                        href="/counselor/appointments"
                        className="rounded-lg border border-[#FFCA40]/30 bg-[#FFCA40]/15 px-3 py-1.5 text-sm font-medium text-[#FFCA40] transition-colors hover:bg-[#FFCA40]/25"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2">
              <FiTrendingDown className="h-5 w-5 text-red-300" />
              <h2 className="text-lg font-semibold text-white">Priority Follow-up</h2>
            </div>
            {isLoadingProgress && progressItems.length === 0 ? (
              <div className="space-y-3">
                <div className="h-16 animate-pulse rounded-lg border border-red-500/20 bg-red-500/10" />
                <div className="h-16 animate-pulse rounded-lg border border-red-500/20 bg-red-500/10" />
              </div>
            ) : urgentFocusPatients.length === 0 ? (
              <p className="text-sm text-white/60">No declining patient trajectories detected.</p>
            ) : (
              <div className="space-y-3">
                {urgentFocusPatients.map((item) => (
                  <Link
                    key={item.user_hash}
                    href={`/counselor/patients/${item.user_hash}`}
                    className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 transition-colors hover:bg-red-500/15"
                  >
                    <div>
                      <p className="font-mono text-sm text-red-200">{item.user_hash}</p>
                      <p className="mt-0.5 text-xs text-red-100/70">{item.active_cases} active cases in follow-up</p>
                    </div>
                    <span className="text-xs font-medium text-red-200">Open profile</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="mb-4 text-lg font-semibold text-white">Caseload Signals</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2">
                <span className="text-sm text-green-200">Improving</span>
                <span className="font-semibold text-green-200">{isLoadingProgress ? '--' : trendSummary.improving}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2">
                <span className="text-sm text-yellow-200">Stable</span>
                <span className="font-semibold text-yellow-200">{isLoadingProgress ? '--' : trendSummary.stable}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2">
                <span className="text-sm text-red-200">Declining</span>
                <span className="font-semibold text-red-200">{isLoadingProgress ? '--' : trendSummary.declining}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-white/55">
              Signals are derived from counselor-scoped case, triage, and intervention progress snapshots.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h3 className="mb-4 text-lg font-semibold text-white">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/counselor/escalations"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                <FiAlertTriangle className="h-4 w-4 text-[#FFCA40]" />
                Review Intake Escalations
              </Link>
              <Link
                href="/counselor/cases?status=in_progress&source=dashboard"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                <FiClipboard className="h-4 w-4 text-[#FFCA40]" />
                Continue Active Cases
              </Link>
              <Link
                href="/counselor/conversations"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                <FiMessageSquare className="h-4 w-4 text-[#FFCA40]" />
                Review Conversations
              </Link>
              <Link
                href="/counselor/progress"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                <FiTrendingUp className="h-4 w-4 text-[#FFCA40]" />
                Track Patient Progress
              </Link>
              <Link
                href="/counselor/appointments"
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                <FiCalendar className="h-4 w-4 text-[#FFCA40]" />
                Manage Appointments
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
