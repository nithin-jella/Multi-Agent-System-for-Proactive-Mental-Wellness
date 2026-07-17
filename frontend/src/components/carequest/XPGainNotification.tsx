'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * XPGainNotification - Floating notification for XP gains
 * Auto-dismisses after duration, stacks multiple notifications
 */

interface XPNotification {
  id: string;
  amount: number;
  message: string;
  timestamp: number;
}

interface XPGainNotificationProps {
  notifications: XPNotification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-center' | 'bottom-right';
  className?: string;
}

const positionConfig = {
  'top-right': 'top-20 right-4',
  'top-center': 'top-20 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

export const XPGainNotification: React.FC<XPGainNotificationProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  className,
}) => {
  // Auto-dismiss after 3 seconds
  React.useEffect(() => {
    notifications.forEach((notification) => {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, 3000);
      return () => clearTimeout(timer);
    });
  }, [notifications, onDismiss]);

  return (
    <div className={cn('fixed z-50 space-y-2', positionConfig[position], className)}>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
              delay: index * 0.1,
            }}
            layout
            className="relative"
          >
            {/* Notification card */}
            <div className="relative overflow-hidden rounded-xl border-2 border-ugm-gold/70 bg-gradient-to-br from-ugm-blue/95 to-ugm-blue-dark/95 backdrop-blur-md shadow-xl shadow-ugm-gold/30 min-w-[280px]">
              {/* Animated background shine */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-ugm-gold/10 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              />

              <div className="relative p-4 flex items-center gap-3">
                {/* XP Icon with pulse */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 0.6 }}
                  className="flex-shrink-0"
                >
                  <div className="relative">
                    <Star className="w-8 h-8 text-ugm-gold fill-current" />
                    {/* Glow effect */}
                    <motion.div
                      className="absolute inset-0 blur-lg bg-ugm-gold/50"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </div>
                </motion.div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-ugm-gold">
                      +{notification.amount}
                    </span>
                    <span className="text-sm font-semibold text-ugm-gold/80">XP</span>
                    <TrendingUp className="w-4 h-4 text-ugm-gold" />
                  </div>
                  <p className="text-sm text-gray-300">{notification.message}</p>
                </div>

                {/* Close button */}
                <button
                  onClick={() => onDismiss(notification.id)}
                  className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>

              {/* Progress bar for auto-dismiss */}
              <motion.div
                className="h-1 bg-ugm-gold/80"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            </div>

            {/* Floating particles */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-1 h-1 bg-ugm-gold rounded-full"
                initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                animate={{
                  opacity: 0,
                  scale: 0,
                  x: (Math.random() - 0.5) * 100,
                  y: -50 - Math.random() * 50,
                }}
                transition={{ duration: 1, delay: i * 0.1 }}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Hook to manage XP notifications
 */
export const useXPNotifications = () => {
  const [notifications, setNotifications] = React.useState<XPNotification[]>([]);

  const addNotification = React.useCallback((amount: number, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [
      ...prev,
      { id, amount, message, timestamp: Date.now() },
    ]);
  }, []);

  const dismissNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, addNotification, dismissNotification };
};
