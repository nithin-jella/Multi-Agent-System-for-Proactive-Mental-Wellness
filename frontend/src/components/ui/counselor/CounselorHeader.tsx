"use client";

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { FiBell, FiMenu, FiSearch, FiChevronDown, FiUser, FiSettings, FiLogOut, FiAlertTriangle, FiClipboard } from 'react-icons/fi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type CounselorAlertItem = {
  id: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  href: string;
  created_at: string;
  is_seen: boolean;
};

type CounselorAlertsListResponse = {
  alerts: Array<{
    id: string;
    alert_type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    message: string;
    link?: string | null;
    created_at: string;
    is_seen: boolean;
  }>;
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
};

type CounselorUnreadStatsResponse = {
  total_unread: number;
  critical_unread: number;
  high_unread: number;
  requires_attention: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const MAX_ALERTS = 10;
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const severityDotClass: Record<CounselorAlertItem['severity'], string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-emerald-400',
  info: 'bg-sky-400',
};

const formatAlertTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  const diffInSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffInSeconds);

  if (absSeconds < 60) {
    return RELATIVE_TIME_FORMATTER.format(diffInSeconds, 'second');
  }
  if (absSeconds < 3600) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffInSeconds / 60), 'minute');
  }
  if (absSeconds < 86400) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffInSeconds / 3600), 'hour');
  }
  return RELATIVE_TIME_FORMATTER.format(Math.round(diffInSeconds / 86400), 'day');
};

