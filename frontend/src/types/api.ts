// src/types/api.ts

  // --- Journal Prompt Types ---
export interface JournalPromptResponse {
  id: number;
  text: string;
  category?: string | null;
  is_active: boolean;
  created_at: string; 
  updated_at: string;
}

// --- Journal Entry Types ---
// This can be used by DailyJournal.tsx for its allEntries state
export interface JournalEntryItem {
  id: number;
  user_id: number;
  entry_date: string; // yyyy-MM-dd
  content: string;
  created_at: string;
  updated_at: string;
  prompt_id?: number | null;
  prompt?: JournalPromptResponse | null; // Include the prompt object
  reflection_points?: JournalReflectionPointResponse[];
  valence?: number | null; // -1.0 to 1.0
  arousal?: number | null; // -1.0 to 1.0
  inferred_dominance?: number | null; // -1.0 to 1.0 (AI inferred)
  word_count: number;
  tags?: JournalTagResponse[];
}

export interface JournalTagResponse {
  id: number;
  journal_entry_id: number;
  tag_name: string;
  created_at: string;
}

export interface JournalReflectionPointResponse {
  id: number;
  journal_entry_id: number;
  user_id: number;
  reflection_text: string;
  // reflection_category?: string | null; // Uncomment if you add this field in the backend schema
  created_at: string; // ISO date string
}

export interface JournalEntryCreate {
  entry_date: string;
  content: string;
  prompt_id?: number | null;
  valence?: number | null;
  arousal?: number | null;
  tags: string[];
}

export interface JournalEntryFilter {
  search_query?: string;
  valence_min?: number;
  valence_max?: number;
  arousal_min?: number;
  arousal_max?: number;
  inferred_dominance_min?: number;
  inferred_dominance_max?: number;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface PadAxisDistribution {
  very_low: number;
  low: number;
  neutral: number;
  high: number;
  very_high: number;
}

export interface PadDistribution {
  valence: PadAxisDistribution;
  arousal: PadAxisDistribution;
  inferred_dominance: PadAxisDistribution;
}

export interface JournalPadTrendPoint {
  date: string;
  valence?: number | null;
  arousal?: number | null;
  inferred_dominance?: number | null;
}

export interface JournalAnalyticsResponse {
  total_entries: number;
  total_word_count: number;
  avg_word_count: number;
  most_used_tags: Array<{ tag: string; count: number }>;
  writing_frequency: Array<{ date: string; count: number }>;
  pad_distribution: PadDistribution;
  pad_trend: JournalPadTrendPoint[];
}

// --- Psychologist Appointment Types ---
export interface Psychologist {
  id: number;
  name: string;
  specialization?: string | null;
  image_url?: string | null;
  is_available: boolean;
}

export interface AppointmentType {
  id: number;
  name: string;
  duration_minutes: number;
  description?: string | null;
}

export interface AppointmentBase {
  psychologist_id: number;
  appointment_type_id: number;
  appointment_datetime: string; // ISO 8601 format string
  notes?: string | null;
  status?: string; // e.g., "scheduled", "completed", "cancelled"
}

export interface AppointmentCreate extends AppointmentBase {
  user_identifier: string; // google_sub
}

export interface Appointment extends AppointmentBase {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  psychologist: Psychologist; // Nested object
  appointment_type: AppointmentType; // Nested object
}
