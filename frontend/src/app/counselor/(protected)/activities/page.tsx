'use client';

/**
 * Counselor Activities Page
 * 
 * Allows counselors to:
 * - View all available therapeutic activities
 * - Preview activities to understand what patients can use
 * - See activity metadata and recommendations
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiActivity, 
  FiPlay, 
  FiClock, 
  FiTag, 
  FiEye,
  FiX,
  FiHeart,
  FiWind,
  FiTarget,
  FiInfo,
} from 'react-icons/fi';

// Activity data - mirrors backend catalog
const ACTIVITIES_CATALOG = [
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    description: 'Teknik pernapasan 4-4-4-4 yang dipakai Navy SEALs untuk menenangkan pikiran dan mengurangi stres.',
    category: 'breathing',
    estimated_duration: 240,
    difficulty: 'beginner',
    tags: ['anxiety', 'stress', 'focus', 'calming', 'panic'],
    icon: '🔲',
    clinicalNotes: 'Evidence-based technique for activating the parasympathetic nervous system. Recommended for patients experiencing acute anxiety or panic symptoms.',
    recommendedFor: ['Generalized Anxiety', 'Panic Disorder', 'Acute Stress', 'Pre-presentation nerves'],
  },
  {
    id: 'four-seven-eight',
    name: '4-7-8 Breathing',
    description: 'Teknik napas relaksasi dari Dr. Andrew Weil untuk tidur lebih nyenyak dan mengurangi kecemasan.',
    category: 'breathing',
    estimated_duration: 300,
    difficulty: 'beginner',
    tags: ['sleep', 'relaxation', 'anxiety', 'calming', 'insomnia'],
    icon: '💜',
    clinicalNotes: 'Developed by Dr. Andrew Weil based on pranayama yoga. The extended exhale activates vagal tone. Particularly effective for sleep onset insomnia.',
    recommendedFor: ['Insomnia', 'Sleep Anxiety', 'Bedtime Relaxation', 'General Stress'],
  },
  {
    id: 'five-four-three-two-one',
    name: '5-4-3-2-1 Grounding',
    description: 'Teknik grounding sensorik yang menggunakan 5 indera untuk membawa kamu kembali ke saat ini.',
    category: 'grounding',
    estimated_duration: 180,
    difficulty: 'beginner',
    tags: ['anxiety', 'panic', 'dissociation', 'grounding', 'present-moment'],
    icon: '🌿',
    clinicalNotes: 'Sensory-based grounding technique effective for dissociation and panic. Engages external focus to interrupt anxious rumination. Part of DBT distress tolerance skills.',
    recommendedFor: ['Panic Attacks', 'Dissociative Episodes', 'PTSD Flashbacks', 'Overwhelming Emotions'],
  },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  breathing: { 
    label: 'Breathing', 
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/20 border-blue-500/30',
    icon: <FiWind className="w-4 h-4" />
  },
  grounding: { 
    label: 'Grounding', 
    color: 'text-green-300',
    bgColor: 'bg-green-500/20 border-green-500/30',
    icon: <FiTarget className="w-4 h-4" />
  },
  mindfulness: { 
    label: 'Mindfulness', 
    color: 'text-purple-300',
    bgColor: 'bg-purple-500/20 border-purple-500/30',
    icon: <FiHeart className="w-4 h-4" />
  },
};

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: 'bg-emerald-500/20 text-emerald-300' },
  intermediate: { label: 'Intermediate', color: 'bg-amber-500/20 text-amber-300' },
  advanced: { label: 'Advanced', color: 'bg-red-500/20 text-red-300' },
};

export default function CounselorActivitiesPage() {
  const [previewActivity, setPreviewActivity] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  const filteredActivities = filterCategory === 'all' 
    ? ACTIVITIES_CATALOG 
    : ACTIVITIES_CATALOG.filter(a => a.category === filterCategory);

  const categories = ['all', ...new Set(ACTIVITIES_CATALOG.map(a => a.category))];

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center">
            <FiActivity className="mr-3 text-[#FFCA40]" />
            Therapeutic Activities Library
          </h1>
          <p className="text-gray-400 mt-1">
            Review activities available to patients. Click to see clinical notes.
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-[#FFCA40]">{ACTIVITIES_CATALOG.length}</div>
            <div className="text-xs text-gray-400">Activities</div>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {ACTIVITIES_CATALOG.filter(a => a.difficulty === 'beginner').length}
            </div>
            <div className="text-xs text-gray-400">Beginner-friendly</div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <FiInfo className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-200">
            <strong>Clinical Note:</strong> These activities are automatically recommended by the TCA (Therapeutic Coach Agent) 
            based on patient risk assessments and conversation context. You can preview each activity to understand what patients experience.
          </p>
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
                ? 'bg-[#FFCA40] text-[#001D58]'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat === 'all' ? 'All Activities' : CATEGORY_CONFIG[cat]?.label || cat}
          </button>
        ))}
      </div>

      {/* Activities List */}
      <div className="space-y-4">
        {filteredActivities.map((activity, index) => {
          const categoryConfig = CATEGORY_CONFIG[activity.category] || { 
            label: activity.category, 
            color: 'text-gray-300',
            bgColor: 'bg-gray-500/20 border-gray-500/30',
            icon: <FiActivity className="w-4 h-4" />
          };
          const difficultyConfig = DIFFICULTY_CONFIG[activity.difficulty] || {
            label: activity.difficulty,
            color: 'bg-gray-500/20 text-gray-300'
          };
          const isExpanded = expandedActivity === activity.id;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-[#FFCA40]/30 transition-all"
            >
              {/* Main Row */}
              <div 
                className="p-5 cursor-pointer"
                onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-4xl flex-shrink-0">{activity.icon}</div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">
                        {activity.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${categoryConfig.bgColor} ${categoryConfig.color}`}>
                        {categoryConfig.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${difficultyConfig.color}`}>
                        {difficultyConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      {activity.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FiClock className="w-3.5 h-3.5" />
                        {formatDuration(activity.estimated_duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiTag className="w-3.5 h-3.5" />
                        {activity.tags.length} tags
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewActivity(activity.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FFCA40] hover:bg-[#FFD770] text-[#001D58] font-semibold rounded-lg transition-colors"
                    >
                      <FiPlay className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Clinical Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10"
                  >
                    <div className="p-5 bg-white/[0.02] grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Clinical Notes */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#FFCA40] mb-2 flex items-center gap-2">
                          <FiInfo className="w-4 h-4" />
                          Clinical Notes
                        </h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {activity.clinicalNotes}
                        </p>
                      </div>
                      
                      {/* Recommended For */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#FFCA40] mb-2 flex items-center gap-2">
                          <FiHeart className="w-4 h-4" />
                          Recommended For
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {activity.recommendedFor.map(condition => (
                            <span 
                              key={condition}
                              className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30"
                            >
                              {condition}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Tags */}
                      <div className="lg:col-span-2">
                        <h4 className="text-sm font-semibold text-gray-400 mb-2">Tags (for TCA recommendation)</h4>
                        <div className="flex flex-wrap gap-1">
                          {activity.tags.map(tag => (
                            <span 
                              key={tag}
                              className="px-2 py-0.5 bg-white/5 text-gray-400 text-xs rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredActivities.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-400">No activities found in this category.</p>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewActivity(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#001D58] border border-white/20 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Activity Preview (As Patient Sees It)</h2>
                <button
                  onClick={() => setPreviewActivity(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              {/* Modal Content - Embed the activity */}
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                <iframe
                  src={`/activities?play=${previewActivity}`}
                  className="w-full h-[600px] rounded-xl border border-white/10"
                  title="Activity Preview"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
