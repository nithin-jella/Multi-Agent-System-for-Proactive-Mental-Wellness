'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBarChart2,
  FiClock,
  FiDownload,
  FiFilter,
  FiMessageSquare,
  FiSearch,
  FiUsers,
} from 'react-icons/fi';
import { apiCall, authenticatedFetch } from '@/utils/adminApi';

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

interface UserConversationGroup {
  userHash: string;
  sessions: ConversationSession[];
  totalMessages: number;
  lastActivityIso: string;
  openFlagCount: number;
}

interface ConversationsByUserViewProps {
  portal: 'admin' | 'counselor';
  title: string;
  subtitle: string;
  onOpenSession?: (sessionId: string) => void;
  allowFlagging?: boolean;
}

interface FetchSessionsParams {
  page: number;
  limit: number;
  session_search?: string;
  date_from?: string;
  date_to?: string;
  user_id_hash?: string;
}

const OVERVIEW_PAGE_SIZE = 100;
const USER_SESSIONS_PAGE_SIZE = 20;

const buildSessionsQuery = (params: FetchSessionsParams) => {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.session_search) query.append('session_search', params.session_search);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.user_id_hash) query.append('user_id_hash', params.user_id_hash);

  return query.toString();
};

function formatAgo(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'Recently';
  }
}

function buildUserGroups(sessions: ConversationSession[]): UserConversationGroup[] {
  const groups = new Map<string, UserConversationGroup>();

  for (const session of sessions) {
    const existing = groups.get(session.user_id_hash);
    if (!existing) {
      groups.set(session.user_id_hash, {
        userHash: session.user_id_hash,
        sessions: [session],
        totalMessages: session.message_count,
        lastActivityIso: session.last_time,
        openFlagCount: session.open_flag_count || 0,
      });
      continue;
    }

    existing.sessions.push(session);
    existing.totalMessages += session.message_count;
    existing.openFlagCount += session.open_flag_count || 0;

    if (new Date(session.last_time).getTime() > new Date(existing.lastActivityIso).getTime()) {
      existing.lastActivityIso = session.last_time;
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.lastActivityIso).getTime() - new Date(a.lastActivityIso).getTime(),
  );
}

