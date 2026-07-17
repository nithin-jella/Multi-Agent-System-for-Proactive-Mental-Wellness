'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiPlus,
  FiCalendar,
  FiUser,
  FiFileText,
  FiAlertTriangle,
  FiRefreshCw,
  FiSend,
  FiX,
} from 'react-icons/fi';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';

interface CaseNote {
  id: number;
  case_id: string;
  user_hash?: string;
  note: string;
  author_id: number | null;
  created_at: string;
}

interface CaseOption {
  id: string;
  user_hash: string;
  severity: string;
  status: string;
}

export default function CounselorNotesPage() {
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New note form
  const [showForm, setShowForm] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/counselor/notes');
      setNotes(response.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setError('Failed to load session notes');
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCases = useCallback(async () => {
    try {
      const response = await apiClient.get('/counselor/cases');
      const allCases = response.data?.cases ?? [];
      // Only show open cases as options for adding notes
      const openCases = allCases.filter(
        (c: CaseOption) => c.status !== 'closed'
      );
      setCases(openCases);
      if (openCases.length > 0 && !selectedCaseId) {
        setSelectedCaseId(openCases[0].id);
      }
    } catch {
      // Non-critical, form just won't have case options
    }
  }, [selectedCaseId]);

  useEffect(() => {
    loadNotes();
    loadCases();
  }, [loadNotes, loadCases]);

  const handleSubmitNote = async () => {
    if (!selectedCaseId || !newNoteText.trim()) {
      toast.error('Please select a case and enter a note');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.post(`/counselor/cases/${selectedCaseId}/notes`, {
        note: newNoteText.trim(),
      });
      toast.success('Note added');
      setNewNoteText('');
      setShowForm(false);
      loadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
      toast.error('Failed to add note');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredNotes = notes.filter((note) => {
    if (searchQuery === '') return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      note.note.toLowerCase().includes(searchLower) ||
      note.case_id.toLowerCase().includes(searchLower) ||
      note.user_hash?.toLowerCase().includes(searchLower)
    );
  });

  // Stats
  const thisWeekNotes = notes.filter((n) => {
    const noteDate = new Date(n.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return noteDate >= weekAgo;
  });
  const uniqueCases = new Set(notes.map((n) => n.case_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading session notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <FiAlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-red-300 font-semibold mb-2">Failed to load session notes</p>
          <p className="text-red-300/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadNotes}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FiFileText className="w-8 h-8 text-[#FFCA40]" />
            Session Notes
          </h1>
          <p className="text-white/60">Document and review clinical case notes</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadNotes}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white/70 hover:text-white transition-all"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2"
          >
            {showForm ? <FiX className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'New Note'}
          </button>
        </div>
      </div>

      {/* New Note Form */}
      {showForm && (
        <div className="bg-white/5 backdrop-blur border border-[#FFCA40]/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add Note to Case</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Case</label>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                title="Select a case"
              >
                {cases.length === 0 ? (
                  <option value="" className="bg-[#001d58]">No open cases</option>
                ) : (
                  cases.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#001d58]">
                      {c.id.substring(0, 8)}... | {c.user_hash.substring(0, 16)} | {c.severity} | {c.status}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Note</label>
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Enter your session note..."
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] resize-y"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSubmitNote}
                disabled={submitting || !selectedCaseId || !newNoteText.trim()}
                className="px-6 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <FiSend className="w-4 h-4" />
                {submitting ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search notes by content or case ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{notes.length}</div>
          <div className="text-xs text-white/60 mt-1">Total Notes</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{thisWeekNotes.length}</div>
          <div className="text-xs text-white/60 mt-1">This Week</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{uniqueCases.size}</div>
          <div className="text-xs text-white/60 mt-1">Cases with Notes</div>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <FiFileText className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">
              {notes.length === 0
                ? 'No notes yet. Add your first note using the button above.'
                : 'No notes match your search criteria'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                {/* Header */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-xs font-mono text-white/60 bg-white/5 px-2 py-0.5 rounded">
                      {note.case_id.substring(0, 8)}...
                    </span>
                    {note.user_hash && (
                      <div className="flex items-center gap-1.5 text-xs text-white/50">
                        <FiUser className="w-3 h-3" />
                        {note.user_hash.substring(0, 16)}...
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <FiCalendar className="w-3 h-3" />
                      {formatShortDate(note.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note Content */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
                  {note.note}
                </p>
              </div>

              {/* Metadata */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center text-xs text-white/50">
                <span>Created: {formatDate(note.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
