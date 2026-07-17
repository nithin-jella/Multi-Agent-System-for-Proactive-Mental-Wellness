// src/types/chat.ts
export interface PlanStep {
  id: string;
  label: string;
  duration_min?: number;
}

export interface ResourceCard {
  resource_id: string;
  title: string;
  summary: string;
  url?: string;
  resource_type?: 'link' | 'activity' | 'video' | 'article';  // Type of resource
  activity_id?: string;  // For interactive activities (e.g., "box-breathing")
}

export interface InterventionPlan {
  plan_steps: PlanStep[];
  resource_cards: ResourceCard[];
  next_check_in?: string; // ISO datetime string
  intervention_reason?: string;
}

export interface Appointment {
  id: number;
  student_id: number;
  psychologist_id: number;
  appointment_datetime: string; // ISO datetime string
  appointment_type_id: number;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  cancellation_reason?: string;
  psychologist?: {
    id: number;
    full_name: string;
    specialization?: string[];
    languages?: string[];
  };
  appointment_type?: {
    id: number;
    name: string;
    description?: string;
  };
  location?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id?: string; // Optional if AI message
  session_id: string; // Added if not present, useful for tracking
  content: string;
  role: 'user' | 'assistant' | 'system' | 'event'; // 'event' for module triggers
  created_at: string;
  updated_at: string;
  isLoading?: boolean; // For UI state, not part of backend model
  toolIndicator?: string; // For showing tool usage info
  feedback_id?: string;
  annotations?: unknown[]; // Or a more specific type if annotations have a defined structure
  run_id?: string;
  metadata?: Record<string, any>; // To store things like module_id for event messages
  timestamp: Date;
  interventionPlan?: InterventionPlan; // TCA-generated support plan
  appointment?: Appointment; // Scheduling confirmation
  isError?: boolean; // For error messages
  /** Milliseconds to wait before retrying after a fallback response. 0 = no enforced cooldown. */
  retryAfterMs?: number;
  /** Reason for the fallback: 'rate_limit' | 'model_error'. Present only when isError=true. */
  fallbackType?: 'rate_limit' | 'model_error';
  isStreaming?: boolean; // For streaming messages
  isContinuation?: boolean; // For multi-bubble responses (continuation of previous message)
  agentActivity?: {
    // Agent Activity Log for transparency
    execution_path: string[]; // ["aika_decision", "sta_subgraph", "tca_subgraph", "synthesize_response"]
    agents_invoked: string[]; // ["STA", "TCA"]
    intent: string; // "emotional_support", "crisis_detection", etc.
    intent_confidence: number; // 0.0 - 1.0
    needs_agents: boolean;
    agent_reasoning: string; // Why Aika made this decision
    response_source: string; // "aika_direct", "agent_synthesis"
    processing_time_ms: number;
    risk_level?: string; // If STA was invoked
    risk_score?: number; // If STA was invoked
  };
  aikaMetadata?: {
    // Aika Meta-Agent metadata
    session_id: string;
    user_role: string;
    intent: string;
    agents_invoked: string[];
    actions_taken: string[];
    processing_time_ms: number;
    risk_assessment?: {
      risk_level: string;
      risk_score: number;
      confidence: number;
      risk_factors: string[];
    };
    escalation_triggered: boolean;
    case_id?: string;
    // Fallback signalling
    is_fallback?: boolean;
    fallback_type?: 'rate_limit' | 'model_error';
    retry_after_ms?: number;
  };
}

export type ChatMode = 'standard' | 'summarize' | 'rag' | `module:${string}`; // Example

export interface AvailableModule {
  id: string; // Corresponds to the module_id in the backend
  name: string; // Display name for the module
  description: string; // Short description for the UI
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>; // Optional: if you plan to add icons
}