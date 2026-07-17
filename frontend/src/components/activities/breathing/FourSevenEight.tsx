'use client';

/**
 * 4-7-8 Breathing Exercise
 * 
 * Dr. Andrew Weil's relaxing breath technique:
 * - Inhale for 4 counts
 * - Hold for 7 counts
 * - Exhale for 8 counts
 * 
 * Benefits:
 * - Promotes sleep
 * - Reduces anxiety
 * - Helps manage cravings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityProps, ActivityResult } from '../types';

type BreathPhase = 'inhale' | 'hold' | 'exhale';

const PHASE_DURATIONS: Record<BreathPhase, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
};

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Breathe In',
  hold: 'Hold',
  exhale: 'Breathe Out',
};

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale'];

const DEFAULT_CYCLES = 4;

export default function FourSevenEight({ 
  onComplete, 
  onProgress, 
  onExit,
  config,
  userPreferences 
}: ActivityProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>('inhale');
  const [phaseTimer, setPhaseTimer] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const totalCycles = (config?.customParams?.totalCycles as number) ?? DEFAULT_CYCLES;
  const reducedMotion = userPreferences?.reducedMotion ?? false;
  
  // Calculate progress
  const cycleLength = 4 + 7 + 8; // 19 seconds per cycle
  const currentPhaseStart = PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(currentPhase))
    .reduce((sum, phase) => sum + PHASE_DURATIONS[phase], 0);
  const progressInCycle = currentPhaseStart + phaseTimer;
  const totalProgress = ((currentCycle - 1) * cycleLength + progressInCycle) / (totalCycles * cycleLength);
  const progress = Math.round(totalProgress * 100);
  
  // Report progress
  useEffect(() => {
    if (isActive) {
      onProgress?.(progress);
    }
  }, [progress, isActive, onProgress]);
  
  // Handle phase transitions
  const advancePhase = useCallback(() => {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    const nextIndex = (currentIndex + 1) % 3;
    
    if (nextIndex === 0) {
      // Completed a cycle
      if (currentCycle >= totalCycles) {
        // Exercise complete
        setIsCompleted(true);
        setIsActive(false);
        
        const result: ActivityResult = {
          activityId: 'four-seven-eight',
          completedAt: new Date().toISOString(),
          duration: startTimeRef.current 
            ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
            : totalCycles * cycleLength,
          completed: true,
          metrics: {
            breathCycles: totalCycles,
            technique: '4-7-8',
          },
        };
        onComplete?.(result);
        return;
      }
      setCurrentCycle(prev => prev + 1);
    }
    
    setCurrentPhase(PHASE_ORDER[nextIndex]);
    setPhaseTimer(0);
  }, [currentPhase, currentCycle, totalCycles, cycleLength, onComplete]);
  
  // Timer logic
  useEffect(() => {
    if (!isActive) return;
    
    const currentPhaseDuration = PHASE_DURATIONS[currentPhase];
    
    intervalRef.current = setInterval(() => {
      setPhaseTimer(prev => {
        if (prev >= currentPhaseDuration - 1) {
          advancePhase();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, currentPhase, advancePhase]);
  
  const handleStart = () => {
    startTimeRef.current = new Date();
    setIsActive(true);
    setCurrentPhase('inhale');
    setPhaseTimer(0);
    setCurrentCycle(1);
    setIsCompleted(false);
  };
  
  const handlePause = () => {
    setIsActive(false);
  };
  
  const handleExit = () => {
    setIsActive(false);
    onExit?.();
  };
  
  // Circle animation based on phase
  const getCircleScale = () => {
    const phaseDuration = PHASE_DURATIONS[currentPhase];
    switch (currentPhase) {
      case 'inhale': return 1 + (phaseTimer / phaseDuration) * 0.5;
      case 'hold': return 1.5;
      case 'exhale': return 1.5 - (phaseTimer / phaseDuration) * 0.5;
      default: return 1;
    }
  };
  
  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'inhale': return 'from-indigo-500 to-purple-500';
      case 'hold': return 'from-purple-500 to-pink-500';
      case 'exhale': return 'from-pink-500 to-indigo-500';
      default: return 'from-indigo-500 to-purple-500';
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6 bg-gradient-to-br from-indigo-950 to-purple-950 rounded-3xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">4-7-8 Breathing</h2>
        <p className="text-white/60 text-sm">
          {isActive 
            ? `Cycle ${currentCycle} of ${totalCycles}`
            : 'Dr. Weil\'s relaxing breath technique'
          }
        </p>
      </div>
      
      {/* Main visualization - concentric circles */}
      <div className="relative w-72 h-72 mb-8">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border border-white/10" />
        
        {/* Animated breathing circle */}
        <motion.div
          className={`absolute inset-8 rounded-full bg-gradient-to-br ${getPhaseColor()} opacity-40`}
          animate={{
            scale: reducedMotion ? 1 : getCircleScale(),
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.3,
            ease: 'easeOut',
          }}
          style={{ transformOrigin: 'center center' }}
        />
        
        {/* Inner glow */}
        <motion.div
          className="absolute inset-16 rounded-full bg-white/10 backdrop-blur-sm"
          animate={{
            scale: reducedMotion ? 1 : getCircleScale() * 0.8,
            opacity: isActive ? 0.3 : 0.1,
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.3,
          }}
          style={{ transformOrigin: 'center center' }}
        />
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={isActive ? currentPhase : 'idle'}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center"
            >
              {isActive ? (
                <>
                  <div className="text-6xl font-bold text-white mb-2">
                    {PHASE_DURATIONS[currentPhase] - phaseTimer}
                  </div>
                  <div className="text-lg font-medium text-white/80">
                    {PHASE_LABELS[currentPhase]}
                  </div>
                  <div className="text-sm text-white/40 mt-1">
                    {currentPhase === 'inhale' && '(4 counts)'}
                    {currentPhase === 'hold' && '(7 counts)'}
                    {currentPhase === 'exhale' && '(8 counts)'}
                  </div>
                </>
              ) : isCompleted ? (
                <>
                  <div className="text-5xl mb-3">🌙</div>
                  <div className="text-lg font-medium text-white">
                    Feeling calmer?
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">💜</div>
                  <div className="text-lg font-medium text-white/80">
                    Ready to relax
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* Progress indicator */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i < currentCycle - 1
                ? 'bg-purple-400'
                : i === currentCycle - 1 && isActive
                ? 'bg-purple-400/50 animate-pulse'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>
      
      {/* Controls */}
      <div className="flex gap-3">
        {!isActive && !isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
          >
            {currentCycle > 1 ? 'Resume' : 'Start'}
          </button>
        )}
        
        {isActive && (
          <button
            onClick={handlePause}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
          >
            Pause
          </button>
        )}
        
        {isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
          >
            Do Again
          </button>
        )}
        
        <button
          onClick={handleExit}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium rounded-xl transition-all"
        >
          Exit
        </button>
      </div>
      
      {/* Instructions */}
      {!isActive && !isCompleted && (
        <div className="mt-8 p-4 bg-white/5 rounded-xl max-w-sm">
          <h3 className="text-sm font-semibold text-white mb-2">The 4-7-8 Pattern:</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>• <span className="text-indigo-300">Inhale</span> quietly through your nose for <strong>4</strong> seconds</li>
            <li>• <span className="text-purple-300">Hold</span> your breath for <strong>7</strong> seconds</li>
            <li>• <span className="text-pink-300">Exhale</span> completely through mouth for <strong>8</strong> seconds</li>
            <li className="pt-2 text-white/40">Best used before sleep or when feeling anxious</li>
          </ul>
        </div>
      )}
    </div>
  );
}
