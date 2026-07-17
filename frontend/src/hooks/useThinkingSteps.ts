/**
 * useThinkingSteps Hook
 *
 * Adapts raw SSE reasoning trace events and active agent lists into the
 * structured ThinkingStep[] format consumed by AgentThinkingBubble.
 * Also tracks elapsed seconds since the thinking started.
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ReasoningTrace } from '@/hooks/useAika';
import type { ThinkingStep, ThinkingStepKind } from '@/types/thinking';

/** Maps a reasoning stage string to a ThinkingStepKind. */
function stageToKind(stage: string): ThinkingStepKind {
  const lower = stage.toLowerCase();
  if (lower.includes('assess') || lower.includes('risk') || lower.includes('safety')) return 'assessing';
  if (lower.includes('plan') || lower.includes('support') || lower.includes('coach')) return 'planning';
  if (lower.includes('route') || lower.includes('routing') || lower.includes('intent') || lower.includes('decision')) return 'routing';
  if (lower.includes('synth') || lower.includes('response') || lower.includes('final')) return 'synthesizing';
  if (lower.includes('search') || lower.includes('retriev')) return 'searching';
  return 'analyzing';
}

/** Maps a backend node name to an agent code. */
function nodeToAgent(sourceNode: string): string {
  const lower = sourceNode.toLowerCase();
  if (lower.includes('sta')) return 'STA';
  if (lower.includes('tca') || lower.includes('sca')) return 'TCA';
  if (lower.includes('cma') || lower.includes('sda')) return 'CMA';
  if (lower.includes('ia')) return 'IA';
  return 'AIKA';
}

/** Maps a reasoning stage to a human-readable label. */
function stageToLabel(stage: string): string {
  const lower = stage.toLowerCase();
  if (lower.includes('intent') || lower.includes('decision') || lower.includes('route')) return 'Analyzing intent';
  if (lower.includes('assess') || lower.includes('safety')) return 'Assessing safety';
  if (lower.includes('plan') || lower.includes('support') || lower.includes('coach')) return 'Building support plan';
  if (lower.includes('synth') || lower.includes('response')) return 'Composing response';
  if (lower.includes('search')) return 'Searching knowledge';
  return 'Processing';
}

interface UseThinkingStepsOptions {
  thinkingTrace: ReasoningTrace[];
  activeAgents: string[];
  isActive: boolean;
}

interface UseThinkingStepsResult {
  steps: ThinkingStep[];
  elapsedSeconds: number;
}

export function useThinkingSteps({
  thinkingTrace,
  activeAgents,
  isActive,
}: UseThinkingStepsOptions): UseThinkingStepsResult {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Track elapsed time while active
  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);

      const id = window.setInterval(() => {
        if (startTimeRef.current !== null) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);

      return () => {
        window.clearInterval(id);
      };
    } else {
      startTimeRef.current = null;
    }
  }, [isActive]);

  // Convert thinkingTrace + activeAgents into ThinkingStep[]
  const steps = useMemo<ThinkingStep[]>(() => {
    const result: ThinkingStep[] = [];

    // Convert reasoning trace entries to steps
    for (const trace of thinkingTrace) {
      result.push({
        id: trace.id,
        kind: stageToKind(trace.stage),
        agent: nodeToAgent(trace.sourceNode),
        label: stageToLabel(trace.stage),
        detail: trace.summary,
        resultSummary: trace.riskLevel ? `Risk: ${trace.riskLevel.toUpperCase()}` : undefined,
        timestamp: trace.timestamp,
      });
    }

    // If there are active agents not yet represented in the trace, add a placeholder step
    const representedAgents = new Set(result.map((s) => s.agent));
    for (const agentCode of activeAgents) {
      const code = agentCode.toUpperCase();
      if (!representedAgents.has(code)) {
        result.push({
          id: `agent-${code}-${uuidv4()}`,
          kind: code === 'STA' ? 'assessing' : code === 'TCA' ? 'planning' : 'analyzing',
          agent: code,
          label: `${code} processing`,
          timestamp: new Date().toISOString(),
        });
        representedAgents.add(code);
      }
    }

    return result;
  }, [thinkingTrace, activeAgents]);

  return { steps, elapsedSeconds };
}
