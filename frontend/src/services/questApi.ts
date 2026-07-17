import apiClient from "@/services/api";
import type {
  DailyMessage,
  QuestCompletionResponse,
  QuestInstance,
  WellnessState,
} from "@/types/quests";

export async function fetchTodayQuests(): Promise<QuestInstance[]> {
  const { data } = await apiClient.get<QuestInstance[]>("/quests/today");
  return data;
}

export interface CompleteQuestPayload {
  notes?: string;
  mood?: string;
  metadata?: Record<string, unknown>;
}

export async function completeQuest(
  questId: number,
  payload: CompleteQuestPayload,
): Promise<QuestCompletionResponse> {
  const { data } = await apiClient.post<QuestCompletionResponse>(
    `/quests/${questId}/complete`,
    payload,
  );
  return data;
}

export async function fetchWellnessState(): Promise<WellnessState> {
  const { data } = await apiClient.get<WellnessState>("/quests/state");
  return data;
}

export async function fetchDailyMessage(): Promise<DailyMessage> {
  const { data } = await apiClient.get<DailyMessage>("/quests/daily-message");
  return data;
}

export interface UpdateWellnessPayload {
  joy_delta?: number;
  care_delta?: number;
  harmony_delta?: number;
}

export async function updateWellnessState(
  payload: UpdateWellnessPayload
): Promise<WellnessState> {
  const { data } = await apiClient.patch<WellnessState>(
    "/quests/state/update",
    payload
  );
  return data;
}
