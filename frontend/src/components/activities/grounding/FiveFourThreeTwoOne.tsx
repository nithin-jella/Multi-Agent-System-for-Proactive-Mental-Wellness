'use client';

/**
 * 5-4-3-2-1 Grounding Exercise
 * 
 * A sensory awareness technique for anxiety and panic attacks:
 * - 5 things you can SEE
 * - 4 things you can TOUCH
 * - 3 things you can HEAR
 * - 2 things you can SMELL
 * - 1 thing you can TASTE
 * 
 * Benefits:
 * - Interrupts anxiety spirals
 * - Brings focus to the present moment
 * - Engages all five senses
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityProps, ActivityResult } from '../types';

type GroundingStep = {
  count: number;
  sense: string;
  icon: string;
  color: string;
  prompt: string;
  examples: string;
};

const GROUNDING_STEPS: GroundingStep[] = [
  {
    count: 5,
    sense: 'SEE',
    icon: '👁️',
    color: 'from-blue-500 to-cyan-500',
    prompt: 'Name 5 things you can SEE',
    examples: 'A window, your hands, a plant, the ceiling, a book...',
  },
  {
    count: 4,
    sense: 'TOUCH',
    icon: '✋',
    color: 'from-emerald-500 to-green-500',
    prompt: 'Name 4 things you can TOUCH',
    examples: 'The floor, your clothes, a chair, the air...',
  },
  {
    count: 3,
    sense: 'HEAR',
    icon: '👂',
    color: 'from-violet-500 to-purple-500',
    prompt: 'Name 3 things you can HEAR',
    examples: 'Traffic, your breathing, music, birds...',
  },
  {
    count: 2,
    sense: 'SMELL',
    icon: '👃',
    color: 'from-orange-500 to-amber-500',
    prompt: 'Name 2 things you can SMELL',
    examples: 'Fresh air, coffee, your shampoo...',
  },
  {
    count: 1,
    sense: 'TASTE',
    icon: '👅',
    color: 'from-pink-500 to-rose-500',
    prompt: 'Name 1 thing you can TASTE',
    examples: 'Water, mint, the inside of your mouth...',
  },
];

export default function FiveFourThreeTwoOne({ 
  onComplete, 
  onProgress, 
  onExit,
  userPreferences 
}: ActivityProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [itemsNamed, setItemsNamed] = useState<number[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const startTimeRef = useRef<Date | null>(null);
  const reducedMotion = userPreferences?.reducedMotion ?? false;
  
  const isActive = currentStepIndex >= 0 && !isCompleted;
  const currentStep = GROUNDING_STEPS[currentStepIndex];
  const currentCount = itemsNamed[currentStepIndex] ?? 0;
  
  // Calculate progress
  const totalItems = 5 + 4 + 3 + 2 + 1; // 15 total
  const completedItems = itemsNamed.reduce((sum, count) => sum + count, 0);
  const progress = Math.round((completedItems / totalItems) * 100);
  
  const handleStart = () => {
    startTimeRef.current = new Date();
    setCurrentStepIndex(0);
    setItemsNamed([0, 0, 0, 0, 0]);
    setIsCompleted(false);
    onProgress?.(0);
  };
  
  const handleItemNamed = () => {
    const newItemsNamed = [...itemsNamed];
    newItemsNamed[currentStepIndex] = currentCount + 1;
    setItemsNamed(newItemsNamed);
    
    // Check if current step is complete
    if (currentCount + 1 >= currentStep.count) {
      // Move to next step or complete
      if (currentStepIndex >= GROUNDING_STEPS.length - 1) {
        // Exercise complete
        setIsCompleted(true);
        
        const result: ActivityResult = {
          activityId: 'five-four-three-two-one',
          completedAt: new Date().toISOString(),
          duration: startTimeRef.current 
            ? Math.round((Date.now() - startTimeRef.current.getTime()) / 1000)
            : 0,
          completed: true,
          metrics: {
            itemsIdentified: totalItems,
            technique: '5-4-3-2-1 Grounding',
          },
        };
        onComplete?.(result);
      } else {
        setCurrentStepIndex(prev => prev + 1);
      }
    }
    
    // Update progress
    const newTotal = newItemsNamed.reduce((sum, count) => sum + count, 0);
    onProgress?.(Math.round((newTotal / totalItems) * 100));
  };
  
  const handleExit = () => {
    onExit?.();
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">5-4-3-2-1 Grounding</h2>
        <p className="text-white/60 text-sm">
          {isActive 
            ? `Step ${currentStepIndex + 1} of 5`
            : isCompleted
            ? 'You did great!'
            : 'Anchor yourself in the present'
          }
        </p>
      </div>
      
      {/* Progress dots */}
      <div className="flex gap-3 mb-8">
        {GROUNDING_STEPS.map((step, i) => (
          <motion.div
            key={i}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
              i < currentStepIndex || isCompleted
                ? 'border-green-500 bg-green-500/20'
                : i === currentStepIndex
                ? 'border-white bg-white/10'
                : 'border-white/20 bg-white/5'
            }`}
            animate={i === currentStepIndex && !reducedMotion ? {
              scale: [1, 1.05, 1],
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            <span className="text-xl">{step.icon}</span>
            <span className="absolute -bottom-6 text-xs font-bold text-white/80">
              {step.count}
            </span>
          </motion.div>
        ))}
      </div>
      
      {/* Main content area */}
      <div className="w-full max-w-md min-h-[200px]">
        <AnimatePresence mode="wait">
          {!isActive && !isCompleted && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🌿</div>
              <p className="text-white/70 text-sm mb-6">
                This grounding technique uses your five senses to bring you back 
                to the present moment. Take your time with each step.
              </p>
            </motion.div>
          )}
          
          {isActive && currentStep && (
            <motion.div
              key={`step-${currentStepIndex}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="text-center"
            >
              {/* Current step card */}
              <div className={`p-6 rounded-2xl bg-gradient-to-br ${currentStep.color} mb-4`}>
                <div className="text-5xl mb-3">{currentStep.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {currentStep.prompt}
                </h3>
                <p className="text-sm text-white/70">
                  {currentStep.examples}
                </p>
              </div>
              
              {/* Counter */}
              <div className="flex justify-center gap-2 mb-4">
                {Array.from({ length: currentStep.count }).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                      i < currentCount
                        ? `bg-gradient-to-br ${currentStep.color} text-white`
                        : 'bg-white/10 text-white/40'
                    }`}
                    initial={i === currentCount - 1 ? { scale: 0.5 } : {}}
                    animate={i === currentCount - 1 ? { scale: 1 } : {}}
                  >
                    {i < currentCount ? '✓' : i + 1}
                  </motion.div>
                ))}
              </div>
              
              {/* Tap button */}
              <button
                onClick={handleItemNamed}
                className="px-8 py-4 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all transform hover:scale-105 active:scale-95"
              >
                I found one ✓
              </button>
            </motion.div>
          )}
          
          {isCompleted && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">🌟</div>
              <h3 className="text-xl font-bold text-white mb-2">
                Well done!
              </h3>
              <p className="text-white/60 text-sm mb-6">
                You've engaged all five senses. Notice how you feel more 
                grounded and present in this moment.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Controls */}
      <div className="flex gap-3 mt-8">
        {!isActive && !isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
          >
            Begin
          </button>
        )}
        
        {isCompleted && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105"
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
    </div>
  );
}
