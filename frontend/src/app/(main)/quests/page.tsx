"use client";

import Link from "next/link";
import QuestBoard from "@/components/quests/QuestBoard";
import { FiArrowLeft } from "@/icons";

export default function QuestsPage() {
  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 pt-24 pb-12 space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/60">UGM-AICare Quest</p>
            <h1 className="text-3xl font-semibold text-white">Quest harianmu</h1>
            <p className="mt-2 text-sm text-white/60">
              Selesaikan quest untuk menjaga keseimbangan harian dan kumpulkan Harmony bersama guild-mu.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
          >
            <FiArrowLeft className="h-4 w-4" />
            Kembali ke dashboard
          </Link>
        </div>

        <QuestBoard />
      </div>
    </main>
  );
}
