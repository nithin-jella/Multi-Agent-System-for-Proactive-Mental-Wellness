'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { Heart, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StatBar - Animated stat display with icon and progress bar
 * Used for JOY, CARE, Harmony in CareQuest
 */

interface StatBarProps {
  label: string;
  value: number;
  maxValue: number;
  icon: 'joy' | 'care' | 'harmony';
  color: 'pink' | 'blue' | 'purple' | 'cyan';
  showPercentage?: boolean;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const iconMap = {
  joy: Sparkles,
  care: Heart,
  harmony: Shield,
};

const colorConfig = {
  pink: {
    gradient: 'from-aurora-pink to-pink-400',
    glow: 'shadow-aurora-pink/50',
    text: 'text-aurora-pink',
  },
  blue: {
    gradient: 'from-aurora-blue to-blue-400',
    glow: 'shadow-aurora-blue/50',
    text: 'text-aurora-blue',
  },
  purple: {
    gradient: 'from-aurora-purple to-purple-400',
    glow: 'shadow-aurora-purple/50',
    text: 'text-aurora-purple',
  },
  cyan: {
    gradient: 'from-aurora-cyan to-cyan-400',
    glow: 'shadow-aurora-cyan/50',
    text: 'text-aurora-cyan',
  },
};

const sizeConfig = {
  sm: {
    container: 'p-3',
    icon: 'w-5 h-5',
    text: 'text-sm',
    bar: 'h-1.5',
  },
  md: {
    container: 'p-4',
    icon: 'w-6 h-6',
    text: 'text-base',
    bar: 'h-2',
  },
  lg: {
    container: 'p-5',
    icon: 'w-8 h-8',
    text: 'text-lg',
    bar: 'h-3',
  },
};

export const StatBar: React.FC<StatBarProps> = ({
  label,
  value,
  maxValue,
  icon,
  color,
  showPercentage = true,
  animated = true,
  size = 'md',
  className,
}) => {
  const Icon = iconMap[icon];
  const colors = colorConfig[color];
  const sizes = sizeConfig[size];

  const percentage = (value / maxValue) * 100;

  // Spring animation for smooth value changes
  const springValue = useSpring(0, { stiffness: 100, damping: 30 });
  const displayValue = useTransform(springValue, (v) => Math.round(v));

  React.useEffect(() => {
    if (animated) {
      springValue.set(value);
    }
  }, [value, springValue, animated]);

  return (
    <div
      className={cn(
        'rounded-xl border border-white/20 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm',
        sizes.container,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg bg-white/10', colors.text)}>
            <Icon className={cn(sizes.icon, 'fill-current')} />
          </div>
          <span className={cn('font-bold text-white', sizes.text)}>{label}</span>
        </div>
        <div className={cn('font-bold', colors.text, sizes.text)}>
          {animated ? (
            <motion.span>{displayValue}</motion.span>
          ) : (
            <span>{value}</span>
          )}
          <span className="text-white/50">/{maxValue}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            className={cn(
              'h-full bg-gradient-to-r rounded-full',
              colors.gradient,
              colors.glow,
              'shadow-lg'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.div>
        </div>
        {showPercentage && (
          <div className="text-right text-xs text-white/60">
            {Math.round(percentage)}%
          </div>
        )}
      </div>
    </div>
  );
};
