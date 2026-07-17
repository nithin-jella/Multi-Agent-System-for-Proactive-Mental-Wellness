import { useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiTrendingUp,
  FiZap,
  BiSmile,
} from "@/icons";
import {
  useCompleteQuest,
  useDailyMessage,
  useTodayQuests,
  useWellnessState,
} from "@/hooks/useQuests";
import type { QuestInstance } from "@/types/quests";
import QuestDialogueWindow from "./QuestDialogueWindow";

interface QuestBoardProps {
  className?: string;
}

const formatMetric = (value: number | null | undefined, digits: number) =>
  (typeof value === "number" ? value : 0).toFixed(digits);

const statusCopy: Record<string, { label: string; toneClass: string }> = {
  active: { label: "Aktif", toneClass: "text-[#FFCA40]" },
  completed: { label: "Selesai", toneClass: "text-emerald-300" },
  expired: { label: "Lewat", toneClass: "text-red-300" },
  cancelled: { label: "Dibatalkan", toneClass: "text-white/50" },
};

function formatTimeRemaining(quest: QuestInstance): string {
  if (quest.status !== "active") return "";
  const expires = new Date(quest.expires_at);
  const now = new Date();
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return "Berakhir segera";
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes} menit lagi`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours} jam ${minutes} menit lagi`;
}

function QuestCard({
  quest,
  onComplete,
  isCompleting,
}: {
  quest: QuestInstance;
  onComplete: (questId: number) => Promise<void>;
  isCompleting: boolean;
}) {
  const statusInfo = statusCopy[quest.status] ?? statusCopy.active;
  const timeRemaining = formatTimeRemaining(quest);
  const canComplete = quest.status === "active" && !isCompleting;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/3 p-4 shadow-lg shadow-[#00153a]/15 backdrop-blur-sm transition hover:border-[#FFCA40]/40">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <FiZap className="h-4 w-4 text-[#FFCA40]" />
            {quest.template.name}
          </span>
          <span className={`text-xs font-medium uppercase tracking-wide ${statusInfo.toneClass}`}>
            {statusInfo.label}
          </span>
        </div>
        <p className="text-sm text-white/70">{quest.template.short_description}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
            <FiClock className="h-3 w-3" />
            {quest.template.recommended_duration_minutes} menit
          </span>
          {quest.compassion_mode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-rose-200">
              <FiRefreshCw className="h-3 w-3" />
              Compassion Mode
            </span>
          )}
          {timeRemaining && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
              <FiTrendingUp className="h-3 w-3" />
              {timeRemaining}
            </span>
          )}
        </div>
      </div>

      <button
        disabled={!canComplete}
        onClick={() => onComplete(quest.id)}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#FFCA40] to-[#FFD55C] px-4 py-2 text-sm font-semibold text-[#001D58] shadow-lg shadow-[#FFCA40]/25 transition hover:shadow-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <FiCheckCircle className="h-4 w-4" />
        {quest.status === "completed" ? "Quest Selesai" : isCompleting ? "Memproses..." : "Selesaikan Quest"}
      </button>
    </div>
  );
}

export default function QuestBoard({ className }: QuestBoardProps) {
  const { data: quests, isLoading: questsLoading } = useTodayQuests();
  const { data: wellness } = useWellnessState();
  const { data: dailyMessage } = useDailyMessage();
  const completeQuestMutation = useCompleteQuest();

  const normalizeMessage = useCallback((raw: unknown): string[] => {
    if (raw == null) {
      return [];
    }

    if (typeof raw === "string") {
      return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line !== "0");
    }

    if (typeof raw === "number" || typeof raw === "boolean") {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw.flatMap((entry) => normalizeMessage(entry)).filter((line) => line.length > 0 && line !== "0");
    }

    if (typeof raw === "object") {
      const possible = raw as Record<string, unknown>;
      const candidateKeys = ["text", "message", "content", "value"];
      const collected = candidateKeys
        .filter((key) => key in possible)
        .map((key) => possible[key] as unknown);

      if (collected.length === 0) {
        return Object.values(possible)
          .flatMap((value) => normalizeMessage(value))
          .filter((line) => line.length > 0 && line !== "0");
      }

      return collected.flatMap((value) => normalizeMessage(value)).filter((line) => line.length > 0 && line !== "0");
    }

    return [];
  }, []);

  const dialogueLines = normalizeMessage(dailyMessage?.message);

  const handleComplete = useCallback(
    async (questId: number) => {
      try {
        const response = await completeQuestMutation.mutateAsync({ questId, payload: {} });
        toast.success(`Quest selesai! +${response.reward.xp} XP, +${response.reward.joy} JOY`);
      } catch (error) {
        console.error(error);
        toast.error("Gagal menyelesaikan quest. Coba lagi nanti.");
      }
    },
    [completeQuestMutation],
  );

  return (
    <section
      className={`rounded-3xl border border-white/10 bg-linear-to-br from-[#001d58]/70 via-[#0a2a6e]/60 to-[#173a7a]/70 p-6 backdrop-blur ${className ?? ""}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Quest Board</h2>
          <p className="text-sm text-white/60">
            Langkah harian yang disiapkan Aika untuk menjaga keseimbanganmu.
          </p>
        </div>
        {wellness && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
            <BiSmile className="h-5 w-5 text-[#FFCA40]" />
            <div className="leading-tight">
              <p className="font-semibold">{wellness.current_streak} hari streak</p>
              <p className="text-xs text-white/60">
                Harmony {formatMetric(wellness.harmony_score, 1)}{" "}&bull;{" "}JOY {formatMetric(wellness.joy_balance, 0)}{" "}
                &bull;{" "}CARE {formatMetric(wellness.care_balance, 2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {dailyMessage && (
        <div className="mt-6">
          <QuestDialogueWindow lines={dialogueLines} tone={dailyMessage.tone} />
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {questsLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/50 md:col-span-3">
            Memuat quest harian...
          </div>
        )}
        {!questsLoading && quests && quests.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60 md:col-span-3">
            Tidak ada quest hari ini. Coba hubungi counselor jika kamu membutuhkan dukungan tambahan.
          </div>
        )}
        {!questsLoading &&
          quests &&
          quests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              isCompleting={completeQuestMutation.isPending}
              onComplete={handleComplete}
            />
          ))}
      </div>
    </section>
  );
}



