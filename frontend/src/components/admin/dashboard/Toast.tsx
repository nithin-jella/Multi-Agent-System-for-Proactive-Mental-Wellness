'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', isVisible, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const config = {
    success: {
      icon: CheckCircleIcon,
      bg: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
    },
    error: {
      icon: XCircleIcon,
      bg: 'from-red-500/20 to-red-600/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
    },
    info: {
      icon: InformationCircleIcon,
      bg: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
    },
  };

  const { icon: Icon, bg, border, text } = config[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 right-4 z-[100] max-w-md"
        >
          <div className={`bg-gradient-to-r ${bg} backdrop-blur-xl border ${border} rounded-xl shadow-2xl overflow-hidden`}>
            <div className="p-4 flex items-start gap-3">
              <Icon className={`w-5 h-5 ${text} flex-shrink-0 mt-0.5`} />
              <p className="text-sm text-white/90 flex-1">{message}</p>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/80 transition-colors"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
              className={`h-1 bg-gradient-to-r ${type === 'success' ? 'from-green-500 to-emerald-500' : type === 'error' ? 'from-red-500 to-red-600' : 'from-blue-500 to-cyan-500'}`}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
