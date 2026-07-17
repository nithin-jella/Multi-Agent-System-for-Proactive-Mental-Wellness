/**
 * Screening Types for Admin Dashboard
 * Types for mental health screening monitoring interface
 * 
 * Based on internationally validated psychological screening instruments:
 * - PHQ-9: Patient Health Questionnaire-9 (Depression)
 * - GAD-7: Generalized Anxiety Disorder-7 (Anxiety)
 * - DASS-21: Depression Anxiety Stress Scales (Stress)
 * - PSQI: Pittsburgh Sleep Quality Index (Sleep)
 * - UCLA-LS3: UCLA Loneliness Scale Version 3 (Social Isolation)
 * - RSES: Rosenberg Self-Esteem Scale (Self-Worth)
 * - AUDIT: Alcohol Use Disorders Identification Test (Substance Use)
 * - C-SSRS: Columbia Suicide Severity Rating Scale (Crisis)
 */

export type RiskLevel = 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
export type RiskTrajectory = 'improving' | 'stable' | 'declining';

/** Screening dimension based on validated instruments */
export type ScreeningDimension = 
  | 'depression'   // PHQ-9
  | 'anxiety'      // GAD-7
  | 'stress'       // DASS-21
  | 'sleep'        // PSQI
  | 'social'       // UCLA-LS3
  | 'academic'     // SSI (adapted)
  | 'self_worth'   // RSES
  | 'substance'    // AUDIT
  | 'crisis';      // C-SSRS

export interface DimensionScore {
  dimension: ScreeningDimension;
  current_score: number;
  protective_score: number;
  net_score: number;
  indicator_count: number;
  last_updated: string | null;
  trend: 'improving' | 'stable' | 'worsening';
  instrument?: string;
  severity_label?: string;
}

export interface ScreeningProfile {
  user_id: number;
  user_name: string | null;
  user_email: string | null;
  overall_risk: RiskLevel;
  requires_attention: boolean;
  risk_trajectory: RiskTrajectory;
  total_messages_analyzed: number;
  total_sessions_analyzed: number;
  dimension_scores: DimensionScore[];
  primary_concerns: string[];
  protective_factors: string[];
  last_intervention_at: string | null;
  intervention_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScreeningProfileListResponse {
  total: number;
  page: number;
  limit: number;
  profiles: ScreeningProfile[];
}

export interface TopConcern {
  concern: string;
  count: number;
}

export interface ScreeningDashboard {
  total_profiles: number;
  profiles_requiring_attention: number;
  risk_distribution: Record<RiskLevel, number>;
  top_concerns: TopConcern[];
  recent_high_risk: ScreeningProfile[];
}

export interface ScreeningFilters {
  page?: number;
  limit?: number;
  risk_level?: RiskLevel;
  requires_attention?: boolean;
}

/**
 * Instrument configuration with academic references
 */
export interface InstrumentInfo {
  code: string;
  name: string;
  reference: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Mapping of dimensions to validated psychological instruments
 */
export const INSTRUMENT_CONFIG: Record<ScreeningDimension, InstrumentInfo> = {
  depression: {
    code: 'PHQ-9',
    name: 'Patient Health Questionnaire-9',
    reference: 'Kroenke et al. (2001)',
    description: 'Mood, anhedonia, hopelessness, fatigue',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  anxiety: {
    code: 'GAD-7',
    name: 'Generalized Anxiety Disorder-7',
    reference: 'Spitzer et al. (2006)',
    description: 'Worry, tension, panic, restlessness',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  stress: {
    code: 'DASS-21',
    name: 'DASS-21 Stress Subscale',
    reference: 'Lovibond & Lovibond (1995)',
    description: 'Overwhelm, burnout, pressure',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  sleep: {
    code: 'PSQI',
    name: 'Pittsburgh Sleep Quality Index',
    reference: 'Buysse et al. (1989)',
    description: 'Insomnia, fatigue, sleep quality',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  social: {
    code: 'UCLA-LS3',
    name: 'UCLA Loneliness Scale V3',
    reference: 'Russell (1996)',
    description: 'Isolation, loneliness, withdrawal',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  academic: {
    code: 'SSI',
    name: 'Student Stress Inventory',
    reference: 'Lakaev (2009), adapted',
    description: 'Academic pressure, thesis stress',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
  },
  self_worth: {
    code: 'RSES',
    name: 'Rosenberg Self-Esteem Scale',
    reference: 'Rosenberg (1965)',
    description: 'Self-esteem, self-criticism',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
  substance: {
    code: 'AUDIT',
    name: 'Alcohol Use Disorders ID Test',
    reference: 'Saunders et al. (1993)',
    description: 'Alcohol/substance coping',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
  },
  crisis: {
    code: 'C-SSRS',
    name: 'Columbia Suicide Severity Rating',
    reference: 'Posner et al. (2011)',
    description: 'Self-harm, suicidal ideation',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
};

/** Dimension display labels */
export const DIMENSION_LABELS: Record<ScreeningDimension, string> = {
  depression: 'Depression (PHQ-9)',
  anxiety: 'Anxiety (GAD-7)',
  stress: 'Stress (DASS-21)',
  sleep: 'Sleep (PSQI)',
  social: 'Social (UCLA-LS3)',
  academic: 'Academic (SSI)',
  self_worth: 'Self-Worth (RSES)',
  substance: 'Substance (AUDIT)',
  crisis: 'Crisis (C-SSRS)',
};

/** Risk level display configuration */
export const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; borderColor: string }> = {
  none: { label: 'None', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
  mild: { label: 'Mild', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  moderate: { label: 'Moderate', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30' },
  severe: { label: 'Severe', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  critical: { label: 'Critical', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' },
};

/**
 * Scoring thresholds based on instrument cutoffs
 */
export const SEVERITY_THRESHOLDS: Record<ScreeningDimension, Record<string, number>> = {
  depression: { mild: 0.19, moderate: 0.37, severe: 0.56, critical: 0.74 },
  anxiety: { mild: 0.24, moderate: 0.48, severe: 0.71, critical: 0.90 },
  stress: { mild: 0.19, moderate: 0.29, severe: 0.38, critical: 0.60 },
  sleep: { mild: 0.24, moderate: 0.48, severe: 0.71, critical: 0.90 },
  social: { mild: 0.25, moderate: 0.44, severe: 0.63, critical: 0.83 },
  academic: { mild: 0.25, moderate: 0.50, severe: 0.70, critical: 0.85 },
  self_worth: { mild: 0.25, moderate: 0.50, severe: 0.70, critical: 0.85 },
  substance: { mild: 0.20, moderate: 0.40, severe: 0.50, critical: 0.70 },
  crisis: { mild: 0.20, moderate: 0.40, severe: 0.60, critical: 0.80 },
};

/**
 * Get severity label based on score and dimension thresholds
 */
export function getSeverityLabel(dimension: ScreeningDimension, score: number): RiskLevel {
  const thresholds = SEVERITY_THRESHOLDS[dimension];
  if (score >= thresholds.critical) return 'critical';
  if (score >= thresholds.severe) return 'severe';
  if (score >= thresholds.moderate) return 'moderate';
  if (score >= thresholds.mild) return 'mild';
  return 'none';
}
