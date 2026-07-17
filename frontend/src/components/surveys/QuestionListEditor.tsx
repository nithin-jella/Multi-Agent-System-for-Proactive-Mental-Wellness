import React, { useState, useEffect, useCallback } from 'react';
import { RatingQuestionDraft, QuestionDraft } from '@/types/surveys';

export interface QuestionListEditorProps {
  questions: QuestionDraft[];
  optionInputs: string[]; // per-question pending option input
  errors: Record<number, string | undefined>;
  mode: 'create' | 'edit';
  onQuestionsChange: (questions: QuestionDraft[]) => void;
  onOptionInputsChange: (vals: string[]) => void;
  onErrorChange?: (errors: Record<number, string | undefined>) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onAddOption: (index: number) => void;
  onRemoveOption: (qIdx: number, opt: string) => void;
  renderControls?: (index: number) => React.ReactNode; // custom trailing controls (e.g., remove button)
}

// NOTE: This is a first extraction pass—page still uses inline implementation.
// Next step would be to replace page inline blocks with this component usage.

export const QuestionListEditor: React.FC<QuestionListEditorProps> = ({
  questions,
  optionInputs,
  errors,
  onAddQuestion,
  onRemoveQuestion,
  onAddOption,
  onRemoveOption,
  onQuestionsChange,
  onOptionInputsChange,
  renderControls,
}) => {
  // Local buffered text values to avoid parent state churn on every keystroke
  const [localTexts, setLocalTexts] = useState<string[]>(() => questions.map(q => q.question_text));
  const [dirty, setDirty] = useState<boolean[]>(() => questions.map(() => false));
  
  // Local buffered option inputs to avoid focus loss on every keystroke
  const [localOptionInputs, setLocalOptionInputs] = useState<string[]>(() => [...optionInputs]);
  
  // Local buffered rating values to avoid focus loss
  const [localRatingValues, setLocalRatingValues] = useState<Record<string, string>>({});

  // Sync when questions array shape changes (add/remove) or when upstream changes replace objects
  useEffect(() => {
    setLocalTexts(prev => {
      const next: string[] = [];
      for (let i = 0; i < questions.length; i++) {
        // Preserve in-progress edits (dirty) else reflect upstream text
        if (dirty[i]) {
          next[i] = prev[i] ?? questions[i].question_text;
        } else {
          next[i] = questions[i].question_text;
        }
      }
      return next;
    });
    setDirty(prev => {
      if (prev.length === questions.length) return prev; // keep existing flags if same length
      const next = [...prev];
      while (next.length < questions.length) next.push(false);
      if (next.length > questions.length) next.length = questions.length;
      return next;
    });
  }, [questions, dirty]);

  // Sync local option inputs with parent when optionInputs changes
  useEffect(() => {
    setLocalOptionInputs(prev => {
      if (prev.length === optionInputs.length && prev.every((v, i) => v === optionInputs[i])) {
        return prev; // no change needed
      }
      return [...optionInputs];
    });
  }, [optionInputs]);

  const commitQuestionText = useCallback((index: number) => {
    const current = questions[index];
    if (!current) return;
    if (!dirty[index]) return; // nothing pending
    const newValue = localTexts[index];
    if (newValue === current.question_text) {
      // Reset dirty flag only
      setDirty(d => d.map((v,i)=> i===index ? false : v));
      return;
    }
    const updated = [...questions];
    updated[index] = { ...current, question_text: newValue } as QuestionDraft;
    onQuestionsChange(updated);
    setDirty(d => d.map((v,i)=> i===index ? false : v));
  }, [questions, localTexts, dirty, onQuestionsChange]);

  const handleQuestionField = (index: number, field: string, value: string) => {
    const target = questions[index];
    if (!target) return;
    if (field === 'question_type') {
      let nextQuestion: QuestionDraft;
      if (value === 'text') nextQuestion = { id: target.id, question_text: target.question_text, question_type: 'text', options: [] };
      else if (value === 'multiple-choice') nextQuestion = { id: target.id, question_text: target.question_text, question_type: 'multiple-choice', options: [] };
      else nextQuestion = { id: target.id, question_text: target.question_text, question_type: 'rating', options: { scale: { min: 1, max: 5 } } };
      if (nextQuestion.question_type !== target.question_type) {
        const updated = [...questions];
        updated[index] = nextQuestion;
        onQuestionsChange(updated);
      }
      return;
    }
    if (field === 'question_text') {
      setLocalTexts(prev => prev.map((t,i)=> i===index ? value : t));
      setDirty(prev => prev.map((f,i)=> i===index ? true : f));
      return;
    }
  };

  // Handle option input changes with local buffering
  const handleOptionInputChange = useCallback((index: number, value: string) => {
    setLocalOptionInputs(prev => prev.map((v, i) => i === index ? value : v));
  }, []);

  // Commit option input to parent (on blur or enter)
  const commitOptionInput = useCallback((index: number) => {
    const localValue = localOptionInputs[index];
    if (localValue === optionInputs[index]) return; // no change
    onOptionInputsChange(localOptionInputs.map((v, i) => i === index ? localValue : v));
  }, [localOptionInputs, optionInputs, onOptionInputsChange]);

  // Handle rating scale changes with local buffering
  const handleRatingInputChange = useCallback((index: number, key: 'min'|'max', value: string) => {
    const ratingKey = `${index}-${key}`;
    setLocalRatingValues(prev => ({ ...prev, [ratingKey]: value }));
  }, []);

  // Commit rating value to parent (on blur or enter)
  const commitRatingValue = useCallback((index: number, key: 'min'|'max') => {
    const ratingKey = `${index}-${key}`;
    const localValue = localRatingValues[ratingKey];
    if (localValue === undefined) return; // no local edit in progress
    
    const numValue = Number(localValue);
    if (isNaN(numValue)) {
      // Invalid number, revert to original value
      setLocalRatingValues(prev => {
        const next = { ...prev };
        delete next[ratingKey];
        return next;
      });
      return;
    }

    const prev = questions;
    const target = prev[index];
    if (!target || target.question_type !== 'rating') return;
    const existing = target.options.scale;
    if (existing[key] === numValue) {
      // No change, just clear local state
      setLocalRatingValues(prev => {
        const next = { ...prev };
        delete next[ratingKey];
        return next;
      });
      return;
    }
    
    const updated: RatingQuestionDraft = { ...target, options: { scale: { ...existing, [key]: numValue } } };
    const newArr = [...prev];
    newArr[index] = updated;
    onQuestionsChange(newArr);
    
    // Clear local value after commit
    setLocalRatingValues(prev => {
      const next = { ...prev };
      delete next[ratingKey];
      return next;
    });
  }, [localRatingValues, questions, onQuestionsChange]);



  return (
    <div>
      {questions.map((q, i) => (
        <div key={q.id ?? `q-${i}`} className="p-4 border border-white/20 rounded-lg mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-300">Question {i + 1}</label>
            {renderControls ? renderControls(i) : (
              <button
                aria-label={`Remove question ${i+1}`}
                title="Remove question"
                onClick={() => onRemoveQuestion(i)}
                className="text-red-400 hover:text-red-300"
                type="button"
              >×</button>
            )}
          </div>
          <input
            value={localTexts[i] ?? ''}
            onChange={(e) => handleQuestionField(i, 'question_text', e.target.value)}
            onBlur={() => commitQuestionText(i)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitQuestionText(i); } }}
            placeholder="Question text"
            className="w-full mb-2 px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none"
            data-dirty={dirty[i] ? 'true' : 'false'}
          />
          <select
            value={q.question_type}
            onChange={(e) => handleQuestionField(i, 'question_type', e.target.value)}
            className="w-full mb-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            aria-label="Question type"
          >
            <option value="text" className="bg-gray-800">Text</option>
            <option value="multiple-choice" className="bg-gray-800">Multiple Choice</option>
            <option value="rating" className="bg-gray-800">Rating</option>
          </select>
          {q.question_type === 'multiple-choice' && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localOptionInputs[i] || ''}
                  onChange={(e) => handleOptionInputChange(i, e.target.value)}
                  onBlur={() => commitOptionInput(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitOptionInput(i); } }}
                  placeholder="Add an option"
                  className="flex-1 px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none"
                />
                <button type="button" onClick={() => onAddOption(i)} className="px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md hover:bg-white/20">Add</button>
              </div>
              {q.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white/10 border border-white/20 text-white">
                      {opt}
                      <button aria-label={`Remove option ${opt}`} title="Remove option" type="button" onClick={() => onRemoveOption(i, opt)} className="text-red-400 hover:text-red-300">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {q.question_type === 'rating' && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                value={localRatingValues[`${i}-min`] ?? q.options.scale.min}
                onChange={(e) => handleRatingInputChange(i, 'min', e.target.value)}
                onBlur={() => commitRatingValue(i, 'min')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRatingValue(i, 'min'); } }}
                className="w-full px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
                aria-label="Rating scale minimum"
                placeholder="Min"
              />
              <input
                type="number"
                value={localRatingValues[`${i}-max`] ?? q.options.scale.max}
                onChange={(e) => handleRatingInputChange(i, 'max', e.target.value)}
                onBlur={() => commitRatingValue(i, 'max')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRatingValue(i, 'max'); } }}
                className="w-full px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white"
                aria-label="Rating scale maximum"
                placeholder="Max"
              />
            </div>
          )}
          {errors[i] && <p className="mt-2 text-xs text-red-400" role="alert">{errors[i]}</p>}
        </div>
      ))}
      <button
        type="button"
        onClick={onAddQuestion}
        className="inline-flex items-center px-3 py-2 text-sm border border-white/20 rounded-md text-white bg-white/10 hover:bg-white/20"
      >Add Question</button>
    </div>
  );
};
