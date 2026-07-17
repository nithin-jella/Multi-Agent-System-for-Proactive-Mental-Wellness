'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartBarIcon,
  UsersIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { TrendChart } from '@/components/admin/dashboard/TrendChart';
import type { HistoricalDataPoint } from '@/types/admin/dashboard';
import type {
  ActiveUsersSummary,
  CohortRetentionSeries,
  DailyActiveUsersSeries,
  RetentionSummary,
} from '@/types/admin/retention';
import {
  getActiveUsersSummary,
  getCohortRetentionSeries,
  getDailyActiveUsersSeries,
  getRetentionSummary,
} from '@/services/adminRetentionApi';
import { useI18n } from '@/i18n/I18nProvider';

type CohortTableRow = {
  cohortDate: string;
  cohortSize: number;
  byDayN: Record<number, { retained: number; rate: number }>;
};

function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return '0%';
  return `${(rate * 100).toFixed(1)}%`;
}

export default function AdminRetentionPage() {
  const { t } = useI18n();

  const [summary, setSummary] = useState<ActiveUsersSummary | null>(null);
  const [dauSeries, setDauSeries] = useState<DailyActiveUsersSeries | null>(null);
  const [cohorts, setCohorts] = useState<CohortRetentionSeries | null>(null);
  const [retentionSummary, setRetentionSummary] = useState<RetentionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryData, dauData, cohortData, retentionSummaryData] = await Promise.all([
        getActiveUsersSummary(),
        getDailyActiveUsersSeries(30),
        getCohortRetentionSeries(30, [1, 7, 30]),
        getRetentionSummary([1, 7, 30]),
      ]);

      setSummary(summaryData);
      setDauSeries(dauData);
      setCohorts(cohortData);
      setRetentionSummary(retentionSummaryData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load retention analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dauChartData: HistoricalDataPoint[] = useMemo(() => {
    if (!dauSeries) return [];
    return dauSeries.points.map((point) => ({
      date: point.activity_date,
      value: point.active_users,
    }));
  }, [dauSeries]);

  const cohortRows: CohortTableRow[] = useMemo(() => {
    if (!cohorts) return [];

    const byCohort: Map<string, CohortTableRow> = new Map();

    for (const point of cohorts.points) {
      const key = point.cohort_date;
      const existing = byCohort.get(key);
      if (existing) {
        existing.cohortSize = point.cohort_size;
        existing.byDayN[point.day_n] = { retained: point.retained_users, rate: point.retention_rate };
        continue;
      }

      byCohort.set(key, {
        cohortDate: point.cohort_date,
        cohortSize: point.cohort_size,
        byDayN: {
          [point.day_n]: { retained: point.retained_users, rate: point.retention_rate },
        },
      });
    }

    return Array.from(byCohort.values()).sort((a, b) => a.cohortDate.localeCompare(b.cohortDate));
  }, [cohorts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#FFCA40] rounded-full animate-spin mx-auto" />
          <p className="text-white/60">{t('admin.retention.loading', 'Loading retention analytics...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="max-w-md w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <ChartBarIcon className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">{t('admin.retention.error_title', 'Unable to load retention analytics')}</h2>
              <p className="text-sm text-white/60 mt-1">{error}</p>
              <button
                onClick={load}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCA40] text-[#00153a] font-semibold hover:bg-[#FFCA40]/90 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {t('admin.retention.retry', 'Retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary || !dauSeries || !cohorts) {
    return <div className="p-6 text-white/70">No retention data available</div>;
  }

  const retentionByDay = new Map<number, { retained: number; rate: number; cohortSize: number }>();
  if (retentionSummary) {
    for (const point of retentionSummary.points) {
      retentionByDay.set(point.day_n, {
        retained: point.retained_users,
        rate: point.retention_rate,
        cohortSize: point.cohort_size,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-400 mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('admin.retention.title', 'Retention Analytics')}</h1>
            <p className="text-white/60 text-sm">{t('admin.retention.subtitle', 'DAU/WAU/MAU, daily activity, and cohort retention')}</p>
          </div>
          <div className="flex items-center gap-2 bg-[#FFCA40]/10 backdrop-blur-sm border border-[#FFCA40]/20 rounded-lg px-4 py-2.5">
            <CalendarIcon className="h-4 w-4 text-[#FFCA40]" />
            <span className="text-xs font-medium text-[#FFCA40]">{t('admin.retention.as_of', 'As of')} {summary.as_of}</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title={t('admin.retention.kpi.dau', 'DAU')}
            value={summary.dau}
            subtitle={t('admin.retention.kpi.dau_subtitle', 'Unique users today')}
            icon={<UsersIcon className="w-6 h-6 text-[#FFCA40]" />}
          />
          <KPICard
            title={t('admin.retention.kpi.wau', 'WAU')}
            value={summary.wau}
            subtitle={t('admin.retention.kpi.wau_subtitle', 'Unique users (7 days)')}
            icon={<UsersIcon className="w-6 h-6 text-[#FFCA40]" />}
          />
          <KPICard
            title={t('admin.retention.kpi.mau', 'MAU')}
            value={summary.mau}
            subtitle={t('admin.retention.kpi.mau_subtitle', 'Unique users (30 days)')}
            icon={<UsersIcon className="w-6 h-6 text-[#FFCA40]" />}
          />
        </div>

        {/* Retention summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 7, 30].map((dayN) => {
            const point = retentionByDay.get(dayN);
            const value = point ? formatPercent(point.rate) : '—';
            const cohortSize = point?.cohortSize ?? 0;
            const retained = point?.retained ?? 0;
            const subtitle = retentionSummary?.cohort_date
              ? `${t('admin.retention.kpi.cohort', 'Cohort')} ${retentionSummary.cohort_date} · ${retained}/${cohortSize}`
              : t('admin.retention.kpi.cohort_missing', 'No cohort data yet');

            return (
              <KPICard
                key={dayN}
                title={t(`admin.retention.kpi.d${dayN}`, `D${dayN} Retention`)}
                value={value}
                subtitle={subtitle}
                icon={<ChartBarIcon className="w-6 h-6 text-[#FFCA40]" />}
              />
            );
          })}
        </div>

        {/* DAU chart + table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart title={t('admin.retention.dau_chart_title', 'Daily Active Users (last 30 days)')} data={dauChartData} color="cyan" suffix="" height={220} showGrid />

          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white/80">{t('admin.retention.activity_title', 'Daily Activity')}</h2>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
                aria-label="Refresh retention analytics"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {t('admin.retention.refresh', 'Refresh')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60">
                    <th scope="col" className="px-5 py-3 font-medium">{t('admin.retention.table.date', 'Date')}</th>
                    <th scope="col" className="px-5 py-3 font-medium">{t('admin.retention.table.active_users', 'Active users')}</th>
                    <th scope="col" className="px-5 py-3 font-medium">{t('admin.retention.table.requests', 'Requests')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dauSeries.points
                    .slice()
                    .reverse()
                    .map((point) => (
                      <tr key={point.activity_date} className="text-white/80">
                        <td className="px-5 py-3 whitespace-nowrap">{point.activity_date}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{point.active_users}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{point.total_requests}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cohort retention */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{t('admin.retention.cohorts.title', 'Cohort Retention')}</h2>
              <p className="text-sm text-white/60">
                {t('admin.retention.cohorts.subtitle_prefix', 'Cohorts by first activity date (last')} {cohorts.cohort_days}{' '}
                {t('admin.retention.cohorts.subtitle_suffix', 'days)')}
              </p>
            </div>
            <div className="text-xs text-white/50">{t('admin.retention.cohorts.days_label', 'Days')}: {cohorts.day_n_values.join(', ')}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-white/60">
                  <th scope="col" className="px-5 py-3 font-medium">{t('admin.retention.cohorts.cohort_date', 'Cohort date')}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t('admin.retention.cohorts.cohort_size', 'Cohort size')}</th>
                  {cohorts.day_n_values.map((dayN) => (
                    <th key={dayN} scope="col" className="px-5 py-3 font-medium">Day {dayN}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {cohortRows
                  .slice()
                  .reverse()
                  .map((row) => (
                    <tr key={row.cohortDate} className="text-white/80">
                      <td className="px-5 py-3 whitespace-nowrap">{row.cohortDate}</td>
                      <td className="px-5 py-3 whitespace-nowrap">{row.cohortSize}</td>
                      {cohorts.day_n_values.map((dayN) => {
                        const cell = row.byDayN[dayN];
                        if (!cell) {
                          return (
                            <td key={dayN} className="px-5 py-3 whitespace-nowrap text-white/40">—</td>
                          );
                        }
                        return (
                          <td key={dayN} className="px-5 py-3 whitespace-nowrap">
                            <span className="font-medium">{formatPercent(cell.rate)}</span>
                            <span className="text-white/50"> ({cell.retained}/{row.cohortSize})</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {cohortRows.length === 0 && (
            <div className="p-6 text-sm text-white/50">{t('admin.retention.cohorts.no_rows', 'No cohort retention rows found.')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
