"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "react-hot-toast";

import {
  BsChatDots,
  FiActivity,
  FiArrowRight,
  FiAward,
  FiCalendar,
  FiClock,
  FiHeart,
  FiRefreshCw,
  FiShield,
  FiTrendingUp,
  FiPlus,
} from "@/icons";
import WalletLinkButton from "@/components/ui/WalletLinkButton";
import QuestBoard from "@/components/quests/QuestBoard";
import apiClient, { fetchUserProfileOverview } from "@/services/api";
import type { JournalEntryItem } from "@/types/api";
import type { TimelineEntry, UserProfileOverviewResponse } from "@/types/profile";

interface EarnedBadgeSummary {
  badge_id: number;
  awarded_at: string;
}

interface JournalStats {
  todayHasEntry: boolean;
  currentStreak: number;
  entriesThisMonth: number;
  recentAffectiveLabel: string | null;
  recentPadSummary: string | null;
}

type DashboardTimelineEntry = TimelineEntry & { formattedTimestamp: string };

type QuickAction = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
};

const quickActions: QuickAction[] = [
  {
    href: "/aika",
    label: "Talk with Aika now",
    description: "Get immediate emotional support and grounding.",
    icon: <BsChatDots className="h-5 w-5" />,
  },
  {
    href: "/appointment",
    label: "Book counselling",
    description: "Reserve a slot with UGM support team.",
    icon: <FiCalendar className="h-5 w-5" />,
  },
  {
    href: "/journaling",
    label: "Journal check-in",
    description: "Capture thoughts and affective state in a private space.",
    icon: <FiActivity className="h-5 w-5" />,
  },
  {
    href: "/help",
    label: "Help & safety",
    description: "Find support contacts and guidance quickly.",
    icon: <FiShield className="h-5 w-5" />,
  },
];

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function describePadState(valence: number, arousal: number): string {
  if (valence >= 0.2 && arousal >= 0.2) return "Energized Positive";
  if (valence >= 0.2 && arousal <= -0.2) return "Calm Positive";
  if (valence <= -0.2 && arousal >= 0.2) return "Tense Negative";
  if (valence <= -0.2 && arousal <= -0.2) return "Low Negative";
  if (arousal >= 0.3) return "Activated Neutral";
  if (arousal <= -0.3) return "Calm Neutral";
  return "Balanced Neutral";
}

function formatPadCoordinate(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function StreakCard({ type, value }: { type: "current" | "longest"; value: number }) {
  const isCurrent = type === "current";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FFCA40]/30 hover:bg-white/5">
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
            isCurrent
              ? "bg-orange-500/20 shadow-lg shadow-orange-500/10"
              : "bg-purple-500/20 shadow-lg shadow-purple-500/10"
          }`}
        >
          {isCurrent ? "🔥" : "🏆"}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">
            {isCurrent ? "Current Streak" : "Personal Best"}
          </p>
          <p className="text-lg font-bold text-white">
            {value} {value === 1 ? "day" : "days"}
          </p>
          <p className={`text-xs font-medium ${isCurrent ? "text-orange-400" : "text-purple-400"}`}>
            {isCurrent
              ? value > 0
                ? "Keep the fire going!"
                : "Start your streak today!"
              : value > 0
                ? "Your all-time record!"
                : "Set your first record!"}
          </p>
        </div>
      </div>
    </div>
  );
}

function WellnessTrendCard({ score }: { score: number }) {
  const percentage = Math.round(score * 100);

  const getWellnessBand = (s: number) => {
    if (s >= 80) return { emoji: "😊", label: "Thriving", color: "emerald" };
    if (s >= 60) return { emoji: "🙂", label: "Doing Well", color: "green" };
    if (s >= 40) return { emoji: "😐", label: "Balanced", color: "yellow" };
    if (s >= 20) return { emoji: "😔", label: "Could Be Better", color: "orange" };
    return { emoji: "😢", label: "Need Support", color: "rose" };
  };

  const wellnessBand = getWellnessBand(percentage);
  const colorMap: Record<string, { text: string; bar: string; bg: string }> = {
    emerald: { text: "text-emerald-400", bar: "bg-emerald-400", bg: "bg-emerald-500/20" },
    green: { text: "text-green-400", bar: "bg-green-400", bg: "bg-green-500/20" },
    yellow: { text: "text-yellow-400", bar: "bg-yellow-400", bg: "bg-yellow-500/20" },
    orange: { text: "text-orange-400", bar: "bg-orange-400", bg: "bg-orange-500/20" },
    rose: { text: "text-rose-400", bar: "bg-rose-400", bg: "bg-rose-500/20" },
  };
  const colors = colorMap[wellnessBand.color];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FFCA40]/30 hover:bg-white/5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wide text-white/60">Wellness Trend</p>
          <p className={`mt-1 text-lg font-bold ${colors.text}`}>{wellnessBand.label}</p>
        </div>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${colors.bg}`}>
          {wellnessBand.emoji}
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
        <span>Based on your conversations</span>
        <span className={`font-medium ${colors.text}`}>{percentage}%</span>
      </div>
    </div>
  );
}

