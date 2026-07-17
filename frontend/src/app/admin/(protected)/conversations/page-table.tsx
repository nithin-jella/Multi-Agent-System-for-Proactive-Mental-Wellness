'use client';

/**
 * Conversations Page - Table View
 * Matches UGM-AICare blue/gold color scheme with efficient scanning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  FiMessageSquare,
  FiSearch,
  FiFilter,
  FiDownload,
  FiAlertTriangle,
  FiClock,
  FiUser,
  FiBarChart2,
  FiTrendingUp,
  FiActivity,
  FiEye,
  FiList,
  FiGrid,
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
}> = ({ icon, label, value, subtitle }) => {
  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFCA40]/15 text-[#FFCA40]">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
          {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
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
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

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

  const ITEMS_PER_PAGE = 15;

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
      // Log full error for diagnostics (no PII)
      console.error('Flagging session failed', err);
      // Safely derive a user-friendly message
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

  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasActiveFilters = searchTerm || userHashFilter || dateFrom || dateTo;

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 max-w-md text-center">
          <FiAlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Error Loading Data</h2>
          <p className="text-white/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FiMessageSquare className="w-8 h-8 text-[#FFCA40]" />
              <h1 className="text-3xl font-bold text-white">AI Conversations</h1>
            </div>
            <p className="text-white/60 text-sm">
              Monitor chat sessions with privacy protection
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#FFCA40] text-[#001d58]'
                    : 'text-white/60 hover:text-white/80'
                }`}
                title="Table view"
              >
                <FiList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'cards'
                    ? 'bg-[#FFCA40] text-[#001d58]'
                    : 'text-white/60 hover:text-white/80'
                }`}
                title="Card view"
              >
                <FiGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white/80 transition-all flex items-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-[#FFCA40]/20 border border-[#FFCA40]/40 text-[#FFCA40]'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/80'
              }`}
            >
              <FiFilter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 bg-[#FFCA40] text-[#001d58] rounded text-xs font-bold">
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
              subtitle={`${stats.total_users_with_conversations} users`}
            />
            <StatCard
              icon={<FiActivity className="w-5 h-5" />}
              label="Conversations"
              value={stats.total_conversations.toLocaleString()}
              subtitle={`${stats.conversations_today} today`}
            />
            <StatCard
              icon={<FiTrendingUp className="w-5 h-5" />}
              label="Avg Session"
              value={stats.avg_messages_per_session.toFixed(1)}
              subtitle="messages"
            />
            <StatCard
              icon={<FiClock className="w-5 h-5" />}
              label="This Week"
              value={stats.conversations_this_week.toLocaleString()}
              subtitle="conversations"
            />
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label htmlFor="searchTerm" className="block text-xs font-medium text-white/70 mb-2">
                  Search Sessions
                </label>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    id="searchTerm"
                    type="text"
                    placeholder="Session ID..."
                    title="Search sessions by session ID"
                    aria-label="Search sessions by session ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="userHashFilter" className="block text-xs font-medium text-white/70 mb-2">
                  User Hash
                </label>
                <input
                  id="userHashFilter"
                  type="text"
                  placeholder="Filter by user..."
                  title="Filter by user hash"
                  aria-label="Filter by user hash"
                  value={userHashFilter}
                  onChange={(e) => setUserHashFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all"
                />
              </div>

              <div>
                <label htmlFor="dateFrom" className="block text-xs font-medium text-white/70 mb-2">
                  From Date
                </label>
                <input
                  id="dateFrom"
                  type="date"
                  title="Filter from date"
                  aria-label="Filter from date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all"
                />
              </div>

              <div>
                <label htmlFor="dateTo" className="block text-xs font-medium text-white/70 mb-2">
                  To Date
                </label>
                <input
                  id="dateTo"
                  type="date"
                  title="Filter to date"
                  aria-label="Filter to date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all"
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

        {/* Table View */}
        {viewMode === 'table' ? (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Last Message
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Flags
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Last Activity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white/70 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-20"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-24"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-full"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-8 mx-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-8 mx-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-4 bg-white/10 rounded w-16"></div></td>
                        <td className="px-4 py-4"><div className="h-8 bg-white/10 rounded w-20 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : sessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <FiMessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-white/60">No conversations found</p>
                      </td>
                    </tr>
                  ) : (
                    sessions.map((session) => {
                      const isAI = (session.last_role || 'assistant') === 'assistant';
                      const preview = session.last_text || session.last_preview || 'No content';
                      return (
                        <tr 
                          key={session.session_id} 
                          className="hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => handleViewSession(session.session_id)}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FiMessageSquare className="w-4 h-4 text-[#FFCA40]/60" />
                              <span className="text-sm font-mono text-white/90">
                                #{session.session_id.slice(0, 8)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FiUser className="w-3 h-3 text-white/40" />
                              <span className="text-xs font-mono text-white/70">
                                {session.user_id_hash.slice(0, 12)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 max-w-md">
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                                isAI 
                                  ? 'bg-[#FFCA40]/20 text-[#FFCA40]' 
                                  : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {isAI ? 'AI' : 'User'}
                              </span>
                              <p className="text-sm text-white/80 line-clamp-2">{preview}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs font-medium text-blue-300">
                              {session.message_count}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {session.open_flag_count && session.open_flag_count > 0 ? (
                              <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs font-medium text-red-300 flex items-center justify-center gap-1">
                                <FiAlertTriangle className="w-3 h-3" />
                                {session.open_flag_count}
                              </span>
                            ) : (
                              <span className="text-white/30 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-white/60">
                              <FiClock className="w-3 h-3" />
                              {getTimeAgo(session.last_time)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFlag(session.session_id);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded text-xs text-white/70 hover:text-red-300 transition-all"
                              >
                                Flag
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewSession(session.session_id);
                                }}
                                className="px-3 py-1 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded text-xs font-medium text-[#FFCA40] transition-all flex items-center gap-1"
                              >
                                <FiEye className="w-3 h-3" />
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card View - Fallback */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => {
              const isAI = (session.last_role || 'assistant') === 'assistant';
              const preview = session.last_text || session.last_preview || 'No content';
              return (
                <div 
                  key={session.session_id}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => handleViewSession(session.session_id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-sm font-mono text-white/90">#{session.session_id.slice(0, 8)}</span>
                      <p className="text-xs text-white/50 font-mono">{session.user_id_hash.slice(0, 16)}</p>
                    </div>
                    <span className="px-2 py-1 bg-blue-500/20 rounded text-xs text-blue-300">
                      {session.message_count} msgs
                    </span>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      isAI ? 'bg-[#FFCA40]/20 text-[#FFCA40]' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {isAI ? 'AI' : 'User'}
                    </span>
                    <p className="text-sm text-white/80 mt-2 line-clamp-2">{preview}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>{getTimeAgo(session.last_time)}</span>
                    {session.open_flag_count && session.open_flag_count > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded flex items-center gap-1">
                        <FiAlertTriangle className="w-3 h-3" />
                        {session.open_flag_count}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                          ? 'bg-[#FFCA40] text-[#001d58] font-semibold'
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

        {/* Flag Modal */}
        {flagOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setFlagOpen(false)} 
            />
            <div className="relative bg-[#001d58] border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
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
                  <label htmlFor="flagReason" className="block text-sm font-medium text-white/70 mb-2">
                    Reason
                  </label>
                  <textarea
                    id="flagReason"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    rows={4}
                    placeholder="Describe why this session is being flagged..."
                    title="Describe why this session is being flagged"
                    aria-label="Flag reason"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="flagTags" className="block text-sm font-medium text-white/70 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    id="flagTags"
                    value={flagTags}
                    onChange={(e) => setFlagTags(e.target.value)}
                    placeholder="crisis, escalation, urgent..."
                    title="Comma separated tags for flagging"
                    aria-label="Flag tags"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-all"
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
