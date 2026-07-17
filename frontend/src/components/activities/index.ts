/**
 * Therapeutic Activities Module
 * 
 * Central export file for the activities system.
 * Import from here to access all activity-related functionality.
 * 
 * @example
 * import { 
 *   ActivityPlayer, 
 *   ActivityBrowser, 
 *   activityRegistry 
 * } from '@/components/activities';
 */

// Main components
export { default as ActivityPlayer } from './ActivityPlayer';
export { default as ActivityBrowser } from './ActivityBrowser';

// Registry
export { activityRegistry } from './registry';

// Types
export type {
  ActivityProps,
  ActivityResult,
  ActivityMetadata,
  ActivityConfig,
  ActivityProgress,
  UserPreferences,
} from './types';

// Individual activities (for direct import if needed)
export { BoxBreathing, FourSevenEight, breathingActivities } from './breathing';
export { FiveFourThreeTwoOne, groundingActivities } from './grounding';

export { BodyScan, mindfulnessActivities } from './mindfulness';