export function ConversationsByUserView({
  portal,
  title,
  subtitle,
  onOpenSession,
  allowFlagging = false,
}: ConversationsByUserViewProps) {
  const apiPrefix = portal === 'counselor' ? '/api/v1/counselor' : '/api/v1/admin';

  const fetchSessions = useCallback(
    async (params: FetchSessionsParams) => {
      const query = buildSessionsQuery(params);
      return apiCall<SessionsResponse>(`${apiPrefix}/conversation-sessions?${query}`);
    },
    [apiPrefix],
  );

  const fetchStats = useCallback(async () => {
    if (portal === 'counselor') {
      return apiCall<ConversationStats>(`${apiPrefix}/conversation-sessions/stats`);
    }

    const response = await apiCall<ConversationsResponse>(`${apiPrefix}/conversations?page=1&limit=1`);
    return response.stats;
  }, [apiPrefix, portal]);

  const [stats, setStats] = useState<ConversationStats | null>(null);

  const [overviewSessions, setOverviewSessions] = useState<ConversationSession[]>([]);
  const [overviewTotalCount, setOverviewTotalCount] = useState(0);
  const [overviewPage, setOverviewPage] = useState(1);

  const [selectedUserHash, setSelectedUserHash] = useState<string | null>(null);
  const [selectedUserSessions, setSelectedUserSessions] = useState<ConversationSession[]>([]);
  const [selectedUserTotalCount, setSelectedUserTotalCount] = useState(0);
  const [selectedUserPage, setSelectedUserPage] = useState(1);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingUserSessions, setLoadingUserSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionSearch, setSessionSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagSessionId, setFlagSessionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagTags, setFlagTags] = useState('');

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setError(null);

    try {
      const [sessionsData, statsData] = await Promise.all([
        fetchSessions({
          page: overviewPage,
          limit: OVERVIEW_PAGE_SIZE,
          session_search: sessionSearch || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        fetchStats(),
      ]);

      setOverviewSessions(sessionsData.sessions);
      setOverviewTotalCount(sessionsData.total_count);
      setStats(statsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(message);
    } finally {
      setLoadingOverview(false);
    }
  }, [dateFrom, dateTo, fetchSessions, fetchStats, overviewPage, sessionSearch]);

  const loadSelectedUserSessions = useCallback(async () => {
    if (!selectedUserHash) {
      return;
    }

    setLoadingUserSessions(true);
    setError(null);

    try {
      const sessionsData = await fetchSessions({
        page: selectedUserPage,
        limit: USER_SESSIONS_PAGE_SIZE,
        session_search: sessionSearch || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        user_id_hash: selectedUserHash,
      });

      setSelectedUserSessions(sessionsData.sessions);
      setSelectedUserTotalCount(sessionsData.total_count);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load user sessions';
      setError(message);
    } finally {
      setLoadingUserSessions(false);
    }
  }, [dateFrom, dateTo, fetchSessions, selectedUserHash, selectedUserPage, sessionSearch]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedUserHash) {
      return;
    }
    loadSelectedUserSessions();
  }, [selectedUserHash, loadSelectedUserSessions]);

  const groupedUsers = useMemo(() => {
    const groups = buildUserGroups(overviewSessions);
    if (!userSearch.trim()) {
      return groups;
    }

    const needle = userSearch.trim().toLowerCase();
    return groups.filter((group) => group.userHash.toLowerCase().includes(needle));
  }, [overviewSessions, userSearch]);

  const selectedUserSummary = useMemo(() => {
    if (!selectedUserHash) {
      return null;
    }

    const fromOverview = groupedUsers.find((group) => group.userHash === selectedUserHash);
    if (fromOverview) {
      return fromOverview;
    }

    if (selectedUserSessions.length === 0) {
      return null;
    }

    const totalMessages = selectedUserSessions.reduce((sum, session) => sum + session.message_count, 0);
    const openFlagCount = selectedUserSessions.reduce((sum, session) => sum + (session.open_flag_count || 0), 0);

    return {
      userHash: selectedUserHash,
      sessions: selectedUserSessions,
      totalMessages,
      openFlagCount,
      lastActivityIso: selectedUserSessions[0].last_time,
    } satisfies UserConversationGroup;
  }, [groupedUsers, selectedUserHash, selectedUserSessions]);

  const overviewTotalPages = Math.ceil(overviewTotalCount / OVERVIEW_PAGE_SIZE);
  const selectedUserTotalPages = Math.ceil(selectedUserTotalCount / USER_SESSIONS_PAGE_SIZE);
  const filterCount = [sessionSearch, userSearch, dateFrom, dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setSessionSearch('');
    setUserSearch('');
    setDateFrom('');
    setDateTo('');
    setOverviewPage(1);
    setSelectedUserPage(1);
  };

  const handleSelectUser = (userHash: string) => {
    setSelectedUserHash(userHash);
    setSelectedUserPage(1);
  };

  const handleBackToUsers = () => {
    setSelectedUserHash(null);
    setSelectedUserPage(1);
  };

  const openFlagModal = (sessionId: string) => {
    if (!allowFlagging) {
      return;
    }
    setFlagSessionId(sessionId);
    setFlagReason('');
    setFlagTags('');
    setFlagOpen(true);
  };

  const submitFlag = async () => {
    if (!flagSessionId) {
      return;
    }

    try {
      const tags = flagTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      await apiCall(`${apiPrefix}/conversations/session/${flagSessionId}/flag`, {
        method: 'POST',
        body: JSON.stringify({
          reason: flagReason || undefined,
          tags: tags.length ? tags : undefined,
        }),
      });

      toast.success('Session flagged successfully');
      setFlagOpen(false);
      await loadSelectedUserSessions();
      await loadOverview();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to flag session';
      toast.error(message);
    }
  };

  const handleExport = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const query = new URLSearchParams();

      if (sessionSearch) query.append('session_search', sessionSearch);
      if (dateFrom) query.append('date_from', dateFrom);
      if (dateTo) query.append('date_to', dateTo);
      if (selectedUserHash) query.append('user_id_hash', selectedUserHash);

      const response = await authenticatedFetch(
        `${base}${apiPrefix}/conversation-sessions/export.csv?${query.toString()}`,
      );

      const text = await response.text();
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = selectedUserHash
        ? `conversations_${selectedUserHash.slice(0, 10)}.csv`
        : 'conversations_export.csv';

      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-105">
        <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <FiAlertTriangle className="mx-auto mb-3 h-9 w-9 text-red-400" />
          <h2 className="mb-2 text-base font-semibold text-white">Error Loading Conversations</h2>
          <p className="mb-4 text-sm text-red-200/80">{error}</p>
          <button
            onClick={selectedUserHash ? loadSelectedUserSessions : loadOverview}
            className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-400/20"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <FiMessageSquare className="h-6 w-6 text-[#FFCA40]" />
              <h1 className="text-2xl font-bold text-white">{title}</h1>
            </div>
            <p className="ml-9 text-sm text-white/55">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              <FiDownload className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                showFilters || filterCount > 0
                  ? 'border border-[#FFCA40]/30 bg-[#FFCA40]/15 text-[#FFCA40]'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <FiFilter className="h-3.5 w-3.5" />
              Filters
              {filterCount > 0 && (
                <span className="rounded bg-[#FFCA40] px-1.5 py-0.5 text-[10px] font-bold text-[#001D58]">
                  {filterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              icon: <FiBarChart2 className="h-4 w-4" />,
              label: 'Total Sessions',
              value: stats.total_sessions.toLocaleString(),
              sub: `${stats.total_users_with_conversations} users`,
            },
            {
              icon: <FiMessageSquare className="h-4 w-4" />,
              label: 'Conversations',
              value: stats.total_conversations.toLocaleString(),
              sub: `${stats.conversations_today} today`,
            },
            {
              icon: <FiUsers className="h-4 w-4" />,
              label: 'Avg Session',
              value: stats.avg_messages_per_session.toFixed(1),
              sub: 'messages',
            },
            {
              icon: <FiClock className="h-4 w-4" />,
              label: 'This Week',
              value: stats.conversations_this_week.toLocaleString(),
              sub: 'conversations',
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[#FFCA40]/10 p-2.5 text-[#FFCA40]">{card.icon}</div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/50">{card.label}</p>
                  <p className="text-lg font-semibold text-white">{card.value}</p>
                  <p className="text-[11px] text-white/40">{card.sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="conversation-filter-session" className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">
                Session Search
              </label>
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <input
                  id="conversation-filter-session"
                  type="text"
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder="Session ID"
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="conversation-filter-user" className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">
                User Hash
              </label>
              <input
                id="conversation-filter-user"
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search user hash"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
              />
            </div>

            <div>
              <label htmlFor="conversation-filter-from" className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">
                From Date
              </label>
              <input
                id="conversation-filter-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
              />
            </div>

            <div>
              <label htmlFor="conversation-filter-to" className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">
                To Date
              </label>
              <input
                id="conversation-filter-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <button
              onClick={clearFilters}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/10"
            >
              Clear All
            </button>
            <span className="text-[11px] text-white/45">
              {selectedUserHash
                ? `${selectedUserTotalCount.toLocaleString()} sessions for selected user`
                : `${overviewTotalCount.toLocaleString()} total sessions`}
            </span>
          </div>
        </div>
      )}

      {!selectedUserHash ? (
        <>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-sm font-semibold text-white">User Groups</h2>
            <p className="mt-1 text-xs text-white/50">
              Select a user to open their session list. Showing {groupedUsers.length} users from this result set.
            </p>
          </div>

          {loadingOverview ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : groupedUsers.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
              <FiUsers className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm text-white/55">No users found for the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupedUsers.map((group) => (
                <button
                  key={group.userHash}
                  type="button"
                  onClick={() => handleSelectUser(group.userHash)}
                  className="group rounded-xl border border-white/10 bg-linear-to-br from-white/5 to-white/2 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#FFCA40]/35 hover:bg-white/8"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-white/45">User Hash</p>
                      <p className="font-mono text-sm text-white/85">{group.userHash}</p>
                    </div>
                    <span className="rounded-full border border-[#FFCA40]/30 bg-[#FFCA40]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#FFCA40]">
                      {group.sessions.length} sessions
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/4 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-white/45">Messages</p>
                      <p className="text-sm font-semibold text-white">{group.totalMessages.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/4 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-white/45">Open Flags</p>
                      <p className="text-sm font-semibold text-white">{group.openFlagCount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                    <span className="inline-flex items-center gap-1">
                      <FiClock className="h-3 w-3" />
                      {formatAgo(group.lastActivityIso)}
                    </span>
                    <span className="font-medium text-[#FFCA40] transition group-hover:text-[#ffd970]">
                      View Sessions
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {overviewTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setOverviewPage((prev) => Math.max(1, prev - 1))}
                disabled={overviewPage === 1}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-white/55">
                Page {overviewPage} of {overviewTotalPages}
              </span>
              <button
                onClick={() => setOverviewPage((prev) => Math.min(overviewTotalPages, prev + 1))}
                disabled={overviewPage === overviewTotalPages}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={handleBackToUsers}
                  className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-white/65 transition hover:text-white"
                >
                  <FiArrowLeft className="h-3.5 w-3.5" />
                  Back to User Groups
                </button>
                <h2 className="text-base font-semibold text-white">Sessions for {selectedUserHash}</h2>
                <p className="mt-1 text-xs text-white/50">
                  {selectedUserTotalCount.toLocaleString()} sessions matched for this user.
                </p>
              </div>

              {selectedUserSummary && (
                <div className="grid grid-cols-2 gap-3 text-right">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">Messages</p>
                    <p className="text-sm font-semibold text-white">{selectedUserSummary.totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">Open Flags</p>
                    <p className="text-sm font-semibold text-white">{selectedUserSummary.openFlagCount.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/50">Session</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/50">Last Message</th>
                    <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-white/50">Msgs</th>
                    <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider text-white/50">Flags</th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-white/50">Last Activity</th>
                    <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-white/50">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingUserSessions ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-4 py-3.5"><div className="h-4 w-28 rounded bg-white/5" /></td>
                        <td className="px-4 py-3.5"><div className="h-4 w-full rounded bg-white/5" /></td>
                        <td className="px-4 py-3.5"><div className="mx-auto h-4 w-8 rounded bg-white/5" /></td>
                        <td className="px-4 py-3.5"><div className="mx-auto h-4 w-8 rounded bg-white/5" /></td>
                        <td className="px-4 py-3.5"><div className="h-4 w-20 rounded bg-white/5" /></td>
                        <td className="px-4 py-3.5"><div className="ml-auto h-6 w-20 rounded bg-white/5" /></td>
                      </tr>
                    ))
                  ) : selectedUserSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-14 text-center text-sm text-white/55">
                        No sessions found for this user and filter combination.
                      </td>
                    </tr>
                  ) : (
                    selectedUserSessions.map((session) => {
                      const preview = session.last_text || session.last_preview || 'No content';

                      return (
                        <tr key={session.session_id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-sm text-white/80">#{session.session_id.slice(0, 12)}</span>
                          </td>
                          <td className="max-w-lg px-4 py-3.5">
                            <p className="line-clamp-1 text-sm text-white/70">{preview}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="rounded border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                              {session.message_count}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {session.open_flag_count && session.open_flag_count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                                <FiAlertTriangle className="h-3 w-3" />
                                {session.open_flag_count}
                              </span>
                            ) : (
                              <span className="text-xs text-white/30">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-white/55">{formatAgo(session.last_time)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {allowFlagging && (
                                <button
                                  type="button"
                                  onClick={() => openFlagModal(session.session_id)}
                                  className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-300"
                                >
                                  Flag
                                </button>
                              )}
                              {onOpenSession && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSession(session.session_id)}
                                  className="rounded border border-[#FFCA40]/30 bg-[#FFCA40]/15 px-2.5 py-1 text-[11px] font-medium text-[#FFCA40] transition-colors hover:bg-[#FFCA40]/25"
                                >
                                  View
                                </button>
                              )}
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

          {selectedUserTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setSelectedUserPage((prev) => Math.max(1, prev - 1))}
                disabled={selectedUserPage === 1}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-white/55">
                Page {selectedUserPage} of {selectedUserTotalPages}
              </span>
              <button
                onClick={() => setSelectedUserPage((prev) => Math.min(selectedUserTotalPages, prev + 1))}
                disabled={selectedUserPage === selectedUserTotalPages}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {allowFlagging && flagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setFlagOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-white/15 bg-[#001030] p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-white">Flag Session</h3>

            <div className="mb-4 space-y-3">
              <div>
                <label htmlFor="flag-session" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/50">
                  Session
                </label>
                <input
                  id="flag-session"
                  value={flagSessionId || ''}
                  readOnly
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono text-white/80"
                />
              </div>

              <div>
                <label htmlFor="flag-reason" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/50">
                  Reason
                </label>
                <textarea
                  id="flag-reason"
                  rows={3}
                  value={flagReason}
                  onChange={(event) => setFlagReason(event.target.value)}
                  placeholder="Describe why this session should be reviewed"
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
                />
              </div>

              <div>
                <label htmlFor="flag-tags" className="mb-1.5 block text-[11px] uppercase tracking-wider text-white/50">
                  Tags
                </label>
                <input
                  id="flag-tags"
                  value={flagTags}
                  onChange={(event) => setFlagTags(event.target.value)}
                  placeholder="risk, escalation, urgent"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setFlagOpen(false)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/65 transition-colors hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submitFlag}
                className="rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
              >
                Flag Session
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-2" />

      {portal === 'counselor' && (
        <p className="text-xs text-white/45">
          Counselors can review grouped session metadata here. Flagging and detailed transcript management remain available in the admin workflow.
        </p>
      )}
    </div>
  );
}
