'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PlayIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { executeCampaign, previewCampaignTargets } from '@/services/adminCampaignApi';
import type { Campaign, ExecuteCampaignResponse } from '@/types/admin/campaigns';
import { formatTargetAudience } from '@/lib/campaignUtils';

interface ExecuteCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExecuteCampaignModal({ campaign, onClose, onSuccess }: ExecuteCampaignModalProps) {
  const [isDryRun, setIsDryRun] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteCampaignResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // Load target preview on mount
  useState(() => {
    const loadTargets = async () => {
      try {
        setLoadingTargets(true);
        const preview = await previewCampaignTargets(campaign.id);
        setTargetCount(preview.total_targeted);
      } catch (err) {
        // Silently fail - not critical
        console.error('Failed to load target preview:', err);
      } finally {
        setLoadingTargets(false);
      }
    };

    loadTargets();
  });

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await executeCampaign(campaign.id, { dry_run: isDryRun });
      setResult(response);

      if (!isDryRun) {
        // Wait a bit to show result, then close and refresh
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute campaign');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-[#001a47] to-[#00153a] rounded-2xl shadow-2xl border border-white/10 max-w-2xl w-full"
        >
          {/* Header */}
          <div className="bg-[#001a47]/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Execute Campaign</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6 text-white/60" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Campaign Summary */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-3">Campaign Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Name:</span>
                  <span className="text-white font-medium">{campaign.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Target Audience:</span>
                  {/* campaign.target_audience may be a string or an object from backend */}
                  {(() => {
                    const audience = campaign.target_audience;
                    return (
                      <span className="text-white font-medium capitalize">{formatTargetAudience(audience)}</span>
                    );
                  })()}
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Priority:</span>
                  <span className={`font-medium capitalize ${
                    campaign.priority === 'high' ? 'text-red-400' :
                    campaign.priority === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {campaign.priority}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Estimated Targets:</span>
                  {loadingTargets ? (
                    <span className="text-white/40">Loading...</span>
                  ) : (
                    <span className="text-white font-medium">{targetCount ?? 'Unknown'} students</span>
                  )}
                </div>
              </div>
            </div>

            {/* Message Preview */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">Message Template</h3>
              <p className="text-white/80 text-sm whitespace-pre-wrap font-mono">
                {campaign.message_template}
              </p>
              <p className="text-white/40 text-xs mt-2">
                Variables will be replaced with actual student data
              </p>
            </div>

            {/* Dry Run Toggle */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-blue-500/50 bg-white/5 text-[#FFCA40] focus:ring-2 focus:ring-[#FFCA40]/50"
                />
                <div className="flex-1">
                  <span className="text-white font-medium">Dry Run (Test Mode)</span>
                  <p className="text-white/60 text-sm mt-1">
                    Test campaign execution without sending actual messages. Use this to verify targeting and preview results.
                  </p>
                </div>
              </label>
            </div>

            {/* Warning for Real Execution */}
            {!isDryRun && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">Real Execution Warning</p>
                  <p className="text-white/80 text-sm mt-1">
                    This will send actual messages to{' '}
                    <span className="font-semibold text-white">{targetCount ?? 'targeted'} students</span>.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <XCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">Execution Failed</p>
                  <p className="text-white/80 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Execution Result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
              >
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircleIcon className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-400 font-medium">
                      {result.dry_run ? 'Dry Run Complete' : 'Campaign Executed Successfully'}
                    </p>
                    <p className="text-white/80 text-sm mt-1">
                      {result.dry_run
                        ? 'Test execution completed without sending messages'
                        : 'Campaign has been executed and messages are being delivered'}
                    </p>
                  </div>
                </div>

                {/* Execution Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <p className="text-white/60 text-xs">Targeted</p>
                    <p className="text-white text-xl font-bold">{result.total_targeted}</p>
                  </div>
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <p className="text-green-400 text-xs">Sent</p>
                    <p className="text-white text-xl font-bold">{result.messages_sent}</p>
                  </div>
                  <div className="p-3 bg-red-500/20 rounded-lg">
                    <p className="text-red-400 text-xs">Failed</p>
                    <p className="text-white text-xl font-bold">{result.messages_failed}</p>
                  </div>
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-xs">Duration</p>
                    <p className="text-white text-xl font-bold">
                      {result.execution_time_seconds !== undefined 
                        ? `${result.execution_time_seconds.toFixed(2)}s` 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-[#001a47]/95 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
            >
              {result && !isDryRun ? 'Close' : 'Cancel'}
            </button>

            {!result && (
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-6 py-3 bg-[#FFCA40] hover:bg-[#FFCA40]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#00153a] font-semibold rounded-xl transition-all shadow-lg shadow-[#FFCA40]/20 flex items-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#00153a]/30 border-t-[#00153a] rounded-full animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-5 h-5" />
                    {isDryRun ? 'Run Test' : 'Execute Campaign'}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
