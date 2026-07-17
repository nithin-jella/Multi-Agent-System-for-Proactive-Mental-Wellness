// Shared survey question draft types
// Central source to avoid duplication between pages and components.

export type BaseQuestion = { id?: number; question_text: string };
export type TextQuestionDraft = BaseQuestion & { question_type: 'text'; options: [] };
export type MultipleChoiceQuestionDraft = BaseQuestion & { question_type: 'multiple-choice'; options: string[] };
export type RatingQuestionDraft = BaseQuestion & { question_type: 'rating'; options: { scale: { min: number; max: number } } };
export type QuestionDraft = TextQuestionDraft | MultipleChoiceQuestionDraft | RatingQuestionDraft;

// Local negative id generator to ensure stable keys before persistence assigns real IDs
let tempQuestionId = -1;
export const createEmptyQuestion = (): TextQuestionDraft => ({ id: tempQuestionId--, question_text: '', question_type: 'text', options: [] });
