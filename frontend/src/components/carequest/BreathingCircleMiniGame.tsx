"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiRefreshCcw, FiPlay, FiPause } from "@/icons";
import { cn } from "@/lib/utils";

interface BreathingCircleMiniGameProps {
  cycles?: number;
  className?: string;
  onComplete?: () => void;
}

type BreathingPhase = {
  key: "inhale" | "hold" | "exhale";
  duration: number;
  label: string;
  instruction: string;
};

const PHASES: BreathingPhase[] = [
  { key: "inhale", duration: 4, label: "Inhale", instruction: "Inhale gently through your nose" },
  { key: "hold", duration: 7, label: "Hold", instruction: "Hold your breath and relax your shoulders" },
  { key: "exhale", duration: 8, label: "Exhale", instruction: "Exhale slowly through your mouth" },
];

const CANVAS_SIZE = 280;
const BASE_RADIUS = 60;
const MAX_RADIUS = 120;

export default function BreathingCircleMiniGame({
  cycles = 3,
  className,
  onComplete,
}: BreathingCircleMiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [cycleIndex, setCycleIndex] = useState(0);

  const currentPhase = useMemo(() => PHASES[phaseIndex], [phaseIndex]);

  const resetState = useCallback(() => {
    setIsRunning(false);
    setPhaseIndex(0);
    setPhaseProgress(0);
    setCycleIndex(0);
  }, []);

  const advancePhase = useCallback(() => {
    setPhaseIndex((prevPhase) => {
      const isLastPhase = prevPhase === PHASES.length - 1;
      if (isLastPhase) {
        setCycleIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= cycles) {
            setIsRunning(false);
            onComplete?.();
            return prevIndex;
          }
          return nextIndex;
        });
        return 0;
      }
      return prevPhase + 1;
    });
    setPhaseProgress(0);
  }, [cycles, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * ratio;
    canvas.height = CANVAS_SIZE * ratio;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const interval = window.setInterval(() => {
      setPhaseProgress((prev) => {
        const next = prev + 0.1;
        if (next >= currentPhase.duration) {
          advancePhase();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [isRunning, currentPhase.duration, advancePhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const logicalSize = CANVAS_SIZE;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const progress = currentPhase.duration
      ? Math.min(phaseProgress / currentPhase.duration, 1)
      : 1;

    let radius = BASE_RADIUS;
    if (currentPhase.key === "inhale") {
      radius = BASE_RADIUS + progress * (MAX_RADIUS - BASE_RADIUS);
    } else if (currentPhase.key === "hold") {
      radius = MAX_RADIUS;
    } else {
      radius = MAX_RADIUS - progress * (MAX_RADIUS - BASE_RADIUS);
    }

    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2;

    ctx.clearRect(0, 0, logicalSize, logicalSize);
    ctx.save();

    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.25, centerX, centerY, radius);
    gradient.addColorStop(0, "rgba(94, 234, 212, 0.9)");
    gradient.addColorStop(0.6, "rgba(59, 167, 181, 0.7)");
    gradient.addColorStop(1, "rgba(2, 19, 48, 0.2)");

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 202, 64, 0.8)";
    ctx.lineWidth = 2;
    ctx.arc(centerX, centerY, MAX_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, [phaseProgress, currentPhase]);

  const handleStart = useCallback(() => {
    resetState();
    setIsRunning(true);
  }, [resetState]);

  const handlePauseToggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const displayCycle = useMemo(() => {
    if (isRunning || phaseProgress > 0) {
      return Math.min(cycleIndex + 1, cycles);
    }
    if (cycleIndex === 0) {
      return 0;
    }
    return Math.min(cycleIndex + 1, cycles);
  }, [isRunning, phaseProgress, cycleIndex, cycles]);
  const remainingSeconds = Math.max(currentPhase.duration - phaseProgress, 0).toFixed(1);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_18px_40px_rgba(2,16,40,0.35)] backdrop-blur",
        className,
      )}
    >
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">4-7-8 Breathing Circle</p>
        <p className="text-lg font-semibold text-white">{currentPhase.label}</p>
        <p className="text-sm text-white/70">{currentPhase.instruction}</p>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} aria-hidden className="rounded-full" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-3xl font-light text-white">{remainingSeconds}s</span>
          <span className="text-xs uppercase tracking-[0.28em] text-white/60">Phase Time</span>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
        <span>Cycle {displayCycle} / {cycles}</span>
        <span>•</span>
        <span>Phase {phaseIndex + 1} / {PHASES.length}</span>
      </div>

      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleStart}
          className="flex items-center gap-2 rounded-full border border-[#5eead4]/40 bg-[#5eead4]/10 px-4 py-2 text-sm font-semibold text-[#5eead4] transition hover:border-[#5eead4]/70 hover:text-white"
        >
          <FiRefreshCcw className="h-4 w-4" />
          Restart
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={isRunning ? handlePauseToggle : handleStart}
          className={cn(
            "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
            isRunning
              ? "border-white/20 bg-white/10 text-white hover:border-white/40"
              : "border-[#FFCA40]/50 bg-[#FFCA40]/15 text-[#FFCA40] hover:border-[#FFCA40]/80 hover:text-white",
          )}
        >
          {isRunning ? (
            <>
              <FiPause className="h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <FiPlay className="h-4 w-4" />
              Begin
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