function BadgesCard({ count }: { count: number | null }) {
  const displayCount = count ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FFCA40]/30 hover:bg-white/5">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFCA40]/20 text-2xl shadow-lg shadow-[#FFCA40]/10">
          🎖️
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Badges Earned</p>
          <p className="text-lg font-bold text-white">
            {count !== null ? displayCount : "--"} {displayCount ===1 ? "badge" : "badges"}
          </p>
          <p className="text-xs font-medium text-[#FFCA40]">
            {displayCount > 0 ? "🎉 Keep achieving!" : "Unlock your first badge!"}
          </p>
        </div>
      </div>
      <div className="absolute right-3 top-3 text-lg opacity-20">✨</div>
    </div>
  );
}

function JournalWidget({ stats }: { stats: JournalStats | null }) {
  if (!stats) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FFCA40]/30 hover:bg-white/5">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-3 w-24 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href="/journaling" className="group block relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-r from-[#FFCA40]/10 to-[#FFB700]/10 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-[#FFCA40]/50 hover:scale-[1.02]">
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-[#FFCA40]/10 blur-3xl group-hover:blur-4xl transition-all" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                stats.todayHasEntry
                  ? 'bg-green-500/30 text-green-400'
                  : 'bg-[#FFCA40]/30 text-[#FFCA40]'
            }`}>
              {stats.todayHasEntry ? '✓' : '📝'}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Today&apos;s Journal</p>
              <h3 className="text-lg font-bold text-white">
                {stats.todayHasEntry ? "Completed!" : "Not yet"}
              </h3>
            </div>
          </div>
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#FFCA40] group-hover:scale-110 transition-all">
            <FiArrowRight className="h-5 w-5 text-white/40 group-hover:text-[#001D58] transition-colors" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center bg-white/5 rounded-xl p-3">
            <p className="text-2xl font-bold text-white">{stats.currentStreak}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide">Streak</p>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <p className="text-2xl font-bold text-white">{stats.entriesThisMonth}</p>
            <p className="text-xs text-white/50 uppercase tracking-wide">Month</p>
          </div>
          <div className="text-center bg-white/5 rounded-xl p-3">
            <p className="text-xs font-semibold text-white leading-tight min-h-8 flex items-center justify-center text-center">
              {stats.recentAffectiveLabel || "—"}
            </p>
            <p className="text-xs text-white/50 uppercase tracking-wide">State</p>
            {stats.recentPadSummary && (
              <p className="mt-1 text-[10px] text-white/40">{stats.recentPadSummary}</p>
            )}
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium shadow-lg transition-all bg-white/10 text-white hover:bg-white/20 hover:border-[#FFCA40]">
          {stats.todayHasEntry ? "View Journal" : "Write Now"}
          {stats.todayHasEntry && <FiArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </Link>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link
      href={action.href}
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/3 p-4 backdrop-blur-sm transition hover:border-[#FFCA40] hover:bg-[#FFCA40]/10"
    >
      <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#FFCA40]/10 blur-xl" />
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#FFCA40]">
          {action.icon}
        </span>
        <div>
          <p className="text-base font-semibold text-white">{action.label}</p>
          <p className="text-sm text-white/60 group-hover:text-white/80">{action.description}</p>
        </div>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#FFCA40]">
        Get started
        <FiArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function DashboardBentoCard({
  children,
  className,
  reduceMotion,
}: {
  children: ReactNode;
  className?: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reduceMotion ? undefined : { duration: 0.35, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 p-6 shadow-xl backdrop-blur-md ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}

export default function DashboardPage() {
  const reduceMotion = !!useReducedMotion();
  const [profile, setProfile] = useState<UserProfileOverviewResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [latestBadgeDate, setLatestBadgeDate] = useState<string | null>(null);
  const [journalStats, setJournalStats] = useState<JournalStats | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        try {
          await apiClient.post("/profile/refresh-stats");
        } catch (error) {
          console.warn("Failed to refresh user stats (non-critical)", error);
        }
        const result = await fetchUserProfileOverview();
        setProfile(result);
      } catch (error) {
        console.error("Failed to load dashboard overview", error);
        setProfileError("We couldn't load your dashboard. Please try again later.");
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile().catch(() => {
      /* handled above */
    });
  }, []);

  useEffect(() => {
    async function loadBadges() {
      try {
        const { data } = await apiClient.get<EarnedBadgeSummary[]>("/profile/my-badges");
        setBadgeCount(data.length);
        if (data.length) {
          const latest = data
            .slice()
            .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime())[0];
          setLatestBadgeDate(formatTimestamp(latest.awarded_at));
        }
      } catch (error) {
        console.error("Failed to load badge summary", error);
        toast.error("Could not load your achievement summary");
      }
    }

    loadBadges().catch(() => {
      /* handled above */
    });
  }, []);

  useEffect(() => {
    async function loadJournalStats() {
      try {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        
        const [activityResponse, entriesResponse] = await Promise.all([
          apiClient.get<{
            summary: { [dateStr: string]: { hasJournal: boolean; hasConversation: boolean } };
            currentStreak: number;
            longestStreak: number;
          }>(`/activity-summary/?month=${monthStr}`),
          apiClient.get<JournalEntryItem[]>('/journal/'),
        ]);
        
        const todayStr = today.toISOString().split('T')[0];
        const todayHasEntry = activityResponse.data.summary[todayStr]?.hasJournal || false;
        const entriesThisMonth = Object.values(activityResponse.data.summary).filter(d => d.hasJournal).length;
        
        let recentAffectiveLabel: string | null = null;
        let recentPadSummary: string | null = null;
        if (entriesResponse.data && entriesResponse.data.length > 0) {
          const sortedEntries = entriesResponse.data.sort((a, b) => 
            new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
          );
          const latestEntry = sortedEntries[0];

          if (
            typeof latestEntry.valence === 'number'
            && typeof latestEntry.arousal === 'number'
          ) {
            recentAffectiveLabel = describePadState(latestEntry.valence, latestEntry.arousal);
            recentPadSummary = `V ${formatPadCoordinate(latestEntry.valence)} · A ${formatPadCoordinate(latestEntry.arousal)}`;
          }
        }
        
        setJournalStats({
          todayHasEntry,
          currentStreak: activityResponse.data.currentStreak || 0,
          entriesThisMonth,
          recentAffectiveLabel,
          recentPadSummary,
        });
      } catch (error) {
        console.error("Failed to load journal stats", error);
      }
    }

    loadJournalStats().catch(() => {
      /* handled above */
    });
  }, []);

  const firstName = useMemo(() => {
    if (!profile) return "Friend";
    const preferred = profile.header.preferred_name ?? profile.header.full_name ?? "";
    if (!preferred) return "Friend";
    return preferred.split(" ")[0];
  }, [profile]);

  const timelineEntries: DashboardTimelineEntry[] = useMemo(() => {
    if (!profile?.timeline?.length) return [];
    return profile.timeline.slice(0, 4).map((entry) => ({
      ...entry,
      formattedTimestamp: formatTimestamp(entry.timestamp),
    }));
  }, [profile?.timeline]);

  const upcomingAppointments = useMemo(() => {
    if (!profile?.timeline?.length) return [];
    const now = new Date();
    return profile.timeline
      .filter((entry) => entry.kind === "appointment" && new Date(entry.timestamp).getTime() > now.getTime())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, 3)
      .map((entry) => ({
        ...entry,
        formattedTimestamp: formatTimestamp(entry.timestamp),
      }));
  }, [profile?.timeline]);

  if (profileLoading) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto max-w-6xl px-4 pt-24 pb-12">
          <div className="space-y-6">
            <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
            <div className="h-60 animate-pulse rounded-3xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  if (profileError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#00112e] px-4">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-white/70">{profileError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-12 space-y-10">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.45, ease: "easeOut" }}
        >
          <Link href="/aika" className="block">
            <div className="group relative overflow-hidden rounded-3xl bg-linear-to-r from-teal-500 via-cyan-500 to-blue-500 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.01] hover:shadow-cyan-500/30">
              {!reduceMotion && (
                <motion.div
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.35, 0.2] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <div className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-white/5" />

              <div className="relative z-10 flex items-center gap-6">
                <div className="relative shrink-0">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/30 shadow-xl">
                    <Image
                      src="/aika-avatar.png"
                      alt="Aika - Your AI Companion"
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      priority
                    />
                  </div>
                  <div className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-green-400 animate-pulse" />
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white">Talk with Aika</h2>
                  <p className="mt-1 text-white/80">
                    Your AI companion is ready to listen and support you, {firstName}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-teal-600 shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl">
                  <BsChatDots className="h-5 w-5" />
                  <span>Chat Now</span>
                  <FiArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.45, delay: 0.05 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StreakCard type="current" value={profile?.header.current_streak ?? 0} />
          <StreakCard type="longest" value={profile?.header.longest_streak ?? 0} />
          <WellnessTrendCard score={profile?.header.sentiment_score ?? 0.5} />
          <BadgesCard count={badgeCount} />
        </motion.div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.45, delay: 0.1 }}
          className="grid gap-4 lg:grid-cols-3"
        >
          <JournalWidget stats={journalStats} />
          <DashboardBentoCard className="lg:col-span-2" reduceMotion={reduceMotion}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/50">Your support hub</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">What do you need right now?</h2>
                <p className="mt-2 max-w-xl text-sm text-white/70">
                  Start with a path that fits your current state: quick emotional support, scheduled counselling, or private reflection.
                </p>
              </div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-400/20 text-rose-300">
                <FiHeart className="h-6 w-6" />
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => (
                <QuickActionCard key={action.href} action={action} />
              ))}
            </div>
          </DashboardBentoCard>
        </motion.div>

        <motion.header
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.45, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 p-8 shadow-2xl backdrop-blur-md"
        >
          <div className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-[#FFCA40]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 right-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-wide text-white/60">Welcome back</p>
            <h1 className="text-3xl font-semibold text-white">Ready for your next check-in, {firstName}?</h1>
            <p className="text-sm text-white/70">
              Aika is available anytime. Start a session to reflect, release, and get support tailored to you.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/aika" className="w-full sm:w-auto">
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FFCA40] px-6 py-3 text-sm font-semibold text-[#001D58] shadow-lg shadow-[#FFCA40]/40 transition hover:bg-[#ffd45c]">
                  Talk with Aika now
                  <FiArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link href="/journaling" className="w-full sm:w-auto">
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40] hover:bg-[#FFCA40]/10">
                  <span>Log a reflection</span>
                  <FiActivity className="h-4 w-4" />
                </span>
              </Link>
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/2 p-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Open Campus ID</p>
                <p className="mt-1 text-xs text-white/60">Connect your Web3 identity to earn CARE tokens</p>
              </div>
              <WalletLinkButton />
            </div>
          </div>
        </motion.header>

        <QuestBoard />

        <section className="grid gap-6 lg:grid-cols-12">
          <DashboardBentoCard className="lg:col-span-5" reduceMotion={reduceMotion}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Upcoming appointments</h2>
              <Link
                href="/appointment"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#FFCA40] hover:text-[#ffd45c]"
              >
                Book
                <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {upcomingAppointments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/2 p-4">
                  <p className="text-sm text-white/70">No upcoming appointments yet.</p>
                  <p className="mt-1 text-xs text-white/50">
                    If you would like guided support this week, reserve a time with counselling team.
                  </p>
                </div>
              ) : (
                upcomingAppointments.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm"
                  >
                    <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFCA40]/15 text-[#FFCA40]">
                      <FiCalendar className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{entry.title || "Counselling session"}</p>
                      {entry.description && <p className="mt-1 text-sm text-white/70">{entry.description}</p>}
                      <p className="mt-2 text-xs uppercase tracking-wide text-white/40">{entry.formattedTimestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardBentoCard>

          <DashboardBentoCard className="lg:col-span-7" reduceMotion={reduceMotion}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recent activity</h2>
                <p className="text-sm text-white/60">A compact timeline of your momentum this week.</p>
              </div>
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#FFCA40] hover:text-[#ffd45c]"
              >
                View profile
                <FiArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              {timelineEntries.length === 0 ? (
                <p className="text-sm text-white/60">No activity yet. Start with a reflection or conversation.</p>
              ) : (
                timelineEntries.map((entry, index) => (
                  <div
                    key={`${entry.kind}-${entry.timestamp}-${index}`}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/2 p-4 backdrop-blur-sm"
                  >
                    <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFCA40]/15 text-[#FFCA40]">
                      <FiClock className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{entry.title}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/60">
                          {entry.kind}
                        </span>
                      </div>
                      {entry.description && <p className="mt-2 text-sm text-white/70">{entry.description}</p>}
                      <p className="mt-2 text-xs uppercase tracking-wide text-white/40">{entry.formattedTimestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardBentoCard>

          <div className="space-y-6 lg:col-span-5">
            <DashboardBentoCard reduceMotion={reduceMotion}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Achievements</h2>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFCA40]/20 text-[#FFCA40]">
                  <FiAward className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-white/60">
                {badgeCount != null
                  ? `You have unlocked ${badgeCount} badge${badgeCount === 1 ? "" : "s"}.`
                  : "We're loading your achievements."}
              </p>
              {latestBadgeDate && (
                <p className="mt-1 text-xs uppercase tracking-wide text-white/40">Last badge earned {latestBadgeDate}</p>
              )}
              <Link
                href="/profile"
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
              >
                View achievements
                <FiArrowRight className="h-4 w-4" />
              </Link>
            </DashboardBentoCard>

            <DashboardBentoCard reduceMotion={reduceMotion}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Focus for today</h2>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                  <FiTrendingUp className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-sm text-white/60">
                {profile?.safety.primary_concerns
                  ? profile.safety.primary_concerns
                  : "Set one gentle intention for today. A short check-in is enough to build momentum."}
              </p>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Preferred check-in cadence</p>
                  <p>{profile?.therapy.therapy_frequency ?? "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Support team note</p>
                  <p>{profile?.aicare_team_notes ?? "Leave a note on your profile to let us know what you need right now."}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/2 px-3 py-2 text-xs text-white/60">
                <FiRefreshCw className="h-4 w-4 text-[#FFCA40]" />
                This card updates as your activities and profile insights evolve.
              </div>
            </DashboardBentoCard>
          </div>
        </section>
      </div>
    </main>
  );
}
