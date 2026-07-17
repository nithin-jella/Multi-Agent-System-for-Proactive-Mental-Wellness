'use client';

/**
 * Box Breathing Exercise
 * 
 * A calming breathing technique using equal counts:
 * - Inhale for 4 counts
 * - Hold for 4 counts
 * - Exhale for 4 counts
 * - Hold for 4 counts
 * 
 * Benefits:
 * - Reduces stress and anxiety
 * - Activates parasympathetic nervous system
 * - Improves focus and concentration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityProps, ActivityResult } from '../types';

type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

interface BoxBreathingConfig {
  /** Duration of each phase in seconds */
  phaseDuration: number;
  /** Number of complete cycles */
  totalCycles: number;
}

const DEFAULT_CONFIG: BoxBreathingConfig = {
  phaseDuration: 4,
  totalCycles: 4,
};

const PHASE_LABELS: Record<BreathPhase, string> = {
  inhale: 'Breathe In',
  hold1: 'Hold',
  exhale: 'Breathe Out',
  hold2: 'Hold',
};

const PHASE_COLORS: Record<BreathPhase, string> = {
  inhale: 'from-blue-400 to-cyan-400',
  hold1: 'from-cyan-400 to-teal-400',
  exhale: 'from-teal-400 to-green-400',
  hold2: 'from-green-400 to-blue-400',
};

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold1', 'exhale', 'hold2'];

export default function BoxBreathing({ 
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
  
  // Merge config with defaults
  const settings: BoxBreathingConfig = {
    ...DEFAULT_CONFIG,
    phaseDuration: config?.customParams?.phaseDuration as number ?? DEFAULT_CONFIG.phaseDuration,
    totalCycles: config?.customParams?.totalCycles as number ?? DEFAULT_CONFIG.totalCycles,
  };
  
  const reducedMotion = userPreferences?.reducedMotion ?? false;
  
  // Calculate total duration and progress
  const totalPhases = settings.totalCycles * 4;
  const completedPhases = (currentCycle - 1) * 4 + PHASE_ORDER.indexOf(currentPhase);
  const progress = Math.round((completedPhases / totalPhases) * 100);
  
  // Report progress
  useEffect(() => {
    if (isActive) {
      onProgress?.(progress);
    }
  }, [progress, isActive, onProgress]);
  
  // Handle phase transitions
  const advancePhase = useCallback(() => {
    const currentIndex = PHASE_ORDER.indexOf(currentPhase);
    const nextIndex = (currentIndex + 1) % 4;
    
    if (nextIndex === 0) {
      // Completed a cycle
      if (currentCycle >= settings.totalCycles) {
        // Exercise complete
        setIsCompleted(true);
        setIsActive(false);
        
        const result: ActivityResult = {
          activityId: 'box-breathing',
          completedAt: new Date().toISOString(),
          duration: startTimeRef.current 
            ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
            : settings.totalCycles * settings.phaseDuration * 4,
          completed: true,
          metrics: {
            breathCycles: settings.totalCycles,
            phaseDuration: settings.phaseDuration,
          },
        };
        onComplete?.(result);
        return;
      }
      setCurrentCycle(prev => prev + 1);
    }
    
    setCurrentPhase(PHASE_ORDER[nextIndex]);
    setPhaseTimer(0);
  }, [currentPhase, currentCycle, settings.totalCycles, settings.phaseDuration, onComplete]);
  
  // Timer logic
  useEffect(() => {
    if (!isActive) return;
    
    intervalRef.current = setInterval(() => {
      setPhaseTimer(prev => {
        if (prev >= settings.phaseDuration - 1) {
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
  }, [isActive, settings.phaseDuration, advancePhase]);
  
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
  
  const handleResume = () => {
    setIsActive(true);
  };
  
  const handleExit = () => {
    setIsActive(false);
    onExit?.();
  };
  
  const handleRestart = () => {
    handleStart();
  };
  
  // Box scale animation based on phase
  const getBoxScale = () => {
    switch (currentPhase) {
      case 'inhale': return 1 + (phaseTimer / settings.phaseDuration) * 0.3;
      case 'hold1': return 1.3;
      case 'exhale': return 1.3 - (phaseTimer / settings.phaseDuration) * 0.3;
      case 'hold2': return 1;
      default: return 1;
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Box Breathing</h2>
        <p className="text-white/60 text-sm">
          {isActive 
            ? `Cycle ${currentCycle} of ${settings.totalCycles}`
            : 'A calming 4-4-4-4 breathing technique'
          }
        </p>
      </div>
      
      {/* Main visualization */}
      <div className="relative w-64 h-64 mb-8">
        {/* Background box */}
        <div className="absolute inset-0 rounded-3xl border-2 border-white/10" />
        
        {/* Animated breathing box */}
        <motion.div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${PHASE_COLORS[currentPhase]} opacity-30`}
          animate={{
            scale: reducedMotion ? 1 : getBoxScale(),
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.5,
            ease: 'easeInOut',
          }}
        />
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              {isActive ? (
                <>
                  <div className="text-5xl font-bold text-white mb-2">
                    {settings.phaseDuration - phaseTimer}
                  </div>
                  <div className="text-lg font-medium text-white/80">
                    {PHASE_LABELS[currentPhase]}
                  </div>
                </>
              ) : isCompleted ? (
                <>
                  <div className="text-5xl mb-2">✨</div>
                  <div className="text-lg font-medium text-white/80">
                    Great job!
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-2">🌬️</div>
                  <div className="text-lg font-medium text-white/80">
                    Ready?
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Corner indicators */}
        {['Inhale', 'Hold', 'Exhale', 'Hold'].map((label, index) => {
          const positions = [
            'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
            'top-0 right-0 translate-x-1/2 -translate-y-1/2',
            'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
            'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
          ];
          const isCurrentCorner = PHASE_ORDER.indexOf(currentPhase) === index;
          
          return (
            <div
              key={index}
              className={`absolute ${positions[index]} w-16 h-16 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                isCurrentCorner && isActive
                  ? 'bg-white text-slate-900 scale-110'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>
      
      {/* Progress bar */}
      <div className="w-full max-w-xs mb-6">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-400 to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/40">
          <span>{Math.floor(progress)}% complete</span>
          <span>{settings.totalCycles - currentCycle + 1} cycles left</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex gap-3">
        {!isActive && !isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
          >
            Start
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
        
        {!isActive && !isCompleted && currentCycle > 1 && (
          <button
            onClick={handleResume}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-xl transition-all"
          >
            Resume
          </button>
        )}
        
        {isCompleted && (
          <button
            onClick={handleRestart}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
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
          <h3 className="text-sm font-semibold text-white mb-2">How it works:</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>• Breathe in slowly for {settings.phaseDuration} seconds</li>
            <li>• Hold your breath for {settings.phaseDuration} seconds</li>
            <li>• Exhale slowly for {settings.phaseDuration} seconds</li>
            <li>• Hold empty for {settings.phaseDuration} seconds</li>
            <li>• Repeat {settings.totalCycles} times</li>
          </ul>
        </div>
      )}
    </div>
  );
}
