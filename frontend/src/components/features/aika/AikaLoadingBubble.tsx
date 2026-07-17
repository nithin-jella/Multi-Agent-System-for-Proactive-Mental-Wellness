/**
 * Aika Loading Message Bubble
 * 
 * Displays a loading state with agent activity indicators
 * showing which agents are currently processing the request.
 * Designed to match the glassmorphic chat UI design.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Brain, Shield, Heart, Users, Sparkles } from 'lucide-react';

interface AikaLoadingBubbleProps {
  activeAgents?: string[];
  currentThinking?: string | null;
  className?: string;
}

// Agent configuration with icons and colors
const AGENT_CONFIG = {
  STA: { 
    name: 'Safety Triage', 
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    action: 'Menilai keamanan...' 
  },
  TCA: { 
    name: 'Therapeutic Coach', 
    icon: Heart,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    action: 'Menyiapkan dukungan...' 
  },
  CMA: { 
    name: 'Case Management', 
    icon: Users,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    action: 'Memeriksa riwayat...' 
  },
  IA: { 
    name: 'Insights Agent', 
    icon: Sparkles,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    action: 'Menganalisis pola...' 
  },
  AIKA: { 
    name: 'Aika', 
    icon: Brain,
    color: 'text-ugm-gold',
    bgColor: 'bg-ugm-gold/20',
    borderColor: 'border-ugm-gold/30',
    action: 'Memproses...' 
  },
};

const DEFAULT_ACTIVITIES = [
  "Sedang berpikir...",
  "Menganalisis pesanmu...",
  "Mencari informasi relevan...",
  "Menyusun jawaban...",
];

export function AikaLoadingBubble({ activeAgents = [], currentThinking = null, className = '' }: AikaLoadingBubbleProps) {
  const [currentActivity, setCurrentActivity] = useState(DEFAULT_ACTIVITIES[0]);
  const [activityIndex, setActivityIndex] = useState(0);

  // Get current agent info
  const currentAgentCode = activeAgents.length > 0 
    ? activeAgents[activeAgents.length - 1] as keyof typeof AGENT_CONFIG
    : null;
  const currentAgent = currentAgentCode ? AGENT_CONFIG[currentAgentCode] : null;

  // Cycle through activities when no explicit thinking trace is available
  useEffect(() => {
    if (currentThinking && currentThinking.trim().length > 0) {
      setCurrentActivity(currentThinking.trim());
      return;
    }

    if (currentAgent) {
      setCurrentActivity(currentAgent.action);
      return;
    }

    const interval = setInterval(() => {
      setActivityIndex((prev) => {
        const next = (prev + 1) % DEFAULT_ACTIVITIES.length;
        setCurrentActivity(DEFAULT_ACTIVITIES[next]);
        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [currentAgent, currentThinking]);

  const AgentIcon = currentAgent?.icon || Brain;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-start gap-2 ${className}`}
    >
      {/* Aika Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden shadow-sm border border-white/20 bg-black/20 backdrop-blur-sm">
        <Image
          src="/aika-human.jpeg"
          alt="Aika"
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>

      {/* Message Bubble - Glass style */}
      <div className="flex flex-col items-start">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-bl-sm border border-white/10 px-3 py-2 flex items-center gap-3 min-w-45">
          
          {/* Agent Icon with pulse */}
          <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${currentAgent?.bgColor || 'bg-ugm-gold/20'} ${currentAgent?.borderColor || 'border-ugm-gold/30'} border`}>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <AgentIcon className={`w-3.5 h-3.5 ${currentAgent?.color || 'text-ugm-gold'}`} />
            </motion.div>
          </div>

          {/* Activity Text */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentActivity}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-white/80"
              >
                {currentActivity}
              </motion.div>
            </AnimatePresence>
            
            {/* Active Agent Badge */}
            {currentAgent && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-white/50"
              >
                {currentAgent.name}
              </motion.span>
            )}
          </div>

          {/* Animated dots */}
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${currentAgent?.color || 'bg-white/60'}`}
                style={{ backgroundColor: currentAgent ? undefined : 'rgba(255,255,255,0.6)' }}
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>

        {/* Timestamp placeholder */}
        <div className="text-[10px] text-white/40 ml-1 mt-0.5">
          Sedang mengetik...
        </div>
      </div>
    </motion.div>
  );
}
