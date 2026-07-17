'use client';

/**
 * Redesigned Conversations Page - Table View
 * Matches UGM-AICare color scheme with efficient data scanning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { 
  FiMessageSquare, FiSearch, FiFilter, FiDownload, FiAlertTriangle,
  FiClock, FiUser, FiBarChart2, FiTrendingUp, FiActivity, FiEye, 
} from 'react-icons/fi';
import { apiCall, authenticatedFetch } from '@/utils/adminApi';

// Types
interface ConversationSession {
  session_id: string;
  user_id_hash: string;
  message_count: number;
  first_time: string;
  last_time: string;
  last_preview: string;
  last_role?: 'assistant' | 'user' | string;
  last_text?: string;
  open_flag_count?: number;
}

interface ConversationStats {
  total_conversations: number;
  total_sessions: number;
  total_users_with_conversations: number;
  avg_messages_per_session: number;
  conversations_today: number;
  conversations_this_week: number;
}

interface SessionsResponse {
  sessions: ConversationSession[];
  total_count: number;
}

interface ConversationsResponse {
  conversations: ConversationSession[];
  total_count: number;
  stats: ConversationStats;
}

// API Functions
const fetchSessions = async (params: { 
  page: number; 
  limit: number; 
  session_search?: string; 
  date_from?: string; 
  date_to?: string; 
}) => {
  const query = new URLSearchParams({ 
    page: String(params.page), 
    limit: String(params.limit) 
  });
  if (params.session_search) query.append('session_search', params.session_search);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  return apiCall<SessionsResponse>(`/api/v1/admin/conversation-sessions?${query.toString()}`);
};

const fetchStats = async () => {
  const response = await apiCall<ConversationsResponse>('/api/v1/admin/conversations?page=1&limit=1');
  return response.stats;
};

// Stats Card Component
const StatCard: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  subtitle?: string;
  color: 'blue' | 'purple' | 'emerald' | 'orange';
}> = ({ icon, label, value, subtitle, color }) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/70">{label}</span>
        <div className="text-white/80">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subtitle && <div className="text-xs text-white/60">{subtitle}</div>}
    </div>
  );
};

// Session Card Component
const SessionCard: React.FC<{
  session: ConversationSession;
  onView: (sessionId: string) => void;
  onFlag: (sessionId: string) => void;
}> = ({ session, onView, onFlag }) => {
  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const isAssistant = (session.last_role || 'assistant') === 'assistant';
  const preview = session.last_text || session.last_preview || 'No content';

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
            <FiMessageSquare className="w-5 h-5 text-purple-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-white/90 truncate">
                #{session.session_id.slice(0, 8)}
              </span>
              {session.open_flag_count && session.open_flag_count > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-300 flex items-center gap-1">
                  <FiAlertTriangle className="w-3 h-3" />
                  {session.open_flag_count}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <FiUser className="w-3 h-3" />
              <span className="font-mono truncate">{session.user_id_hash}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-300">
            {session.message_count} msgs
          </div>
        </div>
      </div>

      {/* Last Message Preview */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            isAssistant 
              ? 'bg-emerald-500/20 text-emerald-300' 
              : 'bg-purple-500/20 text-purple-300'
          }`}>
            {isAssistant ? 'AI Response' : 'User Message'}
          </span>
          <span className="text-xs text-white/40">Last activity</span>
        </div>
        <p className="text-sm text-white/80 line-clamp-2">
          {preview}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <FiClock className="w-3 h-3" />
          {getTimeAgo(session.last_time)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFlag(session.session_id)}
            className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-lg text-xs font-medium text-white/70 hover:text-red-300 transition-all flex items-center gap-1.5"
          >
            <FiAlertTriangle className="w-3 h-3" />
            Flag
          </button>
          <button
            onClick={() => onView(session.session_id)}
            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs font-medium text-purple-300 transition-all flex items-center gap-1.5"
          >
            <FiEye className="w-3 h-3" />
            View
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function ConversationsPage() {
  const router = useRouter();

  // State
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [userHashFilter, setUserHashFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Flag modal
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagSessionId, setFlagSessionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagTags, setFlagTags] = useState('');

  const ITEMS_PER_PAGE = 12;

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, statsData] = await Promise.all([
        fetchSessions({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          session_search: searchTerm || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        fetchStats(),
      ]);

      let filtered = sessionsData.sessions;
      if (userHashFilter.trim()) {
        const needle = userHashFilter.trim().toLowerCase();
        filtered = filtered.filter(s => s.user_id_hash.toLowerCase().includes(needle));
      }

      setSessions(filtered);
      setTotalCount(sessionsData.total_count);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, dateFrom, dateTo, userHashFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleViewSession = (sessionId: string) => {
    router.push(`/admin/conversations/session/${sessionId}`);
  };

  const handleOpenFlag = (sessionId: string) => {
    setFlagSessionId(sessionId);
    setFlagReason('');
    setFlagTags('');
    setFlagOpen(true);
  };

  const submitFlag = async () => {
    if (!flagSessionId) return;
    try {
      const tags = flagTags.split(',').map(t => t.trim()).filter(Boolean);
      await apiCall(`/api/v1/admin/conversations/session/${flagSessionId}/flag`, {
        method: 'POST',
        body: JSON.stringify({ 
          reason: flagReason || undefined, 
          tags: tags.length ? tags : undefined 
        })
      });
      setFlagOpen(false);
      alert('Session flagged successfully');
      loadData();
    } catch (err: unknown) {
      // Safely derive a user-facing message from the caught value and avoid instanceof on non-object types
      console.error('Flagging session failed', err);
      const msg =
        err instanceof Error ? err.message :
        typeof err === 'string' ? err :
        'Failed to flag session';
      alert(msg);
    }
  };

  const handleExport = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const q = new URLSearchParams();
      if (searchTerm) q.append('session_search', searchTerm);
      if (dateFrom) q.append('date_from', dateFrom);
      if (dateTo) q.append('date_to', dateTo);
      const res = await authenticatedFetch(`${base}/api/v1/admin/conversation-sessions/export.csv?${q.toString()}`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'conversations_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert('Export failed');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setUserHashFilter('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasActiveFilters = searchTerm || userHashFilter || dateFrom || dateTo;

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <FiAlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Error Loading Data</h2>
          <p className="text-white/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-sm font-medium text-purple-300 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FiMessageSquare className="w-8 h-8 text-purple-400" />
              <h1 className="text-3xl font-bold text-white">Conversations</h1>
            </div>
            <p className="text-white/60 text-sm">
              Monitor and analyze AI chat sessions with privacy protection
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white/80 transition-all flex items-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/80'
              }`}
            >
              <FiFilter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 bg-purple-400 text-purple-900 rounded text-xs font-bold">
                  {[searchTerm, userHashFilter, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<FiBarChart2 className="w-5 h-5" />}
              label="Total Sessions"
              value={stats.total_sessions.toLocaleString()}
              subtitle={`${stats.total_users_with_conversations} unique users`}
              color="blue"
            />
            <StatCard
              icon={<FiActivity className="w-5 h-5" />}
              label="Total Conversations"
              value={stats.total_conversations.toLocaleString()}
              subtitle={`${stats.conversations_today} today`}
              color="purple"
            />
            <StatCard
              icon={<FiTrendingUp className="w-5 h-5" />}
              label="Avg Session Length"
              value={stats.avg_messages_per_session.toFixed(1)}
              subtitle="messages per session"
              color="emerald"
            />
            <StatCard
              icon={<FiClock className="w-5 h-5" />}
              label="This Week"
              value={stats.conversations_this_week.toLocaleString()}
              subtitle="conversations"
              color="orange"
            />
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">
                  Search Sessions
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Session ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">
                  User Hash
                </label>
                <input
                  type="text"
                  placeholder="Filter by user..."
                  value={userHashFilter}
                  onChange={(e) => setUserHashFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/70 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Clear All
              </button>
              <div className="text-xs text-white/50">
                Showing {sessions.length} of {totalCount.toLocaleString()} sessions
              </div>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-24"></div>
                    <div className="h-3 bg-white/10 rounded w-32"></div>
                  </div>
                </div>
                <div className="h-20 bg-white/10 rounded-lg mb-4"></div>
                <div className="flex justify-between">
                  <div className="h-8 bg-white/10 rounded w-16"></div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-white/10 rounded w-16"></div>
                    <div className="h-8 bg-white/10 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <FiMessageSquare className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No conversations found</h3>
            <p className="text-white/60 text-sm">
              {hasActiveFilters 
                ? 'Try adjusting your filters to see more results'
                : 'No conversation sessions available yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  onView={handleViewSession}
                  onFlag={handleOpenFlag}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page <= totalPages) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                            currentPage === page
                              ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/70'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* Flag Modal */}
        {flagOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setFlagOpen(false)} 
            />
            <div className="relative bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FiAlertTriangle className="w-5 h-5 text-red-400" />
                Flag Session
              </h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Session ID
                  </label>
                  <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 font-mono">
                    {flagSessionId}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Reason
                  </label>
                  <textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none"
                    placeholder="Describe why this session is being flagged..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    value={flagTags}
                    onChange={(e) => setFlagTags(e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                    placeholder="crisis, escalation, urgent..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setFlagOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white/70 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFlag}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm font-medium text-red-300 transition-all"
                >
                  Flag Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
