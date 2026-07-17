'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { 
  Brain, Shield, ListChecks, GitBranch, Search, Sparkles, 
  CheckCircle2, Loader2 
} from 'lucide-react';
import type { ThinkingStep } from '@/types/thinking';

interface AgentThinkingBubbleProps {
  steps: ThinkingStep[];
  activeAgents: string[];
  isActive: boolean;
  elapsedSeconds: number;
  className?: string;
}

const AGENT_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
  STA:  { color: 'text-red-400',    bgColor: 'bg-red-500/20',    borderColor: 'border-red-500/30',    label: 'STA' },
  TCA:  { color: 'text-blue-400',   bgColor: 'bg-blue-500/20',   borderColor: 'border-blue-500/30',   label: 'TCA' },
  CMA:  { color: 'text-amber-400',  bgColor: 'bg-amber-500/20',  borderColor: 'border-amber-500/30',  label: 'CMA' },
  IA:   { color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/30', label: 'IA'  },
  AIKA: { color: 'text-ugm-gold',   bgColor: 'bg-ugm-gold/20',   borderColor: 'border-ugm-gold/30',   label: 'AIKA'},
};

const KIND_ICONS = {
  searching: Search,
  analyzing: Brain,
  routing: GitBranch,
  planning: ListChecks,
  assessing: Shield,
  synthesizing: Sparkles,
};

export function AgentThinkingBubble({ 
  steps, 
  activeAgents, 
  isActive, 
  elapsedSeconds,
  className = '' 
}: AgentThinkingBubbleProps) {
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (stepsContainerRef.current) {
      stepsContainerRef.current.scrollTop = stepsContainerRef.current.scrollHeight;
    }
  }, [steps]);

  // Fallback step if none provided but we are active
  const displaySteps = steps.length > 0 ? steps : [
    {
      id: 'fallback-processing',
      kind: 'analyzing' as const,
      agent: 'AIKA',
      label: 'Processing...',
      timestamp: new Date().toISOString()
    }
  ];

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
      <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl rounded-bl-sm border border-white/10 flex flex-col overflow-hidden min-w-[280px]">
          
          {/* Header Row */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-1.5">
              {activeAgents.length > 0 ? (
                <div className="flex -space-x-1">
                  {activeAgents.map((agent, i) => {
                    const conf = AGENT_CONFIG[agent.toUpperCase()] || AGENT_CONFIG.AIKA;
                    return (
                      <div 
                        key={`${agent}-${i}`}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-black ${conf.bgColor} ${conf.color}`}
                        title={conf.label}
                      >
                        {conf.label.charAt(0)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-black bg-ugm-gold/20 text-ugm-gold">
                  A
                </div>
              )}
              <span className="text-xs text-white/70 font-medium">Agents thinking</span>
            </div>
            <span className="text-xs text-white/50 font-mono">{elapsedSeconds}s</span>
          </div>

          {/* Steps Feed */}
          <div 
            ref={stepsContainerRef}
            className="flex flex-col p-2 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
          >
            <AnimatePresence initial={false}>
              {displaySteps.map((step, index) => {
                const isLast = index === displaySteps.length - 1 && isActive;
                const Icon = KIND_ICONS[step.kind] || Brain;
                const conf = AGENT_CONFIG[step.agent] || AGENT_CONFIG.AIKA;

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    className="flex items-start gap-2.5 py-1.5 px-1 rounded-md"
                  >
                    <div className="shrink-0 mt-0.5">
                      {isLast ? (
                        <Loader2 className={`w-3.5 h-3.5 animate-spin ${conf.color}`} />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3 h-3 ${isLast ? 'text-white/80' : 'text-white/50'}`} />
                          <span className={`text-xs ${isLast ? 'text-white/90 font-medium' : 'text-white/60'}`}>
                            {step.label}
                          </span>
                        </div>
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-sm border ${conf.bgColor} ${conf.borderColor} ${conf.color}`}>
                          {conf.label}
                        </span>
                      </div>
                      
                      {(step.detail || step.resultSummary) && (
                        <div className="flex items-center justify-between gap-2 mt-0.5 pl-4.5">
                          {step.detail && (
                            <span className="text-[10px] text-white/40 italic truncate max-w-[180px]">
                              "{step.detail}"
                            </span>
                          )}
                          {step.resultSummary && (
                            <span className="text-[9px] text-white/50 font-medium whitespace-nowrap ml-auto">
                              {step.resultSummary}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        <div className="text-[10px] text-white/40 ml-1 mt-1">
          {isActive ? 'Sedang mengetik...' : 'Selesai'}
        </div>
      </div>
    </motion.div>
  );
}
