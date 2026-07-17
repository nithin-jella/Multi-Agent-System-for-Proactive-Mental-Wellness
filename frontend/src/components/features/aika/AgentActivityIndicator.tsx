/**
 * Agent Activity Indicator
 * 
 * Shows real-time agent activity with colored spinners to indicate
 * which agents are currently working on processing the user's message.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface AgentActivityIndicatorProps {
  activeAgents: string[];
  className?: string;
}

// Agent color mapping with distinct colors
const AGENT_COLORS = {
  STA: {
    name: 'Safety Triage',
    color: '#ef4444', // Red - for safety/risk assessment
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
  },
  TCA: {
    name: 'Therapeutic Coach',
    color: '#3b82f6', // Blue - for coaching/support
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-400',
  },
  CMA: {
    name: 'Case Management',
    color: '#f59e0b', // Orange - for case management
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-400',
  },
  IA: {
    name: 'Insights',
    color: '#8b5cf6', // Purple - for analytics
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-400',
  },
  AIKA: {
    name: 'Aika Orchestrator',
    color: '#10b981', // Green - for orchestration
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
    textColor: 'text-green-400',
  },
};

export function AgentActivityIndicator({ activeAgents, className = '' }: AgentActivityIndicatorProps) {
  if (!activeAgents || activeAgents.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-2">
        {activeAgents.map((agent, index) => {
          const agentInfo = AGENT_COLORS[agent as keyof typeof AGENT_COLORS] || AGENT_COLORS.AIKA;
          
          return (
            <motion.div
              key={agent}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${agentInfo.bgColor} border ${agentInfo.borderColor}`}
            >
              <Loader2
                className={`h-4 w-4 animate-spin ${agentInfo.textColor}`}
                style={{ color: agentInfo.color }}
              />
              <span className={`text-xs font-medium ${agentInfo.textColor}`}>
                {agentInfo.name}
              </span>
            </motion.div>
          );
        })}
      </div>
      
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="ml-auto text-xs text-white/60"
      >
        Processing...
      </motion.div>
    </motion.div>
  );
}

/**
 * Compact version for loading bubble
 */
interface CompactAgentActivityProps {
  activeAgents: string[];
}

export function CompactAgentActivity({ activeAgents }: CompactAgentActivityProps) {
  if (!activeAgents || activeAgents.length === 0) {
    // Show generic loading
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
        <span className="text-xs text-white/60">Aika is thinking...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {activeAgents.map((agent, index) => {
        const agentInfo = AGENT_COLORS[agent as keyof typeof AGENT_COLORS] || AGENT_COLORS.AIKA;
        
        return (
          <motion.div
            key={agent}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-1.5"
          >
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              style={{ color: agentInfo.color }}
            />
            <span 
              className="text-xs font-medium"
              style={{ color: agentInfo.color }}
            >
              {agentInfo.name}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
