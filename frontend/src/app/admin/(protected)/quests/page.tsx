'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiZap,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiEdit2,
  FiCheck,
  FiX,
  FiClock,
  FiToggleLeft,
  FiToggleRight,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

import { useAdminSessionGuard } from '@/hooks/useAdminSessionGuard';
import {
  createQuestTemplate,
  fetchQuestTemplates,
  toggleQuestTemplateActivation,
  updateQuestTemplate,
} from '@/services/adminQuestApi';
import type { QuestTemplate, QuestTemplateCreateRequest } from '@/types/admin/quests';

const QUEST_CATEGORIES = ['wellness', 'reflection', 'social', 'support', 'learning'] as const;
const QUEST_DIFFICULTIES = ['easy', 'standard', 'challenge'] as const;

type FormState = QuestTemplateCreateRequest & { extra_data_text: string };

const defaultForm: FormState = {
  code: '',
  name: '',
  short_description: '',
  long_description: '',
  category: 'wellness',
  difficulty: 'standard',
  recommended_duration_minutes: 10,
  base_xp: 25,
  base_joy: 5,
  base_harmony: 5,
  extra_data: {},
  extra_data_text: '{\n  "action_type": "journal"\n}',
};

export default function AdminQuestTemplatesPage() {
  const { isLoading, isValid } = useAdminSessionGuard();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [formState, setFormState] = useState<FormState>(defaultForm);
  const [editingTemplate, setEditingTemplate] = useState<QuestTemplate | null>(null);

  const queryKey = useMemo(
    () => ['admin-quest-templates', search, includeInactive, categoryFilter, difficultyFilter],
    [search, includeInactive, categoryFilter, difficultyFilter],
  );

  const templatesQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchQuestTemplates({
        search: search || undefined,
        includeInactive,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        difficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createQuestTemplate,
    onSuccess: () => {
      toast.success('Quest template created');
      queryClient.invalidateQueries({ queryKey });
      resetForm();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
            'Failed to create quest template'
          : 'Failed to create quest template';
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      updateQuestTemplate(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Quest template updated');
      queryClient.invalidateQueries({ queryKey });
      if (editingTemplate && editingTemplate.id === variables.id) {
        resetForm();
      }
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
            'Failed to update quest template'
          : 'Failed to update quest template';
      toast.error(message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, activate }: { id: number; activate: boolean }) =>
      toggleQuestTemplateActivation(id, activate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error('Failed to update activation status');
    },
  });

  if (isLoading || !isValid) {
    return null;
  }

  const handleEdit = (template: QuestTemplate) => {
    setEditingTemplate(template);
    setFormState({
      code: template.code,
      name: template.name,
      short_description: template.short_description,
      long_description: template.long_description ?? '',
      category: template.category,
      difficulty: template.difficulty,
      recommended_duration_minutes: template.recommended_duration_minutes,
      base_xp: template.base_xp,
      base_joy: template.base_joy,
      base_harmony: template.base_harmony,
      extra_data: template.extra_data,
      extra_data_text: JSON.stringify(template.extra_data ?? {}, null, 2),
    });
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormState(defaultForm);
  };

  const parseExtraData = (value: string): Record<string, unknown> | null => {
    if (!value.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast.error('Extra metadata must be a JSON object');
        return null;
      }
      return parsed;
    } catch (error: unknown) {
      console.error(error);
      toast.error('Invalid JSON in extra metadata');
      return null;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const extraData = parseExtraData(formState.extra_data_text);
    if (!extraData) return;

    const payload = {
      name: formState.name,
      short_description: formState.short_description,
      long_description: formState.long_description || undefined,
      category: formState.category,
      difficulty: formState.difficulty,
      recommended_duration_minutes: formState.recommended_duration_minutes,
      base_xp: formState.base_xp,
      base_joy: formState.base_joy,
      base_harmony: formState.base_harmony,
      extra_data: extraData,
    };

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        payload,
      });
    } else {
      createMutation.mutate({
        ...payload,
        code: formState.code.trim(),
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#041a3c] via-[#001d58] to-[#041a3c] px-6 py-8 text-white shadow-[0_20px_45px_rgba(4,18,44,0.45)]">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/60">
              <FiZap className="h-4 w-4 text-[#FFCA40]" />
              Quest Engine
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Quest Templates</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Create and manage quest templates used across the AICare Quest system. Configure metadata that defines
              required actions, rewards, and campaign behaviour.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-[#00153a]/25 backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {editingTemplate ? 'Edit Quest Template' : 'Create Quest Template'}
            </h2>
            {editingTemplate ? (
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              >
                <FiRefreshCw className="h-3 w-3" />
                Reset
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs uppercase tracking-wide text-white/50">
            Define the metadata and rewards for this quest.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {!editingTemplate && (
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Template Code</label>
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  placeholder="daily_reflection"
                  value={formState.code}
                  onChange={(event) => setFormState((prev) => ({ ...prev, code: event.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wide text-white/50">Title</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                placeholder="Morning Reflection"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-white/50">Short Description</label>
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                placeholder="Write three sentences about how you feel today."
                value={formState.short_description}
                onChange={(event) => setFormState((prev) => ({ ...prev, short_description: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-white/50">Long Description</label>
              <textarea
                className="mt-1 h-20 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                placeholder="Describe the intent of this quest in more detail."
                value={formState.long_description}
                onChange={(event) => setFormState((prev) => ({ ...prev, long_description: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Category</label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.category}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      category: event.target.value as (typeof QUEST_CATEGORIES)[number],
                    }))
                  }
                >
                  {QUEST_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Difficulty</label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.difficulty}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      difficulty: event.target.value as (typeof QUEST_DIFFICULTIES)[number],
                    }))
                  }
                >
                  {QUEST_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={240}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.recommended_duration_minutes}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      recommended_duration_minutes: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Base XP</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.base_xp}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      base_xp: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Base JOY</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.base_joy}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      base_joy: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Base Harmony</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                  value={formState.base_harmony}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      base_harmony: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-white/50">Extra Metadata (JSON)</label>
                <textarea
                  className="mt-1 h-24 w-full rounded-xl border border-white/15 bg-[#021230] px-3 py-2 font-mono text-xs text-[#FFCA40] focus:border-[#FFCA40] focus:outline-none"
                  value={formState.extra_data_text}
                  onChange={(event) => setFormState((prev) => ({ ...prev, extra_data_text: event.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFCA40] to-[#FFB347] px-4 py-2 text-sm font-semibold text-[#001d58] shadow-[0_12px_30px_rgba(255,202,64,0.35)] transition hover:shadow-[0_16px_35px_rgba(255,202,64,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#FFCA40]/60 focus-visible:ring-offset-[#00112e]"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? <FiCheck className="h-4 w-4" /> : <FiPlus className="h-4 w-4" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </button>
          </form>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-3xl border border-white/10 bg-[#010c20]/70 p-6 shadow-lg shadow-[#00153a]/25 backdrop-blur"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Template Library</h2>
              <p className="text-xs uppercase tracking-wide text-white/50">
                {templatesQuery.data?.length ?? 0} templates
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-xl border border-white/15 bg-[#021230] px-3">
                <FiSearch className="mr-2 text-white/40" />
                <input
                  className="w-40 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/40"
                  placeholder="Search templates"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                className="rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">All Categories</option>
                {QUEST_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-white/15 bg-[#021230] px-3 py-2 text-sm text-white focus:border-[#FFCA40] focus:outline-none"
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
              >
                <option value="all">All Difficulties</option>
                {QUEST_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty.toUpperCase()}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white">
                <input
                  type="checkbox"
                  className="accent-[#FFCA40]"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                />
                Show inactive
              </label>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {templatesQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-white/60">
                <FiClock className="mr-2 animate-spin text-[#FFCA40]" />
                Loading quest templates...
              </div>
            ) : templatesQuery.isError ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-sm text-red-200">
                Failed to load quest templates. Please try again.
              </div>
            ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
              templatesQuery.data.map((template) => (
                <div
                  key={template.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-[#00153a]/20 transition hover:border-[#FFCA40]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
                          {template.code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            template.is_active
                              ? 'border border-emerald-400/50 bg-emerald-400/10 text-emerald-200'
                              : 'border border-white/10 bg-white/5 text-white/50'
                          }`}
                        >
                          {template.is_active ? (
                            <>
                              <FiToggleRight className="h-3 w-3" /> Active
                            </>
                          ) : (
                            <>
                              <FiToggleLeft className="h-3 w-3" /> Inactive
                            </>
                          )}
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-white">{template.name}</h3>
                      <p className="mt-1 text-sm text-white/70">{template.short_description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          toggleMutation.mutate({ id: template.id, activate: !template.is_active })
                        }
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          template.is_active
                            ? 'border border-red-400/40 text-red-300 hover:border-red-300 hover:text-red-200'
                            : 'border border-emerald-400/40 text-emerald-300 hover:border-emerald-300 hover:text-emerald-200'
                        }`}
                      >
                        {template.is_active ? <FiX className="h-3.5 w-3.5" /> : <FiCheck className="h-3.5 w-3.5" />}
                        {template.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70">
                      <p className="uppercase tracking-wide text-white/40">Category</p>
                      <p className="mt-1 text-sm font-semibold text-white">{template.category.toUpperCase()}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70">
                      <p className="uppercase tracking-wide text-white/40">Difficulty</p>
                      <p className="mt-1 text-sm font-semibold text-white">{template.difficulty.toUpperCase()}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70">
                      <p className="uppercase tracking-wide text-white/40">Duration</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {template.recommended_duration_minutes} min
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/70">
                      <p className="uppercase tracking-wide text-white/40">Rewards</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {template.base_xp} XP • {template.base_joy} JOY • {template.base_harmony} Harmony
                      </p>
                    </div>
                  </div>

                  {template.extra_data && Object.keys(template.extra_data).length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-[#010c20]/80 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-white/40">Metadata</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[#FFCA40]/90">
                        {JSON.stringify(template.extra_data, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-white/60">
                No quest templates found for the current filters.
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}




