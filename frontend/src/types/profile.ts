export interface EmergencyContact {
  name?: string | null;
  relationship?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface ContactInfo {
  primary_email?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  emergency_contact?: EmergencyContact | null;
}

export interface SafetyAndClinicalBasics {
  risk_level?: string | null;
  clinical_summary?: string | null;
  primary_concerns?: string | null;
  safety_plan_notes?: string | null;
}

export interface TherapyAssignment {
  current_therapist_name?: string | null;
  current_therapist_contact?: string | null;
  therapy_modality?: string | null;
  therapy_frequency?: string | null;
  therapy_notes?: string | null;
}

export interface ConsentAndPrivacySettings {
  allow_email_checkins: boolean;
  consent_data_sharing: boolean;
  consent_research: boolean;
  consent_emergency_contact: boolean;
  consent_marketing: boolean;
  consent_ai_memory: boolean;
}

export interface AIMemoryFact {
  id: number;
  fact: string;
  category?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalizationAndAccessibility {
  preferred_language?: string | null;
  preferred_timezone?: string | null;
  accessibility_needs?: string | null;
  communication_preferences?: string | null;
  interface_preferences?: string | null;
}

export interface TimelineEntry {
  kind: string;
  title: string;
  description?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

export interface ProfileHeaderSummary {
  user_id: number;
  full_name?: string | null;
  preferred_name?: string | null;
  pronouns?: string | null;
  avatar_url?: string | null;
  profile_photo_url?: string | null;
  wallet_address?: string | null;
  google_sub?: string | null;
  date_of_birth?: string | null;
  age?: number | null;
  sentiment_score: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string | null;
  city?: string | null;
  university?: string | null;
  major?: string | null;
  year_of_study?: string | null;
  created_at?: string | null;
  check_in_code: string;
}

export interface UserProfileOverviewResponse {
  header: ProfileHeaderSummary;
  contact: ContactInfo;
  safety: SafetyAndClinicalBasics;
  therapy: TherapyAssignment;
  timeline: TimelineEntry[];
  consent: ConsentAndPrivacySettings;
  localization: LocalizationAndAccessibility;
  aicare_team_notes?: string | null;
}


export interface UserProfileOverviewUpdate {
  preferred_name?: string | null;
  pronouns?: string | null;
  profile_photo_url?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_relationship?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_email?: string | null;
  risk_level?: string | null;
  clinical_summary?: string | null;
  primary_concerns?: string | null;
  safety_plan_notes?: string | null;
  current_therapist_name?: string | null;
  current_therapist_contact?: string | null;
  therapy_modality?: string | null;
  therapy_frequency?: string | null;
  therapy_notes?: string | null;
  aicare_team_notes?: string | null;
  consent_data_sharing?: boolean;
  consent_research?: boolean;
  consent_emergency_contact?: boolean;
  consent_marketing?: boolean;
  consent_ai_memory?: boolean;
  preferred_language?: string | null;
  preferred_timezone?: string | null;
  accessibility_needs?: string | null;
  communication_preferences?: string | null;
  interface_preferences?: string | null;
  city?: string | null;
  university?: string | null;
  major?: string | null;
  year_of_study?: string | null;
}
