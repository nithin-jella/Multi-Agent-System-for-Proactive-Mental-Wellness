'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FiAlertTriangle,
  FiClock,
  FiUser,
  FiCheckCircle,
  FiArrowRight,
  FiRefreshCw,
  FiBell,
  FiMail,
  FiPhone,
  FiSend,
} from 'react-icons/fi';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';

interface Escalation {
  id: string;
  user_hash: string;
  severity: 'low' | 'med' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'waiting' | 'closed';
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  summary_redacted?: string;
  sla_breach_at?: string;
  user_email?: string;
  user_phone?: string;
  telegram_username?: string;
}

const severityConfig = {
  critical: {
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: 'bg-red-500',
    label: 'Critical',
  },
  high: {
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    icon: 'bg-orange-500',
    label: 'High',
  },
  med: {
    color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    icon: 'bg-yellow-500',
    label: 'Moderate',
  },
  low: {
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: 'bg-blue-500',
    label: 'Low',
  },
};

const statusPriority: Record<Escalation['status'], number> = {
  new: 0,
  waiting: 1,
  in_progress: 2,
  closed: 3,
};

const severityPriority: Record<Escalation['severity'], number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
};

export default function CounselorEscalationsPage() {
  const router = useRouter();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'new' | 'waiting'>('all');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadEscalations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ cases: Escalation[] }>('/counselor/cases');
      const allCases = response.data.cases || [];
      // Escalations queue is intake-only; active handling belongs in My Cases.
      const escalationCases = allCases.filter((c) => c.status === 'new' || c.status === 'waiting');
      setEscalations(escalationCases);
    } catch (err) {
      console.error('Failed to load escalations:', err);
      setError('Failed to load escalations');
      toast.error('Failed to load escalations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEscalations();
  }, [loadEscalations]);

  const handleAccept = async (escalationId: string) => {
    try {
      setAcceptingId(escalationId);
      await apiClient.put(`/counselor/cases/${escalationId}/status`, {
        status: 'in_progress',
        note: 'Case accepted by counselor',
      });
      toast.success('Case accepted successfully');
      setEscalations((prev) => prev.filter((e) => e.id !== escalationId));

      const params = new URLSearchParams({
        highlight: escalationId,
        status: 'in_progress',
        source: 'escalations',
      });
      router.push(`/counselor/cases?${params.toString()}`);
    } catch (err) {
      console.error('Failed to accept case:', err);
      toast.error('Failed to accept case');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleViewCase = (escalation: Escalation) => {
    const params = new URLSearchParams({
      highlight: escalation.id,
      status: escalation.status,
      source: 'escalations',
    });
    router.push(`/counselor/cases?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedEscalations = useMemo(
    () =>
      [...escalations].sort((left, right) => {
        const byStatus = statusPriority[left.status] - statusPriority[right.status];
        if (byStatus !== 0) {
          return byStatus;
        }

        const bySeverity = severityPriority[left.severity] - severityPriority[right.severity];
        if (bySeverity !== 0) {
          return bySeverity;
        }

        const leftSla = left.sla_breach_at
          ? new Date(left.sla_breach_at).getTime()
          : Number.POSITIVE_INFINITY;
        const rightSla = right.sla_breach_at
          ? new Date(right.sla_breach_at).getTime()
          : Number.POSITIVE_INFINITY;
        if (leftSla !== rightSla) {
          return leftSla - rightSla;
        }

        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }),
    [escalations],
  );

  const filteredEscalations = sortedEscalations.filter((e) => {
    if (filter === 'all') return true;
    return e.status === filter;
  });

  const newCount = escalations.filter((e) => e.status === 'new').length;
  const waitingCount = escalations.filter((e) => e.status === 'waiting').length;
  const criticalCount = escalations.filter((e) => e.severity === 'critical').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading escalations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <FiAlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-red-300 font-semibold mb-2">Failed to load escalations</p>
          <p className="text-red-300/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadEscalations}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FiBell className="w-8 h-8 text-[#FFCA40]" />
            Escalations
          </h1>
          <p className="text-white/60">
            Risk-first intake queue of newly escalated cases awaiting counselor acceptance
          </p>
        </div>
        <button
          onClick={loadEscalations}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm text-white transition-all flex items-center gap-2"
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alert Banner for Critical Cases */}
      {criticalCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <FiAlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <p className="text-red-300 font-semibold">
                {criticalCount} critical{' '}
                {criticalCount === 1 ? 'case' : 'cases'} requiring immediate
                attention
              </p>
              <p className="text-red-300/70 text-sm">
                Please review and take action as soon as possible
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{escalations.length}</div>
          <div className="text-xs text-white/60 mt-1">Total In Intake Queue</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{newCount}</div>
          <div className="text-xs text-white/60 mt-1">New</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
          <div className="text-xs text-white/60 mt-1">Critical Priority</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setFilter('new')}
          className={`px-4 py-2 font-medium text-sm transition-all ${
            filter === 'new'
              ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          New ({newCount})
        </button>
        <button
          onClick={() => setFilter('waiting')}
          className={`px-4 py-2 font-medium text-sm transition-all ${
            filter === 'waiting'
              ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          Waiting ({waitingCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium text-sm transition-all ${
            filter === 'all'
              ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          All ({escalations.length})
        </button>
      </div>

      {/* Escalations List */}
      <div className="space-y-4">
        {filteredEscalations.length === 0 ? (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <FiCheckCircle className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">
              {escalations.length === 0
                ? 'No escalations in intake queue. Newly escalated cases will appear here.'
                : 'No escalations match the current filter'}
            </p>
          </div>
        ) : (
          filteredEscalations.map((escalation) => (
            <div
              key={escalation.id}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Severity Indicator */}
                <div className="shrink-0 mt-1">
                  <div
                    className={`w-3 h-3 rounded-full ${severityConfig[escalation.severity].icon} ${
                      escalation.status === 'new' ? 'animate-pulse' : ''
                    }`}
                  ></div>
                </div>

                {/* Middle: Content */}
                <div className="flex-1 space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-mono text-white/90">
                      {escalation.id.substring(0, 8)}...
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${severityConfig[escalation.severity].color}`}
                    >
                      {severityConfig[escalation.severity].label}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                      CMA
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        escalation.status === 'new'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : escalation.status === 'waiting'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-gray-500/20 text-gray-300'
                      }`}
                    >
                      {escalation.status === 'waiting' ? 'Waiting' : escalation.status}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <FiClock className="w-3 h-3" />
                      {formatDate(escalation.created_at)}
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-white/40" />
                      <span className="text-sm font-mono text-white/70">
                        {escalation.user_hash.substring(0, 16)}...
                      </span>
                    </div>
                    {escalation.user_email && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <FiMail className="w-3 h-3" />
                        {escalation.user_email}
                      </div>
                    )}
                    {escalation.user_phone && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <FiPhone className="w-3 h-3" />
                        {escalation.user_phone}
                      </div>
                    )}
                    {escalation.telegram_username && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <FiSend className="w-3 h-3" />
                        @{escalation.telegram_username}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {escalation.summary_redacted && (
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-sm font-medium text-white/90 mb-1">
                        Case Summary:
                      </p>
                      <p className="text-sm text-white/70">
                        {escalation.summary_redacted}
                      </p>
                    </div>
                  )}

                  {/* SLA Warning */}
                  {escalation.sla_breach_at && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-orange-300 mb-1">
                        SLA Deadline:
                      </p>
                      <p className="text-sm text-orange-200/80">
                        {new Date(escalation.sla_breach_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="shrink-0 flex flex-col gap-2">
                  {(escalation.status === 'new' || escalation.status === 'waiting') && (
                    <button
                      onClick={() => handleAccept(escalation.id)}
                      disabled={acceptingId === escalation.id}
                      className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                    >
                      <FiCheckCircle className="w-4 h-4" />
                      {acceptingId === escalation.id ? 'Accepting...' : 'Accept Case'}
                    </button>
                  )}
                  <button
                    onClick={() => handleViewCase(escalation)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white/70 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <FiArrowRight className="w-4 h-4" />
                    View in Cases
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
