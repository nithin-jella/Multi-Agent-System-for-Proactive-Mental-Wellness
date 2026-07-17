"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuestDialogueWindowProps {
  lines: string[];
  tone?: string;
  className?: string;
  title?: string;
  avatarSrc?: string;
}

export default function QuestDialogueWindow({
  lines,
  tone,
  className,
  title = "Aika",
  avatarSrc = "/aika-human.jpeg",
}: QuestDialogueWindowProps) {
  if (!lines.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/15 bg-linear-to-br from-[#0A1C3A]/95 via-[#13294B]/90 to-[#0A1C3A]/95 shadow-[0_12px_35px_rgba(3,12,36,0.45)]",
        "before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,202,64,0.25),transparent_55%)] before:opacity-80",
        className,
      )}
    >
      <div className="relative z-10 flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/20 shadow-lg shadow-black/40 md:h-24 md:w-24">
            <Image
              src={avatarSrc}
              alt={title}
              fill
              sizes="96px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#FFCA40]">
                {title}
              </span>
              {tone && (
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/60">
                  {tone}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/85">
              {lines.map((line, idx) => (
                <p key={`dialogue-line-${idx}`} className="font-medium">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-6 bottom-5 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute inset-x-6 bottom-3 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
    </motion.div>
  );
}
