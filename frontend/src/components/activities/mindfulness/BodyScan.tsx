'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ActivityProps, ActivityResult } from '../types';

const SCAN_STEPS = [
  { label: 'Breath', prompt: 'Notice your breath without changing it.', icon: '🌬️' },
  { label: 'Head', prompt: 'Relax your forehead, jaw, and neck.', icon: '🧠' },
  { label: 'Shoulders', prompt: 'Let your shoulders drop away from your ears.', icon: '🫳' },
  { label: 'Core', prompt: 'Notice your chest and abdomen rising and falling.', icon: '💛' },
  { label: 'Legs', prompt: 'Soften your hips, knees, calves, and feet.', icon: '🦶' },
] as const;

export default function BodyScan({ onComplete, onProgress, onExit }: ActivityProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const totalSteps = SCAN_STEPS.length;
  const progress = Math.round(((isCompleted ? totalSteps : stepIndex) / totalSteps) * 100);

  const handleStart = (): void => {
    startedAtRef.current = Date.now();
    setHasStarted(true);
    setStepIndex(0);
    setIsCompleted(false);
    onProgress?.(0);
  };

  const handleNext = (): void => {
    if (stepIndex >= totalSteps - 1) {
      setIsCompleted(true);
      onProgress?.(100);
      const result: ActivityResult = {
        activityId: 'body-scan',
        completedAt: new Date().toISOString(),
        duration: startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0,
        completed: true,
        metrics: {
          stepsCompleted: totalSteps,
          technique: 'Body Scan',
        },
      };
      onComplete?.(result);
      return;
    }

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    onProgress?.(Math.round((nextIndex / totalSteps) * 100));
  };

  const step = SCAN_STEPS[stepIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-125 p-6 bg-linear-to-br from-slate-900 to-indigo-950 rounded-3xl">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Body Scan Meditation</h2>
        <p className="text-white/70 text-sm">
          {isCompleted ? 'Session completed.' : hasStarted ? `Step ${stepIndex + 1} of ${totalSteps}` : 'A short guided mindfulness check-in.'}
        </p>
      </div>

      <div className="w-full max-w-md mb-8">
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-purple-500 to-indigo-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
      </div>

      <div className="w-full max-w-md min-h-55 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!hasStarted && !isCompleted && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🧘</div>
              <p className="text-white/70 text-sm">Sit comfortably, then move your attention through the body.</p>
            </motion.div>
          )}

          {hasStarted && !isCompleted && (
            <motion.div
              key={`step-${step.label}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full text-center rounded-2xl p-6 bg-white/10 border border-white/15"
            >
              <div className="text-5xl mb-3">{step.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">{step.label}</h3>
              <p className="text-white/80 text-sm">{step.prompt}</p>
            </motion.div>
          )}

          {isCompleted && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🌟</div>
              <h3 className="text-xl font-bold text-white mb-2">Great work.</h3>
              <p className="text-white/70 text-sm">You have finished a full body scan and reset your attention.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-3 mt-8">
        {!hasStarted && !isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-linear-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all"
          >
            Begin
          </button>
        )}

        {hasStarted && !isCompleted && (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all"
          >
            Next
          </button>
        )}

        {isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-linear-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all"
          >
            Do Again
          </button>
        )}

        <button
          onClick={onExit}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium rounded-xl transition-all"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
