'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { createCampaign, updateCampaign } from '@/services/adminCampaignApi';
import type {
  Campaign,
  CreateCampaignRequest,
  CampaignStatus,
  CampaignPriority,
  TargetAudience,
  TriggerType,
  CampaignTrigger,
  ConditionOperator,
} from '@/types/admin/campaigns';
import {
  TARGET_AUDIENCE_LABELS,
  TRIGGER_TYPE_LABELS,
  OPERATOR_LABELS,
  TEMPLATE_VARIABLES,
} from '@/types/admin/campaigns';
import { extractTargetAudienceType } from '@/lib/campaignUtils';

interface CampaignFormModalProps {
  campaign?: Campaign | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CampaignFormModal({ campaign, onClose, onSuccess }: CampaignFormModalProps) {
  const isEditing = !!campaign;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract target_audience type from backend object format
  const initialTargetAudience = campaign?.target_audience 
    ? (extractTargetAudienceType(campaign.target_audience) as TargetAudience || 'all_users')
    : 'all_users';

  // Form state
  const [name, setName] = useState(campaign?.name || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(initialTargetAudience);
  const [messageTemplate, setMessageTemplate] = useState(campaign?.message_template || '');
  const [status, setStatus] = useState<CampaignStatus>(campaign?.status || 'draft');
  const [priority, setPriority] = useState<CampaignPriority>(campaign?.priority || 'medium');
  const [schedule, setSchedule] = useState(campaign?.schedule || '');
  const [triggers, setTriggers] = useState<Omit<CampaignTrigger, 'id' | 'campaign_id' | 'created_at'>[]>(
    campaign?.triggers?.map(t => ({
      trigger_type: t.trigger_type,
      conditions: t.conditions,
      is_active: t.is_active,
    })) || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateCampaignRequest = {
        name,
        description: description || undefined,
        target_audience: targetAudience,
        message_template: messageTemplate,
        status,
        priority,
        schedule: schedule || undefined,
        triggers: triggers.length > 0 ? triggers : undefined,
      };

      if (isEditing) {
        await updateCampaign(campaign.id, data);
      } else {
        await createCampaign(data);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTrigger = () => {
    setTriggers([
      ...triggers,
      {
        trigger_type: 'sentiment_threshold',
        conditions: { operator: 'less_than', value: 50 },
        is_active: true,
      },
    ]);
  };

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index));
  };

  const updateTrigger = (
    index: number,
    field: keyof Omit<CampaignTrigger, 'id' | 'campaign_id' | 'created_at'>,
    value: unknown
  ) => {
    const updated = [...triggers];
    updated[index] = { ...updated[index], [field]: value };
    setTriggers(updated);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-template') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + `{${variable}}` + after;

    setMessageTemplate(newText);

    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
    }, 0);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-[#001a47] to-[#00153a] rounded-2xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#001a47]/95 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-2xl font-bold text-white">
              {isEditing ? 'Edit Campaign' : 'Create New Campaign'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6 text-white/60" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Basic Information</h3>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">
                  Campaign Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  placeholder="e.g., Weekly Mental Health Check-in"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-white/80 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  placeholder="Describe the purpose of this campaign..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="target-audience" className="block text-sm font-medium text-white/80 mb-2">
                    Target Audience *
                  </label>
                  <select
                    id="target-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  >
                    {Object.entries(TARGET_AUDIENCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-white/80 mb-2">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CampaignPriority)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-white/80 mb-2">
                    Status
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="schedule" className="block text-sm font-medium text-white/80 mb-2">
                  Schedule (Cron Expression)
                </label>
                <input
                  id="schedule"
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                  placeholder="e.g., 0 10 * * 1 (Every Monday at 10 AM)"
                />
                <p className="mt-1 text-xs text-white/40">
                  Optional: Use cron syntax for scheduled execution
                </p>
              </div>
            </div>

            {/* Message Template */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Message Template</h3>

              <div>
                <label htmlFor="message-template" className="block text-sm font-medium text-white/80 mb-2">
                  Message *
                </label>
                <textarea
                  id="message-template"
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50 font-mono text-sm"
                  placeholder="Hi {user_name}! How are you feeling today?"
                />
              </div>

              {/* Template Variables */}
              <div>
                <p className="text-sm font-medium text-white/80 mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <button
                      key={variable.name}
                      type="button"
                      onClick={() => insertVariable(variable.name)}
                      className="px-3 py-1 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 text-[#FFCA40] rounded-lg text-sm transition-colors"
                      title={variable.description}
                    >
                      {`{${variable.name}}`}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-white/40">
                  Click a variable to insert it at cursor position
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-sm font-medium text-white/80 mb-2">Preview:</p>
                <p className="text-white/60 text-sm">{messageTemplate || 'Enter a message to see preview'}</p>
              </div>
            </div>

            {/* Trigger Rules (Part 2 - will continue in next message) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Trigger Rules (Optional)</h3>
                <button
                  type="button"
                  onClick={addTrigger}
                  className="px-3 py-1 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 text-[#FFCA40] rounded-lg text-sm flex items-center gap-1 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Trigger
                </button>
              </div>

              {triggers.length === 0 && (
                <p className="text-white/40 text-sm">
                  No triggers defined. Campaign will be executed manually or on schedule.
                </p>
              )}

              {triggers.map((trigger, index) => (
                <div
                  key={index}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <label className="block text-sm font-medium text-white/80">
                      Trigger #{index + 1}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeTrigger(index)}
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      aria-label={`Remove trigger ${index + 1}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label htmlFor={`trigger-type-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                      Trigger Type
                    </label>
                    <select
                      id={`trigger-type-${index}`}
                      value={trigger.trigger_type}
                      onChange={(e) =>
                        updateTrigger(index, 'trigger_type', e.target.value as TriggerType)
                      }
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                    >
                      {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Condition Fields (dynamic based on trigger type) */}
                  <div className="grid grid-cols-2 gap-3">
                    {(trigger.trigger_type === 'sentiment_threshold' ||
                      trigger.trigger_type === 'risk_score') && (
                      <>
                        <div>
                          <label htmlFor={`operator-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                            Operator
                          </label>
                          <select
                            id={`operator-${index}`}
                            value={trigger.conditions.operator || 'less_than'}
                            onChange={(e) =>
                              updateTrigger(index, 'conditions', {
                                ...trigger.conditions,
                                operator: e.target.value as ConditionOperator,
                              })
                            }
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                          >
                            {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`value-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                            Value
                          </label>
                          <input
                            id={`value-${index}`}
                            type="number"
                            value={trigger.conditions.value || 0}
                            onChange={(e) =>
                              updateTrigger(index, 'conditions', {
                                ...trigger.conditions,
                                value: parseFloat(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                          />
                        </div>
                      </>
                    )}

                    {trigger.trigger_type === 'case_count' && (
                      <>
                        <div>
                          <label htmlFor={`operator-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                            Operator
                          </label>
                          <select
                            id={`operator-${index}`}
                            value={trigger.conditions.operator || 'greater_than'}
                            onChange={(e) =>
                              updateTrigger(index, 'conditions', {
                                ...trigger.conditions,
                                operator: e.target.value as ConditionOperator,
                              })
                            }
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                          >
                            {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`case-count-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                            Case Count
                          </label>
                          <input
                            id={`case-count-${index}`}
                            type="number"
                            value={trigger.conditions.value || 1}
                            onChange={(e) =>
                              updateTrigger(index, 'conditions', {
                                ...trigger.conditions,
                                value: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                          />
                        </div>
                        <div className="col-span-2">
                          <label htmlFor={`time-period-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                            Time Period (days)
                          </label>
                          <input
                            id={`time-period-${index}`}
                            type="number"
                            value={trigger.conditions.time_period_days || 30}
                            onChange={(e) =>
                              updateTrigger(index, 'conditions', {
                                ...trigger.conditions,
                                time_period_days: parseInt(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                          />
                        </div>
                      </>
                    )}

                    {trigger.trigger_type === 'inactivity' && (
                      <div className="col-span-2">
                        <label htmlFor={`days-inactive-${index}`} className="block text-xs font-medium text-white/60 mb-1">
                          Days Inactive
                        </label>
                        <input
                          id={`days-inactive-${index}`}
                          type="number"
                          value={trigger.conditions.days_inactive || 7}
                          onChange={(e) =>
                            updateTrigger(index, 'conditions', {
                              ...trigger.conditions,
                              days_inactive: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/50"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-[#FFCA40] hover:bg-[#FFCA40]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#00153a] font-semibold rounded-xl transition-all shadow-lg shadow-[#FFCA40]/20"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
