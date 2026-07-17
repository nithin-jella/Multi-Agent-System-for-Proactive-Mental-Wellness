/**
 * CBT Module Usage Component
 * Shows which CBT modules are used most frequently in intervention plans
 */

'use client';

import { useCBTModuleUsage } from '../hooks/useAnalytics';

interface Props {
    timeframeDays: number;
}

export function CBTModuleUsage({ timeframeDays }: Props) {
    const { modules, loading, error } = useCBTModuleUsage(timeframeDays);

    if (loading) {
        return <div className="text-center text-white py-8">Loading module usage...</div>;
    }

    if (error) {
        return <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-300">{error}</div>;
    }

    return (
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">CBT Module Usage (Last {timeframeDays} Days)</h3>

            {modules.length === 0 ? (
                <div className="text-center text-white/60 py-8">
                    No CBT module data available for this timeframe
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules.map((module, index) => (
                        <div
                            key={index}
                            className="bg-white/5 border border-white/10 rounded-lg p-5 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="text-white font-medium text-sm leading-tight flex-1">
                                    {module.module_name}
                                </div>
                                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFCA40]/20 text-[#FFCA40] flex items-center justify-center text-lg font-bold ml-3">
                                    {module.usage_count}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/60">Completion Rate</span>
                                    <span className="text-white font-semibold">{module.avg_completion_rate.toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/60">Total Steps</span>
                                    <span className="text-white font-semibold">{module.total_steps}</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-3 bg-white/10 rounded-full h-2">
                                <div
                                    className="bg-[#FFCA40] h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, module.avg_completion_rate)}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
