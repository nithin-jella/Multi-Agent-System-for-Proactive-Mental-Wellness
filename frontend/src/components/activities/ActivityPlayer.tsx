'use client';

/**
 * Activity Player Component
 * 
 * This component wraps activity components and provides:
 * - Loading and rendering of activities
 * - Progress tracking and persistence
 * - Consistent UI wrapper
 * - Error handling
 * 
 * Usage:
 * <ActivityPlayer
 *   activityId="box-breathing"
 *   onComplete={(result) => saveProgress(result)}
 * />
 */

import { useState, useCallback, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityRegistry } from './registry';
import type { ActivityProps, ActivityResult, ActivityConfig, UserPreferences } from './types';

// Lazy load activity components
const activityComponents: Record<string, React.LazyExoticComponent<React.ComponentType<ActivityProps>>> = {
  // Breathing
  'box-breathing': lazy(() => import('./breathing/BoxBreathing')),
  'four-seven-eight': lazy(() => import('./breathing/FourSevenEight')),
  // Grounding
  'five-four-three-two-one': lazy(() => import('./grounding/FiveFourThreeTwoOne')),
  'three-three-three': lazy(() => import('./grounding/ThreeThreeThree')),
  // Mindfulness
  'body-scan': lazy(() => import('./mindfulness/BodyScan')),
};

interface ActivityPlayerProps {
  activityId: string;
  config?: Partial<ActivityConfig>;
  userPreferences?: Partial<UserPreferences>;
  onComplete?: (result: ActivityResult) => void;
  onProgress?: (progress: number) => void;
  onExit?: () => void;
  showHeader?: boolean;
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-100 p-6">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="mt-4 text-muted-foreground">Loading activity...</p>
    </div>
  );
}

function ActivityNotFound({ activityId, onExit }: { activityId: string; onExit?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-100 p-6 text-center">
      <div className="text-6xl mb-4">🔍</div>
      <h2 className="text-xl font-bold text-foreground mb-2">Activity Not Found</h2>
      <p className="text-muted-foreground mb-6">
        The activity "{activityId}" could not be found.
      </p>
      {onExit && (
        <button
          onClick={onExit}
          className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
        >
          Go Back
        </button>
      )}
    </div>
  );
}

export default function ActivityPlayer({
  activityId,
  config,
  userPreferences,
  onComplete,
  onProgress,
  onExit,
  showHeader = true,
}: ActivityPlayerProps) {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Get activity metadata
  const activity = activityRegistry.get(activityId);
  const ActivityComponent = activityComponents[activityId];
  
  // Handle progress updates
  const handleProgress = useCallback((newProgress: number) => {
    setProgress(newProgress);
    onProgress?.(newProgress);
  }, [onProgress]);
  
  // Handle completion
  const handleComplete = useCallback((result: ActivityResult) => {
    setProgress(100);
    onComplete?.(result);
  }, [onComplete]);
  
  // Handle exit
  const handleExit = useCallback(() => {
    onExit?.();
  }, [onExit]);
  
  // Activity not found
  if (!activity || !ActivityComponent) {
    return <ActivityNotFound activityId={activityId} onExit={onExit} />;
  }
  
  // Build full config
  const fullConfig: ActivityConfig = {
    duration: config?.duration ?? activity.estimatedDuration,
    difficulty: config?.difficulty ?? activity.difficulty,
    customParams: config?.customParams ?? {},
  };
  
  // Build user preferences with defaults
  const fullPreferences: UserPreferences = {
    soundEnabled: userPreferences?.soundEnabled ?? true,
    vibrationEnabled: userPreferences?.vibrationEnabled ?? true,
    reducedMotion: userPreferences?.reducedMotion ?? false,
  };
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={activityId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header (optional) */}
          {showHeader && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activity.icon}</span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {activity.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    ~{Math.ceil(activity.estimatedDuration / 60)} min • {activity.difficulty}
                  </p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-24">
                <div className="text-xs text-muted-foreground text-right mb-1">
                  {progress}%
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Activity component */}
          <Suspense fallback={<LoadingSpinner />}>
            <ActivityComponent
              onComplete={handleComplete}
              onProgress={handleProgress}
              onExit={handleExit}
              config={fullConfig}
              userPreferences={fullPreferences}
            />
          </Suspense>
          
          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
