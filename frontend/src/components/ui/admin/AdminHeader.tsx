"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { FiSearch, FiBell, FiMenu, FiChevronDown, FiLogOut, FiUser, FiSettings, FiPieChart, FiCalendar, FiUsers } from 'react-icons/fi';
import { Popover, Transition } from '@headlessui/react';
import { usePathname, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useSSEEventHandler } from '@/contexts/AdminSSEContext';
import { apiCall } from '@/utils/adminApi';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import type { AlertData, AlertSeverity, IAReportGeneratedData, SLABreachData } from '@/types/sse';
// Language switcher removed (next-intl reverted)

type AlertNotification = {
  id?: string;
  clientId: string;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  link?: string | null;
  created_at: string;
  is_seen: boolean;
  source: 'api' | 'sse';
};

type AlertsListResponse = {
  alerts: Array<{
    id: string;
    alert_type: string;
    severity: AlertSeverity;
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

type UnreadStatsResponse = {
  total_unread: number;
  critical_unread: number;
  high_unread: number;
  requires_attention: number;
};

const MAX_ALERTS = 10;

const severityStyles: Record<AlertSeverity, { label: string; dot: string; text: string; bg: string; border: string }> = {
  critical: {
    label: 'Critical',
    dot: 'bg-red-500',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  high: {
    label: 'High',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
  },
  low: {
    label: 'Low',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  info: {
    label: 'Info',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
};

const normalizeSeverity = (value?: string): AlertSeverity => {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low' || value === 'info') {
    return value;
  }
  return 'info';
};

const formatAlertType = (value: string) => {
  if (!value) return 'Alert';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatAlertTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

const alertTimeValue = (value: string) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const mergeAlerts = (primary: AlertNotification[], secondary: AlertNotification[]) => {
  const seen = new Set<string>();
  const merged: AlertNotification[] = [];
  [...primary, ...secondary].forEach((alert) => {
    const key = alert.id ? `id:${alert.id}` : `client:${alert.clientId}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(alert);
  });
  return merged.sort((a, b) => alertTimeValue(b.created_at) - alertTimeValue(a.created_at)).slice(0, MAX_ALERTS);
};

export default function AdminHeader({ onMenuToggle }: { onMenuToggle?: () => void } = {}) {
  const { data: session } = useSession();
  const { src: profilePictureSrc } = useProfilePicture();
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [hasLoadedAlerts, setHasLoadedAlerts] = useState(false);
  const pendingSeenRef = useRef(new Set<string>());
  const alertsRef = useRef<AlertNotification[]>(alerts);
  const fetchAlertsRef = useRef<() => Promise<void>>(undefined);
  const fetchUnreadRef = useRef<() => Promise<void>>(undefined);
  const markSeenRef = useRef<(alert: AlertNotification) => Promise<void>>(undefined);
  // i18n removed
  // Add state for mobile sidebar toggle if you implement a drawer sidebar for mobile

  const fetchUnreadStats = useCallback(async () => {
    setIsLoadingCount(true);
    try {
      const stats = await apiCall<UnreadStatsResponse>('/api/v1/admin/alerts/stats/unread');
      const serverUnread = Math.max(0, Number(stats.total_unread || 0));
      const localUnread = alertsRef.current.filter((alert) => !alert.is_seen).length;
      setUnreadCount(Math.max(serverUnread, localUnread));
    } catch (error) {
      console.error('Failed to fetch unread alert stats:', error);
    } finally {
      setIsLoadingCount(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const response = await apiCall<AlertsListResponse>(`/api/v1/admin/alerts?limit=${MAX_ALERTS}&offset=0`);
      const items: AlertNotification[] = response.alerts.map((alert) => ({
        id: alert.id,
        clientId: alert.id,
        alert_type: alert.alert_type,
        severity: normalizeSeverity(alert.severity),
        title: alert.title,
        message: alert.message,
        link: alert.link ?? null,
        created_at: alert.created_at,
        is_seen: alert.is_seen,
        source: 'api',
      }));

      const merged = mergeAlerts(items, alertsRef.current);
      const localUnread = merged.filter((alert) => !alert.is_seen).length;
      const serverUnread = typeof response.unread_count === 'number'
        ? response.unread_count
        : localUnread;

      setAlerts(merged);
      setUnreadCount(Math.max(serverUnread, localUnread));
      setHasLoadedAlerts(true);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  const markAlertSeen = useCallback(async (alert: AlertNotification) => {
    if (alert.is_seen) {
      return;
    }

    if (!alert.id) {
      setAlerts((prev) => prev.map((item) => (item.clientId === alert.clientId ? { ...item, is_seen: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
      return;
    }

    if (pendingSeenRef.current.has(alert.id)) {
      return;
    }

    pendingSeenRef.current.add(alert.id);
    try {
      await apiCall(`/api/v1/admin/alerts/${alert.id}/seen`, { method: 'PUT' });
      setAlerts((prev) => prev.map((item) => (item.id === alert.id ? { ...item, is_seen: true } : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error('Failed to mark alert as seen:', error);
      toast.error('Failed to update alert');
    } finally {
      pendingSeenRef.current.delete(alert.id);
    }
  }, []);

  fetchAlertsRef.current = fetchAlerts;
  fetchUnreadRef.current = fetchUnreadStats;
  markSeenRef.current = markAlertSeen;

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  useEffect(() => {
    fetchUnreadStats();
    if (!hasLoadedAlerts) {
      fetchAlertsRef.current?.();
    }
    const interval = setInterval(() => {
      fetchUnreadRef.current?.();
    }, 45000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchUnreadStats, hasLoadedAlerts]);

  useSSEEventHandler<AlertData>('alert_created', useCallback((data) => {
    const severity = normalizeSeverity(data.severity);
    const nextAlert: AlertNotification = {
      clientId: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      alert_type: data.alert_type,
      severity,
      title: data.title || 'System Alert',
      message: data.message || 'A new alert was created.',
      link: data.link ?? null,
      created_at: data.timestamp || new Date().toISOString(),
      is_seen: false,
      source: 'sse',
    };

    const merged = mergeAlerts([nextAlert], alertsRef.current);
    setAlerts(merged);
    const localUnread = merged.filter((alert) => !alert.is_seen).length;
    setUnreadCount((count) => Math.max(count + 1, localUnread));
  }, []));

  useSSEEventHandler<SLABreachData>('sla_breach', useCallback((data) => {
    const nextAlert: AlertNotification = {
      clientId: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      alert_type: data.alert_type,
      severity: normalizeSeverity(data.severity),
      title: data.title || 'SLA breach detected',
      message: data.message || 'A case has breached its SLA.',
      link: data.link ?? null,
      created_at: data.timestamp || new Date().toISOString(),
      is_seen: false,
      source: 'sse',
    };

    const merged = mergeAlerts([nextAlert], alertsRef.current);
    setAlerts(merged);
    const localUnread = merged.filter((alert) => !alert.is_seen).length;
    setUnreadCount((count) => Math.max(count + 1, localUnread));
  }, []));

  useSSEEventHandler<IAReportGeneratedData>('ia_report_generated', useCallback((data) => {
    const nextAlert: AlertNotification = {
      clientId: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      alert_type: data.alert_type,
      severity: normalizeSeverity(data.severity),
      title: data.title || 'IA report generated',
      message: data.message || 'A new insights report is ready.',
      link: data.link ?? null,
      created_at: data.timestamp || new Date().toISOString(),
      is_seen: false,
      source: 'sse',
    };

    const merged = mergeAlerts([nextAlert], alertsRef.current);
    setAlerts(merged);
    const localUnread = merged.filter((alert) => !alert.is_seen).length;
    setUnreadCount((count) => Math.max(count + 1, localUnread));
  }, []));

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/admin/cases?search=${encodeURIComponent(trimmed)}`);
    setSearchQuery('');
  }, [searchQuery, router]);

  const onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitSearch();
    }
  }, [submitSearch]);

  return (
    <header className="bg-[#000c24]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left side: Mobile Menu Toggle & Search (optional) */}
        <div className="flex items-center">
          {/* Placeholder for a mobile menu toggle button if needed */}
          <button onClick={onMenuToggle} className="mr-3 p-2 rounded-lg hover:bg-white/10 md:hidden" aria-label="Toggle mobile menu">
            <FiMenu className="text-white" size={20} />
          </button>
          <div className="hidden md:flex items-center bg-white/10 rounded-lg px-3 py-1.5 flex-1 max-w-xs relative">
            <FiSearch className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-transparent border-none outline-none text-white placeholder-gray-400 text-sm w-full pr-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <button
              type="button"
              onClick={submitSearch}
              className="absolute right-1.5 rounded-md px-2 py-0.5 text-xs bg-[#FFCA40]/20 text-[#FFCA40] hover:bg-[#FFCA40]/30 transition-colors"
            >
              Go
            </button>
          </div>
        </div>
        
        {/* Right side - Notifications & Profile Dropdown */}
        <div className="flex items-center space-x-3 md:space-x-5">
          {/* Language switcher removed */}
          <Popover className="relative">
            {({ open }) => (
              <>
                <Popover.Button
                  onClick={() => {
                    if (!isLoadingAlerts) {
                      fetchAlertsRef.current?.();
                    }
                  }}
                  className={`relative p-2 rounded-full transition-colors ${open ? 'bg-white/10' : 'hover:bg-white/10'}`}
                  aria-label="Notifications"
                >
                  <FiBell className="text-white" size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center border border-[#000c24]">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Popover.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute right-0 mt-2 w-90 origin-top-right bg-[#00153A] border border-white/10 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Alerts</p>
                        <p className="text-xs text-white/50">{unreadCount} unread</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <span className={`h-1.5 w-1.5 rounded-full ${isLoadingAlerts || isLoadingCount ? 'bg-orange-400 animate-pulse' : 'bg-emerald-400'}`} />
                        {isLoadingAlerts || isLoadingCount ? 'Updating' : 'Live'}
                      </div>
                    </div>
                    <div className="max-h-90 overflow-y-auto">
                      {isLoadingAlerts && !hasLoadedAlerts ? (
                        <div className="space-y-2 p-4">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-16 rounded-lg border border-white/10 bg-white/5 animate-pulse" />
                          ))}
                        </div>
                      ) : alerts.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-sm text-white/70">No alerts yet</p>
                          <p className="text-xs text-white/40 mt-1">New notifications will appear here.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {alerts.map((alert) => {
                            const severity = severityStyles[alert.severity];
                            const content = (
                              <div className={`px-4 py-3 transition-colors ${alert.is_seen ? 'hover:bg-white/5' : 'bg-white/5 hover:bg-white/10'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <span className={`mt-1 h-2 w-2 rounded-full ${severity.dot}`} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/40">
                                        <span className={`${severity.text}`}>{severity.label}</span>
                                        <span className="text-white/30">|</span>
                                        <span>{formatAlertType(alert.alert_type)}</span>
                                      </div>
                                      <p className="text-sm text-white mt-1 line-clamp-2">
                                        {alert.title}
                                      </p>
                                      <p className="text-xs text-white/50 mt-1 line-clamp-2">
                                        {alert.message}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-white/40 whitespace-nowrap">
                                    {formatAlertTime(alert.created_at)}
                                  </span>
                                </div>
                              </div>
                            );

                            const resolvedLink = !alert.link
                              ? null
                              : alert.link.includes('/admin/insights/reports/')
                                ? '/admin/insights'
                                : alert.link;

                            if (resolvedLink) {
                              return (
                                <Link
                                  key={alert.clientId}
                                  href={resolvedLink}
                                  onClick={() => markSeenRef.current?.(alert)}
                                  className="block"
                                >
                                  {content}
                                </Link>
                              );
                            }

                            return (
                              <button
                                key={alert.clientId}
                                type="button"
                                onClick={() => markSeenRef.current?.(alert)}
                                className="w-full text-left"
                              >
                                {content}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-2 border-t border-white/10 bg-white/5 flex items-center justify-between">
                      <button
                        onClick={() => fetchAlertsRef.current?.()}
                        className="text-xs text-white/70 hover:text-white transition-colors"
                        type="button"
                      >
                        Refresh
                      </button>
                      <Link
                        href="/admin/cases"
                        className="text-xs text-[#FFCA40]/80 hover:text-[#FFCA40] transition-colors"
                      >
                        Open cases
                      </Link>
                    </div>
                  </Popover.Panel>
                </Transition>
              </>
            )}
          </Popover>

          <Popover className="relative">
            {({ open }) => (
              <>
                <Popover.Button className="flex items-center p-1 rounded-full hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
                  <div className="h-9 w-9 rounded-full bg-[#FFCA40]/30 flex items-center justify-center ring-1 ring-[#FFCA40]/50">
                    {profilePictureSrc !== "/default-avatar.png" ? (
                        <Image src={profilePictureSrc} alt="Admin" width={36} height={36} className="rounded-full" />
                    ) : (
                        <span className="font-medium text-sm text-[#FFCA40]">
                        {session?.user?.name?.charAt(0).toUpperCase() || 'A'}
                        </span>
                    )}
                  </div>
                  <span className="hidden md:inline-block ml-2 text-sm text-white/90">
                    {session?.user?.name || 'Administrator'}
                  </span>
                  <FiChevronDown className={`hidden md:inline-block ml-1 text-white/70 transition-transform duration-150 ${open ? 'transform rotate-180' : ''}`} size={16} />
                </Popover.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Popover.Panel className="absolute right-0 mt-2 w-56 origin-top-right bg-[#00153A] border border-white/10 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none py-1">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-medium text-white truncate">{session?.user?.name || 'Administrator'}</p>
                      <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
                    </div>
                    <Link href="/admin/profile" className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-[#FFCA40] transition-colors">
                        <FiUser className="mr-2.5" size={16}/> Profile
                    </Link>
                    <Link href="/admin/settings" className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-[#FFCA40] transition-colors">
                        <FiSettings className="mr-2.5" size={16}/> Settings
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/admin' })}
                      className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    >
                      <FiLogOut className="mr-2.5" size={16}/>
                      Sign Out
                    </button>
                  </Popover.Panel>
                </Transition>
              </>
            )}
          </Popover>
        </div>
      </div>
       {/* Mobile Navigation Tabs - shown on smaller screens */}
       <div className="md:hidden border-t border-white/10 overflow-x-auto">
        <nav className="flex px-2 space-x-1">
          {[{ name: 'Dashboard', icon: <FiPieChart size={18}/>, href: '/admin/dashboard' },
            { name: 'Appointments', icon: <FiCalendar size={18}/>, href: '/admin/appointments' },
            { name: 'Users', icon: <FiUsers size={18}/>, href: '/admin/users' },
            { name: 'Settings', icon: <FiSettings size={18}/>, href: '/admin/settings' }].map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center px-3 py-2.5 rounded-t-md text-xs font-medium transition-colors duration-150 group whitespace-nowrap ${
                  isActive
                    ? 'bg-[#001030]/50 text-[#FFCA40]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={`mb-0.5 ${isActive ? 'text-[#FFCA40]' : 'text-white/60 group-hover:text-white/80'}`}>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
