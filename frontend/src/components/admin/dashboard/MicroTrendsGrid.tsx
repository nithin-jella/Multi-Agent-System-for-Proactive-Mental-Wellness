'use client';

import { UsersIcon } from '@heroicons/react/24/outline';
import { MicroTrendCard } from './MicroTrendCard';
import type { TrendsResponse, ActiveUsersSummary } from '@/types/admin/dashboard';

function asMicroPoints(items: Array<{ date: string; value?: number | null }>) {
  return items
    .filter((item): item is { date: string; value: number } => typeof item.value === 'number')
    .map((item) => ({ date: item.date, value: item.value }));
}

interface MicroTrendsGridProps {
  trends: TrendsResponse | null;
  sentimentValue: number | null | undefined;
  avgResolutionHours: number | null | undefined;
  activeUsers?: ActiveUsersSummary | null;
}

export function MicroTrendsGrid({ trends, sentimentValue, avgResolutionHours, activeUsers }: MicroTrendsGridProps) {
  const sentimentPoints = trends ? asMicroPoints(trends.sentiment_trend) : [];
  const openedPoints = trends ? asMicroPoints(trends.cases_opened_trend) : [];
  const closedPoints = trends ? asMicroPoints(trends.cases_closed_trend) : [];

  const hasAnyData = sentimentPoints.length || openedPoints.length || closedPoints.length || activeUsers;

  if (!hasAnyData) {
    return null;
  }

  const dauLabel = activeUsers ? String(activeUsers.dau) : '—';
  const dauSub = activeUsers ? `WAU ${activeUsers.wau} · MAU ${activeUsers.mau}` : 'Unavailable';

  return (
    <section aria-label="Platform health metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Active Users — point-in-time, no sparkline */}
      <MicroTrendCard
        title="Active Users"
        value={dauLabel}
        subtitle={dauSub}
        data={[]}
        color="cyan"
        icon={<UsersIcon className="h-5 w-5 text-cyan-400" />}
      />

      <MicroTrendCard
        title="Well-being Index"
        value={typeof sentimentValue === 'number' ? `${sentimentValue.toFixed(1)}%` : '—'}
        subtitle="Aggregate sentiment score"
        data={sentimentPoints}
        color="blue"
      />
      <MicroTrendCard
        title="Case Intake"
        value={openedPoints.length ? `${openedPoints[openedPoints.length - 1].value}` : '—'}
        subtitle="Latest opened cases bucket"
        data={openedPoints}
        color="purple"
      />
      <MicroTrendCard
        title="Avg Resolution"
        value={typeof avgResolutionHours === 'number' ? `${avgResolutionHours.toFixed(1)}h` : '—'}
        subtitle="Average time to close a case"
        data={closedPoints}
        color="green"
      />
    </section>
  );
}
