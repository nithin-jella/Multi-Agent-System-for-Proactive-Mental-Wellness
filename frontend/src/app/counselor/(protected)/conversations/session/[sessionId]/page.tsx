'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiDownload,
  FiFileText,
  FiMessageSquare,
  FiSearch,
  FiUser,
} from 'react-icons/fi';
import { apiCall, authenticatedFetch } from '@/utils/adminApi';

interface ConversationDetail {
  id: number;
  user_id_hash: string;
  session_id: string;
  conversation_id: string;
  message: string;
  response: string;
  timestamp: string;
  sentiment_score?: number | null;
}

interface SessionUser {
  id: number;
  email?: string | null;
  role?: string | null;
}

interface SessionAnalysis {
  message_pairs: number;
  total_user_chars: number;
  total_ai_chars: number;
  avg_user_message_length: number;
  avg_ai_message_length: number;
  top_keywords?: [string, number][];
}

interface SessionDetailResponse {
  session_id: string;
  user_id_hash: string;
  user?: SessionUser | null;
  conversation_count: number;
  first_message_time: string;
  last_message_time: string;
  total_duration_minutes: number;
  conversations: ConversationDetail[];
  analysis: SessionAnalysis;
}

function humanDuration(minutes: number) {
  if (!minutes || minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
}

export default function CounselorConversationSessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params?.sessionId) ? params.sessionId[0] : params?.sessionId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [filter, setFilter] = useState('');

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setError('Session ID is missing');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiCall<SessionDetailResponse>(`/api/v1/counselor/conversation-session/${sessionId}`);
      setData(response);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load session detail';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const filteredConversations = useMemo(() => {
    if (!data) {
      return [];
    }
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return data.conversations;
    }

    return data.conversations.filter((conversation) => {
      return (
        conversation.message.toLowerCase().includes(needle) ||
        conversation.response.toLowerCase().includes(needle)
      );
    });
  }, [data, filter]);

  const handleExport = async (kind: 'txt' | 'csv') => {
    if (!sessionId) {
      return;
    }

    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      const suffix = kind === 'csv' ? 'export.csv' : 'export';
      const response = await authenticatedFetch(
        `${base}/api/v1/counselor/conversation-session/${sessionId}/${suffix}`,
        { method: 'GET' },
      );

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `session_${sessionId}.${kind}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Export failed';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-xl border border-white/10 bg-white/5" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <FiMessageSquare className="mx-auto mb-3 h-10 w-10 text-red-300" />
          <h2 className="mb-2 text-lg font-semibold text-white">Failed to Load Session</h2>
          <p className="mb-4 text-sm text-red-200/80">{error || 'Unable to load conversation session.'}</p>
          <button
            onClick={() => router.push('/counselor/conversations')}
            className="rounded-lg border border-red-400/30 bg-red-400/15 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-400/25"
          >
            Back to Conversations
          </button>
        </div>
      </div>
    );
  }

  const shortSessionId = data.session_id.slice(-8);
  const firstMessageAgo = formatDistanceToNow(new Date(data.first_message_time), { addSuffix: true });
  const lastMessageAgo = formatDistanceToNow(new Date(data.last_message_time), { addSuffix: true });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/counselor/conversations')}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
              >
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                Session ...{shortSessionId}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">Session Timeline</h1>
            <p className="mt-1 text-sm text-white/55">
              Review transcript context before continuing care actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/counselor/patients/${data.user_id_hash}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              <FiUser className="h-3.5 w-3.5" />
              Patient Profile
            </Link>
            <Link
              href={`/counselor/cases?status=all&search=${encodeURIComponent(data.user_id_hash)}&source=conversations`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              <FiMessageSquare className="h-3.5 w-3.5" />
              Related Cases
            </Link>
            <button
              type="button"
              onClick={() => handleExport('txt')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              <FiFileText className="h-3.5 w-3.5" />
              TXT
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              <FiDownload className="h-3.5 w-3.5" />
              CSV
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/45">
          <span className="font-mono">Patient Hash: {data.user_id_hash}</span>
          {data.user?.email ? <span>User: {data.user.email}</span> : null}
          {data.user?.role ? <span>Role: {data.user.role}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/45">Message Pairs</p>
          <p className="text-xl font-semibold text-white">{data.conversation_count}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/45">Duration</p>
          <p className="text-xl font-semibold text-white">{humanDuration(data.total_duration_minutes)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/45">First Message</p>
          <p className="text-sm font-semibold text-white">{firstMessageAgo}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/45">Last Message</p>
          <p className="text-sm font-semibold text-white">{lastMessageAgo}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <label
          htmlFor="conversation-session-search"
          className="mb-2 block text-[11px] uppercase tracking-wider text-white/45"
        >
          Search Transcript
        </label>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            id="conversation-session-search"
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search user message or AI response"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#FFCA40]/40 focus:ring-1 focus:ring-[#FFCA40]/20"
          />
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          {filteredConversations.length} of {data.conversations.length} turns shown
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-base font-semibold text-white">Chat Timeline</h2>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
            <FiCalendar className="h-3 w-3" />
            Chronological order
          </span>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5">
          {filteredConversations.length === 0 ? (
            <div className="py-10 text-center text-sm text-white/50">No messages match the current search.</div>
          ) : (
            <div className="space-y-5">
              {filteredConversations.map((conversation) => (
                <div key={conversation.id} className="space-y-3">
                  {conversation.message ? (
                    <div className="flex justify-end">
                      <div className="max-w-[86%] lg:max-w-3xl">
                        <div className="mb-1 flex items-center justify-end gap-2 text-[10px] text-white/35">
                          <span>User</span>
                          <span className="inline-flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {new Date(conversation.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-xl rounded-br-none bg-blue-600/80 px-4 py-3 text-sm text-white">
                          <p className="whitespace-pre-wrap wrap-break-word">{conversation.message}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {conversation.response ? (
                    <div className="flex justify-start">
                      <div className="max-w-[86%] lg:max-w-3xl">
                        <div className="mb-1 flex items-center gap-2 text-[10px] text-white/35">
                          <span>AI</span>
                          <span className="inline-flex items-center gap-1">
                            <FiClock className="h-3 w-3" />
                            {new Date(conversation.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded-xl rounded-bl-none border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/90">
                          <p className="whitespace-pre-wrap wrap-break-word">{conversation.response}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
