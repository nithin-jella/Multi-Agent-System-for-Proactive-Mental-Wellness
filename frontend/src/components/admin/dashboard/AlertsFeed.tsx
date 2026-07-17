'use client';

import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import type { AlertItem } from '@/types/admin/dashboard';

interface AlertsFeedProps {
  alerts: AlertItem[];
  maxItems?: number;
}

const severityConfig = {
  critical: {
    icon: FireIcon,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Critical',
  },
  high: {
    icon: ExclamationTriangleIcon,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    label: 'High',
  },
  medium: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'Medium',
  },
};

export function AlertsFeed({ alerts, maxItems = 10 }: AlertsFeedProps) {
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-red-500/10 to-orange-500/10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Critical Alerts</h3>
          <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            {alerts.length} active
          </span>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-white/5">
        {displayAlerts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-white/60">No active critical alerts</p>
            <p className="text-xs text-white/40 mt-1">All systems running smoothly</p>
          </div>
        ) : (
          displayAlerts.map((alert, index) => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.medium;
            const Icon = config.icon;
            const timeAgo = getTimeAgo(new Date(alert.created_at));

            return (
              <motion.div
                key={alert.case_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
              >
                <Link
                  href={`/admin/cases?case_id=${alert.case_id}`}
                  className="block px-6 py-4 hover:bg-white/5 transition-colors duration-200"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-lg ${config.bg} ${config.border} border`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${config.color} uppercase tracking-wide`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-white/40">•</span>
                            <span className="text-xs text-white/40">{timeAgo}</span>
                          </div>
                          {alert.summary && (
                            <p className="text-sm text-white/70 line-clamp-2">
                              {alert.summary}
                            </p>
                          )}
                        </div>
                        
                        <button className="flex-shrink-0 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors">
                          View →
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                        <span>Case #{alert.case_id.slice(0, 8)}</span>
                        {alert.session_id && (
                          <>
                            <span>•</span>
                            <span>Session {alert.session_id.slice(0, 8)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })
        )}
      </div>

      {/* View All Link */}
      {alerts.length > maxItems && (
        <div className="px-6 py-3 border-t border-white/10 bg-white/5">
          <Link
            href="/admin/cases?filter=critical"
            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            View all {alerts.length} alerts →
          </Link>
        </div>
      )}
    </motion.div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
