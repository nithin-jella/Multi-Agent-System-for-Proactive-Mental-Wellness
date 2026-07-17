'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { DashboardOverview, TrendsResponse } from '@/types/admin/dashboard';

const PIE_COLORS = ['#22c55e', '#facc15', '#f97316', '#ef4444'];

function NumberTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-white/20 bg-[#001a47]/90 px-3 py-2 text-xs text-white">
      {label && <p className="mb-1 text-white/70">{label}</p>}
      {payload.map((item, index) => (
        <p key={`${item.name ?? 'metric'}-${index}`}>
          {item.name ?? 'Value'}: {item.value.toFixed(1)}
        </p>
      ))}
    </div>
  );
}

interface InteractiveMetricsChartsProps {
  overview: DashboardOverview;
  trends: TrendsResponse | null;
}

export function InteractiveMetricsCharts({ overview, trends }: InteractiveMetricsChartsProps) {
  const [activeSeverity, setActiveSeverity] = useState<number>(0);
  const [caseMode, setCaseMode] = useState<'opened' | 'closed'>('opened');

  const severityData = useMemo(() => {
    const source = overview.insights.severity_distribution;
    if (!source) {
      return [];
    }

    return [
      { name: 'Low', value: source.low },
      { name: 'Medium', value: source.medium },
      { name: 'High', value: source.high },
      { name: 'Critical', value: source.critical },
    ].filter((item) => item.value > 0);
  }, [overview.insights.severity_distribution]);

  const topicData = useMemo(
    () => [...(overview.insights.trending_topics ?? [])].sort((a, b) => b.count - a.count).slice(0, 6),
    [overview.insights.trending_topics],
  );

  const lifecycleData = useMemo(() => {
    if (!trends) return [];

    const opened = trends.cases_opened_trend;
    const closed = trends.cases_closed_trend;

    return opened.map((point, index) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      opened: point.value ?? 0,
      closed: closed[index]?.value ?? 0,
    }));
  }, [trends]);

  const selectedCaseSeries = caseMode === 'opened' ? 'opened' : 'closed';

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-3" aria-label="Interactive dashboard charts">
      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur xl:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Case Lifecycle Trend</h3>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setCaseMode('opened')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                caseMode === 'opened' ? 'bg-[#FFCA40] text-[#00153a]' : 'text-white/70 hover:text-white'
              }`}
            >
              Opened
            </button>
            <button
              type="button"
              onClick={() => setCaseMode('closed')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                caseMode === 'closed' ? 'bg-[#FFCA40] text-[#00153a]' : 'text-white/70 hover:text-white'
              }`}
            >
              Closed
            </button>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lifecycleData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <Tooltip content={<NumberTooltip />} />
              <Legend wrapperStyle={{ color: 'white', fontSize: 12 }} />
              <Line type="monotone" dataKey="opened" stroke="#a855f7" strokeWidth={2} dot={false} name="Opened" />
              <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={false} name="Closed" />
              <Line
                type="monotone"
                dataKey={selectedCaseSeries}
                stroke="#FFCA40"
                strokeWidth={3}
                dot={false}
                name={caseMode === 'opened' ? 'Selected Opened' : 'Selected Closed'}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <h3 className="mb-4 text-lg font-semibold text-white">Risk Severity Mix</h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={76}
                activeIndex={activeSeverity}
                onMouseEnter={(_, index) => setActiveSeverity(index)}
                paddingAngle={3}
              >
                {severityData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<NumberTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-white/70">
          {severityData.length > 0 ? (
            severityData.map((item, index) => (
              <li key={item.name} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  {item.name}
                </span>
                <span>{item.value}</span>
              </li>
            ))
          ) : (
            <li className="text-white/50">No severity data available</li>
          )}
        </ul>
      </article>

      <article className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur xl:col-span-3">
        <h3 className="mb-4 text-lg font-semibold text-white">Top Stressor Topics</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topicData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis type="number" stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="topic"
                type="category"
                stroke="rgba(255,255,255,0.5)"
                tick={{ fontSize: 11 }}
                width={130}
              />
              <Tooltip content={<NumberTooltip />} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#3b82f6" name="Mentions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
