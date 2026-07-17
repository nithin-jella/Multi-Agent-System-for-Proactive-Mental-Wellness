'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, Heart, Users, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AgentStatusUpdate {
  type: 'thinking' | 'status' | 'agent' | 'complete';
  message?: string;
  node?: string;
  agent?: string;
  name?: string;
  description?: string;
}

interface AikaThinkingIndicatorProps {
  status: AgentStatusUpdate | null;
  isActive: boolean;
}

// Agent configuration matching the loading bubble
const AGENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  STA: { icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
  TCA: { icon: Heart, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
  CMA: { icon: Users, color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  IA: { icon: Sparkles, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30' },
  AIKA: { icon: Brain, color: 'text-ugm-gold', bgColor: 'bg-ugm-gold/20', borderColor: 'border-ugm-gold/30' },
};

export function AikaThinkingIndicator({ status, isActive }: AikaThinkingIndicatorProps) {
  if (!isActive || !status) {
    return null;
  }

  const getAgentConfig = () => {
    const agentName = status.agent?.toUpperCase() || 'AIKA';
    return AGENT_CONFIG[agentName] || AGENT_CONFIG.AIKA;
  };

  const config = getAgentConfig();
  const IconComponent = status.type === 'complete' ? CheckCircle2 : config.icon;

  const getMessage = () => {
    if (status.type === 'agent' && status.name) {
      return (
        <div className="flex flex-col">
          <span className="font-medium text-white/90">{status.name}</span>
          {status.description && (
            <span className="text-[11px] text-white/60">{status.description}</span>
          )}
        </div>
      );
    }
    return <span className="text-white/80">{status.message || 'Memproses...'}</span>;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${status.type}-${status.node || status.agent || 'default'}`}
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`inline-flex items-center gap-2.5 rounded-xl border backdrop-blur-sm px-3 py-2 ${
          status.type === 'complete' 
            ? 'bg-green-500/10 border-green-500/30' 
            : `${config.bgColor} ${config.borderColor}`
        }`}
      >
        {/* Icon */}
        <div className={`shrink-0 ${status.type === 'complete' ? 'text-green-400' : config.color}`}>
          {status.type === 'complete' ? (
            <IconComponent className="h-4 w-4" />
          ) : (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <IconComponent className="h-4 w-4" />
            </motion.div>
          )}
        </div>

        {/* Message */}
        <div className="flex-1 text-sm">
          {getMessage()}
        </div>
        
        {/* Animated dots for ongoing processes */}
        {(status.type === 'thinking' || status.type === 'status') && (
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${config.color}`}
                style={{ backgroundColor: 'currentColor' }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact version for message bubble loading state
 */
export function AikaThinkingCompact({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Brain className="h-4 w-4 text-ugm-gold" />
      </motion.div>
      <span className="text-sm text-white/80">
        {message || 'Aika sedang mengetik...'}
      </span>
      <div className="flex items-center gap-0.5 ml-auto">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ugm-gold"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  );
}
