'use client';

/**
 * Activities Page
 * 
 * Browse and play therapeutic activities for mental wellness.
 * Integrated with intervention plans from the TCA agent.
 * 
 * Supports deep linking via ?play=activity-id query parameter.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityPlayer, ActivityBrowser, activityRegistry, ActivityMetadata } from '@/components/activities';

export default function ActivitiesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedActivity, setSelectedActivity] = useState<ActivityMetadata | null>(null);
  const [completedActivities, setCompletedActivities] = useState<string[]>([]);
  
  // Handle deep link via ?play=activity-id
  useEffect(() => {
    const playParam = searchParams.get('play');
    if (playParam) {
      const activity = activityRegistry.get(playParam);
      if (activity) {
        setSelectedActivity(activity);
      }
    }
  }, [searchParams]);
  
  const handleSelect = (activity: ActivityMetadata) => {
    setSelectedActivity(activity);
    // Update URL without full navigation
    router.push(`/activities?play=${activity.id}`, { scroll: false });
  };
  
  const handleComplete = (result: { activityId: string; completed: boolean }) => {
    if (result.completed) {
      setCompletedActivities(prev => 
        prev.includes(result.activityId) ? prev : [...prev, result.activityId]
      );
    }
  };
  
  const handleExit = () => {
    setSelectedActivity(null);
    // Clear the play parameter from URL
    router.push('/activities', { scroll: false });
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {selectedActivity ? (
            <motion.div
              key="player"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              {/* Back button */}
              <button
                onClick={handleExit}
                className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to activities
              </button>
              
              {/* Activity player */}
              <ActivityPlayer
                activityId={selectedActivity.id}
                onComplete={handleComplete}
                onExit={handleExit}
              />
            </motion.div>
          ) : (
            <motion.div
              key="browser"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  🧘 Therapeutic Activities
                </h1>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Interactive exercises for stress relief, grounding, and mindfulness. 
                  Each activity is designed to help you feel calmer and more present.
                </p>
              </div>
              
              {/* Quick stats */}
              <div className="flex justify-center gap-4 mb-8">
                <div className="px-4 py-2 bg-card border border-border rounded-lg text-center">
                  <div className="text-2xl font-bold text-primary">
                    {activityRegistry.getAll().length}
                  </div>
                  <div className="text-xs text-muted-foreground">Activities</div>
                </div>
                <div className="px-4 py-2 bg-card border border-border rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {completedActivities.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="px-4 py-2 bg-card border border-border rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-500">
                    {activityRegistry.getCategories().length}
                  </div>
                  <div className="text-xs text-muted-foreground">Categories</div>
                </div>
              </div>
              
              {/* Recommended section */}
              {completedActivities.length === 0 && (
                <div className="mb-8 p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl border border-primary/20">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    ✨ Recommended for beginners
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Start with Box Breathing - a simple technique used by Navy SEALs to reduce stress.
                  </p>
                  <button
                    onClick={() => {
                      const boxBreathing = activityRegistry.get('box-breathing');
                      if (boxBreathing) setSelectedActivity(boxBreathing);
                    }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Try Box Breathing →
                  </button>
                </div>
              )}
              
              {/* Activity browser */}
              <ActivityBrowser
                onSelect={handleSelect}
                columns={2}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
