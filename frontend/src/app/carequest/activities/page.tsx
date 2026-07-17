'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Brain, BookOpen, Heart, Dumbbell, Filter } from 'lucide-react';
import { QuestCard } from '@/components/carequest/QuestCard';
import ParticleBackground from '@/components/ui/ParticleBackground';

/**
 * Activities Page - RPG Redesign
 * 
 * Features:
 * - Quest-style activity cards with XP rewards
 * - Category filtering with game-style tabs
 * - Daily streak tracker
 * - Animated hover effects
 */

interface Activity {
  id: string;
  title: string;
  description: string;
  duration: string;
  category: 'mindfulness' | 'cbt' | 'journal' | 'exercise' | 'all';
  rewards: {
    xp: number;
    joy?: number;
    care?: number;
    harmony?: number;
  };
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  icon: string;
  completed?: boolean;
  progress?: number;
}

const categories = [
  { id: 'all' as const, label: 'All Quests', icon: Sparkles, color: '[#FFCA40]' },
  { id: 'mindfulness' as const, label: 'Mindfulness', icon: Heart, color: '[#FF6B9D]' },
  { id: 'cbt' as const, label: 'CBT', icon: Brain, color: '[#B8A4FF]' },
  { id: 'journal' as const, label: 'Journaling', icon: BookOpen, color: '[#50E3C2]' },
  { id: 'exercise' as const, label: 'Exercises', icon: Dumbbell, color: '[#50E3C2]' },
];

export default function ActivitiesPage() {
  const [selectedCategory, setSelectedCategory] = useState<Activity['category']>('all');

  // TODO: Fetch from backend
  const activities: Activity[] = [
    {
      id: '1',
      title: 'Morning Mindfulness Meditation',
      description: 'Complete a 5-minute guided breathing exercise to center yourself and start your day with calm.',
      duration: '5 min',
      category: 'mindfulness',
      rewards: { xp: 50, joy: 10, harmony: 2 },
      difficulty: 'easy',
      icon: '🧘',
      completed: true,
    },
    {
      id: '2',
      title: 'Daily Mood Journal',
      description: 'Record your emotions and reflect on your day. Track patterns in your mental health journey.',
      duration: '10 min',
      category: 'journal',
      rewards: { xp: 75, care: 15, harmony: 3 },
      difficulty: 'easy',
      icon: '📔',
      progress: 65,
    },
    {
      id: '3',
      title: 'CBT Thought Challenge',
      description: 'Practice cognitive restructuring with guided prompts. Challenge negative thought patterns.',
      duration: '15 min',
      category: 'cbt',
      rewards: { xp: 150, joy: 20, care: 10, harmony: 5 },
      difficulty: 'medium',
      icon: '🧠',
      progress: 0,
    },
    {
      id: '4',
      title: 'Box Breathing Exercise',
      description: 'Four-square breathing technique for instant calm. Perfect for managing stress in the moment.',
      duration: '3 min',
      category: 'exercise',
      rewards: { xp: 40, joy: 5, harmony: 1 },
      difficulty: 'easy',
      icon: '💨',
      progress: 0,
    },
    {
      id: '5',
      title: 'Gratitude Practice',
      description: 'Write down three things you are grateful for today. Cultivate positive thinking.',
      duration: '5 min',
      category: 'journal',
      rewards: { xp: 60, joy: 15, care: 5 },
      difficulty: 'easy',
      icon: '🙏',
      completed: true,
    },
    {
      id: '6',
      title: 'Progressive Muscle Relaxation',
      description: 'Systematically tense and relax muscle groups to release physical tension.',
      duration: '12 min',
      category: 'exercise',
      rewards: { xp: 100, joy: 18, harmony: 4 },
      difficulty: 'medium',
      icon: '💪',
      progress: 30,
    },
    {
      id: '7',
      title: 'Cognitive Distortion Slayer',
      description: 'Identify and defeat all 10 cognitive distortions in this advanced CBT challenge.',
      duration: '20 min',
      category: 'cbt',
      rewards: { xp: 250, joy: 30, care: 20, harmony: 10 },
      difficulty: 'hard',
      icon: '⚔️',
      progress: 0,
    },
    {
      id: '8',
      title: 'Master Meditation Marathon',
      description: 'Complete a 30-minute deep meditation session. Only for experienced practitioners.',
      duration: '30 min',
      category: 'mindfulness',
      rewards: { xp: 500, joy: 50, harmony: 15 },
      difficulty: 'legendary',
      icon: '🏆',
      progress: 0,
    },
  ];

  const filteredActivities = selectedCategory === 'all' 
    ? activities 
    : activities.filter(a => a.category === selectedCategory);

  const handleStartActivity = (activityId: string) => {
    console.log(`Starting activity: ${activityId}`);
    // TODO: Launch activity modal or navigate to activity detail
    alert('Activity launching... (Coming soon)');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A] relative">
      {/* Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <ParticleBackground count={50} colors={["#FFCA40", "#B8A4FF", "#50E3C2"]} minSize={2} maxSize={6} speed={0.8} />
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-[#FFCA40]" />
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
              Quest Board
            </h1>
            <Sparkles className="w-12 h-12 text-[#FFCA40]" />
          </div>
          <p className="text-xl text-white/70">
            Complete Therapeutic Quests to Earn XP and Improve Your Wellbeing
          </p>
        </motion.div>

        {/* Daily Streak Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-orange-500/20 to-pink-500/20 backdrop-blur-md rounded-2xl border-2 border-orange-500/30 p-6 mb-8 shadow-2xl shadow-orange-500/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl"
              >
                🔥
              </motion.div>
              <div>
                <div className="text-sm text-orange-300 mb-1">Your Daily Streak</div>
                <div className="text-5xl font-black text-orange-400">7 Days</div>
              </div>
            </div>
            
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">23</div>
                <div className="text-sm text-gray-300">Quests Complete</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-ugm-gold mb-1">1,450</div>
                <div className="text-sm text-gray-300">Total XP Earned</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-6 h-6 text-ugm-gold" />
            <h2 className="text-2xl font-bold text-white">Filter by Category</h2>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = selectedCategory === category.id;
              
              return (
                <motion.button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2
                    ${isActive
                      ? 'bg-gradient-to-r from-ugm-gold to-yellow-500 text-ugm-blue-dark shadow-lg shadow-ugm-gold/50'
                      : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border border-white/20'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {category.label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Activities Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredActivities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
            >
              <QuestCard
                title={activity.title}
                description={activity.description}
                xpReward={activity.rewards.xp}
                progress={activity.progress || 0}
                difficulty={activity.difficulty}
                category={activity.category}
                completed={activity.completed}
                onClick={() => handleStartActivity(activity.id)}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Coming Soon Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-aurora-blue/10 border border-aurora-blue/30 rounded-2xl p-8 text-center backdrop-blur-md"
        >
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-2xl font-bold text-aurora-blue mb-3">
            More Quests Coming Soon
          </h3>
          <p className="text-gray-300 max-w-2xl mx-auto">
            We are developing more interactive mini-games and therapeutic activities. 
            From typing combat to puzzle challenges, your mental health journey is about to get even more engaging!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
