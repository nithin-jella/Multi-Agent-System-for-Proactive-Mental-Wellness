import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeQuest,
  fetchDailyMessage,
  fetchTodayQuests,
  fetchWellnessState,
  type CompleteQuestPayload,
} from "@/services/questApi";
import type { DailyMessage, QuestCompletionResponse, QuestInstance, WellnessState } from "@/types/quests";

export const QUESTS_QUERY_KEY = ["quests", "today"] as const;
export const WELLNESS_QUERY_KEY = ["quests", "wellness"] as const;
export const MESSAGE_QUERY_KEY = ["quests", "message"] as const;

export function useTodayQuests() {
  return useQuery<QuestInstance[]>({
    queryKey: QUESTS_QUERY_KEY,
    queryFn: fetchTodayQuests,
    staleTime: 1000 * 60, // 1 minute
  });
}

import { useSession } from "next-auth/react";

export function useWellnessState() {
  const { status } = useSession();
  return useQuery<WellnessState>({
    queryKey: WELLNESS_QUERY_KEY,
    queryFn: fetchWellnessState,
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: status === "authenticated", // Only fetch if authenticated
  });
}

export function useDailyMessage() {
  return useQuery<DailyMessage>({
    queryKey: MESSAGE_QUERY_KEY,
    queryFn: fetchDailyMessage,
    staleTime: 1000 * 60 * 10,
  });
}

export function useCompleteQuest() {
  const queryClient = useQueryClient();
  return useMutation<QuestCompletionResponse, unknown, { questId: number; payload: CompleteQuestPayload }>(
    {
      mutationFn: ({ questId, payload }) => completeQuest(questId, payload),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUESTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: WELLNESS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEY });
      },
    },
  );
}

