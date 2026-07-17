// frontend/src/components/journaling/StreakDisplay.tsx
import React from 'react';
import { FiActivity, FiAward } from 'react-icons/fi'; // Using FiAward for longest streak
import { motion } from 'framer-motion';

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak: number;
    isLoading?: boolean; // Optional loading state
}

export default function StreakDisplay({ currentStreak, longestStreak, isLoading }: StreakDisplayProps) {
    // Don't render anything if loading or if both streaks are zero
    if (isLoading) {
        // Optional: Show a loading skeleton for the streak
        return (
            <div className="mb-4 flex items-center justify-center sm:justify-start gap-x-4 gap-y-1 animate-pulse">
                <div className="h-6 w-32 bg-gray-700 rounded-full"></div>
                <div className="h-6 w-32 bg-gray-700 rounded-full"></div>
            </div>
        );
    }

    if (currentStreak <= 0 && longestStreak <= 0) {
        return null; // Don't show if no streak data is relevant
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-center sm:text-left"
            aria-live="polite" // Announce changes to screen readers
        >
            {/* Current Streak */}
            {currentStreak > 0 && (
                <div
                    className="flex items-center bg-linear-to-r from-orange-500 via-red-500 to-yellow-500 text-white px-3 py-1 rounded-full shadow-md text-xs sm:text-sm font-medium"
                    title={`Current activity streak: ${currentStreak} days`}
                    aria-label={`Current activity streak: ${currentStreak} days`}
                 >
                    <FiActivity className="mr-1 sm:mr-1.5 shrink-0" />
                    <span>{currentStreak}-Day Streak!</span>
                </div>
            )}

             {/* Longest Streak */}
             {/* Show longest only if it's greater than 0 and different from current */}
            {longestStreak > 0 && longestStreak !== currentStreak && (
                 <div
                    className="flex items-center bg-linear-to-r from-purple-500 to-indigo-500 text-white px-3 py-1 rounded-full shadow-md text-xs sm:text-sm font-medium"
                    title={`Longest streak: ${longestStreak} days`}
                    aria-label={`Longest streak achieved: ${longestStreak} days`}
                 >
                     <FiAward className="mr-1 sm:mr-1.5 shrink-0" />
                     <span>Longest: {longestStreak} Days</span>
                 </div>
            )}
             {/* Show if longest IS the current streak (and > 0) */}
             {longestStreak > 0 && longestStreak === currentStreak && (
                 <div
                    className="flex items-center bg-linear-to-r from-purple-500 to-indigo-500 text-white px-3 py-1 rounded-full shadow-md text-xs sm:text-sm font-medium"
                    title={`Current streak matches longest: ${longestStreak} days`}
                    aria-label={`Current streak matches longest streak: ${longestStreak} days`}
                    >
                     <FiAward className="mr-1 sm:mr-1.5 shrink-0" />
                     <span>Record Streak!</span>
                 </div>
            )}
        </motion.div>
    );
}