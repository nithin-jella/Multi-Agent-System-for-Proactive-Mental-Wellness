'use client';

/**
 * Admin Activities Management Page
 * 
 * Allows administrators to:
 * - View all available therapeutic activities
 * - Preview activities (try them out)
 * - See activity metadata and statistics
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiActivity, 
  FiPlay, 
  FiClock, 
  FiEye,
  FiX,
  FiHeart,
  FiWind,
  FiTarget,
} from 'react-icons/fi';
import { activityRegistry, ActivityPlayer, type ActivityMetadata } from '@/components/activities';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
  breathing: { 
    label: 'Breathing', 
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: <FiWind className="w-4 h-4" />
  },
  grounding: { 
    label: 'Grounding', 
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: <FiTarget className="w-4 h-4" />
  },
  mindfulness: { 
    label: 'Mindfulness', 
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: <FiHeart className="w-4 h-4" />
  },
};

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: 'bg-emerald-500/20 text-emerald-300' },
  intermediate: { label: 'Intermediate', color: 'bg-amber-500/20 text-amber-300' },
  advanced: { label: 'Advanced', color: 'bg-red-500/20 text-red-300' },
};

export default function AdminActivitiesPage() {
  const [previewActivity, setPreviewActivity] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');

  const allActivities = activityRegistry.getAll();
  const filteredActivities = filterCategory === 'all' 
    ? allActivities 
    : allActivities.filter(a => a.category === filterCategory);

  const categories = ['all', ...Array.from(new Set(allActivities.map(a => a.category)))];

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center">
            <FiActivity className="mr-3 text-[#FFCA40]" />
            Therapeutic Activities
          </h1>
          <p className="text-gray-400 mt-1">
            View and preview interactive activities available to users
          </p>
        </div>
        
        {/* Stats */}
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-center shadow-lg">
            <div className="text-2xl font-bold text-[#FFCA40]">{allActivities.length}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-center shadow-lg">
            <div className="text-2xl font-bold text-blue-400">{categories.length - 1}</div>
            <div className="text-xs text-gray-400">Categories</div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filterCategory === cat
                ? 'bg-[#FFCA40] text-[#001D58] shadow-md'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat === 'all' ? 'All Activities' : (CATEGORY_CONFIG[cat]?.label || cat)}
          </button>
        ))}
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredActivities.map((activity, index) => {
          const categoryConfig = CATEGORY_CONFIG[activity.category] || {
            label: activity.category, 
            color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
            icon: <FiActivity className="w-4 h-4" />
          };
          const difficultyConfig = DIFFICULTY_CONFIG[activity.difficulty] || {
            label: activity.difficulty,
            color: 'bg-gray-500/20 text-gray-300'
          };

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-[#FFCA40]/40 transition-all group shadow-xl flex flex-col h-full"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl shadow-inner border border-white/10 group-hover:scale-110 transition-transform">
                  {activity.icon}
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-md text-[11px] uppercase tracking-wider font-bold border ${categoryConfig.color}`}>
                    {categoryConfig.label}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#FFCA40] transition-colors">
                {activity.name}
              </h3>
              <p className="text-sm text-gray-400 mb-5 line-clamp-3 flex-1 grow">
                {activity.description}
              </p>

              {/* Metadata */}
              <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl mb-4 border border-white/5">
                <span className="flex items-center gap-1.5 text-xs text-white/70 font-medium">
                  <FiClock className="w-4 h-4 text-[#FFCA40]" />
                  {formatDuration(activity.estimatedDuration)}
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${difficultyConfig.color}`}>
                  {difficultyConfig.label}
                </span>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-5 h-12 overflow-hidden">
                {activity.tags.slice(0, 4).map(tag => (
                  <span 
                    key={tag}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 text-[10px] uppercase font-semibold tracking-wide rounded-md border border-white/10 cursor-default transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
                {activity.tags.length > 4 && (
                  <span className="px-2 py-1 text-[10px] text-gray-500 font-semibold bg-transparent">+{activity.tags.length - 4} more</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-auto">
                <button
                  onClick={() => setPreviewActivity(activity.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-[#FFCA40] hover:text-[#001D58] text-white font-semibold rounded-xl transition-all shadow-md group-hover:shadow-[0_0_15px_rgba(255,202,64,0.3)]"
                >
                  <FiPlay className="w-4 h-4" />
                  Live Preview
                </button>
                <button
                  onClick={() => window.open(`/activities?play=${activity.id}`, '_blank')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white rounded-xl transition-all border border-white/10"
                  title="Open in new tab"
                >
                  <FiEye className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredActivities.length === 0 && (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <div className="text-6xl mb-4 opacity-50">#</div>
          <h3 className="text-xl font-bold text-white mb-2">No Activities Found</h3>
          <p className="text-gray-400">Try selecting a different category.</p>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#00081c]/90 backdrop-blur-md z-100 flex items-center justify-center p-4 sm:p-6"
            onClick={() => setPreviewActivity(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#001030] overflow-hidden rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-black border border-white/20 relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFCA40]/20 flex items-center justify-center border border-[#FFCA40]/30 text-[#FFCA40]">
                    <FiActivity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-none">Live Component Preview</h2>
                    <p className="text-xs text-white/50 mt-1">Native playback decoupled from main layout</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewActivity(null)}
                  className="p-2 bg-white/5 hover:bg-white/20 rounded-xl transition-colors text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-linear-to-b from-transparent to-black/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="min-h-125 flex flex-col relative z-10 w-full h-full max-h-[70vh]">
                  <ActivityPlayer 
                    activityId={previewActivity} 
                    onExit={() => setPreviewActivity(null)}
                    showHeader={false}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
