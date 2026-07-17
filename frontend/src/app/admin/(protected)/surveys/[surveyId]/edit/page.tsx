'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { apiCall } from '@/utils/adminApi';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface SurveyQuestion {
  id?: number;
  question_text: string;
  question_type: string;
  options?: string[] | null;
}

interface Survey {
  id: number;
  title: string;
  description: string | null;
  is_active: boolean;
  questions: SurveyQuestion[];
}

export default function SurveyEditorPage() {
  const params = useParams<{ surveyId: string }>();
  const router = useRouter();
  const surveyId = parseInt(params.surveyId, 10);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionInputs, setOptionInputs] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const s = await apiCall<Survey>(`/api/v1/admin/surveys/${surveyId}`);
      setSurvey({ ...s, questions: s.questions.map(q => ({ ...q, options: q.options || [] })) });
      setOptionInputs(new Array(s.questions.length).fill(''));
    } catch {
      toast.error('Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => { if (!isNaN(surveyId)) load(); }, [surveyId, load]);

  const addQuestion = () => {
    if (!survey) return;
    const qs = [...survey.questions, { question_text: '', question_type: 'text', options: [] }];
    setSurvey({ ...survey, questions: qs });
    setOptionInputs(prev => [...prev, '']);
  };

  const removeQuestion = (idx: number) => {
    if (!survey) return;
    const qs = survey.questions.filter((_, i) => i !== idx);
    setSurvey({ ...survey, questions: qs });
    setOptionInputs(prev => prev.filter((_, i) => i !== idx));
  };

  type EditableQuestionField = 'question_text' | 'question_type';
  const updateQuestion = (idx: number, field: EditableQuestionField, value: string) => {
    if (!survey) return;
    const qs = survey.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q);
    setSurvey({ ...survey, questions: qs });
  };

  const addOption = (idx: number) => {
    if (!survey) return;
    const val = (optionInputs[idx] || '').trim();
    if (!val) return;
    const qs = survey.questions.map((q, i) => {
      if (i !== idx) return q;
      const opts = Array.isArray(q.options) ? [...q.options] : [];
      if (!opts.includes(val)) opts.push(val);
      return { ...q, options: opts };
    });
    setSurvey({ ...survey, questions: qs });
    setOptionInputs(prev => prev.map((v, i) => i === idx ? '' : v));
  };

  const removeOption = (idx: number, opt: string) => {
    if (!survey) return;
    const qs = survey.questions.map((q, i) => {
      if (i !== idx) return q;
      const opts = Array.isArray(q.options) ? q.options.filter(o => o !== opt) : [];
      return { ...q, options: opts };
    });
    setSurvey({ ...survey, questions: qs });
  };

  const save = async () => {
    if (!survey) return;
    // Validate MC
    for (const q of survey.questions) {
      if (q.question_type === 'multiple-choice') {
        const opts = Array.isArray(q.options) ? q.options : [];
        if (opts.length < 2) {
          toast.error('Multiple-choice questions need at least 2 options.');
          return;
        }
      }
    }
    // Update base survey
    await apiCall(`/api/v1/admin/surveys/${surveyId}` ,{
      method: 'PUT',
      body: JSON.stringify({ title: survey.title, description: survey.description, is_active: survey.is_active })
    });
    // Upsert questions
    await apiCall(`/api/v1/admin/surveys/${surveyId}/questions/bulk`, {
      method: 'PUT',
      body: JSON.stringify(survey.questions.map(q => ({ id: q.id, question_text: q.question_text, question_type: q.question_type, options: q.options || [] })))
    });
    toast.success('Survey saved');
    router.push('/admin/surveys');
  };

  if (loading) return <div className="text-gray-300">Loading…</div>;
  if (!survey) return <div className="text-gray-300">Survey not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Edit Survey</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="text-white" onClick={() => router.back()}>Cancel</Button>
          <Button variant="primaryGold" onClick={save}>Save</Button>
        </div>
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="p-6 space-y-4">
          <Input name="title" label="Title" value={survey.title} onChange={(e) => setSurvey({ ...survey, title: e.target.value })} className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <Textarea value={survey.description || ''} onChange={(e) => setSurvey({ ...survey, description: e.target.value })} className="w-full min-h-[120px] p-3 bg-white/8 border border-white/15 rounded-xl text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={survey.is_active} onChange={(e) => setSurvey({ ...survey, is_active: e.target.checked })} /> Active
          </label>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Questions</h2>
            <Button variant="outline" className="text-white inline-flex items-center" onClick={addQuestion}><FiPlus className="mr-2" />Add Question</Button>
          </div>

          {survey.questions.map((q, i) => (
            <div key={q.id ?? `new-${i}`} className="p-4 border border-white/20 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-300">Question {i + 1}</label>
                <button onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-300" type="button" aria-label={`Remove question ${i + 1}`} title={`Remove question ${i + 1}`}><FiTrash2 /></button>
              </div>
              <Input name="question_text" label="Question text" value={q.question_text} onChange={(e) => updateQuestion(i, 'question_text', e.target.value)} className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white mb-2" />
              <Select name="question_type" label="Question type" value={q.question_type} onChange={(e) => updateQuestion(i, 'question_type', e.target.value)} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white">
                <option value="text" className="bg-gray-800">Text</option>
                <option value="multiple-choice" className="bg-gray-800">Multiple Choice</option>
                <option value="rating" className="bg-gray-800">Rating (scale)</option>
              </Select>
              {q.question_type === 'multiple-choice' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={optionInputs[i] || ''} onChange={(e) => setOptionInputs(prev => prev.map((v, idx) => idx === i ? e.target.value : v))} placeholder="Add an option" className="flex-1 px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white" />
                    <Button type="button" variant="outline" onClick={() => addOption(i)}>Add</Button>
                  </div>
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <span key={opt} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white/10 border border-white/20 text-white">
                          {opt}
                          <button type="button" onClick={() => removeOption(i, opt)} className="text-red-400 hover:text-red-300">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {q.question_type === 'rating' && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input name="rating_min" label="Scale min" type="number" placeholder="1" onChange={() => {}} value={''} className="hidden" />
                  <Input name="rating_max" label="Scale max" type="number" placeholder="5" onChange={() => {}} value={''} className="hidden" />
                  <div className="text-xs text-gray-300">Tip: Rating scale will be interpreted from answers; you can guide users in the question text (e.g., &quot;1 = Sangat Tidak Setuju, 5 = Sangat Setuju&quot;).</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

