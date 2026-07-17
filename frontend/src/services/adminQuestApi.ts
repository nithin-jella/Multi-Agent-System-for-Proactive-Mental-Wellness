import { apiCall } from "@/utils/adminApi";
import type {
  QuestTemplate,
  QuestTemplateCreateRequest,
  QuestTemplateListResponse,
  QuestTemplateUpdateRequest,
} from "@/types/admin/quests";

export interface QuestTemplateQueryParams {
  search?: string;
  includeInactive?: boolean;
  category?: string;
  difficulty?: string;
}

export async function fetchQuestTemplates(params: QuestTemplateQueryParams = {}): Promise<QuestTemplate[]> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (typeof params.includeInactive === "boolean") {
    searchParams.set("include_inactive", String(params.includeInactive));
  }
  if (params.category) searchParams.set("category", params.category);
  if (params.difficulty) searchParams.set("difficulty", params.difficulty);

  const queryString = searchParams.toString();
  const response = await apiCall<QuestTemplateListResponse>(
    `/api/v1/admin/quests/templates${queryString ? `?${queryString}` : ""}`,
  );
  return response.templates;
}

export async function createQuestTemplate(payload: QuestTemplateCreateRequest): Promise<QuestTemplate> {
  return apiCall<QuestTemplate>("/api/v1/admin/quests/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuestTemplate(
  templateId: number,
  payload: QuestTemplateUpdateRequest,
): Promise<QuestTemplate> {
  return apiCall<QuestTemplate>(`/api/v1/admin/quests/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function toggleQuestTemplateActivation(templateId: number, activate: boolean): Promise<QuestTemplate> {
  const searchParams = new URLSearchParams({ activate: String(activate) });
  return apiCall<QuestTemplate>(`/api/v1/admin/quests/templates/${templateId}/activate?${searchParams.toString()}`, {
    method: "POST",
  });
}
