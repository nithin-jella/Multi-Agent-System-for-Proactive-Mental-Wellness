"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiActivity, FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { getJournalAnalytics } from '@/services/api';
import type { JournalAnalyticsResponse } from '@/types/api';

interface AffectiveTrackingDashboardProps {
  days?: number;
  className?: string;
}

type PadAxis = 'valence' | 'arousal' | 'inferred_dominance';
type PadBucket = 'very_low' | 'low' | 'neutral' | 'high' | 'very_high';

const AXIS_META: Record<PadAxis, { label: string; color: string }> = {
  valence: { label: 'Valence', color: '#60A5FA' },
  arousal: { label: 'Arousal', color: '#F59E0B' },
  inferred_dominance: { label: 'Dominance', color: '#34D399' },
};

const PAD_BUCKETS: PadBucket[] = ['very_low', 'low', 'neutral', 'high', 'very_high'];
const PAD_BUCKET_LABELS: Record<PadBucket, string> = {
  very_low: 'Very Low',
  low: 'Low',
  neutral: 'Neutral',
  high: 'High',
  very_high: 'Very High',
};

const formatPadValue = (value: number | null): string => {
  if (value === null) {
    return 'N/A';
  }
  return value.toFixed(2);
};

export default function AffectiveTrackingDashboard({ days = 30, className = '' }: AffectiveTrackingDashboardProps) {
  const [analytics, setAnalytics] = useState<JournalAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getJournalAnalytics(days);
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  const averagePad = useMemo(() => {
    if (!analytics) {
      return {
        valence: null,
        arousal: null,
        inferred_dominance: null,
      } as Record<PadAxis, number | null>;
    }

    const totals: Record<PadAxis, number> = {
      valence: 0,
      arousal: 0,
      inferred_dominance: 0,
    };
    const counts: Record<PadAxis, number> = {
      valence: 0,
      arousal: 0,
      inferred_dominance: 0,
    };

    analytics.pad_trend.forEach((point) => {
      (Object.keys(totals) as PadAxis[]).forEach((axis) => {
        const value = point[axis];
        if (typeof value === 'number') {
          totals[axis] += value;
          counts[axis] += 1;
        }
      });
    });

    return (Object.keys(totals) as PadAxis[]).reduce(
      (acc, axis) => {
        acc[axis] = counts[axis] > 0 ? totals[axis] / counts[axis] : null;
        return acc;
      },
      {
        valence: null,
        arousal: null,
        inferred_dominance: null,
      } as Record<PadAxis, number | null>,
    );
  }, [analytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <div className={`bg-white/3 backdrop-blur-xl rounded-2xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40]"></div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={`bg-white/3 backdrop-blur-xl rounded-2xl border border-white/10 p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <p className="text-red-400">{error || 'No data available'}</p>
        </div>
      </div>
    );
  }

  const padTrendData = analytics.pad_trend.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    valence: item.valence,
    arousal: item.arousal,
    dominance: item.inferred_dominance,
  }));

  const padDistributionData = PAD_BUCKETS.map((bucket) => ({
    bucket: PAD_BUCKET_LABELS[bucket],
    valence: analytics.pad_distribution.valence[bucket],
    arousal: analytics.pad_distribution.arousal[bucket],
    dominance: analytics.pad_distribution.inferred_dominance[bucket],
  }));

  const writingFrequencyData = analytics.writing_frequency.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    entries: item.count,
  }));

  const valenceSignal = averagePad.valence ?? 0;
  const valenceSummary = valenceSignal >= 0 ? 'More positive' : 'More negative';
  const valenceSummaryClass = valenceSignal >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className={`bg-white/3 backdrop-blur-xl rounded-2xl border border-white/10 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="text-[#FFCA40]">Affective</span> Analytics
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/50">Last {days} days</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-linear-to-br from-blue-500/15 to-cyan-500/15 rounded-xl p-5 border border-blue-500/25">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium mb-1">Avg Valence</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white">{formatPadValue(averagePad.valence)}</span>
              </div>
              <p className={`text-xs mt-2 ${valenceSummaryClass} flex items-center gap-1`}>
                <FiTrendingUp size={14} />
                {valenceSummary}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-br from-amber-500/15 to-orange-500/15 rounded-xl p-5 border border-amber-500/25">
          <div>
            <p className="text-amber-300 text-sm font-medium mb-1">Avg Arousal</p>
            <p className="text-3xl font-bold text-white">{formatPadValue(averagePad.arousal)}</p>
            <p className="text-xs text-amber-300 mt-2">Activation level in writing tone</p>
          </div>
        </div>

        <div className="bg-linear-to-br from-emerald-500/15 to-green-500/15 rounded-xl p-5 border border-emerald-500/25">
          <div>
            <p className="text-emerald-300 text-sm font-medium mb-1">Avg Dominance</p>
            <p className="text-3xl font-bold text-white">{formatPadValue(averagePad.inferred_dominance)}</p>
            <p className="text-xs text-emerald-300 mt-2">Perceived agency and control</p>
          </div>
        </div>

        <div className="bg-linear-to-br from-purple-500/15 to-fuchsia-500/15 rounded-xl p-5 border border-purple-500/25">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm font-medium mb-1">Volume</p>
              <p className="text-3xl font-bold text-white">{analytics.total_entries}</p>
              <p className="text-xs text-purple-300 mt-2">entries this period</p>
            </div>
            <FiActivity className="text-purple-300" size={22} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiTrendingUp className="text-[#FFCA40]" />
            PAD Trend
          </h3>
          {padTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={padTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255, 255, 255, 0.3)"
                  fontSize={12}
                />
                <YAxis 
                  domain={[-1, 1]}
                  stroke="rgba(255, 255, 255, 0.3)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#001D58', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }} />
                <Line 
                  type="monotone" 
                  dataKey="valence"
                  name="Valence"
                  stroke={AXIS_META.valence.color}
                  strokeWidth={2}
                  dot={{ fill: AXIS_META.valence.color, r: 3 }}
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey="arousal"
                  name="Arousal"
                  stroke={AXIS_META.arousal.color}
                  strokeWidth={2}
                  dot={{ fill: AXIS_META.arousal.color, r: 3 }}
                  connectNulls
                />
                <Line 
                  type="monotone" 
                  dataKey="dominance"
                  name="Dominance"
                  stroke={AXIS_META.inferred_dominance.color}
                  strokeWidth={2}
                  dot={{ fill: AXIS_META.inferred_dominance.color, r: 3 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50 text-center py-8">No PAD trend data available</p>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiBarChart2 className="text-[#FFCA40]" />
            PAD Distribution
          </h3>
          {padDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={padDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis dataKey="bucket" stroke="rgba(255, 255, 255, 0.3)" fontSize={12} />
                <YAxis stroke="rgba(255, 255, 255, 0.3)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#001D58', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.7)' }} />
                <Bar dataKey="valence" name="Valence" fill={AXIS_META.valence.color} radius={[3, 3, 0, 0]} />
                <Bar dataKey="arousal" name="Arousal" fill={AXIS_META.arousal.color} radius={[3, 3, 0, 0]} />
                <Bar dataKey="dominance" name="Dominance" fill={AXIS_META.inferred_dominance.color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50 text-center py-8">No PAD distribution data available</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Writing Frequency</h3>
          {writingFrequencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={writingFrequencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255, 255, 255, 0.3)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="rgba(255, 255, 255, 0.3)"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#001D58', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="entries" 
                  fill="#FFCA40"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50 text-center py-8">No writing frequency data</p>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Top Tags</h3>
          <div className="space-y-2">
            {analytics.most_used_tags.slice(0, 5).map((tag, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-white text-sm bg-white/10 px-2 py-1 rounded-md">#{tag.tag}</span>
                <span className="text-[#FFCA40] text-sm font-semibold">{tag.count}x</span>
              </div>
            ))}
            {analytics.most_used_tags.length === 0 && (
              <p className="text-white/50 text-sm">No tags yet</p>
            )}
            <div className="pt-2 border-t border-white/10 mt-3 text-xs text-white/50">
              Total words: <span className="text-white/80">{analytics.total_word_count.toLocaleString()}</span>
              {' · '}
              Avg/entry: <span className="text-white/80">{Math.round(analytics.avg_word_count)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
