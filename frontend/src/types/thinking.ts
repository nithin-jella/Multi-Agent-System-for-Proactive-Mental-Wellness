/**
 * Thinking Step Types
 *
 * Types for the Agent Thinking Process UI — the rich step-by-step feed
 * that replaces the generic AikaLoadingBubble during inference.
 */

export type ThinkingStepKind =
  | 'searching'
  | 'analyzing'
  | 'routing'
  | 'planning'
  | 'assessing'
  | 'synthesizing';

export interface ThinkingStep {
  id: string;
  kind: ThinkingStepKind;
  /** Agent code: 'AIKA' | 'STA' | 'TCA' | 'CMA' | 'IA' */
  agent: string;
  /** Short label, e.g. "Analyzed message" */
  label: string;
  /** Italic subtext shown on second line */
  detail?: string;
  /** Right-side result summary e.g. "Risk: LOW" */
  resultSummary?: string;
  /** ISO timestamp when this step was created */
  timestamp: string;
  /** How long this step took in ms (populated after completion) */
  durationMs?: number;
}
