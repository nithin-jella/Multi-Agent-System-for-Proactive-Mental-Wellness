"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { FiAward, FiExternalLink, FiHelpCircle, FiLoader, FiLock, FiRefreshCw } from "react-icons/fi";

import apiClient from "@/services/api";
import InteractiveBadgeCard from "@/components/ui/InteractiveBadgeCard";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  badgeMetadataMap,
  DEFAULT_BADGE_PLACEHOLDER_IMAGE,
  getBadgeMeta,
  getChainShortName,
  getExplorerTxUrl,
  getIpfsUrl,
} from "@/lib/badgeConstants";

// HACKATHON: Fallback chain changed to BSC Testnet for BNB Chain hackathon.
// TODO: Consider making this configurable or derive from API response.
const FALLBACK_CHAIN_ID = 97; // BSC Testnet (changed from EDU Chain 656476)

interface EarnedBadge {
  badge_id: number;
  awarded_at: string;
  transaction_hash: string;
  contract_address: string;
  chain_id?: number; // May be absent for pre-migration badges
}

interface EarnedBadgeInfo {
  badge_id: number;
  awarded_at: string;
  transaction_hash: string;
  contract_address: string;
  chain_id?: number;
}

interface SyncAchievementsResponse {
  message: string;
  newly_awarded_badges: EarnedBadgeInfo[];
}

const skeletonCards = Array.from({ length: 6 });

