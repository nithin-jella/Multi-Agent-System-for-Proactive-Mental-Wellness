'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useModalA11y } from '@/hooks/useModalA11y';
import { FiPlus } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { surveyApi, Survey, SurveyResponse, SurveyQuestionDraft as ServiceQuestionDraft } from '@/services/surveyApi';
import { Button } from '@/components/ui/Button';
// Select component no longer used after extracting QuestionListEditor
import { Textarea } from '@/components/ui/TextArea';
// Tooltip removed; actions consolidated into SurveyRowActions
import SurveyRowActions from '@/components/surveys/SurveyRowActions';
import { QuestionListEditor } from '@/components/surveys/QuestionListEditor';
import { MultipleChoiceQuestionDraft, QuestionDraft, createEmptyQuestion } from '@/types/surveys';

// Draft & response types now come from surveyApi service (transformed to union locally)

interface NewSurveyState { title: string; description: string; category: string; questions: QuestionDraft[] }
type QuestionErrorMap = Record<number, string | undefined>;

const SURVEY_CATEGORY_DEFAULTS = ['Mental Health', 'Wellness', 'Assessment'];

const toServiceDraft = (q: QuestionDraft): ServiceQuestionDraft => {
  if (q.question_type === 'rating') return { id: q.id, question_text: q.question_text, question_type: 'rating', options: { scale: { ...q.options.scale } } };
  if (q.question_type === 'multiple-choice') return { id: q.id, question_text: q.question_text, question_type: 'multiple-choice', options: [...q.options] };
  return { id: q.id, question_text: q.question_text, question_type: 'text', options: [] };
};

