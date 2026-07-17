'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, Trophy, Crown, Star, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RewardBadge - Animated badge/achievement display
 * Features: Rarity levels, glow effects, hover animations
 */

interface RewardBadgeProps {
  title: string;
  description?: string;
  icon?: 'award' | 'trophy' | 'crown' | 'star' | 'gem';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  earned?: boolean;
  earnedDate?: Date;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const iconMap = {
  award: Award,
  trophy: Trophy,
  crown: Crown,
  star: Star,
  gem: Gem,
};

const rarityConfig = {
  common: {
    gradient: 'from-gray-400 to-gray-600',
    glow: 'shadow-gray-400/30',
    border: 'border-gray-400/50',
    text: 'text-gray-300',
  },
  rare: {
    gradient: 'from-aurora-blue to-blue-600',
    glow: 'shadow-aurora-blue/50',
    border: 'border-aurora-blue/70',
    text: 'text-aurora-blue',
  },
  epic: {
    gradient: 'from-aurora-purple to-purple-600',
    glow: 'shadow-aurora-purple/50',
    border: 'border-aurora-purple/70',
    text: 'text-aurora-purple',
  },
  legendary: {
    gradient: 'from-ugm-gold via-yellow-400 to-ugm-gold',
    glow: 'shadow-ugm-gold/60',
    border: 'border-ugm-gold',
    text: 'text-ugm-gold',
  },
};

const sizeConfig = {
  sm: {
    container: 'w-20 h-20',
    icon: 'w-8 h-8',
    text: 'text-xs',
  },
  md: {
    container: 'w-28 h-28',
    icon: 'w-12 h-12',
    text: 'text-sm',
  },
  lg: {
    container: 'w-36 h-36',
    icon: 'w-16 h-16',
    text: 'text-base',
  },
};

export const RewardBadge: React.FC<RewardBadgeProps> = ({
  title,
  description,
  icon = 'award',
  rarity = 'common',
  earned = false,
  earnedDate,
  onClick,
  size = 'md',
  className,
}) => {
  const Icon = iconMap[icon];
  const config = rarityConfig[rarity];
  const sizes = sizeConfig[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, rotate: earned ? 5 : 0 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'relative group cursor-pointer',
        className
      )}
    >
      {/* Badge container */}
      <div
        className={cn(
          'relative rounded-2xl border-2 backdrop-blur-sm flex items-center justify-center',
          'bg-gradient-to-br from-ugm-blue/40 to-ugm-blue-dark/60',
          sizes.container,
          earned ? cn(config.border, config.glow, 'shadow-lg') : 'border-gray-600 opacity-40'
        )}
      >
        {/* Rotating glow for legendary */}
        {earned && rarity === 'legendary' && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-ugm-gold/20 via-transparent to-ugm-gold/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Icon */}
        <div className="relative z-10">
          {earned ? (
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: rarity === 'legendary' ? [0, 5, -5, 0] : 0,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              <Icon
                className={cn(
                  sizes.icon,
                  'bg-gradient-to-br',
                  config.gradient,
                  'bg-clip-text text-transparent'
                )}
                strokeWidth={2}
              />
            </motion.div>
          ) : (
            <Icon className={cn(sizes.icon, 'text-gray-600')} strokeWidth={1.5} />
          )}
        </div>

        {/* Lock overlay */}
        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl">🔒</div>
          </div>
        )}

        {/* Sparkle effects for earned badges */}
        {earned && (
          <>
            <motion.div
              className="absolute top-2 right-2 text-xs"
              animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ✨
            </motion.div>
            <motion.div
              className="absolute bottom-2 left-2 text-xs"
              animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              ✨
            </motion.div>
          </>
        )}
      </div>

      {/* Tooltip on hover */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileHover={{ opacity: 1, y: 0 }}
        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none"
      >
        <div className="bg-ugm-blue-dark/95 backdrop-blur-md rounded-lg p-3 shadow-xl border border-white/20 min-w-[200px]">
          <h4 className={cn('font-bold mb-1', config.text)}>{title}</h4>
          {description && (
            <p className="text-xs text-gray-300 mb-2">{description}</p>
          )}
          <div className="text-xs text-white/60">
            {earned ? (
              earnedDate ? (
                `Earned ${earnedDate.toLocaleDateString()}`
              ) : (
                'Earned ✓'
              )
            ) : (
              'Locked'
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
