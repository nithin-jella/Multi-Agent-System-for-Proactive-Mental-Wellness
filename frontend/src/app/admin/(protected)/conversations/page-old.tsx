'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  Search,
  Filter,
  MessageSquare,
  Clock,
  Hash,
  Users,
  BarChart3,
  MessageCircle,
  Timer,
  Flag as FlagIcon,
  Download as DownloadIcon,
  FileSpreadsheet
} from 'lucide-react';
import Image from 'next/image';
import { FiMessageCircle as ChatIcon } from '@/icons';
import Tooltip from '@/components/ui/Tooltip';
import { formatDistanceToNow } from 'date-fns';

// Hydration safe wrapper to prevent SSR mismatches
const HydrationSafeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">Loading conversations...</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we load the conversation data.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Types
interface ConversationListItem {
  id: number;
  user_id_hash: string;
  session_id: string;
  conversation_id: string;
  message_preview: string;
  response_preview: string;
  timestamp: string;
  message_length: number;
  response_length: number;
  session_message_count: number;
  last_text?: string;
  last_role?: 'assistant' | 'user' | string;
  open_flag_count?: number;
}

interface ConversationStats {
  total_conversations: number;
  total_sessions: number;
  total_users_with_conversations: number;
  avg_messages_per_session: number;
  avg_message_length: number;
  avg_response_length: number;
  conversations_today: number;
  conversations_this_week: number;
  most_active_hour: number;
}

interface ConversationsResponse {
  conversations: ConversationListItem[];
  total_count: number;
  stats: ConversationStats;
}
// Grouped session view type
import { apiCall, authenticatedFetch } from '@/utils/adminApi';

// API function (uses session automatically via adminApi)
const fetchConversations = async (
  params: {
    page: number;
    limit: number;
    search?: string;
    session_id?: string;
    date_from?: string;
    date_to?: string;
  }
): Promise<ConversationsResponse> => {
  const queryParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.search) queryParams.append('search', params.search);
  if (params.session_id) queryParams.append('session_id', params.session_id);
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);

  return apiCall<ConversationsResponse>(`/api/v1/admin/conversations?${queryParams.toString()}`);
};

// Server-side sessions listing
interface SessionsListResponse {
  sessions: {
    session_id: string;
    user_id_hash: string;
    message_count: number;
    first_time: string;
    last_time: string;
    last_preview: string;
    last_role?: 'assistant' | 'user' | string;
    last_text?: string;
    open_flag_count?: number;
  }[];
  total_count: number;
}
const fetchSessions = async (params: { page: number; limit: number; session_search?: string; date_from?: string; date_to?: string; }) => {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.session_search) query.append('session_search', params.session_search);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  return apiCall<SessionsListResponse>(`/api/v1/admin/conversation-sessions?${query.toString()}`);
};

const createDemoSessions = (): ConversationListItem[] => ([
  {
    id: 0,
    user_id_hash: '8db3c65d',
    session_id: 'e09ddd88',
    conversation_id: 'e09ddd88',
    message_preview: '',
    response_preview:
      'Hai! Gimana kabarmu hari ini? Ada sesuatu yang lagi kamu pikirin atau rasain yang pengen kamu bagiin? Aku di sini buat dengerin. 😊',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    message_length: 0,
    response_length: 142,
    session_message_count: 9
  },
  {
    id: 1,
    user_id_hash: '7c61e30b',
    session_id: '69a96a0c',
    conversation_id: '69a96a0c',
    message_preview: '',
    response_preview:
      'Wah, makasih udah cerita. Rasanya wajar banget kok ngerasa capek belakangan ini. Mau coba kita atur langkah kecil bareng‑bareng?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    message_length: 0,
    response_length: 148,
    session_message_count: 1
  }
]);