const formatTimestamp = (ts?: string | null) => {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '-';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

export default function SurveyManagementPage() {
  // Debug counters (temporary instrumentation)
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  // Debug log removed after stabilization
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  // Local buffered meta edits for the edit modal (avoid re-creating survey object each keystroke)
  const [editMeta, setEditMeta] = useState<{ title: string; description: string; category: string; is_active: boolean }>({ title: '', description: '', category: '', is_active: false });
  const [surveyResults, setSurveyResults] = useState<SurveyResponse[]>([]);
  const [newSurvey, setNewSurvey] = useState<NewSurveyState>({
    title: '',
    description: '',
    category: '',
    questions: [createEmptyQuestion()]
  });
  const [optionInputs, setOptionInputs] = useState<string[]>(['']);
  const [createErrors, setCreateErrors] = useState<QuestionErrorMap>({});
  // Edit modal question state
  const [editQuestions, setEditQuestions] = useState<QuestionDraft[]>([]);
  const [editOptionInputs, setEditOptionInputs] = useState<string[]>([]);
  const [editErrors, setEditErrors] = useState<QuestionErrorMap>({});
  // Search + pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  // Sorting: key can be 'index' (default), 'title', 'category', 'description', 'created', 'updated'
  const [sort, setSort] = useState<{ key: 'index' | 'title' | 'category' | 'description' | 'created' | 'updated'; direction: 'asc' | 'desc' }>(() => ({ key: 'index', direction: 'asc' }));
  // Expanded description ids
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const surveyCategoryOptions = useMemo(() => {
    const categorySet = new Set(SURVEY_CATEGORY_DEFAULTS);
    surveys.forEach((survey) => {
      const value = (survey.category || '').trim();
      if (value) categorySet.add(value);
    });
    if (newSurvey.category.trim()) categorySet.add(newSurvey.category.trim());
    if (editMeta.category.trim()) categorySet.add(editMeta.category.trim());
    return Array.from(categorySet).sort((left, right) => left.localeCompare(right));
  }, [surveys, newSurvey.category, editMeta.category]);

  // Initialize from URL (once)
  useEffect(() => {
    try {
      const keyParam = searchParams.get('sortKey');
      const dirParam = searchParams.get('sortDir');
      if (keyParam && ['index','title','category','description','created','updated'].includes(keyParam)) {
        const typedKey = keyParam as 'index' | 'title' | 'category' | 'description' | 'created' | 'updated';
        setSort({ key: typedKey, direction: dirParam === 'desc' ? 'desc' : 'asc' });
      }
      const exp = searchParams.get('exp');
      if (exp) {
        const ids = exp.split(',').map(v=>parseInt(v,10)).filter(n=>!isNaN(n));
        setExpanded(new Set(ids));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Modal a11y refs (generic HTMLElement for hook compatibility)
  const createModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  const resultsModalRef = useRef<HTMLDivElement>(null);
  const createTitleRef = useRef<HTMLInputElement>(null);
  const createDescRef = useRef<HTMLTextAreaElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const editDescRef = useRef<HTMLTextAreaElement>(null);

  const fetchSurveys = useCallback(async () => {
    try {
      const data = await surveyApi.list();
      setSurveys(data);
    } catch (error) {
      const err = surveyApi.normalizeError(error, 'Failed to load surveys');
      console.error('Error fetching surveys:', error);
      toast.error(`Load failed: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  // Preserve caret position in title during rapid re-renders
  const lastTitleCaret = useRef<number | null>(null);
  const prevTitle = useRef<string>('');
  const lastDescCaret = useRef<number | null>(null);
  useEffect(() => {
    if (!isEditModalOpen) { lastTitleCaret.current = null; prevTitle.current=''; return; }
    const input = editTitleRef.current;
    if (!input) return;
    // Record caret before paint on change
    const handleInput = () => {
      try { lastTitleCaret.current = input.selectionStart ?? null; } catch {}
    };
    input.addEventListener('input', handleInput, { capture: true });
  return () => { input.removeEventListener('input', handleInput, { capture: true }); };
  }, [isEditModalOpen]);

  useEffect(() => {
    if (!isEditModalOpen) return;
    const input = editTitleRef.current;
    if (!input) return;
    if (document.activeElement !== input && lastTitleCaret.current !== null) {
      // Restore focus + caret
      requestAnimationFrame(() => {
        try {
          input.focus({ preventScroll: true });
          const pos = Math.min(lastTitleCaret.current ?? input.value.length, input.value.length);
          input.setSelectionRange(pos, pos);
        } catch {}
      });
    }
  }, [editMeta.title, isEditModalOpen]);

  // Capture description caret
  useEffect(() => {
    if (!isEditModalOpen) { lastDescCaret.current = null; return; }
    const ta = editDescRef.current;
    if (!ta) return;
    const handleInput = () => {
      try { lastDescCaret.current = ta.selectionStart ?? null; } catch {}
    };
    ta.addEventListener('input', handleInput, { capture: true });
    return () => { ta.removeEventListener('input', handleInput, { capture: true }); };
  }, [isEditModalOpen]);

  useEffect(() => {
    if (!isEditModalOpen) return;
    const ta = editDescRef.current;
    if (!ta) return;
    if (document.activeElement !== ta && lastDescCaret.current !== null) {
      requestAnimationFrame(() => {
        try {
          ta.focus({ preventScroll: true });
          const pos = Math.min(lastDescCaret.current ?? ta.value.length, ta.value.length);
          ta.setSelectionRange(pos, pos);
        } catch {}
      });
    }
  }, [editMeta.description, isEditModalOpen]);

  // Focus preservation for create modal - similar to edit modal
  const createTitleCaret = useRef<number | null>(null);
  const createDescCaret = useRef<number | null>(null);

  useEffect(() => {
    if (!isCreateModalOpen) { createTitleCaret.current = null; return; }
    const input = createTitleRef.current;
    if (!input) return;
    const handleInput = () => {
      try { createTitleCaret.current = input.selectionStart ?? null; } catch {}
    };
    input.addEventListener('input', handleInput, { capture: true });
    return () => { input.removeEventListener('input', handleInput, { capture: true }); };
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const input = createTitleRef.current;
    if (!input) return;
    if (document.activeElement !== input && createTitleCaret.current !== null) {
      requestAnimationFrame(() => {
        try {
          input.focus({ preventScroll: true });
          const pos = Math.min(createTitleCaret.current ?? input.value.length, input.value.length);
          input.setSelectionRange(pos, pos);
        } catch {}
      });
    }
  }, [newSurvey.title, isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) { createDescCaret.current = null; return; }
    const ta = createDescRef.current;
    if (!ta) return;
    const handleInput = () => {
      try { createDescCaret.current = ta.selectionStart ?? null; } catch {}
    };
    ta.addEventListener('input', handleInput, { capture: true });
    return () => { ta.removeEventListener('input', handleInput, { capture: true }); };
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) return;
    const ta = createDescRef.current;
    if (!ta) return;
    if (document.activeElement !== ta && createDescCaret.current !== null) {
      requestAnimationFrame(() => {
        try {
          ta.focus({ preventScroll: true });
          const pos = Math.min(createDescCaret.current ?? ta.value.length, ta.value.length);
          ta.setSelectionRange(pos, pos);
        } catch {}
      });
    }
  }, [newSurvey.description, isCreateModalOpen]);

  const handleCreateModalOpen = () => setIsCreateModalOpen(true);
  const handleCreateModalClose = () => setIsCreateModalOpen(false);

  const handleEditModalOpen = (survey: Survey) => {
    setSelectedSurvey(survey);
    setIsEditModalOpen(true);
    // Initialize buffered meta fields
    setEditMeta({ title: survey.title, description: survey.description || '', category: survey.category || '', is_active: survey.is_active });
    const cloned: QuestionDraft[] = survey.questions.map(q => {
      if (q.question_type === 'text') {
        return { id: q.id, question_text: q.question_text, question_type: 'text', options: [] };
      }
      if (q.question_type === 'multiple-choice') {
        return { id: q.id, question_text: q.question_text, question_type: 'multiple-choice', options: Array.isArray(q.options) ? [...q.options] : [] };
      }
      const raw = q.options as { scale?: { min?: number; max?: number } } | undefined;
      const min = raw?.scale?.min ?? 1;
      const max = raw?.scale?.max ?? 5;
      return { id: q.id, question_text: q.question_text, question_type: 'rating', options: { scale: { min, max } } };
    });
    setEditQuestions(cloned);
    setEditOptionInputs(new Array(cloned.length).fill(''));
  };
  const handleEditModalClose = () => {
    setSelectedSurvey(null);
    setIsEditModalOpen(false);
    // Reset buffered meta
    setEditMeta({ title: '', description: '', category: '', is_active: false });
  };

  const handleResultsModalOpen = async (surveyId: number) => {
    try {
      const data = await surveyApi.responses(surveyId);
      setSurveyResults(data);
      setIsResultsModalOpen(true);
    } catch (error) {
      const err = surveyApi.normalizeError(error, 'Failed to load survey results');
      console.error('Error fetching survey results:', error);
      toast.error(`Results failed: ${err.message}`);
    }
  };
  const handleResultsModalClose = () => setIsResultsModalOpen(false);

  // Invoke modal accessibility hook AFTER handlers are defined
  useModalA11y(isCreateModalOpen, createModalRef, handleCreateModalClose);
  useModalA11y(isEditModalOpen, editModalRef, handleEditModalClose);
  useModalA11y(isResultsModalOpen, resultsModalRef, handleResultsModalClose);

  const handleNewSurveyChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewSurvey((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleEditTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditMeta(meta => ({ ...meta, title: e.target.value }));
  }, []);

  const handleEditDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditMeta(meta => ({ ...meta, description: e.target.value }));
  }, []);

  const handleEditCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setEditMeta(meta => ({ ...meta, category: e.target.value }));
  }, []);

  // handleNewQuestionChange removed; handled via <QuestionListEditor />

  const handleAddQuestion = () => {
    setNewSurvey((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion()]
    }));
    setOptionInputs((prev) => [...prev, '']);
    setCreateErrors(prev => ({ ...prev, [newSurvey.questions.length]: 'Question text is required' }));
  };

  const handleRemoveQuestion = (index: number) => {
    const questions = [...newSurvey.questions];
    questions.splice(index, 1);
    setNewSurvey((prev) => ({ ...prev, questions }));
    setOptionInputs(prev => prev.filter((_, i) => i !== index));
    setCreateErrors(prev => {
      const clone = { ...prev }; delete clone[index];
      const remapped: QuestionErrorMap = {};
      questions.forEach((_, i) => { if (clone[i]) remapped[i] = clone[i]; });
      return remapped;
    });
  };

  // Create modal: option handlers
  const handleOptionInputChange = (index: number, value: string) => {
    setOptionInputs(prev => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleAddOption = (index: number) => {
    const value = (optionInputs[index] || '').trim();
    if (!value) return;
    const questions = [...newSurvey.questions];
    const opts = Array.isArray(questions[index].options) ? [...(questions[index].options as string[])] : [];
    if (!opts.includes(value)) opts.push(value);
    questions[index].options = opts;
    setNewSurvey(prev => ({ ...prev, questions }));
    handleOptionInputChange(index, '');
  };

  const handleRemoveOption = (qIdx: number, optValue: string) => {
    const questions = [...newSurvey.questions];
    const opts = Array.isArray(questions[qIdx].options) ? (questions[qIdx].options as string[]).filter(o => o !== optValue) : [];
    questions[qIdx].options = opts;
    setNewSurvey(prev => ({ ...prev, questions }));
  };

  // Rating scale handled inside QuestionListEditor component

  const validateQuestion = (q: QuestionDraft): string | undefined => {
    if (!q.question_text.trim()) return 'Question text is required';
    if (q.question_type === 'multiple-choice' && q.options.length < 2) return 'At least 2 options required';
    if (q.question_type === 'rating') {
      const { min, max } = q.options.scale;
      if (!(Number.isFinite(min) && Number.isFinite(max) && min < max)) return 'Rating scale invalid';
    }
    return undefined;
  };

  const handleCreateSurvey = async () => {
    const errors: QuestionErrorMap = {};
    newSurvey.questions.forEach((q, i) => { const err = validateQuestion(q); if (err) errors[i] = err; });
    setCreateErrors(errors);
    if (Object.values(errors).some(Boolean)) { toast.error('Fix validation errors'); return; }
    const tempId = Math.random();
    const optimistic: Survey = { id: tempId, title: newSurvey.title, description: newSurvey.description, category: newSurvey.category, is_active: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), questions: [] };
    setSurveys(prev => [optimistic, ...prev]);
    try {
      const created = await surveyApi.create({ title: newSurvey.title, description: newSurvey.description, questions: newSurvey.questions.map(toServiceDraft) });
      setSurveys(prev => prev.map(s => s.id === tempId ? created : s));
      toast.success('Survey created');
      handleCreateModalClose();
      setNewSurvey({ title: '', description: '', category: '', questions: [createEmptyQuestion()] });
      setOptionInputs(['']);
      setCreateErrors({});
    } catch (error) {
      setSurveys(prev => prev.filter(s => s.id !== tempId));
      console.error('Error creating survey:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create survey');
    }
  };

  const handleUpdateSurvey = async () => {
    if (!selectedSurvey) return;
    const errors: QuestionErrorMap = {};
    editQuestions.forEach((q, i) => { const err = validateQuestion(q); if (err) errors[i] = err; });
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) { toast.error('Fix validation errors'); return; }
    const original = selectedSurvey;
    // Optimistic meta update using buffered values
    setSurveys(prev => prev.map(s => s.id === original.id ? { ...s, title: editMeta.title, description: editMeta.description, is_active: editMeta.is_active, updated_at: new Date().toISOString() } : s));
    try {
      await surveyApi.updateMeta(original.id, { title: editMeta.title, description: editMeta.description, is_active: editMeta.is_active });
      await surveyApi.bulkUpsertQuestions(original.id, editQuestions.map(toServiceDraft));
      toast.success('Survey updated');
      handleEditModalClose();
      setEditErrors({});
    } catch (error) {
      console.error('Error updating survey:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update survey');
      fetchSurveys();
    }
  };

  // Edit modal question handlers
  // handleEditQuestionChange removed; handled via <QuestionListEditor />

  const handleEditAddQuestion = () => {
    setEditQuestions(prev => [...prev, createEmptyQuestion()]);
    setEditOptionInputs(prev => [...prev, '']);
    setEditErrors(prev => ({ ...prev, [editQuestions.length]: 'Question text is required' }));
  };

  const handleEditRemoveQuestion = (index: number) => {
    setEditQuestions(prev => prev.filter((_, i) => i !== index));
    setEditOptionInputs(prev => prev.filter((_, i) => i !== index));
    setEditErrors(prev => {
      const clone = { ...prev }; delete clone[index];
      const remapped: QuestionErrorMap = {};
      const remaining = editQuestions.filter((_, i) => i !== index);
      remaining.forEach((_, i) => { if (clone[i]) remapped[i] = clone[i]; });
      return remapped;
    });
  };

  const handleEditOptionInputChange = (index: number, value: string) => {
    setEditOptionInputs(prev => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleEditAddOption = (index: number) => {
    const value = (editOptionInputs[index] || '').trim();
    if (!value) return;
    setEditQuestions(prev => prev.map((q, i) => {
      if (i !== index) return q;
      if (q.question_type !== 'multiple-choice') return q;
      const opts = [...q.options];
      if (!opts.includes(value)) opts.push(value);
      return { ...q, options: opts } as MultipleChoiceQuestionDraft;
    }));
    handleEditOptionInputChange(index, '');
  };

  const handleEditRemoveOption = (qIdx: number, optValue: string) => {
    setEditQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      if (q.question_type !== 'multiple-choice') return q;
      const opts = q.options.filter(o => o !== optValue);
      return { ...q, options: opts } as MultipleChoiceQuestionDraft;
    }));
  };

  // Edit rating scale handled inside QuestionListEditor component

  // Derived lists for search and pagination
  const filtered = surveys.filter(s => (
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  ));
  // Maintain a frozen sorted snapshot while editing to avoid reordering on each keystroke
  const frozenSortedRef = useRef<Survey[] | null>(null);
  useEffect(() => {
    if (isEditModalOpen && frozenSortedRef.current == null) {
      const base = [...filtered];
      if (sort.key !== 'index') {
        base.sort((a,b) => {
          let av: string | number = '';
          let bv: string | number = '';
          if (sort.key === 'title') { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
          else if (sort.key === 'category') { av = (a.category || '').toLowerCase(); bv = (b.category || '').toLowerCase(); }
          else if (sort.key === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase(); }
          else if (sort.key === 'created') { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); }
          else if (sort.key === 'updated') { av = new Date(a.updated_at).getTime(); bv = new Date(b.updated_at).getTime(); }
          if (av < bv) return sort.direction === 'asc' ? -1 : 1;
          if (av > bv) return sort.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
      frozenSortedRef.current = base;
    }
    if (!isEditModalOpen) {
      frozenSortedRef.current = null; // release snapshot when closing
    }
  }, [isEditModalOpen, filtered, sort]);

  const sorted = (() => {
    if (isEditModalOpen && frozenSortedRef.current) return frozenSortedRef.current;
    const arr = [...filtered];
    if (sort.key !== 'index') {
      arr.sort((a,b) => {
        let av: string | number = '';
        let bv: string | number = '';
        if (sort.key === 'title') { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
        else if (sort.key === 'category') { av = (a.category || '').toLowerCase(); bv = (b.category || '').toLowerCase(); }
        else if (sort.key === 'description') { av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase(); }
        else if (sort.key === 'created') { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); }
        else if (sort.key === 'updated') { av = new Date(a.updated_at).getTime(); bv = new Date(b.updated_at).getTime(); }
        if (av < bv) return sort.direction === 'asc' ? -1 : 1;
        if (av > bv) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return arr;
  })();
  const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = sorted.slice(start, start + ITEMS_PER_PAGE);

  // Track pending sync state instead of mutating router during render cycle
  const pendingSortRef = useRef(sort);
  const pendingExpandedRef = useRef(expanded);
  useEffect(() => { pendingSortRef.current = sort; }, [sort]);
  useEffect(() => { pendingExpandedRef.current = expanded; }, [expanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isEditModalOpen) return; // defer while editing
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      params.set('sortKey', pendingSortRef.current.key);
      params.set('sortDir', pendingSortRef.current.direction);
      if (pendingExpandedRef.current.size) params.set('exp', [...pendingExpandedRef.current].join(',')); else params.delete('exp');
      const newQs = params.toString();
      const target = `?${newQs}`;
      // Avoid redundant router calls
      if (window.location.search !== target.replace(/^\?/, '?')) {
        router.replace(target);
      }
    }, 50); // small debounce to collapse rapid interactions
    return () => window.clearTimeout(handle);
  }, [sort, expanded, isEditModalOpen, router]);

  const cycleSort = (key: 'index' | 'title' | 'category' | 'description' | 'created' | 'updated') => {
    setCurrentPage(1);
    setSort(prev => {
      let next: { key: typeof key | 'index'; direction: 'asc' | 'desc' };
      if (prev.key !== key) next = { key, direction: 'asc' };
      else if (prev.direction === 'asc') next = { key, direction: 'desc' };
      else next = { key: 'index', direction: 'asc' };
      return next;
    });
  };

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDeleteSurvey = async (surveyId: number) => {
    if (!confirm('Delete this survey permanently?')) return;
    const previous = surveys;
    setSurveys(s => s.filter(sv => sv.id !== surveyId));
    try {
      await surveyApi.remove(surveyId);
      toast.success('Survey deleted');
    } catch (error) {
      setSurveys(previous);
      const err = surveyApi.normalizeError(error, 'Failed to delete survey');
      console.error('Error deleting survey:', error);
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const handleToggleSurveyActive = async (survey: Survey) => {
    const previous = surveys;
    const next = !survey.is_active;
    setSurveys(s => s.map(sv => sv.id === survey.id ? { ...sv, is_active: next } : sv));
    try {
      await surveyApi.toggleActive(survey.id, next);
      toast.success(`Survey ${next ? 'activated' : 'deactivated'}`);
    } catch (error) {
      setSurveys(previous);
      const err = surveyApi.normalizeError(error, 'Failed to update status');
      console.error('Error toggling survey status:', error);
      toast.error(`Status update failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Survey Management</h1>
          <p className="text-sm text-gray-300">Create, edit, and review surveys shared with students.</p>
        </div>
        <Button onClick={handleCreateModalOpen} variant="primaryGold" className="inline-flex items-center">
          <FiPlus className="h-4 w-4 mr-2" />
          Create Survey
        </Button>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
        <div className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search surveys by title or description..."
              className="w-full px-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
            />
          </div>
        </div>
        {/* Mobile / small screen card list */}
        <div className="md:hidden px-4 pb-4 space-y-3">
          {paginated.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-6">No surveys found.</div>
          )}
          {paginated.map((survey, idx) => (
            <div
              key={survey.id}
              className="bg-white/5 border border-white/15 rounded-lg p-4 shadow-sm hover:shadow transition-shadow focus-within:ring-2 focus-within:ring-[#FFCA40]/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-gray-500 bg-white/10 px-1.5 py-0.5 rounded">{start + idx + 1}</span>
                    <h3 className="text-sm font-semibold text-white break-words" title={survey.title}>{survey.title}</h3>
                  </div>
                  {survey.description && (
                    <p className="text-xs text-gray-400 mt-1 break-words whitespace-pre-wrap" title={survey.description}>{survey.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-wide text-gray-400">
                    <span>{survey.questions.length} q</span>
                    <span className="w-1 h-1 rounded-full bg-gray-500" />
                    <span>{survey.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  <button
                    type="button"
                    onClick={() => handleToggleSurveyActive(survey)}
                    className={`inline-flex items-center px-2 py-1 text-[10px] rounded-md border transition-colors ${survey.is_active ? 'bg-green-700/25 border-green-500/50 text-green-200' : 'bg-gray-700/25 border-gray-500/50 text-gray-300'}`}
                    aria-label={survey.is_active ? 'Set survey inactive' : 'Set survey active'}
                  >
                    {survey.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <div className="scale-90 origin-top-right">
                  <SurveyRowActions
                    isActive={survey.is_active}
                    onToggleActive={() => handleToggleSurveyActive(survey)}
                    onEdit={() => handleEditModalOpen(survey)}
                    onViewResponses={() => handleResultsModalOpen(survey.id)}
                    onOpenFullEditor={() => window.location.assign(`/admin/surveys/${survey.id}/edit`)}
                    onAnalytics={() => window.location.assign(`/admin/surveys/${survey.id}/analytics`)}
                    onDelete={() => handleDeleteSurvey(survey.id)}
                    hideToggle
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto max-h-[60vh] bg-white/5 rounded-lg border border-white/10">
          <table className="min-w-full divide-y divide-white/20 table-fixed">
            <thead className="bg-white/10 sticky top-0 z-20 backdrop-blur-md border-b border-white/20">
              <tr>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[4%]">
                  <button type="button" onClick={() => cycleSort('index')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    #
                    {sort.key === 'index' ? null : (
                      <span className="text-[9px] text-gray-400 group-hover:text-gray-300">×</span>
                    )}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[20%]">
                  <button type="button" onClick={() => cycleSort('title')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    Title
                    {sort.key === 'title' && <span className="text-[9px] text-gray-400 group-hover:text-gray-300">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[15%]">
                  <button type="button" onClick={() => cycleSort('category')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    Category
                    {sort.key === 'category' && <span className="text-[9px] text-gray-400 group-hover:text-gray-300">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  <button type="button" onClick={() => cycleSort('description')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    Description
                    {sort.key === 'description' && <span className="text-[9px] text-gray-400 group-hover:text-gray-300">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[13%]">
                  <button type="button" onClick={() => cycleSort('created')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    Created
                    {sort.key === 'created' && <span className="text-[9px] text-gray-400 group-hover:text-gray-300">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[13%]">
                  <button type="button" onClick={() => cycleSort('updated')} className="flex items-center gap-1 group focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1">
                    Updated
                    {sort.key === 'updated' && <span className="text-[9px] text-gray-400 group-hover:text-gray-300">{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
                <th className="px-3 lg:px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider w-[17%]">Actions</th>
              </tr>
            </thead>
             <tbody className="bg-white/[0.02] divide-y divide-white/10 relative z-0">
               {paginated.length === 0 && (
                 <tr>
                   <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">No surveys found. Adjust your search or create a new survey.</td>
                 </tr>
               )}
               {paginated.map((survey, idx) => {
                 const isExpanded = expanded.has(survey.id);
                 const long = (survey.description || '').length > 240;
                 const displayDesc = long && !isExpanded ? (survey.description || '').slice(0,240) + '…' : (survey.description || '');
                 return (
                 <tr key={survey.id} className="align-top hover:bg-white/5 transition-colors relative">
                  <td className="px-3 lg:px-4 py-4 text-[11px] text-gray-400 font-mono">
                    <button
                      type="button"
                      onClick={() => cycleSort('index')}
                      className="focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1 -mx-1"
                      aria-label={`Row number ${start + 1 + idx}`}
                    >
                      {start + 1 + idx}
                    </button>
                  </td>
                  <td className="px-3 lg:px-4 py-4 text-sm font-medium text-white">
                    <div className="pr-2 break-words leading-snug">{survey.title}</div>
                  </td>
                  <td className="px-3 lg:px-4 py-4 text-sm text-gray-300">
                    <div className="pr-2 break-words leading-snug">
                      {survey.category ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-200 border border-blue-500/30">
                          {survey.category}
                        </span>
                      ) : (
                        <span className="italic text-gray-500 text-xs">No category</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 lg:px-4 py-4 text-sm text-gray-300">
                    <div className="prose prose-invert max-w-none whitespace-pre-wrap break-words leading-snug text-[13px]">
                      {displayDesc ? displayDesc : <span className="italic text-gray-500">No description</span>}
                    </div>
                    {long && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(survey.id)}
                        className="mt-1 text-[11px] text-[#FFCA40] hover:underline focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/60 rounded px-1"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse full description' : 'Expand full description'}
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 lg:px-4 py-4 text-xs text-gray-400 whitespace-nowrap align-top">{formatTimestamp(survey.created_at as unknown as string)}</td>
                  <td className="px-3 lg:px-4 py-4 text-xs text-gray-400 whitespace-nowrap align-top">{formatTimestamp(survey.updated_at as unknown as string)}</td>
                  <td className="px-3 lg:px-4 py-4 text-right text-sm font-medium">
                    <div className="flex items-start justify-end gap-2">
                      <div className="mr-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSurveyActive(survey)}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FFCA40]/60 focus:ring-offset-[#1c1f26] ${survey.is_active ? 'bg-green-700/25 border-green-500/50 text-green-200 hover:bg-green-700/35' : 'bg-gray-700/25 border-gray-500/50 text-gray-300 hover:bg-gray-700/35'}`}
                          data-state={survey.is_active ? 'on' : 'off'}
                          aria-label={survey.is_active ? 'Set survey inactive' : 'Set survey active'}
                        >
                          {survey.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                      <div className="w-px h-8 bg-white/10" aria-hidden="true" />
                      <SurveyRowActions
                        isActive={survey.is_active}
                        onToggleActive={() => handleToggleSurveyActive(survey)}
                        onEdit={() => handleEditModalOpen(survey)}
                        onViewResponses={() => handleResultsModalOpen(survey.id)}
                        onOpenFullEditor={() => window.location.assign(`/admin/surveys/${survey.id}/edit`)}
                        onAnalytics={() => window.location.assign(`/admin/surveys/${survey.id}/analytics`)}
                        onDelete={() => handleDeleteSurvey(survey.id)}
                        hideToggle
                      />
                    </div>
                  </td>
                </tr>
                );})}
            </tbody>
          </table>
        </div>
        {/* Pagination controls */}
        <div className="p-4 flex items-center justify-center gap-2">
          <Button variant="outline" className="text-white" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</Button>
          <span className="text-sm text-gray-300">Page {currentPage} of {totalPages}</span>
          <Button variant="outline" className="text-white" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</Button>
        </div>
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleCreateModalClose}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-survey-title"
              ref={createModalRef}
              tabIndex={-1}
            >
              <div className="px-6 py-4 border-b border-white/20">
                <h3 id="create-survey-title" className="text-lg font-medium text-white">Create New Survey</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-300">Title</label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={newSurvey.title}
                    onChange={handleNewSurveyChange}
                    ref={createTitleRef}
                    required
                    className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="category" className="block text-sm font-medium text-gray-300">Category</label>
                  <select
                    key="create-category-select"
                    id="category"
                    name="category"
                    value={newSurvey.category}
                    onChange={handleNewSurveyChange}
                    className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  >
                    <option value="" className="bg-[#1c1f26] text-gray-300">Select category</option>
                    {surveyCategoryOptions.map((category) => (
                      <option key={category} value={category} className="bg-[#1c1f26] text-gray-100">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={newSurvey.description}
                    onChange={handleNewSurveyChange}
                    ref={createDescRef}
                    className="w-full min-h-[120px] p-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <h4 className="text-md font-medium text-white mb-2">Questions</h4>
                  <QuestionListEditor
                    questions={newSurvey.questions}
                    optionInputs={optionInputs}
                    errors={createErrors}
                    mode="create"
                    onQuestionsChange={(updated) => {
                      // Directly adopt updated array to preserve object identity for unaffected questions
                      setNewSurvey(prev => ({ ...prev, questions: updated }));
                      setCreateErrors(() => {
                        const errs: QuestionErrorMap = {};
                        updated.forEach((q,i)=>{ if(!q.question_text.trim()) errs[i] = 'Question text is required'; });
                        return errs;
                      });
                    }}
                    onOptionInputsChange={setOptionInputs}
                    onAddQuestion={handleAddQuestion}
                    onRemoveQuestion={handleRemoveQuestion}
                    onAddOption={handleAddOption}
                    onRemoveOption={handleRemoveOption}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/20 flex justify-end space-x-3">
                <Button onClick={handleCreateModalClose} type="button" variant="outline" className="text-white">Cancel</Button>
                <Button onClick={handleCreateSurvey} type="button" variant="primaryGold">Create</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && selectedSurvey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleEditModalClose}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-survey-title"
              ref={editModalRef}
              tabIndex={-1}
            >
              <div className="px-6 py-4 border-b border-white/20">
                <h3 id="edit-survey-title" className="text-lg font-medium text-white">Edit Survey</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label htmlFor="edit-title" className="block text-sm font-medium text-gray-300">Title</label>
                  <input
                    key="edit-title-input"
                    id="edit-title"
                    name="title"
                    type="text"
                    value={editMeta.title}
                    onChange={handleEditTitleChange}
                    required
                    ref={editTitleRef}
                    className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-category" className="block text-sm font-medium text-gray-300">Category</label>
                  <select
                    key="edit-category-select"
                    id="edit-category"
                    name="category"
                    value={editMeta.category}
                    onChange={handleEditCategoryChange}
                    className="w-full pl-3 pr-3 py-2 bg-white/8 border border-white/15 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  >
                    <option value="" className="bg-[#1c1f26] text-gray-300">Select category</option>
                    {surveyCategoryOptions.map((category) => (
                      <option key={category} value={category} className="bg-[#1c1f26] text-gray-100">
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Description</label>
                  <Textarea
                    key="edit-description-textarea"
                    value={editMeta.description}
                    onChange={handleEditDescriptionChange}
                    // debug handlers removed
                    ref={editDescRef}
                    className="w-full min-h-[120px] p-3 bg-white/8 border border-white/15 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-[#FFCA40]/50 outline-none transition-all duration-300 backdrop-blur-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editMeta.is_active}
                      onChange={(e) => setEditMeta(meta => ({ ...meta, is_active: e.target.checked }))}
                      className="h-4 w-4 text-[#FFCA40] focus:ring-[#FFCA40] bg-white/10 border-white/20 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-300">Active</span>
                  </label>
                </div>
                <div>
                  <h4 className="text-md font-medium text-white mb-2">Questions</h4>
                  <QuestionListEditor
                    questions={editQuestions}
                    optionInputs={editOptionInputs}
                    errors={editErrors}
                    mode="edit"
                    onQuestionsChange={(updated) => {
                      setEditQuestions(updated);
                      setEditErrors(() => {
                        const errs: QuestionErrorMap = {};
                        updated.forEach((q,i)=>{ if(!q.question_text.trim()) errs[i] = 'Question text is required'; });
                        return errs;
                      });
                    }}
                    onOptionInputsChange={setEditOptionInputs}
                    onAddQuestion={handleEditAddQuestion}
                    onRemoveQuestion={handleEditRemoveQuestion}
                    onAddOption={handleEditAddOption}
                    onRemoveOption={handleEditRemoveOption}
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/20 flex justify-end space-x-3">
                <Button onClick={handleEditModalClose} type="button" variant="outline" className="text-white">Cancel</Button>
                <Button onClick={handleUpdateSurvey} type="button" variant="primaryGold">Update</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isResultsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={handleResultsModalClose}
            role="presentation"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="results-survey-title"
              ref={resultsModalRef}
              tabIndex={-1}
            >
              <div className="px-6 py-4 border-b border-white/20">
                <h3 id="results-survey-title" className="text-lg font-medium text-white">Survey Results</h3>
              </div>
              <div className="p-6">
                {surveyResults.length > 0 ? (
                  <div className="space-y-4">
                    {surveyResults.map((response) => (
                      <div key={response.id} className="p-4 border border-white/20 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium text-white">User ID: {response.user_id}</p>
                          <p className="text-xs text-gray-400">{new Date(response.created_at).toLocaleString()}</p>
                        </div>
                        <div className="space-y-2">
                          {response.answers.map((answer) => (
                            <div key={answer.id}>
                              <p className="text-sm font-medium text-gray-300">{answer.question_text}</p>
                              <p className="text-sm text-white">{answer.answer_text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400">No results found for this survey.</p>
                )}
              </div>
              <div className="px-6 py-4 border-t border-white/20 flex justify-end">
                <Button onClick={handleResultsModalClose} type="button" variant="outline" className="text-white">Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
