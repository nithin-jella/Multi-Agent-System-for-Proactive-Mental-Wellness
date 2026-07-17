export type QuestCategory = "wellness" | "reflection" | "social" | "support" | "learning";

export type QuestDifficulty = "easy" | "standard" | "challenge";

export interface QuestTemplate {
  id: number;
  code: string;
  name: string;
  short_description: string;
  long_description?: string | null;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  recommended_duration_minutes: number;
  base_xp: number;
  base_joy: number;
  base_harmony: number;
  extra_data: Record<string, unknown>;
  requires_counselor: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestTemplateListResponse {
  templates: QuestTemplate[];
}

export interface QuestTemplateCreateRequest {
  code: string;
  name: string;
  short_description: string;
  long_description?: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  recommended_duration_minutes: number;
  base_xp: number;
  base_joy: number;
  base_harmony: number;
  extra_data: Record<string, unknown>;
}

export interface QuestTemplateUpdateRequest {
  name?: string;
  short_description?: string;
  long_description?: string | null;
  category?: QuestCategory;
  difficulty?: QuestDifficulty;
  recommended_duration_minutes?: number;
  base_xp?: number;
  base_joy?: number;
  base_harmony?: number;
  extra_data?: Record<string, unknown>;
  is_active?: boolean;
}
