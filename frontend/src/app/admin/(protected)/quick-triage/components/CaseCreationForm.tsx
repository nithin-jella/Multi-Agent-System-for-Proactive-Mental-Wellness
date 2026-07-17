'use client';

import { useState } from 'react';
import { CMAGraphRequest } from '@/services/langGraphApi';
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface CaseCreationFormProps {
  onSubmit: (request: CMAGraphRequest) => Promise<void>;
  loading: boolean;
}

const SEVERITY_OPTIONS = [
  {
    value: 'critical' as const,
    label: 'Critical',
    sla: '1 hour SLA',
    description: 'Immediate danger or crisis',
    color: 'border-red-500/50 bg-red-500/10 text-red-300',
    selectedColor: 'border-red-500 bg-red-500/25 text-red-200 ring-2 ring-red-500/40',
    dot: 'bg-red-500',
  },
  {
    value: 'high' as const,
    label: 'High',
    sla: '4 hour SLA',
    description: 'Significant risk, urgent',
    color: 'border-orange-500/50 bg-orange-500/10 text-orange-300',
    selectedColor: 'border-orange-500 bg-orange-500/25 text-orange-200 ring-2 ring-orange-500/40',
    dot: 'bg-orange-500',
  },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    sla: 'Standard',
    description: 'Needs follow-up',
    color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
    selectedColor: 'border-yellow-500 bg-yellow-500/25 text-yellow-200 ring-2 ring-yellow-500/40',
    dot: 'bg-yellow-500',
  },
  {
    value: 'low' as const,
    label: 'Low',
    sla: 'Routine',
    description: 'Monitoring, no urgency',
    color: 'border-green-500/50 bg-green-500/10 text-green-300',
    selectedColor: 'border-green-500 bg-green-500/25 text-green-200 ring-2 ring-green-500/40',
    dot: 'bg-green-500',
  },
];

const RISK_LEVELS = [
  { value: 0, label: 'Low', color: 'bg-green-500', textColor: 'text-green-300' },
  { value: 1, label: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-300' },
  { value: 2, label: 'High', color: 'bg-orange-500', textColor: 'text-orange-300' },
  { value: 3, label: 'Critical', color: 'bg-red-500', textColor: 'text-red-300' },
];

const INTENT_OPTIONS = [
  { value: 'support_request', label: 'Support Request' },
  { value: 'crisis_intervention', label: 'Crisis Intervention' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'screening_referral', label: 'Screening Referral' },
  { value: 'counseling_referral', label: 'Counseling Referral' },
  { value: 'wellness_check', label: 'Wellness Check' },
];

const inputClass =
  'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 focus:border-transparent text-sm transition-all';

export function CaseCreationForm({ onSubmit, loading }: CaseCreationFormProps) {
  const [formData, setFormData] = useState({
    user_id: '',
    session_id: '',
    user_hash: '',
    severity: 'high' as 'critical' | 'high' | 'moderate' | 'low',
    message: '',
    intent: 'support_request',
    risk_level: 2,
  });

  const [messageExpanded, setMessageExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const request: CMAGraphRequest = {
      user_id: parseInt(formData.user_id),
      session_id: formData.session_id,
      user_hash: formData.user_hash,
      severity: formData.severity,
      message: formData.message,
      intent: formData.intent,
      risk_level: formData.risk_level,
    };

    await onSubmit(request);

    setFormData({
      user_id: '',
      session_id: '',
      user_hash: '',
      severity: 'high',
      message: '',
      intent: 'support_request',
      risk_level: 2,
    });
    setMessageExpanded(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Row 1: Identity Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            User ID <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            required
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            className={inputClass}
            placeholder="Enter user ID"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            Session ID <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.session_id}
            onChange={(e) => setFormData({ ...formData, session_id: e.target.value })}
            className={inputClass}
            placeholder="Enter session ID"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">
            User Hash <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.user_hash}
            onChange={(e) => setFormData({ ...formData, user_hash: e.target.value })}
            className={inputClass}
            placeholder="Anonymized hash"
            disabled={loading}
          />
        </div>
      </div>

      {/* Row 2: Severity Card Selector */}
      <div>
        <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
          Severity <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SEVERITY_OPTIONS.map((opt) => {
            const isSelected = formData.severity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={loading}
                onClick={() => setFormData({ ...formData, severity: opt.value })}
                className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${
                  isSelected ? opt.selectedColor : `${opt.color} hover:bg-white/5`
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </div>
                <p className="text-[11px] text-white/50 leading-tight">{opt.description}</p>
                <span className="mt-2 inline-block text-[10px] font-medium px-2 py-0.5 bg-white/5 rounded-full text-white/40">
                  {opt.sla}
                </span>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Risk Level Segmented Control + Intent Dropdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Level: Segmented Control */}
        <div>
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
            Risk Level
          </label>
          <div className="flex rounded-xl overflow-hidden border border-white/10 bg-white/5">
            {RISK_LEVELS.map((level) => {
              const isSelected = formData.risk_level === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  disabled={loading}
                  onClick={() => setFormData({ ...formData, risk_level: level.value })}
                  className={`flex-1 py-3 px-2 text-center text-xs font-medium transition-all duration-200 relative ${
                    isSelected
                      ? `${level.textColor} bg-white/10`
                      : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  } disabled:opacity-50`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isSelected ? level.color : 'bg-white/20'} transition-colors`} />
                    <span>{level.label}</span>
                  </div>
                  {isSelected && (
                    <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${level.color}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intent: Dropdown */}
        <div>
          <label htmlFor="intent-select" className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-3">
            Intent
          </label>
          <select
            id="intent-select"
            value={formData.intent}
            onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
            className={inputClass}
            disabled={loading}
            aria-label="Select case intent"
          >
            {INTENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#001a47]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: Expandable Message */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-medium text-white/60 uppercase tracking-wider">
            Case Message <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={() => setMessageExpanded(!messageExpanded)}
            className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/60 transition-colors"
          >
            {messageExpanded ? (
              <>
                <ChevronUpIcon className="w-3.5 h-3.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-3.5 h-3.5" />
                Expand
              </>
            )}
          </button>
        </div>
        <textarea
          required
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          rows={messageExpanded ? 10 : 3}
          className={`${inputClass} resize-none transition-all duration-300`}
          placeholder="Describe the case in detail..."
          disabled={loading}
        />
        <p className="text-[11px] text-white/30 mt-1.5">
          {formData.message.length} characters
        </p>
      </div>

      {/* CMA Info Banner */}
      <div className="bg-[#FFCA40]/5 border border-[#FFCA40]/15 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-[#FFCA40]/10 rounded-lg">
            <svg className="h-4 w-4 text-[#FFCA40]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-xs text-white/50 leading-relaxed">
            <span className="text-[#FFCA40]/80 font-medium">CMA Graph Workflow: </span>
            Auto-calculates SLA deadline, assigns available counselor, creates tracked case, and triggers SLA monitoring.
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-[#FFCA40] hover:bg-[#FFCA40]/90 disabled:bg-[#FFCA40]/50 text-[#00153a] font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-[#FFCA40]/10 flex items-center gap-2 disabled:cursor-not-allowed text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-[#00153a]/20 border-t-[#00153a] rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="w-4 h-4" />
              Create Case
            </>
          )}
        </button>
      </div>
    </form>
  );
}
