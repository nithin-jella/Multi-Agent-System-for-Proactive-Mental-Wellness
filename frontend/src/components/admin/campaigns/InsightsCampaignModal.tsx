'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, SparklesIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import apiClient from '@/services/api';

interface InsightsCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  insightsSummary: string;
  trendingTopics: Array<{ topic: string; count: number }>;
}

interface AIGeneratedConfig {
  target_audience: string;
  message_template: string;
  triggers: Array<{
    trigger_type: string;
    conditions: Record<string, unknown>;
  }>;
  priority: string;
  schedule: string | null;
  ai_rationale: string;
}

export function InsightsCampaignModal({
  isOpen,
  onClose,
  onSuccess,
  insightsSummary,
  trendingTopics,
}: InsightsCampaignModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<AIGeneratedConfig | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const topicsString = trendingTopics.map(t => t.topic).join(',');
      
      const response = await apiClient.post('/admin/campaigns/generate-from-insights', null, {
        params: {
          insights_summary: insightsSummary,
          trending_topics: topicsString,
        },
      });

      const { generated_config, campaign_name } = response.data;
      setGeneratedConfig(generated_config);
      setCampaignName(campaign_name);
    } catch (err) {
      console.error('Failed to generate campaign from insights:', err);
      setError('Failed to generate campaign. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!generatedConfig) return;

    setIsCreating(true);
    setError(null);

    try {
      // Transform to match backend schema
      const payload = {
        name: campaignName,
        description: `Campaign generated from insights: ${insightsSummary.substring(0, 200)}${insightsSummary.length > 200 ? '...' : ''}`,
        message_template: generatedConfig.message_template,
        priority: generatedConfig.priority,
        status: 'draft',
        // Backend expects target_audience as a Dict/object
        target_audience: {
          type: generatedConfig.target_audience,
        },
        // Backend expects trigger_rules as a Dict/object
        trigger_rules: {
          triggers: generatedConfig.triggers,
          schedule: generatedConfig.schedule,
        },
      };

      console.log('Creating campaign with payload:', JSON.stringify(payload, null, 2));
      await apiClient.post('/admin/campaigns', payload);
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      // Log the full error details for debugging
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: unknown } };
        console.error('Validation error details:', JSON.stringify(axiosError.response?.data, null, 2));
      }
      setError('Failed to create campaign. Please check the console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGeneratedConfig(null);
    setCampaignName('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative bg-[#001a47] rounded-2xl shadow-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-8 py-6 bg-gradient-to-r from-pink-500/20 to-orange-500/20 border-b border-white/10">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-pink-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Generate Campaign from Insights</h2>
                <p className="text-sm text-white/60 mt-1">
                  AI will create a targeted campaign based on Insight Agent analysis
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Close modal"
            >
              <XMarkIcon className="w-6 h-6 text-white/60 hover:text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Insights Summary */}
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <h3 className="text-sm font-semibold text-blue-300 mb-2">Source Insights</h3>
              <p className="text-sm text-white/70 mb-3">{insightsSummary}</p>
              
              {trendingTopics.length > 0 && (
                <div>
                  <p className="text-xs text-white/60 mb-2">Trending Topics:</p>
                  <div className="flex flex-wrap gap-2">
                    {trendingTopics.map((topic) => (
                      <span
                        key={topic.topic}
                        className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full"
                      >
                        {topic.topic} ({topic.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Generate or Preview */}
            {!generatedConfig ? (
              <div className="text-center py-12">
                <SparklesIcon className="w-16 h-16 text-pink-400 mx-auto mb-4" />
                <p className="text-white/70 mb-6">
                  Ready to generate a campaign based on these insights
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-8 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 
                    hover:to-orange-600 disabled:from-pink-500/50 disabled:to-orange-500/50 
                    text-white font-semibold rounded-xl shadow-lg shadow-pink-500/30 
                    transition-all duration-200 flex items-center gap-3 mx-auto"
                >
                  {isGenerating ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5" />
                      Generate Campaign
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Campaign Name */}
                <div>
                  <label htmlFor="campaign-name-input" className="block text-sm font-medium text-white/80 mb-2">
                    Campaign Name
                  </label>
                  <input
                    id="campaign-name-input"
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Enter campaign name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl 
                      text-white placeholder-white/40 focus:outline-none focus:ring-2 
                      focus:ring-pink-500/50"
                  />
                </div>

                {/* AI Rationale */}
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <h3 className="text-sm font-semibold text-purple-300 mb-2">AI Rationale</h3>
                  <p className="text-sm text-white/70">{generatedConfig.ai_rationale}</p>
                </div>

                {/* Configuration Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Target Audience */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-xs font-semibold text-white/60 mb-2">Target Audience</h4>
                    <p className="text-sm text-white">{generatedConfig.target_audience}</p>
                  </div>

                  {/* Priority */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-xs font-semibold text-white/60 mb-2">Priority</h4>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        generatedConfig.priority === 'high'
                          ? 'bg-red-500/20 text-red-300'
                          : generatedConfig.priority === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-green-500/20 text-green-300'
                      }`}
                    >
                      {generatedConfig.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Message Template */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-xs font-semibold text-white/60 mb-2">Message Template</h4>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {generatedConfig.message_template}
                  </p>
                </div>

                {/* Triggers */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-xs font-semibold text-white/60 mb-3">
                    Triggers ({generatedConfig.triggers.length})
                  </h4>
                  <div className="space-y-3">
                    {generatedConfig.triggers.map((trigger, index) => (
                      <div key={index} className="p-3 bg-white/5 rounded-lg">
                        <p className="text-sm text-white font-medium mb-1">{trigger.trigger_type}</p>
                        <pre className="text-xs text-white/60 overflow-x-auto">
                          {JSON.stringify(trigger.conditions, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Schedule */}
                {generatedConfig.schedule && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-xs font-semibold text-white/60 mb-2">Schedule</h4>
                    <p className="text-sm text-white/80">{generatedConfig.schedule}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {generatedConfig && (
            <div className="px-8 py-6 bg-white/5 border-t border-white/10 flex justify-between">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 
                  text-white font-medium rounded-xl transition-all duration-200 
                  flex items-center gap-2"
              >
                <ArrowPathIcon className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>

              <button
                onClick={handleCreateCampaign}
                disabled={isCreating || !campaignName.trim()}
                className="px-8 py-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 
                  hover:to-orange-600 disabled:from-pink-500/50 disabled:to-orange-500/50 
                  text-white font-semibold rounded-xl shadow-lg shadow-pink-500/30 
                  transition-all duration-200 flex items-center gap-3"
              >
                {isCreating ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Create Campaign
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
