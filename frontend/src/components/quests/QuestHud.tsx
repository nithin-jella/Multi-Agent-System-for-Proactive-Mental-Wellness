"use client";

import { FiTrendingUp, FiClock, BiSmile } from "@/icons";
import { useTodayQuests, useWellnessState } from "@/hooks/useQuests";
import type { QuestInstance } from "@/types/quests";
import { cn } from "@/lib/utils";

interface QuestHudProps {
  className?: string;
}

function getActiveQuestSummary(quests: QuestInstance[] | undefined) {
  if (!quests) {
    return { activeCount: 0, nextQuest: undefined };
  }
  const active = quests.filter((quest) => quest.status === "active");
  const nextQuest = active[0];
  return { activeCount: active.length, nextQuest };
}

const formatMetric = (value: number | null | undefined, digits: number) =>
  (typeof value === "number" ? value : 0).toFixed(digits);

export default function QuestHud({ className }: QuestHudProps) {
  const { data: wellness, isLoading: wellnessLoading } = useWellnessState();
  const { data: quests, isLoading: questsLoading } = useTodayQuests();

  if (wellnessLoading || questsLoading) {
    return (
      <div
        className={cn(
          "mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 shadow-md shadow-[#00153a]/20 backdrop-blur",
          className,
        )}
      >
        <div className="animate-pulse text-white/50">Memuat progres quest...</div>
      </div>
    );
  }

  if (!wellness) {
    return null;
  }

  const { activeCount, nextQuest } = getActiveQuestSummary(quests);
  const nextQuestName = nextQuest?.template.name;

  return (
    <div
      className={cn(
        "mx-4 mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-linear-to-r from-white/10 via-white/5 to-transparent p-4 text-sm text-white shadow-lg shadow-[#00153a]/25 backdrop-blur md:flex-row md:items-center md:justify-between",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFCA40]/15 text-[#FFCA40]">
          <BiSmile className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Harmony tracker</p>
          <p className="flex flex-wrap items-center gap-1 text-sm text-white/80">
            Streak <span className="font-semibold text-white">{wellness.current_streak} hari</span>{" "}
            &bull;{" "}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[#FFCA40]">{formatMetric(wellness.harmony_score, 1)}</span>
              <span
                className="cursor-help rounded-md bg-white/5 px-1 text-[11px] uppercase tracking-wide text-white/60"
                title="Harmony: keseimbangan emosional dan kemajuan harianmu. Bertambah ketika menjaga streak dan menyelesaikan quest."
              >
                Harmony
              </span>
            </span>{" "}
            &bull;{" "}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[#FFCA40]">{formatMetric(wellness.joy_balance, 0)}</span>
              <span
                className="cursor-help rounded-md bg-white/5 px-1 text-[11px] uppercase tracking-wide text-white/60"
                title="JOY: energi positif untukmu dan guild. Dikumpulkan dari quest dan aktivitas penuh semangat."
              >
                JOY
              </span>
            </span>{" "}
            &bull;{" "}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-[#FFCA40]">{formatMetric(wellness.care_balance, 2)}</span>
              <span
                className="cursor-help rounded-md bg-white/5 px-1 text-[11px] uppercase tracking-wide text-white/60"
                title="CARE: tabungan dukungan yang bisa dipakai saat Compassion Mode atau event kolaboratif."
              >
                CARE
              </span>
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          <FiTrendingUp className="h-3.5 w-3.5 text-[#FFCA40]" />
          Longest streak {wellness.longest_streak} hari
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
          <FiClock className="h-3.5 w-3.5 text-[#FFCA40]" />
          {activeCount > 0
            ? `${activeCount} quest menunggu${nextQuestName ? ` - ${nextQuestName}` : ""}`
            : "Tidak ada quest aktif"}
        </span>
      </div>
    </div>
  );
}


