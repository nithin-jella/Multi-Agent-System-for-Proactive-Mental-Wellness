'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * QuestCard - RPG-style card for activities/quests
 * Features: Progress bar, XP display, difficulty badge, hover animations
 */

interface QuestCardProps {
  title: string;
  description: string;
  xpReward: number;
  progress: number; // 0-100
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
  category?: string;
  completed?: boolean;
  locked?: boolean;
  onClick?: () => void;
  className?: string;
}

const difficultyConfig = {
  easy: {
    color: 'text-green-400',
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    glow: 'shadow-green-500/20',
  },
  medium: {
    color: 'text-aurora-blue',
    bg: 'bg-aurora-blue/20',
    border: 'border-aurora-blue/50',
    glow: 'shadow-aurora-blue/20',
  },
  hard: {
    color: 'text-aurora-purple',
    bg: 'bg-aurora-purple/20',
    border: 'border-aurora-purple/50',
    glow: 'shadow-aurora-purple/20',
  },
  legendary: {
    color: 'text-ugm-gold',
    bg: 'bg-ugm-gold/20',
    border: 'border-ugm-gold/50',
    glow: 'shadow-ugm-gold/30',
  },
};

export const QuestCard: React.FC<QuestCardProps> = ({
  title,
  description,
  xpReward,
  progress,
  difficulty,
  category,
  completed = false,
  locked = false,
  onClick,
  className,
}) => {
  const config = difficultyConfig[difficulty];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: locked ? 1 : 1.02, y: locked ? 0 : -4 }}
      whileTap={{ scale: locked ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={locked ? undefined : onClick}
      className={cn(
        'relative overflow-hidden rounded-xl border-2 backdrop-blur-sm',
        'bg-gradient-to-br from-ugm-blue/90 via-ugm-blue/80 to-ugm-blue-dark/90',
        locked
          ? 'border-gray-600 opacity-60 cursor-not-allowed'
          : cn('border-white/30 cursor-pointer', config.glow, 'shadow-lg hover:shadow-xl'),
        completed && 'border-ugm-gold/70',
        className
      )}
    >
      {/* Animated background shimmer */}
      {!locked && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
      )}

      {/* Difficulty badge */}
      <div className="absolute top-3 right-3 z-10">
        <div className={cn('px-3 py-1 rounded-full text-xs font-semibold', config.bg, config.border, 'border')}>
          <span className={config.color}>{difficulty.toUpperCase()}</span>
        </div>
      </div>

      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-sm text-gray-300">Complete previous quests</p>
          </div>
        </div>
      )}

      {/* Completed overlay */}
      {completed && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 left-3 z-10"
        >
          <CheckCircle className="w-8 h-8 text-ugm-gold" strokeWidth={2.5} />
        </motion.div>
      )}

      <div className="relative p-6 space-y-4">
        {/* Category tag */}
        {category && (
          <div className="inline-block px-2 py-1 bg-white/10 rounded text-xs text-ugm-gold font-medium">
            {category}
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl font-bold text-white pr-16">{title}</h3>

        {/* Description */}
        <p className="text-sm text-gray-300 line-clamp-2">{description}</p>

        {/* Progress bar */}
        {!completed && progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-aurora-cyan via-aurora-blue to-aurora-purple"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Footer: XP Reward */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-ugm-gold">
            <Star className="w-5 h-5 fill-current" />
            <span className="font-bold">{xpReward} XP</span>
          </div>
          {!locked && (
            <motion.div
              whileHover={{ x: 4 }}
              className="text-white/70 text-sm font-medium"
            >
              {completed ? 'Completed ✓' : 'Start Quest →'}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
