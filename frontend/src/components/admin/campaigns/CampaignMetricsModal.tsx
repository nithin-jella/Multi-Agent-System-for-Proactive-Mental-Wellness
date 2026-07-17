'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ChartBarIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { getCampaignMetrics } from '@/services/adminCampaignApi';
import type { CampaignMetricsResponse } from '@/types/admin/campaigns';
import styles from './CampaignMetricsModal.module.css';

interface CampaignMetricsModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

export function CampaignMetricsModal({ campaignId, campaignName, onClose }: CampaignMetricsModalProps) {
  const [metrics, setMetrics] = useState<CampaignMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);
        const data = await getCampaignMetrics(campaignId);
        setMetrics(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [campaignId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateSuccessRate = () => {
    if (!metrics) return '0.0';
    return metrics.average_success_rate?.toFixed(1) || '0.0';
  };

  const getSentPercentage = () => {
    if (!metrics || metrics.total_users_targeted === 0) return 0;
    return (metrics.total_messages_sent / metrics.total_users_targeted) * 100;
  };

  const getEngagedPercentage = () => {
    if (!metrics || metrics.total_users_targeted === 0) return 0;
    return (metrics.total_users_engaged / metrics.total_users_targeted) * 100;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-[#001a47] to-[#00153a] rounded-2xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#001a47]/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-white">Campaign Metrics</h2>
              <p className="text-white/60 text-sm mt-1">{campaignName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6 text-white/60" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-[#FFCA40]/30 border-t-[#FFCA40] rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {!loading && !error && metrics && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Total Messages */}
                  <div className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ChartBarIcon className="w-8 h-8 text-blue-400" />
                      <div>
                        <p className="text-white/60 text-xs font-medium">Messages Sent</p>
                        <p className="text-white text-2xl font-bold">{metrics.total_messages_sent}</p>
                      </div>
                    </div>
                  </div>

                  {/* Success Rate */}
                  <div className="p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-8 h-8 text-green-400" />
                      <div>
                        <p className="text-white/60 text-xs font-medium">Success Rate</p>
                        <p className="text-white text-2xl font-bold">{calculateSuccessRate()}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Users Targeted */}
                  <div className="p-4 bg-gradient-to-br from-[#FFCA40]/20 to-[#FFCA40]/10 border border-[#FFCA40]/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="w-8 h-8 text-[#FFCA40]" />
                      <div>
                        <p className="text-white/60 text-xs font-medium">Users Targeted</p>
                        <p className="text-white text-2xl font-bold">{metrics.total_users_targeted}</p>
                      </div>
                    </div>
                  </div>

                  {/* Users Engaged */}
                  <div className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <XCircleIcon className="w-8 h-8 text-purple-400" />
                      <div>
                        <p className="text-white/60 text-xs font-medium">Users Engaged</p>
                        <p className="text-white text-2xl font-bold">{metrics.total_users_engaged}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engagement Chart */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">User Engagement</h3>
                  <div className="space-y-4">
                    {/* Visual Bar Chart */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-white/80">Messages Sent</span>
                          <span className="text-sm font-medium text-green-400">
                            {metrics.total_messages_sent} ({getSentPercentage().toFixed(0)}%)
                          </span>
                        </div>

                        {/* Replaced inline-style bar with semantic <progress> styled via external CSS */}
                        <progress
                          className={`${styles.progress} h-4 w-full rounded-full overflow-hidden`}
                          value={Math.min(Math.max(getSentPercentage(), 0), 100)}
                          max={100}
                          aria-label="Messages sent progress"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-white/80">Users Engaged</span>
                          <span className="text-sm font-medium text-purple-400">
                            {metrics.total_users_engaged} ({getEngagedPercentage().toFixed(0)}%)
                          </span>
                        </div>

                        {/* Replaced inline-style bar with semantic <progress> styled via external CSS */}
                        <progress
                          className={`${styles.progressPurple} h-4 w-full rounded-full overflow-hidden`}
                          value={Math.min(Math.max(getEngagedPercentage(), 0), 100)}
                          max={100}
                          aria-label="Users engaged progress"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Execution History */}
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Metrics History</h3>

                  {metrics.metrics.length === 0 && (
                    <p className="text-white/40 text-center py-8">No metrics data yet</p>
                  )}

                  {metrics.metrics.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                              Messages
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                              Targeted
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                              Engaged
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                              Success Rate
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {metrics.metrics.map((metric) => {
                            const successRate = metric.success_rate?.toFixed(1) || '0.0';

                            return (
                              <tr key={metric.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-sm text-white/80">
                                  {formatDate(metric.execution_date)}
                                </td>
                                <td className="px-4 py-3 text-sm text-green-400">
                                  {metric.messages_sent}
                                </td>
                                <td className="px-4 py-3 text-sm text-white/80">
                                  {metric.users_targeted}
                                </td>
                                <td className="px-4 py-3 text-sm text-purple-400">
                                  {metric.users_engaged}
                                </td>
                                <td className="px-4 py-3 text-sm text-white/80">
                                  {successRate}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Empty State */}
                {metrics.metrics.length === 0 && (
                  <div className="text-center py-12">
                    <ChartBarIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60 text-lg">No metrics available yet</p>
                    <p className="text-white/40 text-sm mt-2">
                      Execute this campaign to see performance metrics
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#001a47]/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
