'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import apiClient from '@/services/api';
import type { CreateCampaignRequest } from '@/types/admin/campaigns';
import { formatTargetAudience } from '@/lib/campaignUtils';

interface AICampaignModalProps {
  onClose: () => void;
  onSuccess: (campaignData: CreateCampaignRequest) => void;
}

interface AIGeneratedConfig {
  target_audience: string;
  message_template: string;
  triggers: Array<{
    trigger_type: string;
    condition_type: string;
    conditions: Record<string, unknown>;
    description: string;
  }>;
  priority: string;
  schedule: string | null;
  ai_rationale: string;
}

export function AICampaignModal({ onClose, onSuccess }: AICampaignModalProps) {
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] = useState<AIGeneratedConfig | null>(null);

  const handleGenerate = async () => {
    if (!campaignName.trim() || !campaignDescription.trim()) {
      setError('Please fill in both campaign name and description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.post('/admin/campaigns/generate-with-ai', null, {
        params: {
          campaign_name: campaignName,
          campaign_description: campaignDescription,
        },
      });

      const config = response.data.generated_config as AIGeneratedConfig;
      setGeneratedConfig(config);
    } catch (err) {
      console.error('AI generation failed:', err);
      const errorMessage = err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'detail' in err.response.data ? String(err.response.data.detail) : 'Failed to generate campaign. Please try again.';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateCampaign = () => {
    if (!generatedConfig) return;

    // Convert AI config to CreateCampaignRequest format
    const campaignData = {
      name: campaignName,
      description: campaignDescription,
      target_audience: generatedConfig.target_audience,
      message_template: generatedConfig.message_template,
      priority: generatedConfig.priority,
      status: 'draft',
      schedule: generatedConfig.schedule || undefined,
      triggers: generatedConfig.triggers.map((trigger) => ({
        trigger_type: trigger.trigger_type,
        condition_type: trigger.condition_type,
        conditions: trigger.conditions,
        description: trigger.description,
      })),
    } as CreateCampaignRequest;

    onSuccess(campaignData);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-gradient-to-br from-[#001a47] to-[#00153a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create Campaign with AI</h2>
                <p className="text-sm text-white/60">Powered by Gemini - Just describe your campaign!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6 text-white/60" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!generatedConfig ? (
              <>
                {/* Input Form */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ai-campaign-name" className="block text-sm font-medium text-white/80 mb-2">
                      Campaign Name *
                    </label>
                    <input
                      id="ai-campaign-name"
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g., Wellness Check-in for Inactive Students"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>

                  <div>
                    <label htmlFor="ai-campaign-description" className="block text-sm font-medium text-white/80 mb-2">
                      Campaign Description *
                    </label>
                    <textarea
                      id="ai-campaign-description"
                      value={campaignDescription}
                      onChange={(e) => setCampaignDescription(e.target.value)}
                      placeholder="Describe the purpose and goals of this campaign. What do you want to achieve? Who should it target? E.g., 'Reach out to students who haven't logged in for a week to check on their mental health and encourage them to engage with support services.'"
                      rows={6}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                    />
                    <p className="mt-2 text-xs text-white/40">
                      💡 Tip: Be specific about the target audience, timing, and desired outcome
                    </p>
                  </div>
                </div>

                {/* AI Features Info */}
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    AI Will Generate:
                  </h3>
                  <ul className="text-sm text-white/70 space-y-1">
                    <li>✨ Target audience selection (high-risk, inactive, all users, etc.)</li>
                    <li>✨ Personalized message template with smart variables</li>
                    <li>✨ Relevant trigger rules (sentiment, inactivity, case count, etc.)</li>
                    <li>✨ Appropriate priority level (low, medium, high)</li>
                    <li>✨ Recommended schedule (if applicable)</li>
                  </ul>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Generated Config Preview */}
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
                    <p className="text-sm text-green-400 flex items-center gap-2">
                      <SparklesIcon className="w-4 h-4" />
                      Campaign configuration generated successfully!
                    </p>
                  </div>

                  {/* AI Rationale */}
                  {generatedConfig.ai_rationale && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-sm font-semibold text-white/80 mb-2">AI Analysis:</h3>
                      <p className="text-sm text-white/70">{generatedConfig.ai_rationale}</p>
                    </div>
                  )}

                  {/* Target Audience */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">Target Audience:</h3>
                    {(() => {
                      const audience: unknown = generatedConfig?.target_audience as unknown;
                      return <p className="text-white capitalize">{formatTargetAudience(audience)}</p>;
                    })()}
                  </div>

                  {/* Message Template */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">Message Template:</h3>
                    <p className="text-white/90 whitespace-pre-wrap font-mono text-sm">
                      {generatedConfig.message_template}
                    </p>
                  </div>

                  {/* Priority */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h3 className="text-sm font-semibold text-white/80 mb-2">Priority:</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      generatedConfig.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      generatedConfig.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {generatedConfig.priority.toUpperCase()}
                    </span>
                  </div>

                  {/* Triggers */}
                  {generatedConfig.triggers.length > 0 && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-sm font-semibold text-white/80 mb-3">Trigger Rules:</h3>
                      <div className="space-y-2">
                        {generatedConfig.triggers.map((trigger, index) => (
                          <div key={index} className="p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-[#FFCA40]">
                                {trigger.trigger_type.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-white/70">{trigger.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Schedule */}
                  {generatedConfig.schedule && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-sm font-semibold text-white/80 mb-2">Schedule:</h3>
                      <p className="text-white/70 font-mono text-sm">{generatedConfig.schedule}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-white/5 flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
            >
              Cancel
            </button>
            
            {!generatedConfig ? (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !campaignName.trim() || !campaignDescription.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    Generate with AI
                  </>
                )}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setGeneratedConfig(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                >
                  Regenerate
                </button>
                <button
                  onClick={handleCreateCampaign}
                  className="px-6 py-2.5 bg-[#FFCA40] hover:bg-[#FFCA40]/90 text-[#00153a] font-semibold rounded-xl transition-all flex items-center gap-2"
                >
                  Create Campaign
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
