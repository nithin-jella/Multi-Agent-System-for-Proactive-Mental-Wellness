export type QuestCategory =
  | "wellness"
  | "reflection"
  | "social"
  | "support"
  | "learning";

export type QuestDifficulty = "easy" | "standard" | "challenge";

export type QuestStatus = "active" | "completed" | "expired" | "cancelled";

export interface QuestTemplate {
  id: number;
  code: string;
  name: string;
  short_description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  recommended_duration_minutes: number;
}

export interface QuestInstance {
  id: number;
  status: QuestStatus;
  issued_at: string;
  expires_at: string;
  completed_at: string | null;
  compassion_mode: boolean;
  template: QuestTemplate;
}

export interface RewardSummary {
  xp: number;
  joy: number;
  harmony: number;
  care_pending: number;
}

export interface QuestCompletionResponse {
  quest: QuestInstance;
  reward: RewardSummary;
}

export interface WellnessState {
  current_streak: number;
  longest_streak: number;
  harmony_score: number;
  joy_balance: number;
  care_balance: number;
  compassion_mode_active: boolean;
}

export interface DailyMessage {
  message: string;
  tone: string;
  generated_at: string;
}

