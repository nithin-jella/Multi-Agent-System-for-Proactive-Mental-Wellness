/**
 * Admin Flagged Chats Page
 * Flagged sessions that build up into patient history / summary / facts
 * Features: summary stats, category tags, status filters, search, quick status changes, bulk ops
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FiFlag, FiSearch, FiEye, FiCheckCircle, FiAlertCircle,
  FiClock, FiMessageSquare, FiRefreshCw, FiChevronDown,
} from 'react-icons/fi';

// Predefined category system for clinical flagging
const FLAG_CATEGORIES = [
  { value: 'risk_indicator', label: 'Risk Indicator', color: 'red' },
  { value: 'behavioral_pattern', label: 'Behavioral Pattern', color: 'orange' },
  { value: 'treatment_progress', label: 'Treatment Progress', color: 'blue' },
  { value: 'support_need', label: 'Support Need', color: 'purple' },
  { value: 'safety_concern', label: 'Safety Concern', color: 'red' },
  { value: 'positive_milestone', label: 'Positive Milestone', color: 'green' },
] as const;

type CategoryValue = typeof FLAG_CATEGORIES[number]['value'];

const CATEGORY_COLORS: Record<string, string> = {
  red: 'bg-red-500/20 border-red-500/30 text-red-300',
  orange: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
  blue: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  purple: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
  green: 'bg-green-500/20 border-green-500/30 text-green-300',
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  open: { icon: <FiAlertCircle size={14} />, color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  reviewing: { icon: <FiEye size={14} />, color: 'text-blue-300', bg: 'bg-blue-500/20 border-blue-500/30' },
  resolved: { icon: <FiCheckCircle size={14} />, color: 'text-green-300', bg: 'bg-green-500/20 border-green-500/30' },
};

interface FlagItem {
  id: number;
  session_id: string;
  user_id?: number | null;
  reason?: string | null;
  status: string;
  flagged_by_admin_id?: number | null;
  created_at: string;
  updated_at: string;
  tags?: string[] | null;
  notes?: string | null;
}

interface FlagSummary {
  open_count: number;
  recent: FlagItem[];
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const [summary, setSummary] = useState<FlagSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch flags list
  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
      const data = await apiCall<FlagItem[]>(`/api/v1/admin/flags${q}`);
      setFlags(data);
      setSelected({});
    } catch (err) {
      console.error('Failed to load flags:', err);
      toast.error('Failed to load flags');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch summary stats
  const loadSummary = useCallback(async () => {
    try {
      const data = await apiCall<FlagSummary>(`/api/v1/admin/flags/summary`);
      setSummary(data);
    } catch {
      // Non-critical, silently fail
    }
  }, []);

  useEffect(() => { void loadFlags(); }, [loadFlags]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const updateFlag = async (id: number, payload: Partial<FlagItem>) => {
    try {
      await apiCall<FlagItem>(`/api/v1/admin/flags/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: payload.status,
          reason: payload.reason,
          tags: payload.tags,
          notes: payload.notes,
        }),
      });
      await loadFlags();
      await loadSummary();
      toast.success('Flag updated');
    } catch (err) {
      console.error('Failed to update flag:', err);
      toast.error('Failed to update flag');
    }
  };

  // Quick status cycle: open -> reviewing -> resolved
  const cycleStatus = (flag: FlagItem) => {
    const order = ['open', 'reviewing', 'resolved'];
    const idx = order.indexOf(flag.status);
    const next = order[(idx + 1) % order.length];
    updateFlag(flag.id, { status: next });
  };

  // Add a predefined category tag
  const addCategoryTag = (flag: FlagItem, category: CategoryValue) => {
    const currentTags = flag.tags || [];
    if (currentTags.includes(category)) return;
    updateFlag(flag.id, { tags: [...currentTags, category] });
  };

  // Remove a tag
  const removeTag = (flag: FlagItem, tag: string) => {
    const currentTags = flag.tags || [];
    updateFlag(flag.id, { tags: currentTags.filter(t => t !== tag) });
  };

  // Filtered flags (client-side search + category filter)
  const filteredFlags = useMemo(() => {
    let result = flags;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.session_id.toLowerCase().includes(q) ||
        f.reason?.toLowerCase().includes(q) ||
        f.notes?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter(f => f.tags?.includes(categoryFilter));
    }
    return result;
  }, [flags, searchQuery, categoryFilter]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
    [selected]
  );
  const allSelected = filteredFlags.length > 0 && selectedIds.length === filteredFlags.length;
  const anySelected = selectedIds.length > 0;

  const toggleAll = (value: boolean) => {
    const next: Record<number, boolean> = {};
    if (value) filteredFlags.forEach(f => { next[f.id] = true; });
    setSelected(next);
  };

  const bulkClose = async () => {
    if (!anySelected) return;
    if (!confirm(`Close ${selectedIds.length} selected flag(s) as resolved?`)) return;
    try {
      await apiCall(`/api/v1/admin/flags/bulk-close`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, status: 'resolved' }),
      });
      toast.success(`${selectedIds.length} flag(s) closed`);
      await loadFlags();
      await loadSummary();
    } catch (err) {
      console.error('Failed to bulk close flags:', err);
      toast.error('Failed to close selected flags');
    }
  };

  const bulkAddTag = async () => {
    if (!anySelected) return;
    const tag = prompt('Tag to add to selected flags:')?.trim();
    if (!tag) return;
    try {
      await apiCall(`/api/v1/admin/flags/bulk-tag`, {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds, tags: [tag], mode: 'add' }),
      });
      toast.success(`Tag "${tag}" added to ${selectedIds.length} flag(s)`);
      await loadFlags();
    } catch (err) {
      console.error('Failed to bulk add tag:', err);
      toast.error('Failed to add tag to selected flags');
    }
  };

  // Count stats from current data
  const openCount = summary?.open_count ?? flags.filter(f => f.status === 'open').length;
  const reviewingCount = flags.filter(f => f.status === 'reviewing').length;
  const resolvedCount = flags.filter(f => f.status === 'resolved').length;

  return (
    <div className="space-y-5 px-1">
      {/* Header + Summary Stats */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FiFlag className="text-[#FFCA40]" size={22} />
            <h1 className="text-2xl font-bold text-white">Flagged Chats</h1>
            <span className="px-2.5 py-0.5 bg-white/10 border border-white/20 text-white/70 text-xs font-semibold rounded-full">
              {flags.length} total
            </span>
          </div>
          <button
            onClick={() => { void loadFlags(); void loadSummary(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <FiRefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Summary stat pills */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <FiAlertCircle className="text-yellow-400" size={15} />
            <span className="text-white/50">Open:</span>
            <span className="text-white font-semibold">{openCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FiEye className="text-blue-400" size={15} />
            <span className="text-white/50">Reviewing:</span>
            <span className="text-white font-semibold">{reviewingCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FiCheckCircle className="text-green-400" size={15} />
            <span className="text-white/50">Resolved:</span>
            <span className="text-white font-semibold">{resolvedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={15} />
          <input
            type="text"
            placeholder="Search by session ID, reason, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="" className="bg-gray-800">All Statuses</option>
            <option value="open" className="bg-gray-800">Open</option>
            <option value="reviewing" className="bg-gray-800">Reviewing</option>
            <option value="resolved" className="bg-gray-800">Resolved</option>
          </select>
          <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="" className="bg-gray-800">All Categories</option>
            {FLAG_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value} className="bg-gray-800">{cat.label}</option>
            ))}
          </select>
          <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" size={14} />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
              className="rounded"
            />
            Select all
          </label>
          {anySelected && (
            <span className="text-xs text-white/50">{selectedIds.length} selected</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-white text-xs" disabled={!anySelected} onClick={bulkClose}>
            Close Selected
          </Button>
          <Button variant="outline" className="text-white text-xs" disabled={!anySelected} onClick={bulkAddTag}>
            Add Tag
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredFlags.length === 0 && (
        <div className="text-center py-12 bg-white/5 border border-white/10 rounded-xl">
          <FiFlag className="mx-auto text-white/20 mb-3" size={40} />
          <p className="text-white/40 text-sm">
            {flags.length === 0 ? 'No flagged sessions yet.' : 'No flags match your current filters.'}
          </p>
        </div>
      )}

      {/* Flag Cards */}
      {!loading && (
        <div className="space-y-3">
          {filteredFlags.map((f) => {
            const statusCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.open;
            const isExpanded = expandedId === f.id;
            const categoryTags = (f.tags || []).filter(t => FLAG_CATEGORIES.some(c => c.value === t));
            const customTags = (f.tags || []).filter(t => !FLAG_CATEGORIES.some(c => c.value === t));

            return (
              <div
                key={f.id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden"
              >
                {/* Card Header Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={!!selected[f.id]}
                    onChange={(e) => setSelected(prev => ({ ...prev, [f.id]: e.target.checked }))}
                    className="rounded shrink-0"
                    aria-label={`Select flag ${f.id}`}
                  />

                  {/* Status badge (clickable to cycle) */}
                  <button
                    onClick={() => cycleStatus(f)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border transition-colors hover:opacity-80 ${statusCfg.bg} ${statusCfg.color}`}
                    title={`Click to change status (current: ${f.status})`}
                  >
                    {statusCfg.icon}
                    {f.status}
                  </button>

                  {/* Session info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-mono text-sm truncate">
                      ...{f.session_id.slice(-10)}
                    </span>
                    <span className="text-white/30 text-xs hidden sm:inline">
                      #{f.id}
                    </span>
                  </div>

                  {/* Category pills */}
                  <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                    {categoryTags.map(tag => {
                      const cat = FLAG_CATEGORIES.find(c => c.value === tag);
                      const colorClass = cat ? CATEGORY_COLORS[cat.color] : 'bg-white/10 border-white/20 text-white/60';
                      return (
                        <span
                          key={tag}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${colorClass}`}
                        >
                          {cat?.label || tag}
                          <button onClick={() => removeTag(f, tag)} className="hover:opacity-70">x</button>
                        </span>
                      );
                    })}
                    {customTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border bg-white/10 border-white/20 text-white/60"
                      >
                        {tag}
                        <button onClick={() => removeTag(f, tag)} className="hover:opacity-70">x</button>
                      </span>
                    ))}
                  </div>

                  {/* Right side */}
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    <FiClock className="text-white/30" size={13} />
                    <span className="text-white/40 text-xs hidden sm:inline">
                      {new Date(f.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/admin/conversations/session/${f.session_id}`}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#FFCA40] hover:text-[#FFCA40]/80 transition-colors"
                    >
                      <FiMessageSquare size={13} />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className="px-2 py-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                {/* Reason preview (always visible if present) */}
                {f.reason && !isExpanded && (
                  <div className="px-4 pb-3 pl-[52px]">
                    <p className="text-white/50 text-xs line-clamp-1">{f.reason}</p>
                  </div>
                )}

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-white/10 px-4 py-4 space-y-4">
                    {/* Reason + Notes side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium">Reason</label>
                        <textarea
                          defaultValue={f.reason || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (f.reason || '')) {
                              updateFlag(f.id, { reason: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-y min-h-[80px]"
                          placeholder="Why was this session flagged?"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5 font-medium">Clinical Notes</label>
                        <textarea
                          defaultValue={f.notes || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (f.notes || '')) {
                              updateFlag(f.id, { notes: e.target.value });
                            }
                          }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-y min-h-[80px]"
                          placeholder="Add clinical observations, patient facts, etc."
                        />
                      </div>
                    </div>

                    {/* Category Tags */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5 font-medium">Categories</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {FLAG_CATEGORIES.map(cat => {
                          const isActive = f.tags?.includes(cat.value);
                          const colorClass = CATEGORY_COLORS[cat.color];
                          return (
                            <button
                              key={cat.value}
                              onClick={() => {
                                if (isActive) {
                                  removeTag(f, cat.value);
                                } else {
                                  addCategoryTag(f, cat.value);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                                isActive
                                  ? colorClass
                                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Tags */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5 font-medium">Custom Tags</label>
                      <InlineTagEditor
                        tags={customTags}
                        onAdd={(tag) => updateFlag(f.id, { tags: [...(f.tags || []), tag] })}
                        onRemove={(tag) => removeTag(f, tag)}
                      />
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-white/30 pt-2 border-t border-white/5">
                      <span>Created: {new Date(f.created_at).toLocaleString()}</span>
                      <span>Updated: {new Date(f.updated_at).toLocaleString()}</span>
                      {f.user_id && <span>User ID: {f.user_id}</span>}
                      {f.flagged_by_admin_id && <span>Flagged by Admin #{f.flagged_by_admin_id}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline tag editor for custom (non-category) tags
function InlineTagEditor({ tags, onAdd, onRemove }: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    const v = value.trim();
    if (!v || tags.includes(v)) return;
    onAdd(v);
    setValue('');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white/10 border border-white/20 text-white/70"
        >
          {t}
          <button onClick={() => onRemove(t)} className="text-red-400 hover:text-red-300">x</button>
        </span>
      ))}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Add tag..."
        className="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-white/30 w-24"
      />
      <button
        onClick={handleAdd}
        className="px-2 py-1 text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 rounded-md transition-colors"
      >
        Add
      </button>
    </div>
  );
}
