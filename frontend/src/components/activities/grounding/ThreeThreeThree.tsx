'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ActivityProps, ActivityResult } from '../types';

type Step = {
  id: number;
  label: string;
  count: number;
  prompt: string;
  icon: string;
  color: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    label: 'SEE',
    count: 3,
    prompt: 'Name 3 things you can see around you.',
    icon: '👀',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 2,
    label: 'HEAR',
    count: 3,
    prompt: 'Name 3 sounds you can hear right now.',
    icon: '👂',
    color: 'from-purple-500 to-violet-500',
  },
  {
    id: 3,
    label: 'MOVE',
    count: 3,
    prompt: 'Gently move 3 body parts.',
    icon: '🖐️',
    color: 'from-emerald-500 to-green-500',
  },
];

export default function ThreeThreeThree({ onComplete, onProgress, onExit }: ActivityProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState<number[]>([0, 0, 0]);
  const [isCompleted, setIsCompleted] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const totalItems = STEPS.reduce((sum, step) => sum + step.count, 0);
  const completedItems = stepProgress.reduce((sum, value) => sum + value, 0);
  const progressPercent = Math.round((completedItems / totalItems) * 100);

  const currentStep = STEPS[activeStepIndex];

  const handleStart = (): void => {
    startedAtRef.current = Date.now();
    setHasStarted(true);
    setActiveStepIndex(0);
    setStepProgress([0, 0, 0]);
    setIsCompleted(false);
    onProgress?.(0);
  };

  const completeActivity = (): void => {
    setIsCompleted(true);
    const result: ActivityResult = {
      activityId: 'three-three-three',
      completedAt: new Date().toISOString(),
      duration: startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0,
      completed: true,
      metrics: {
        itemsIdentified: totalItems,
        technique: '3-3-3 Grounding',
      },
    };
    onProgress?.(100);
    onComplete?.(result);
  };

  const handleCountOne = (): void => {
    const next = [...stepProgress];
    const currentCount = next[activeStepIndex] ?? 0;
    const stepTarget = currentStep.count;

    if (currentCount >= stepTarget) {
      return;
    }

    next[activeStepIndex] = currentCount + 1;
    setStepProgress(next);

    const nextProgress = Math.round((next.reduce((sum, value) => sum + value, 0) / totalItems) * 100);
    onProgress?.(nextProgress);

    if (next[activeStepIndex] >= stepTarget) {
      if (activeStepIndex === STEPS.length - 1) {
        completeActivity();
      } else {
        setActiveStepIndex((prev) => prev + 1);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-125 p-6 bg-linear-to-br from-slate-900 to-slate-800 rounded-3xl">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">3-3-3 Grounding</h2>
        <p className="text-white/70 text-sm">
          {isCompleted
            ? 'You are grounded in the present moment.'
            : hasStarted
              ? `Step ${activeStepIndex + 1} of ${STEPS.length}`
              : 'A quick grounding technique for intense anxiety.'}
        </p>
      </div>

      <div className="w-full max-w-md mb-8">
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-linear-to-r from-cyan-500 to-emerald-500"
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
        <p className="text-xs text-white/60 mt-2 text-right">{progressPercent}%</p>
      </div>

      <div className="w-full max-w-md min-h-57.5">
        <AnimatePresence mode="wait">
          {!hasStarted && !isCompleted && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🌿</div>
              <p className="text-white/70 text-sm">
                This exercise helps interrupt anxious thought loops in under 2 minutes.
              </p>
            </motion.div>
          )}

          {hasStarted && !isCompleted && (
            <motion.div
              key={`step-${currentStep.id}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="text-center"
            >
              <div className={`rounded-2xl p-6 bg-linear-to-br ${currentStep.color} mb-5`}>
                <div className="text-5xl mb-3">{currentStep.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{currentStep.label}</h3>
                <p className="text-white/80 text-sm">{currentStep.prompt}</p>
              </div>

              <div className="flex justify-center gap-2 mb-5">
                {Array.from({ length: currentStep.count }).map((_, index) => {
                  const done = index < (stepProgress[activeStepIndex] ?? 0);
                  return (
                    <div
                      key={index}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        done ? 'bg-white text-slate-900' : 'bg-white/15 text-white/70'
                      }`}
                    >
                      {done ? '✓' : index + 1}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleCountOne}
                className="px-8 py-3 rounded-xl font-semibold bg-white/20 hover:bg-white/30 text-white transition-all"
              >
                Mark one
              </button>
            </motion.div>
          )}

          {isCompleted && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-bold text-white mb-2">Well done.</h3>
              <p className="text-white/70 text-sm">Take one steady breath and notice the room around you.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-3 mt-8">
        {!hasStarted && !isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all"
          >
            Begin
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
