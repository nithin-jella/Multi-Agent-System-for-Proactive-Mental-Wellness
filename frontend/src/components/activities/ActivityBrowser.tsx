'use client';

/**
 * Activity Browser Component
 * 
 * A UI component for browsing and selecting activities.
 * Supports filtering by category, tags, and difficulty.
 * 
 * Usage:
 * <ActivityBrowser
 *   onSelect={(activity) => setSelectedActivity(activity.id)}
 *   filterCategory="breathing"
 * />
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { activityRegistry, ActivityMetadata } from './registry';

interface ActivityBrowserProps {
  onSelect: (activity: ActivityMetadata) => void;
  filterCategory?: string;
  filterTags?: string[];
  filterDifficulty?: ActivityMetadata['difficulty'];
  showFilters?: boolean;
  columns?: 1 | 2 | 3;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-green-500/20 text-green-400',
  intermediate: 'bg-yellow-500/20 text-yellow-400',
  advanced: 'bg-red-500/20 text-red-400',
};

const CATEGORY_ICONS: Record<string, string> = {
  breathing: '🌬️',
  grounding: '🌿',
  meditation: '🧘',
  movement: '🏃',
  journaling: '📝',
  cognitive: '🧠',
};

export default function ActivityBrowser({
  onSelect,
  filterCategory,
  filterTags,
  filterDifficulty,
  showFilters = true,
  columns = 2,
}: ActivityBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(filterCategory ?? null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<ActivityMetadata['difficulty'] | null>(filterDifficulty ?? null);
  
  // Get categories for filter
  const categories = useMemo(() => activityRegistry.getCategories(), []);
  
  // Filter activities
  const filteredActivities = useMemo(() => {
    let activities = activityRegistry.getAll();
    
    // Apply category filter
    if (selectedCategory) {
      activities = activities.filter(a => a.category === selectedCategory);
    }
    
    // Apply difficulty filter
    if (selectedDifficulty) {
      activities = activities.filter(a => a.difficulty === selectedDifficulty);
    }
    
    // Apply tag filter
    if (filterTags && filterTags.length > 0) {
      activities = activities.filter(a => 
        a.tags.some((tag: string) => filterTags.includes(tag))
      );
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      activities = activities.filter(a => 
        a.name.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }
    
    return activities;
  }, [selectedCategory, selectedDifficulty, filterTags, searchQuery]);
  
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };
  
  return (
    <div className="w-full">
      {/* Filters */}
      {showFilters && (
        <div className="mb-6 space-y-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                className={`px-3 py-1.5 text-sm rounded-full transition-all flex items-center gap-1.5 ${
                  category === selectedCategory
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <span>{CATEGORY_ICONS[category] ?? '📦'}</span>
                <span className="capitalize">{category}</span>
              </button>
            ))}
          </div>
          
          {/* Difficulty filter */}
          <div className="flex gap-2">
            {(['beginner', 'intermediate', 'advanced'] as const).map(diff => (
              <button
                key={diff}
                onClick={() => setSelectedDifficulty(diff === selectedDifficulty ? null : diff)}
                className={`px-3 py-1.5 text-sm rounded-full transition-all capitalize ${
                  diff === selectedDifficulty
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Activity grid */}
      <div className={`grid ${gridCols[columns]} gap-4`}>
        {filteredActivities.map((activity, index) => (
          <motion.button
            key={activity.id}
            onClick={() => onSelect(activity)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-4 bg-card border border-border rounded-xl text-left hover:border-primary transition-all group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl group-hover:scale-110 transition-transform">
                {activity.icon}
              </div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${DIFFICULTY_COLORS[activity.difficulty]}`}>
                {activity.difficulty}
              </span>
            </div>
            
            {/* Title & description */}
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {activity.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {activity.description}
            </p>
            
            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span>⏱️</span>
                ~{Math.ceil(activity.estimatedDuration / 60)} min
              </span>
              <span className="capitalize flex items-center gap-1">
                <span>{CATEGORY_ICONS[activity.category] ?? '📦'}</span>
                {activity.category}
              </span>
            </div>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {activity.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] bg-muted text-muted-foreground rounded"
                >
                  #{tag}
                </span>
              ))}
              {activity.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{activity.tags.length - 3}
                </span>
              )}
            </div>
          </motion.button>
        ))}
      </div>
      
      {/* Empty state */}
      {filteredActivities.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-muted-foreground">
            No activities found. Try adjusting your filters.
          </p>
        </div>
      )}
    </div>
  );
}
