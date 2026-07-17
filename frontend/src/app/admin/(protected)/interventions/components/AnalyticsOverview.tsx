/**
 * Analytics Overview Component
 * Displays key metrics and charts for intervention plan effectiveness
 */

import { SCAAnalytics } from '../hooks/useAnalytics';

interface Props {
    analytics: SCAAnalytics | null;
    loading: boolean;
    timeframeDays: number;
}

export function AnalyticsOverview({ analytics, loading, timeframeDays }: Props) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-24 mb-4"></div>
                        <div className="h-8 bg-white/10 rounded w-16"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-6 text-center">
                <p className="text-red-300">Failed to load analytics</p>
            </div>
        );
    }

    const metrics = [
        {
            label: 'Total Plans',
            value: analytics.total_plans,
            icon: '📋',
            color: 'blue',
            change: null,
        },
        {
            label: 'Active Plans',
            value: analytics.active_plans,
            icon: '🟢',
            color: 'green',
            change: null,
        },
        {
            label: 'Completed',
            value: analytics.completed_plans,
            icon: '✅',
            color: 'emerald',
            change: `${analytics.completion_rate.toFixed(1)}% rate`,
        },
        {
            label: 'Avg Completion',
            value: `${analytics.avg_completion_percentage.toFixed(1)}%`,
            icon: '📊',
            color: 'yellow',
            change: null,
        },
        {
            label: 'Viewed (24h)',
            value: analytics.plans_viewed_in_24h,
            icon: '👁️',
            color: 'purple',
            change: null,
        },
        {
            label: 'Stale (7d)',
            value: analytics.plans_not_viewed_in_7d,
            icon: '⚠️',
            color: 'orange',
            change: 'not viewed',
        },
        {
            label: 'Avg Days to Complete',
            value: analytics.avg_days_to_completion?.toFixed(1) || 'N/A',
            icon: '⏱️',
            color: 'cyan',
            change: null,
        },
        {
            label: 'Abandonment Rate',
            value: `${analytics.abandonment_rate.toFixed(1)}%`,
            icon: '📉',
            color: 'red',
            change: null,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{metric.icon}</span>
                            <span className="text-xs text-white/50 uppercase tracking-wide">{metric.label}</span>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{metric.value}</div>
                        {metric.change && (
                            <div className="text-xs text-white/60">{metric.change}</div>
                        )}
                    </div>
                ))}
            </div>

            {/* Risk Level Distribution */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Risk Level Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(analytics.risk_level_distribution).map(([level, count]) => {
                        const colors = {
                            low: 'bg-green-500/20 border-green-500/30 text-green-300',
                            medium: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
                            high: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
                            critical: 'bg-red-500/20 border-red-500/30 text-red-300',
                            unknown: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
                        };
                        const colorClass = colors[level as keyof typeof colors] || colors.unknown;

                        return (
                            <div
                                key={level}
                                className={`backdrop-blur-sm border rounded-lg p-4 ${colorClass}`}
                            >
                                <div className="text-xs uppercase tracking-wide mb-1">{level}</div>
                                <div className="text-2xl font-bold">{count}</div>
                                <div className="text-xs mt-1">
                                    {analytics.total_plans > 0
                                        ? `${((count / analytics.total_plans) * 100).toFixed(1)}%`
                                        : '0%'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-[#FFCA40]/10 backdrop-blur-sm border border-[#FFCA40]/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-3">Summary for Last {timeframeDays} Days</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-white/60">Completion Rate: </span>
                        <span className="text-white font-semibold">{analytics.completion_rate.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="text-white/60">Active Plans: </span>
                        <span className="text-white font-semibold">{analytics.active_plans} / {analytics.total_plans}</span>
                    </div>
                    <div>
                        <span className="text-white/60">Generated: </span>
                        <span className="text-white font-semibold">
                            {new Date(analytics.generated_at).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