// Components
const ConversationCard: React.FC<{
  conversation: ConversationListItem;
  onViewSession: (sessionId: string) => void;
  onFlag: (sessionId: string) => void;
}> = ({ conversation, onViewSession, onFlag }) => {
  const getTimeAgo = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Recently';
    }
  };

  return (
    <div className="bg-white/5 dark:bg-gray-800/60 backdrop-blur-md border border-white/10 dark:border-gray-700 rounded-xl p-5 hover:shadow-lg transition-all overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 min-w-0">
        {/* Brand + user hash */}
        <div className="flex items-center gap-2 min-w-0">
          <Image src="/UGM_Lambang.png" alt="UGM" width={18} height={18} className="opacity-80" />
          <span className="bg-white/10 dark:bg-gray-700/50 px-2 py-0.5 rounded font-mono text-xs text-gray-200 truncate flex items-center gap-1">
            <Hash className="h-3 w-3 text-gray-400" /> {conversation.user_id_hash}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFlag(conversation.session_id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-red-300/30 text-red-300 hover:bg-red-500/15 transition-colors"
            title="Flag session"
          >
            <FlagIcon className="h-3 w-3" /> Flag
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {getTimeAgo(conversation.timestamp)}
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="flex items-center gap-2 mb-4 min-w-0">
        <MessageSquare className="h-4 w-4 text-[#FFCA40]" />
        <span className="text-sm font-medium truncate">Session: {conversation.session_id.slice(-8)}</span>
        <span className="bg-blue-500/15 text-blue-200 px-2 py-0.5 rounded-full text-xs whitespace-nowrap">
          {conversation.session_message_count} messages
        </span>
        {conversation.open_flag_count && conversation.open_flag_count > 0 && (
          <span className="bg-red-500/15 text-red-200 px-2 py-0.5 rounded-full text-xs whitespace-nowrap border border-red-300/30">
            {conversation.open_flag_count} flagged
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4 mb-4 min-w-0">
        {/* Last Message Preview (user or AI) */}
        <div className="p-4 bg-white/5 dark:bg-gray-700/50 rounded-lg min-w-0 border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-[#FFCA40]">Last Message</span>
            <RolePill
              isAssistant={(conversation.last_role || 'assistant') === 'assistant'}
            />
            <span className="bg-white/10 dark:bg-gray-600/40 px-2 py-0.5 rounded text-xs text-gray-300">
              {Math.max(conversation.message_length, conversation.response_length)} chars
            </span>
          </div>
          <LastMessageWithTooltip
            fullText={conversation.last_text}
            previewText={conversation.response_preview || conversation.message_preview}
            isTruncated={(conversation.last_text ? conversation.last_text.length > 100 : (conversation.response_length > 100 || conversation.message_length > 100))}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewSession(conversation.session_id)}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-1 border-[#FFCA40]/50 text-[#FFCA40] hover:bg-[#FFCA40] hover:text-[#001D58]"
        >
          <MessageCircle className="h-3 w-3" />
          View Session
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
              const url = `${apiBase}/api/v1/admin/conversation-session/${conversation.session_id}/export`;
              const resp = await authenticatedFetch(url, { method: 'GET' });
              if (!resp.ok) {
                throw new Error(`Download failed (${resp.status})`);
              }
              const txt = await resp.text();
              const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `session_${conversation.session_id}.txt`;
              document.body.appendChild(a);
              a.click();
              a.remove();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to download transcript';
              alert(message);
            }
          }}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-1"
        >
          <DownloadIcon className="h-4 w-4" /> Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
              const url = `${apiBase}/api/v1/admin/conversation-session/${conversation.session_id}/export.csv`;
              const resp = await authenticatedFetch(url, { method: 'GET' });
              if (!resp.ok) {
                throw new Error(`CSV download failed (${resp.status})`);
              }
              const blob = await resp.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `session_${conversation.session_id}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to download CSV';
              alert(message);
            }
          }}
          className="flex-1 min-w-[120px] flex items-center justify-center gap-1"
        >
          <FileSpreadsheet className="h-4 w-4" /> CSV
        </Button>
      </div>
    </div>
  );
};

// Lazy tooltip that fetches the full last message on hover
const LastMessageWithTooltip: React.FC<{ fullText?: string; previewText: string; isTruncated?: boolean }>
  = ({ fullText, previewText, isTruncated }) => {
  return (
    <div className="min-w-0">
      <Tooltip title={fullText || previewText} placement="top">
        <p className="text-sm text-gray-200 break-words whitespace-pre-wrap line-clamp-3">
          {previewText}
          {isTruncated && '...'}
        </p>
      </Tooltip>
    </div>
  );
};

const RolePill: React.FC<{ isAssistant: boolean }> = ({ isAssistant }) => (
  <span
    className={
      'px-2 py-0.5 rounded-full text-[10px] font-semibold ' +
      (isAssistant ? 'bg-blue-500/15 text-blue-200' : 'bg-gray-500/15 text-gray-200')
    }
    title={isAssistant ? 'AI' : 'User'}
  >
    {isAssistant ? 'AI' : 'User'}
  </span>
);

const StatsCard: React.FC<{ stats: ConversationStats }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Conversations */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Total Conversations</h3>
          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          {stats.total_conversations.toLocaleString()}
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          {stats.conversations_today} today, {stats.conversations_this_week} this week
        </p>
      </div>

      {/* Active Sessions */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Active Sessions</h3>
          <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
          {stats.total_sessions.toLocaleString()}
        </div>
        <p className="text-xs text-green-600 dark:text-green-400">
          {stats.total_users_with_conversations} unique users
        </p>
      </div>

      {/* Avg Session Length */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Avg Session Length</h3>
          <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
          {stats.avg_messages_per_session.toFixed(1)}
        </div>
        <p className="text-xs text-purple-600 dark:text-purple-400">
          messages per session
        </p>
      </div>

      {/* Most Active Hour */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">Most Active Hour</h3>
          <Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
          {stats.most_active_hour}:00
        </div>
        <p className="text-xs text-orange-600 dark:text-orange-400">
          peak conversation time
        </p>
      </div>
    </div>
  );
};

// Main component - now using useSession
function AIConversationsContent() {
  const router = useRouter();
  // i18n removed

  // State
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  
  // Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userHashFilter, setUserHashFilter] = useState('');
  
  const ITEMS_PER_PAGE = 20;

  // Demo data used when API returns no sessions
  // Flag modal state
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagSessionId, setFlagSessionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagTags, setFlagTags] = useState('');

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSessions({ page: currentPage, limit: ITEMS_PER_PAGE, session_search: sessionFilter || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined });
      let sessions = data.sessions;
      if (userHashFilter.trim()) {
        const needle = userHashFilter.trim().toLowerCase();
        sessions = sessions.filter(s => s.user_id_hash.toLowerCase().includes(needle));
      }
      if (!sessions.length) {
        setUsingDemo(true);
        const demoSessions = createDemoSessions();
        setConversations(demoSessions);
        setTotalCount(demoSessions.length);
        setStats(null);
      } else {
        setUsingDemo(false);
        const normalized = sessions.map((s, idx) => {
          const isAssistant = (s.last_role || 'assistant') === 'assistant';
          const preview = s.last_preview || '';
          return {
            id: idx,
            user_id_hash: s.user_id_hash,
            session_id: s.session_id,
            conversation_id: s.session_id,
            message_preview: isAssistant ? '' : preview,
            response_preview: isAssistant ? preview : '',
            timestamp: s.last_time,
            message_length: isAssistant ? 0 : preview.length,
            response_length: isAssistant ? preview.length : 0,
            session_message_count: s.message_count,
            last_text: s.last_text,
            last_role: s.last_role,
            open_flag_count: s.open_flag_count,
          } satisfies ConversationListItem;
        });
        setConversations(normalized);
        setTotalCount(data.total_count);
        try {
          const statsResponse = await fetchConversations({
            page: 1,
            limit: 1,
            search: searchTerm || undefined,
            session_id: sessionFilter || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          });
          setStats(statsResponse.stats);
        } catch (statsError) {
          console.warn('Failed to load conversation stats', statsError);
          setStats(null);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations. Please try again later.');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sessionFilter, dateFrom, dateTo, userHashFilter, searchTerm]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSessionFilter = (value: string) => {
    setSessionFilter(value);
    setCurrentPage(1);
  };

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
        body: JSON.stringify({ reason: flagReason || undefined, tags: tags.length ? tags : undefined })
      });
      setFlagOpen(false);
      alert('Session flagged');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to flag';
      alert(message);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSessionFilter('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleTryAgain = () => {
    loadConversations();
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Authentication is enforced by middleware + adminApi error handling

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Error Loading Conversations</h2>
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={handleTryAgain}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl 2xl:max-w-[100rem]">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <ChatIcon className="h-7 w-7 mr-0.5 text-[#FFCA40]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Conversations</h1>
            {usingDemo && (
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-yellow-300">Demo data</span>
            )}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Monitor and analyze AI chat interactions with privacy protection</div>
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            className="text-sm"
            onClick={async () => {
              try {
                const isServer = typeof window === 'undefined';
                const base = isServer ? (process.env.INTERNAL_API_URL as string) : (process.env.NEXT_PUBLIC_API_URL as string);
                const q = new URLSearchParams();
                if (sessionFilter) q.append('session_search', sessionFilter);
                if (dateFrom) q.append('date_from', dateFrom);
                if (dateTo) q.append('date_to', dateTo);
                const res = await fetch(`${base}/api/v1/admin/conversation-sessions/export.csv?${q.toString()}`, { credentials: 'include' });
                const text = await res.text();
                const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.setAttribute('download', 'sessions_export.csv');
                document.body.appendChild(a);
                a.click();
                a.parentNode?.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Export failed', error);
              }
            }}
          >
            Export Sessions CSV
          </Button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="text-sm text-gray-300">Sessions Loaded</div>
          <div className="text-lg font-semibold text-white">{conversations.length}</div>
        </div>
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="text-sm text-gray-300">Total Messages</div>
          <div className="text-lg font-semibold text-white">{conversations.reduce((a,c)=>a + (c.session_message_count||0), 0)}</div>
        </div>
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
          <div className="text-sm text-gray-300">Found (server)</div>
          <div className="text-lg font-semibold text-white">{totalCount}</div>
        </div>
      </div>

      {/* Stats */}
      {stats && <StatsCard stats={stats} />}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Filters & Search</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Search and filter conversations while maintaining user privacy
        </p>
        
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <label htmlFor="search-messages" className="text-sm font-medium">
                Search Messages
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  id="search-messages"
                  type="text"
                  placeholder="Search in messages..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="session-filter" className="text-sm font-medium">
                Session ID
              </label>
              <input
                id="session-filter"
                type="text"
                placeholder="Filter by session ID..."
                value={sessionFilter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSessionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="userhash-filter" className="text-sm font-medium">
                User Hash
              </label>
              <input
                id="userhash-filter"
                type="text"
                placeholder="Filter by user hash..."
                value={userHashFilter}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserHashFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          
          <div className="space-y-2">
            <label htmlFor="date-from" className="text-sm font-medium">
              Date From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="date-to" className="text-sm font-medium">
              Date To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={clearFilters} size="sm">
            Clear Filters
          </Button>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {conversations.length} of {totalCount.toLocaleString()} conversations
          </div>
        </div>
      </div>

      {/* Conversations List */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
              </div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded flex-1"></div>
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded flex-1"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No conversations found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            No conversations match your current filters. Try adjusting your search criteria.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {conversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onViewSession={handleViewSession}
                onFlag={handleOpenFlag}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, Math.max(1, currentPage - 2))) + i;
                  if (page <= totalPages) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-10"
                      >
                        {page}
                      </Button>
                    );
                  }
                  return null;
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {flagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFlagOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-xl font-semibold mb-4">Flag Session …{flagSessionId?.slice(-8)}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Reason</label>
                <textarea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700" placeholder="Describe why this session is being flagged (optional)" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tags</label>
                <input value={flagTags} onChange={(e) => setFlagTags(e.target.value)} className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700" placeholder="Comma-separated tags (e.g., crisis, escalation)" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
              <Button onClick={submitFlag}>Flag Session</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the hydration-safe wrapped component
export default function AIConversationsPage() {
  return (
    <HydrationSafeWrapper>
      <AIConversationsContent />
    </HydrationSafeWrapper>
  );
}