async function counselorApiCall<T>(path: string, accessToken?: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export default function CounselorHeader({ onMenuToggle }: { onMenuToggle?: () => void } = {}) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  const [searchQuery, setSearchQuery] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [counselorAlerts, setCounselorAlerts] = useState<CounselorAlertItem[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const pendingSeenRef = useRef(new Set<string>());

  const closeMenus = useCallback(() => {
    setIsAlertsOpen(false);
    setIsProfileOpen(false);
  }, []);

  const fetchUnreadStats = useCallback(async () => {
    try {
      const stats = await counselorApiCall<CounselorUnreadStatsResponse>(
        '/api/v1/counselor/alerts/stats/unread',
        accessToken
      );
      setNotificationCount(Math.max(0, Number(stats.total_unread || 0)));
    } catch (error) {
      console.error('Failed to fetch counselor alert stats:', error);
    }
  }, [accessToken]);

  const fetchAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const response = await counselorApiCall<CounselorAlertsListResponse>(
        `/api/v1/counselor/alerts?limit=${MAX_ALERTS}&offset=0`,
        accessToken
      );

      const mapped: CounselorAlertItem[] = response.alerts.map((alert) => ({
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        href: alert.link ?? '/counselor/cases?source=header',
        created_at: alert.created_at,
        is_seen: alert.is_seen,
      }));

      setCounselorAlerts(mapped);
      setNotificationCount(Math.max(response.unread_count, mapped.filter((item) => !item.is_seen).length));
    } catch (error) {
      console.error('Failed to fetch counselor alerts:', error);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [accessToken]);

  const markAlertSeen = useCallback(async (alert: CounselorAlertItem) => {
    if (alert.is_seen || pendingSeenRef.current.has(alert.id)) {
      return;
    }

    pendingSeenRef.current.add(alert.id);
    try {
      await counselorApiCall(`/api/v1/counselor/alerts/${alert.id}/seen`, accessToken, { method: 'PUT' });
      setCounselorAlerts((prev) => prev.map((item) => (
        item.id === alert.id ? { ...item, is_seen: true } : item
      )));
      setNotificationCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error('Failed to mark counselor alert as seen:', error);
    } finally {
      pendingSeenRef.current.delete(alert.id);
    }
  }, [accessToken]);

  const addSourceToCasesHref = useCallback((href: string, source: string) => {
    if (!href.startsWith('/counselor/cases')) {
      return href;
    }

    const [pathAndQuery, hashPart = ''] = href.split('#');
    const [path, rawQuery = ''] = pathAndQuery.split('?');
    const params = new URLSearchParams(rawQuery);
    if (!params.get('source')) {
      params.set('source', source);
    }

    const queryString = params.toString();
    return `${path}${queryString ? `?${queryString}` : ''}${hashPart ? `#${hashPart}` : ''}`;
  }, []);

  const handleAlertOpen = useCallback(async (alert: CounselorAlertItem) => {
    await markAlertSeen(alert);
    closeMenus();
    router.push(addSourceToCasesHref(alert.href, 'header'));
  }, [addSourceToCasesHref, closeMenus, markAlertSeen, router]);

  useEffect(() => {
    void fetchUnreadStats();

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void fetchUnreadStats();
      if (isAlertsOpen) {
        void fetchAlerts();
      }
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void fetchUnreadStats();
      if (isAlertsOpen) {
        void fetchAlerts();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchAlerts, fetchUnreadStats, isAlertsOpen]);

  const counselorAlertsSummary = useMemo(() => {
    if (isLoadingAlerts && counselorAlerts.length === 0) {
      return 'Loading alerts...';
    }
    if (counselorAlerts.length === 0) {
      return 'No alerts yet';
    }
    return `${notificationCount} unread`;
  }, [counselorAlerts.length, isLoadingAlerts, notificationCount]);

  const submitSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    const params = new URLSearchParams({
      search: trimmed,
      status: 'all',
      source: 'header',
    });
    router.push(`/counselor/cases?${params.toString()}`);
  };

  const onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitSearch();
    }
  };

  return (
    <header className="h-16 bg-white/5 backdrop-blur-sm border-b border-white/10 px-4 md:px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onMenuToggle}
          className="md:hidden text-white/80 hover:text-white"
          aria-label="Open sidebar menu"
          title="Open sidebar menu"
        >
          <FiMenu size={24} />
          <span className="sr-only">Open sidebar menu</span>
        </button>
        <div className="hidden lg:block">
          <h1 className="text-sm font-medium text-white/60">Welcome back,</h1>
          <p className="text-lg font-semibold text-white">{session?.user?.name || 'Counselor'}</p>
        </div>

        <div className="relative hidden md:flex items-center w-72 lg:w-96">
          <FiSearch className="absolute left-3 text-white/50" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search cases..."
            aria-label="Search cases"
            className="w-full bg-white/10 border border-white/15 rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 focus:border-[#FFCA40]/40"
          />
          <button
            type="button"
            onClick={submitSearch}
            className="absolute right-2 rounded-md px-2 py-1 text-xs bg-[#FFCA40]/20 text-[#FFCA40] hover:bg-[#FFCA40]/30 transition-colors"
          >
            Go
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        <button
          type="button"
          onClick={() => {
            const nextOpen = !isAlertsOpen;
            setIsAlertsOpen(nextOpen);
            setIsProfileOpen(false);
            if (nextOpen) {
              void fetchAlerts();
            }
          }}
          className="relative p-2 text-white/70 hover:text-white transition-colors"
          aria-label="View notifications"
          title="View notifications"
        >
          <FiBell size={20} />
          <span className="sr-only">View notifications</span>
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        {isAlertsOpen && (
          <div className="absolute right-14 top-12 w-80 rounded-xl border border-white/10 bg-[#00153f] shadow-2xl p-3 z-30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Alerts</h3>
              <span className="text-xs text-white/60">{counselorAlertsSummary}</span>
              <button
                type="button"
                onClick={() => setIsAlertsOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {isLoadingAlerts && counselorAlerts.length === 0 ? (
                <div className="text-xs text-white/60 px-1 py-2">Loading alerts...</div>
              ) : null}
              {!isLoadingAlerts && counselorAlerts.length === 0 ? (
                <div className="text-xs text-white/60 px-1 py-2">No alerts yet</div>
              ) : null}
              {counselorAlerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => {
                    void handleAlertOpen(alert);
                  }}
                  className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{alert.title}</div>
                    <span className={`h-2 w-2 rounded-full ${severityDotClass[alert.severity]}`} />
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">{alert.message}</div>
                  <div className="text-[11px] text-white/45 mt-1">{formatAlertTime(alert.created_at)}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-white/10">
              <Link
                href="/counselor/escalations"
                onClick={closeMenus}
                className="text-xs text-[#FFCA40] hover:text-[#FFD55C]"
              >
                Open escalation queue
              </Link>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setIsProfileOpen((open) => !open);
            setIsAlertsOpen(false);
          }}
          className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-white/10 transition-colors"
          aria-label="Open profile menu"
          title="Open profile menu"
        >
          <div className="w-10 h-10 bg-linear-to-br from-[#FFCA40] to-[#FFD55C] rounded-full flex items-center justify-center font-semibold text-[#001d58]">
            {session?.user?.name?.charAt(0) || 'C'}
          </div>
          <FiChevronDown size={16} className="text-white/70" />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 top-12 w-60 rounded-xl border border-white/10 bg-[#00153f] shadow-2xl p-2 z-30">
            <div className="px-3 py-2 border-b border-white/10 mb-1">
              <div className="text-sm font-medium text-white truncate">{session?.user?.name || 'Counselor'}</div>
              <div className="text-xs text-white/60 truncate">{session?.user?.email || 'counselor@aicare'}</div>
            </div>
            <Link
              href="/counselor/profile"
              onClick={closeMenus}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/85 hover:bg-white/10"
            >
              <FiUser size={14} />
              Profile
            </Link>
            <Link
              href="/counselor/settings"
              onClick={closeMenus}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/85 hover:bg-white/10"
            >
              <FiSettings size={14} />
              Settings
            </Link>
            <Link
              href="/counselor/cases"
              onClick={closeMenus}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/85 hover:bg-white/10"
            >
              <FiClipboard size={14} />
              My Cases
            </Link>
            <Link
              href="/counselor/escalations"
              onClick={closeMenus}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/85 hover:bg-white/10"
            >
              <FiAlertTriangle size={14} />
              Escalations
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/counselor' })}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-red-300 hover:bg-red-500/15 mt-1"
            >
              <FiLogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {(isAlertsOpen || isProfileOpen) && (
        <button
          type="button"
          aria-label="Dismiss overlays"
          className="fixed inset-0 z-20 cursor-default"
          onClick={closeMenus}
        />
      )}

      <div className="md:hidden sr-only">Current route: {pathname}</div>
    </header>
  );
}
