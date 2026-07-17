'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * ProgressRing - Circular progress indicator with animation
 * Perfect for level progress, completion rates, etc.
 */

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: 'gold' | 'blue' | 'purple' | 'cyan' | 'pink';
  showPercentage?: boolean;
  label?: string;
  animated?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const colorConfig = {
  gold: {
    stroke: '#FFCA40',
    glow: 'drop-shadow(0 0 8px rgba(255, 202, 64, 0.6))',
    text: 'text-ugm-gold',
  },
  blue: {
    stroke: '#75BFFF',
    glow: 'drop-shadow(0 0 8px rgba(117, 191, 255, 0.6))',
    text: 'text-aurora-blue',
  },
  purple: {
    stroke: '#C175FF',
    glow: 'drop-shadow(0 0 8px rgba(193, 117, 255, 0.6))',
    text: 'text-aurora-purple',
  },
  cyan: {
    stroke: '#75FFEE',
    glow: 'drop-shadow(0 0 8px rgba(117, 255, 238, 0.6))',
    text: 'text-aurora-cyan',
  },
  pink: {
    stroke: '#FF75D1',
    glow: 'drop-shadow(0 0 8px rgba(255, 117, 209, 0.6))',
    text: 'text-aurora-pink',
  },
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = 'gold',
  showPercentage = true,
  label,
  animated = true,
  className,
  children,
}) => {
  const config = colorConfig[color];
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={config.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: animated ? offset : circumference }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />

        {/* Animated gradient overlay for legendary effect */}
        {color === 'gold' && progress > 90 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#goldGradient)"
            strokeWidth={strokeWidth / 2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            opacity={0.5}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#FFCA40" />
            <stop offset="100%" stopColor="#FFA500" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ? (
          children
        ) : (
          <>
            {showPercentage && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className={cn('text-2xl font-bold', config.text)}
              >
                {Math.round(progress)}%
              </motion.div>
            )}
            {label && (
              <div className="text-xs text-gray-400 mt-1">{label}</div>
            )}
          </>
        )}
      </div>

      {/* Pulse effect when near completion */}
      {progress > 95 && (
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: config.stroke }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  );
};