function formatAwardDate(iso: string | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTimestamp(date: Date | null) {
  if (!date) {
    return "not synced yet";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString();
}

export default function EarnedBadgesDisplay() {
  const [earnedBadges, setEarnedBadges] = useState<Record<number, EarnedBadge>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const badgeCatalog = useMemo(() => {
    return Object.keys(badgeMetadataMap)
      .map((key) => Number(key))
      .sort((a, b) => a - b);
  }, []);

  const earnedCount = useMemo(() => Object.keys(earnedBadges).length, [earnedBadges]);
  const totalCount = badgeCatalog.length;
  const progressPercent = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;

  const lastSyncedLabel = useMemo(() => formatRelativeTimestamp(lastSyncedAt), [lastSyncedAt]);

  const fetchBadges = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.get<EarnedBadge[]>("/profile/my-badges");
      const mapped = data.reduce<Record<number, EarnedBadge>>((acc, badge) => {
        acc[badge.badge_id] = badge;
        return acc;
      }, {});
      setEarnedBadges(mapped);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error("Error fetching earned badges", err);
      setError("We couldn't load your badges just now. Please try again shortly.");
      setEarnedBadges({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSyncAchievements = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    const toastId = toast.loading("Checking for new badges...");

    try {
      const { data } = await apiClient.post<SyncAchievementsResponse>("/profile/sync-achievements");
      toast.dismiss(toastId);

      const newlyAwarded = data.newly_awarded_badges ?? [];
      if (newlyAwarded.length) {
        toast.success(`Unlocked ${newlyAwarded.length} new badge${newlyAwarded.length > 1 ? "s" : ""}!`, {
          duration: 4000,
        });

        newlyAwarded.forEach((item, index) => {
          const meta = getBadgeMeta(item.badge_id);
          setTimeout(() => {
            toast.success(`Badge unlocked: ${meta.name}`, { duration: 4500 });
          }, index * 350);
        });

        await fetchBadges();
      } else {
        toast.success("Achievements are already up to date!");
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error("Error syncing achievements", err);
      toast.dismiss(toastId);
      const fallback = "We couldn't synchronise your badges. Please try again.";
      setSyncError(fallback);
      toast.error(fallback);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchBadges, isSyncing]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skeletonCards.map((_, index) => (
            <div
              key={index}
              className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur animate-pulse"
            >
              <div className="flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-white/10" />
              </div>
              <div className="mt-6 space-y-3">
                <div className="h-3 w-3/4 rounded-full bg-white/10" />
                <div className="h-3 w-1/2 rounded-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {badgeCatalog.map((badgeId) => {
          const meta = getBadgeMeta(badgeId);
          const earnedBadge = earnedBadges[badgeId];
          const isEarned = Boolean(earnedBadge);
          const awardedDate = formatAwardDate(earnedBadge?.awarded_at);
          const chainId = earnedBadge?.chain_id ?? FALLBACK_CHAIN_ID;
          const explorerUrl = earnedBadge?.transaction_hash
            ? getExplorerTxUrl(chainId, earnedBadge.transaction_hash)
            : undefined;
          const chainLabel = isEarned ? getChainShortName(chainId) : undefined;

          const tooltipTitle = meta.description || "";

          const badgeBody = (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white/90">{meta.name}</span>
              </div>
              {meta.description && (
                <p className="mt-2 text-xs text-white/60 line-clamp-2">{meta.description}</p>
              )}

              <div className="mt-5 flex flex-1 items-center justify-center">
                {isEarned ? (
                  <Image
                    src={getIpfsUrl(meta.image)}
                    alt={meta.name}
                    width={88}
                    height={88}
                    className="h-20 w-20 rounded-full border border-[#FFCA40]/40 bg-black/30 object-cover shadow-[0_0_24px_rgba(255,202,64,0.35)]"
                    onError={(event) => {
                      event.currentTarget.src = DEFAULT_BADGE_PLACEHOLDER_IMAGE;
                    }}
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40">
                    <FiHelpCircle className="h-8 w-8" />
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-col items-center gap-2 text-xs text-white/60">
                {isEarned ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCA40]/40 bg-[#FFCA40]/10 px-3 py-1 text-[#FFCA40]">
                    <FiAward className="h-3.5 w-3.5" />
                    <span>{awardedDate ?? "Recently earned"}</span>
                    {chainLabel && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
                        {chainLabel}
                      </span>
                    )}
                    {explorerUrl && <FiExternalLink className="h-3.5 w-3.5" />}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
                    <FiLock className="h-3.5 w-3.5" />
                    <span>Keep exploring AICare to unlock</span>
                  </div>
                )}
              </div>
            </div>
          );

          return tooltipTitle ? (
            <Tooltip key={badgeId} title={tooltipTitle} placement="top">
              <InteractiveBadgeCard
                className={`relative flex h-full flex-col rounded-2xl border p-6 transition duration-200 ${
                  isEarned
                    ? "border-[#FFCA40]/50 bg-linear-to-br from-[#FFCA40]/15 via-white/10 to-white/5 hover:border-[#FFCA40]/80 hover:shadow-[0_0_25px_rgba(255,202,64,0.35)]"
                    : "border-white/10 bg-white/5 opacity-80"
                }`}
                href={isEarned ? explorerUrl : undefined}
                isEarned={isEarned}
                ariaLabel={isEarned ? `View blockchain details for ${meta.name}` : `${meta.name} is locked`}
              >
                {badgeBody}
              </InteractiveBadgeCard>
            </Tooltip>
          ) : (
            <InteractiveBadgeCard
              key={badgeId}
              className={`relative flex h-full flex-col rounded-2xl border p-6 transition duration-200 ${
                isEarned
                  ? "border-[#FFCA40]/50 bg-linear-to-br from-[#FFCA40]/15 via-white/10 to-white/5 hover:border-[#FFCA40]/80 hover:shadow-[0_0_25px_rgba(255,202,64,0.35)]"
                  : "border-white/10 bg-white/5 opacity-80"
              }`}
              href={isEarned ? explorerUrl : undefined}
              isEarned={isEarned}
              ariaLabel={isEarned ? `View blockchain details for ${meta.name}` : `${meta.name} is locked`}
            >
              {badgeBody}
            </InteractiveBadgeCard>
          );
        })}
      </div>
    );
  }, [badgeCatalog, earnedBadges, isLoading]);

  return (
    <div className="w-full space-y-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/50">Achievements</p>
          <h3 className="flex items-center gap-2 text-xl font-semibold">
            <FiAward className="h-5 w-5 text-[#FFCA40]" />
            {earnedCount ? `You have earned ${earnedCount} badge${earnedCount > 1 ? "s" : ""}` : "Start unlocking badges"}
          </h3>
          <p className="text-sm text-white/60">{totalCount} badges available across the AICare experience.</p>
        </div>

        <div className="flex flex-col items-stretch gap-3 text-sm text-white/70 sm:flex-row sm:items-center">
          <div className="w-full min-w-50 sm:w-60">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#FFCA40]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-white/50">Last synced {lastSyncedLabel}.</p>
          <button
            type="button"
            onClick={handleSyncAchievements}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <FiRefreshCw className="h-4 w-4" />
                Sync badges
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {syncError && !error && (
        <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
          {syncError}
        </div>
      )}

      {content}
    </div>
  );
}
