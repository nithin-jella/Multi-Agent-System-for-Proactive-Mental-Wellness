/**
 * User Progress Table Component
 * Shows aggregated user engagement with intervention plans
 */

'use client';

import { useUserProgress } from '../hooks/useAnalytics';

export function UserProgressTable() {
    const { users, loading, error } = useUserProgress({ limit: 50, min_plans: 1 });

    if (loading) {
        return <div className="text-center text-white py-8">Loading user progress...</div>;
    }

    if (error) {
        return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300">{error}</div>;
    }

    const getEngagementBadge = (score: number) => {
        if (score >= 80) return <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-300">Excellent</span>;
        if (score >= 60) return <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-300">Good</span>;
        if (score >= 40) return <span className="px-2 py-1 text-xs rounded bg-orange-500/20 text-orange-300">Fair</span>;
        return <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">Low</span>;
    };

    return (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Top {users.length} Users by Engagement</h3>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10">
                        <tr className="text-white/60">
                            <th className="pb-3 px-2">User Hash</th>
                            <th className="pb-3 px-2">Total Plans</th>
                            <th className="pb-3 px-2">Active</th>
                            <th className="pb-3 px-2">Completed</th>
                            <th className="pb-3 px-2">Avg Progress</th>
                            <th className="pb-3 px-2">Engagement Score</th>
                            <th className="pb-3 px-2">Last Plan</th>
                        </tr>
                    </thead>
                    <tbody className="text-white">
                        {users.map((user, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-2 font-mono text-xs text-white/80">{user.user_hash}</td>
                                <td className="py-3 px-2 font-semibold">{user.total_plans}</td>
                                <td className="py-3 px-2 text-green-300">{user.active_plans}</td>
                                <td className="py-3 px-2 text-blue-300">{user.completed_plans}</td>
                                <td className="py-3 px-2">{user.avg_completion_percentage.toFixed(1)}%</td>
                                <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{user.engagement_score.toFixed(0)}</span>
                                        {getEngagementBadge(user.engagement_score)}
                                    </div>
                                </td>
                                <td className="py-3 px-2 text-white/60 text-xs">
                                    {new Date(user.last_plan_created).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {users.length === 0 && (
                <div className="text-center text-white/60 py-8">No user data available</div>
            )}
        </div>
    );
}
