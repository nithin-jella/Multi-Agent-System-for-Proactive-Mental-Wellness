/**
 * Activity Registry
 * 
 * Central registry for all therapeutic activities.
 * This module provides discovery, filtering, and loading of activities.
 * 
 * To add a new activity category:
 * 1. Create the category folder with components
 * 2. Create an index.ts with activity metadata
 * 3. Import and register the activities here
 */

import { ActivityMetadata } from './types';
import { breathingActivities } from './breathing';
import { groundingActivities } from './grounding';
import { mindfulnessActivities } from './mindfulness';

// Combine all activities from different categories
const allActivities: ActivityMetadata[] = [
  ...breathingActivities,
  ...groundingActivities,
  ...mindfulnessActivities,
];

/**
 * Activity Registry class providing discovery and filtering capabilities
 */
class ActivityRegistry {
  private activities: Map<string, ActivityMetadata>;
  
  constructor() {
    this.activities = new Map();
    this.registerAll(allActivities);
  }
  
  /**
   * Register multiple activities at once
   */
  private registerAll(activities: ActivityMetadata[]): void {
    activities.forEach(activity => {
      this.activities.set(activity.id, activity);
    });
  }
  
  /**
   * Register a single activity (useful for dynamic registration)
   */
  register(activity: ActivityMetadata): void {
    this.activities.set(activity.id, activity);
  }
  
  /**
   * Get an activity by ID
   */
  get(id: string): ActivityMetadata | undefined {
    return this.activities.get(id);
  }
  
  /**
   * Get all registered activities
   */
  getAll(): ActivityMetadata[] {
    return Array.from(this.activities.values());
  }
  
  /**
   * Filter activities by category
   */
  getByCategory(category: string): ActivityMetadata[] {
    return this.getAll().filter(a => a.category === category);
  }
  
  /**
   * Filter activities by tags (returns activities matching ANY tag)
   */
  getByTags(tags: string[]): ActivityMetadata[] {
    return this.getAll().filter(a => 
      a.tags.some((tag: string) => tags.includes(tag))
    );
  }
  
  /**
   * Filter activities by difficulty level
   */
  getByDifficulty(difficulty: ActivityMetadata['difficulty']): ActivityMetadata[] {
    return this.getAll().filter(a => a.difficulty === difficulty);
  }
  
  /**
   * Filter activities by maximum duration (in seconds)
   */
  getByMaxDuration(maxSeconds: number): ActivityMetadata[] {
    return this.getAll().filter(a => a.estimatedDuration <= maxSeconds);
  }
  
  /**
   * Search activities by name or description
   */
  search(query: string): ActivityMetadata[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getAll().filter(a => 
      a.name.toLowerCase().includes(lowercaseQuery) ||
      a.description.toLowerCase().includes(lowercaseQuery) ||
      a.tags.some((tag: string) => tag.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  /**
   * Get activity recommendations based on mood/symptoms
   */
  getRecommendations(symptoms: string[]): ActivityMetadata[] {
    // Map symptoms to relevant tags
    const tagMap: Record<string, string[]> = {
      'anxiety': ['anxiety', 'calming', 'grounding'],
      'stress': ['stress-relief', 'calming', 'relaxation'],
      'panic': ['panic', 'grounding', 'breathing'],
      'insomnia': ['sleep', 'relaxation', 'calming'],
      'overwhelmed': ['grounding', 'present-moment', 'calming'],
      'unfocused': ['focus', 'mindfulness', 'present-moment'],
      'sad': ['mood-boost', 'gratitude', 'mindfulness'],
    };
    
    const relevantTags = symptoms
      .flatMap(symptom => tagMap[symptom.toLowerCase()] || [])
      .filter((tag, i, arr) => arr.indexOf(tag) === i); // unique
    
    if (relevantTags.length === 0) {
      // Return beginner-friendly activities as default
      return this.getByDifficulty('beginner').slice(0, 3);
    }
    
    // Score activities by how many tags they match
    const scored = this.getAll().map(activity => ({
      activity,
      score: activity.tags.filter((tag: string) => relevantTags.includes(tag)).length,
    }));
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.activity);
  }
  
  /**
   * Get unique categories
   */
  getCategories(): string[] {
    const categories = new Set(this.getAll().map(a => a.category));
    return Array.from(categories);
  }
  
  /**
   * Get unique tags
   */
  getAllTags(): string[] {
    const tags = new Set(this.getAll().flatMap(a => a.tags));
    return Array.from(tags).sort();
  }
}

// Export singleton instance
export const activityRegistry = new ActivityRegistry();

// Export types for convenience
export type { ActivityMetadata };
