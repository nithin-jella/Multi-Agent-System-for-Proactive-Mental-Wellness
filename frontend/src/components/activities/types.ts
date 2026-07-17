/**
 * Therapeutic Activities Type Definitions
 * 
 * These types define the contract for all therapeutic activities
 * in the UGM-AICare system.
 */

// ============================================================================
// Activity Metadata (for Registry)
// ============================================================================

/**
 * Metadata for an activity in the registry
 */
export interface ActivityMetadata {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Brief description */
  description: string;
  
  /** Category for grouping */
  category: string;
  
  /** Estimated duration in seconds */
  estimatedDuration: number;
  
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  
  /** Tags for filtering and recommendation */
  tags: string[];
  
  /** Emoji or icon identifier */
  icon: string;
  
  /** Component name for dynamic loading */
  component: string;
}

/**
 * Progress tracking for activities
 */
export interface ActivityProgress {
  /** Current step or phase */
  currentStep: number;
  
  /** Total steps or phases */
  totalSteps: number;
  
  /** Progress percentage (0-100) */
  percentage: number;
  
  /** Time elapsed in seconds */
  elapsed: number;
  
  /** Time remaining in seconds */
  remaining: number;
}

// ============================================================================
// Activity Props & Results
// ============================================================================

/**
 * Props passed to all activity components
 */
export interface ActivityProps {
  /** Called when activity is completed successfully */
  onComplete?: (result: ActivityResult) => void;
  
  /** Called to report progress (0-100) */
  onProgress?: (progress: number) => void;
  
  /** Called if user exits early */
  onExit?: () => void;
  
  /** Optional configuration overrides */
  config?: ActivityConfig;
  
  /** User preferences for personalization */
  userPreferences?: UserPreferences;
}

/**
 * Configuration options for activities
 */
export interface ActivityConfig {
  /** Override default duration (seconds) */
  duration?: number;
  
  /** Override difficulty level */
  difficulty?: ActivityDifficulty;
  
  /** Enable/disable audio guidance */
  audioEnabled?: boolean;
  
  /** Enable/disable haptic feedback (mobile) */
  hapticEnabled?: boolean;
  
  /** Enable/disable visual animations */
  animationsEnabled?: boolean;
  
  /** Custom parameters for specific activities */
  customParams?: Record<string, unknown>;
}

/**
 * User preferences for activity personalization
 */
export interface UserPreferences {
  /** Color theme */
  theme?: 'light' | 'dark' | 'system';
  
  /** Language code (e.g., 'en', 'id') */
  language?: string;
  
  /** Accessibility mode (larger text, higher contrast) */
  accessibilityMode?: boolean;
  
  /** Reduce motion for users with vestibular disorders */
  reducedMotion?: boolean;
  
  /** Enable/disable sound effects */
  soundEnabled?: boolean;
  
  /** Enable/disable vibration feedback (mobile) */
  vibrationEnabled?: boolean;
}

/**
 * Result returned when an activity completes
 */
export interface ActivityResult {
  /** Activity identifier */
  activityId: string;
  
  /** ISO timestamp of completion */
  completedAt: string;
  
  /** Actual duration in seconds */
  duration: number;
  
  /** Whether user completed the full activity */
  completed: boolean;
  
  /** Activity-specific metrics */
  metrics?: ActivityMetrics;
  
  /** Optional user feedback */
  feedback?: ActivityFeedback;
}

/**
 * Activity-specific metrics (varies by activity type)
 */
export interface ActivityMetrics {
  /** Number of breath cycles completed (breathing activities) */
  breathCycles?: number;
  
  /** Average breath duration (breathing activities) */
  avgBreathDuration?: number;
  
  /** Items identified (grounding activities) */
  itemsIdentified?: number;
  
  /** Thoughts reframed (cognitive activities) */
  thoughtsReframed?: number;
  
  /** Generic metrics */
  [key: string]: number | string | boolean | undefined;
}

/**
 * User feedback after completing activity
 */
export interface ActivityFeedback {
  /** Rating 1-5 */
  rating?: number;
  
  /** Free-form notes */
  notes?: string;
  
  /** Would recommend to others */
  wouldRecommend?: boolean;
  
  /** Felt helpful */
  feltHelpful?: boolean;
}

// ============================================================================
// Activity Registry Types
// ============================================================================

/**
 * Difficulty levels for activities
 */
export type ActivityDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Activity categories
 */
export type ActivityCategory = 
  | 'breathing'
  | 'grounding'
  | 'mindfulness'
  | 'cognitive'
  | 'physical'
  | 'social';

/**
 * Tags for activity filtering
 */
export type ActivityTag = 
  | 'anxiety'
  | 'stress'
  | 'depression'
  | 'panic'
  | 'sleep'
  | 'focus'
  | 'relaxation'
  | 'energy'
  | 'calm'
  | 'quick'       // < 5 minutes
  | 'medium'      // 5-15 minutes
  | 'long';       // > 15 minutes

/**
 * Definition of an activity in the registry
 */
export interface ActivityDefinition {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Brief description */
  description: string;
  
  /** Category for grouping */
  category: ActivityCategory;
  
  /** Estimated duration in seconds */
  duration: number;
  
  /** Difficulty level */
  difficulty: ActivityDifficulty;
  
  /** Tags for filtering and recommendation */
  tags: ActivityTag[];
  
  /** React component */
  component: React.ComponentType<ActivityProps>;
  
  /** Emoji or icon identifier */
  icon: string;
  
  /** List of benefits */
  benefits: string[];
  
  /** Detailed instructions (optional) */
  instructions?: string[];
  
  /** Prerequisites (other activity IDs) */
  prerequisites?: string[];
  
  /** Whether activity requires audio */
  requiresAudio?: boolean;
  
  /** Whether activity works offline */
  offlineCapable?: boolean;
  
  /** Minimum recommended age */
  minAge?: number;
  
  /** Scientific references (optional) */
  references?: string[];
}

// ============================================================================
// Activity Player Types
// ============================================================================

/**
 * State of the activity player
 */
export type ActivityPlayerState = 
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';

/**
 * Activity session for tracking
 */
export interface ActivitySession {
  /** Session ID */
  sessionId: string;
  
  /** Activity being performed */
  activityId: string;
  
  /** Start timestamp */
  startedAt: string;
  
  /** End timestamp (if completed) */
  endedAt?: string;
  
  /** Current progress (0-100) */
  progress: number;
  
  /** Current state */
  state: ActivityPlayerState;
  
  /** Result (if completed) */
  result?: ActivityResult;
}

// ============================================================================
// TCA Integration Types
// ============================================================================

/**
 * Activity recommendation from TCA
 */
export interface ActivityRecommendation {
  /** Activity ID */
  activityId: string;
  
  /** Why this activity was recommended */
  reason: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Suggested configuration */
  suggestedConfig?: ActivityConfig;
  
  /** Priority (1 = highest) */
  priority: number;
}

/**
 * Resource card with activity type
 */
export interface ActivityResourceCard {
  type: 'activity';
  activityId: string;
  title: string;
  description: string;
  duration?: number;
  category?: ActivityCategory;
}
