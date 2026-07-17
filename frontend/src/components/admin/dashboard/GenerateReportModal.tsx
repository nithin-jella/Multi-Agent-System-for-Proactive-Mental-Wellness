'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  CalendarIcon,
  ClockIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: GenerateReportParams) => Promise<void>;
}

export interface GenerateReportParams {
  report_type: 'weekly' | 'monthly' | 'ad_hoc';
  period_start?: string; // ISO datetime
  period_end?: string; // ISO datetime
  use_llm?: boolean; // Whether to use Gemini LLM for intelligent analysis
}

export function GenerateReportModal({ isOpen, onClose, onGenerate }: GenerateReportModalProps) {
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'ad_hoc'>('ad_hoc');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [useLLM, setUseLLM] = useState(true); // Default to using LLM
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      const params: GenerateReportParams = {
        report_type: reportType,
        use_llm: useLLM,
      };

      // Add dates if provided (for ad_hoc or overriding defaults)
      if (periodStart) {
        params.period_start = new Date(periodStart).toISOString();
      }
      if (periodEnd) {
        params.period_end = new Date(periodEnd).toISOString();
      }

      await onGenerate(params);
      
      // Reset form and close
      setReportType('ad_hoc');
      setPeriodStart('');
      setPeriodEnd('');
      setUseLLM(true);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Get default date ranges based on report type
  const getDefaultDates = () => {
    const now = new Date();
    const start = new Date();

    if (reportType === 'weekly') {
      start.setDate(now.getDate() - 7);
    } else if (reportType === 'monthly') {
      start.setDate(now.getDate() - 30);
    } else {
      start.setDate(now.getDate() - 7);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };
  };

  const defaultDates = getDefaultDates();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-800 rounded-2xl shadow-2xl border border-white/10 w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <SparklesIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Generate IA Report</h2>
                      <p className="text-sm text-white/60">AI-powered Insights Agent analysis</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    disabled={isGenerating}
                    aria-label="Close report modal"
                  >
                    <XMarkIcon className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Report Type */}
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Report Type
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['weekly', 'monthly', 'ad_hoc'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setReportType(type)}
                        className={`
                          px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                          ${reportType === type
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10'
                          }
                        `}
                      >
                        {type === 'ad_hoc' ? 'Custom' : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    {reportType === 'weekly' && 'Analyze data from the last 7 days'}
                    {reportType === 'monthly' && 'Analyze data from the last 30 days'}
                    {reportType === 'ad_hoc' && 'Create a custom report with your own date range'}
                  </p>
                </div>

                {/* LLM Toggle */}
                <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <CpuChipIcon className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <label htmlFor="use-llm" className="text-sm font-medium text-white cursor-pointer">
                          Gemini AI Analysis
                        </label>
                        <p className="text-xs text-white/50">
                          Generate intelligent summaries, pattern recognition, and recommendations
                        </p>
                      </div>
                    </div>
                    <button
                      id="use-llm"
                      type="button"
                      role="switch"
                      aria-checked={useLLM}
                      onClick={() => setUseLLM(!useLLM)}
                      className={`
                        relative w-12 h-6 rounded-full transition-colors duration-200
                        ${useLLM ? 'bg-purple-500' : 'bg-white/20'}
                      `}
                    >
                      <span
                        className={`
                          absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
                          transition-transform duration-200
                          ${useLLM ? 'translate-x-6' : 'translate-x-0'}
                        `}
                      />
                    </button>
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="period-start" className="block text-sm font-medium text-white/80 mb-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Period Start Date
                      </div>
                    </label>
                    <input
                      id="period-start"
                      type="date"
                      value={periodStart || defaultDates.start}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                    <p className="mt-1.5 text-xs text-white/40">
                      Leave blank to use default ({reportType === 'weekly' ? '7' : reportType === 'monthly' ? '30' : '7'} days ago)
                    </p>
                  </div>

                  <div>
                    <label htmlFor="period-end" className="block text-sm font-medium text-white/80 mb-2">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        Period End Date
                      </div>
                    </label>
                    <input
                      id="period-end"
                      type="date"
                      value={periodEnd || defaultDates.end}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                    <p className="mt-1.5 text-xs text-white/40">
                      Leave blank to use current date/time
                    </p>
                  </div>
                </div>

                {/* Preview Info */}
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <ClockIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-white/80 font-medium mb-1">Report Preview</p>
                      <p className="text-xs text-white/60">
                        This will analyze <strong>{reportType === 'weekly' ? '7' : reportType === 'monthly' ? '30' : 'custom'}</strong> days
                        of triage assessments, generate trending topics, calculate sentiment scores, 
                        and identify high-risk cases.
                        {useLLM && (
                          <span className="block mt-1 text-purple-300">
                            <SparklesIcon className="w-3 h-3 inline mr-1" />
                            Gemini will provide intelligent summaries, pattern recognition, and actionable recommendations.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 
                      text-white/80 rounded-lg font-medium transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 
                      hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium 
                      shadow-lg shadow-blue-500/30 transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {useLLM ? 'AI Analyzing...' : 'Generating...'}
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
