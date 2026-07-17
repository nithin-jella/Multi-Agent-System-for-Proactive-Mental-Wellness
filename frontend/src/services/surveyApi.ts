import { apiCall } from '@/utils/adminApi';

// Domain types (reuse shapes already declared in page; re-export for broader use)
export type QuestionType = 'text' | 'multiple-choice' | 'rating';
export interface RatingOptions { scale: { min: number; max: number } }
export type QuestionOptions = string[] | RatingOptions | [];
export interface SurveyQuestion { id: number; question_text: string; question_type: QuestionType; options: QuestionOptions }
export interface SurveyQuestionDraft { id?: number; question_text: string; question_type: QuestionType; options: QuestionOptions }
export interface Survey { id: number; title: string; description: string | null; category: string | null; is_active: boolean; created_at: string; updated_at: string; questions: SurveyQuestion[] }
export interface SurveyAnswer { id: number; question_text: string; answer_text: string }
export interface SurveyResponse { id: number; user_id: number; created_at: string; answers: SurveyAnswer[] }

interface ApiErrorDescriptor { code?: string; status?: number; message: string }

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelay = 400): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      lastError = e;
      if (i < attempts - 1) await delay(baseDelay * Math.pow(2, i));
    }
  }
  throw lastError;
}

function normalizeError(e: unknown, fallback: string): ApiErrorDescriptor {
  if (e instanceof Error) return { message: e.message };
  if (typeof e === 'object' && e && 'message' in e) {
    const msg = (e as { message?: unknown }).message;
    return { message: typeof msg === 'string' ? msg : String(msg) };
  }
  return { message: fallback };
}

// CRUD operations
export const surveyApi = {
  list: () => withRetry(() => apiCall<Survey[]>('/api/v1/admin/surveys')),
  create: (payload: { title: string; description: string; category?: string; questions: SurveyQuestionDraft[] }) =>
    apiCall<Survey>('/api/v1/admin/surveys', { method: 'POST', body: JSON.stringify(payload) }),
  updateMeta: (id: number, payload: { title?: string; description?: string | null; category?: string | null; is_active?: boolean }) =>
    apiCall(`/api/v1/admin/surveys/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  bulkUpsertQuestions: (id: number, questions: SurveyQuestionDraft[]) =>
    apiCall(`/api/v1/admin/surveys/${id}/questions/bulk`, { method: 'PUT', body: JSON.stringify(
      questions.map(q => ({ id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options || [] }))
    ) }),
  toggleActive: (id: number, next: boolean) =>
    apiCall(`/api/v1/admin/surveys/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: next }) }),
  remove: (id: number) => apiCall(`/api/v1/admin/surveys/${id}`, { method: 'DELETE' }),
  responses: (id: number) => withRetry(() => apiCall<SurveyResponse[]>(`/api/v1/admin/surveys/${id}/responses`)),
  normalizeError,
};
