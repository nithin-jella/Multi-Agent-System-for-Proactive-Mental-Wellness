/**
 * Component to display an individual intervention plan
 * Redesigned with dark theme to match InterventionPlansSidebar
 */

'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Archive, ChevronDown, ChevronUp, Calendar, Sparkles, BookOpen, Clock } from 'lucide-react';
import { useCompleteStep, useArchivePlan } from '@/hooks/useInterventionPlans';
import type { InterventionPlanRecord } from '@/services/interventionPlanApi';
import styles from './PlanCard.module.css';

interface PlanCardProps {
  plan: InterventionPlanRecord;
  onUpdate?: () => void;
  compact?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onUpdate, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { completeStep, isLoading: isCompletingStep } = useCompleteStep();
  const { archivePlan, isLoading: isArchiving } = useArchivePlan();

  const handleStepToggle = async (stepIndex: number, currentlyCompleted: boolean) => {
    try {
      await completeStep(plan.id, stepIndex, !currentlyCompleted, undefined, () => {
        if (onUpdate) onUpdate();
      });
    } catch (error) {
      console.error('Failed to toggle step:', error);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Apakah kamu yakin ingin mengarsipkan rencana ini?')) return;
    
    try {
      await archivePlan(plan.id, () => {
        if (onUpdate) onUpdate();
      });
    } catch (error) {
      console.error('Failed to archive plan:', error);
    }
  };

  const completedSteps = plan.completion_tracking?.completed_steps?.length || 0;
  const totalSteps = plan.plan_data?.plan_steps?.length || 0;
  const completionPercentage = plan.completion_tracking?.completion_percentage || 0;

  // map completionPercentage to nearest 10% class to avoid inline styles
  const roundedProgress = Math.max(0, Math.min(100, Math.round(completionPercentage / 10) * 10));
  const progressClass = styles[`progress${roundedProgress}`] || styles.progress0;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Compact view for minimized sidebar
  if (compact) {
    return (
      <div className="bg-white/3 backdrop-blur-sm rounded-lg border border-white/10 p-3 hover:bg-white/5 transition-all group">
        <div className="flex items-center gap-2.5">
          {/* Progress Ring */}
          <div className="relative w-10 h-10 shrink-0">
            <svg className="w-10 h-10 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-white/10"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${completionPercentage} 100`}
                strokeLinecap="round"
                className="text-ugm-gold"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/60">
              {completionPercentage}%
            </span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-medium text-white/80 truncate leading-tight mb-0.5">
              {plan.plan_title || 'Rencana Intervensi'}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-white/40">
                {completedSteps}/{totalSteps} langkah
              </span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[9px] text-white/30">
                {formatDate(plan.created_at)}
              </span>
            </div>
          </div>
          
          {/* Quick Actions */}
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-1 rounded hover:bg-red-500/10 disabled:opacity-50"
            title="Arsipkan"
          >
            <Archive className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/3 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden hover:bg-white/5 transition-all">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-ugm-gold/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-ugm-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white/90 mb-1.5 leading-tight">
                {plan.plan_title || 'Rencana Intervensi'}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] text-white/40">
                  <Calendar className="w-3 h-3" />
                  {formatDate(plan.created_at)}
                </span>
                <span className="px-2 py-0.5 bg-ugm-gold/10 text-ugm-gold rounded-full text-[10px] font-medium border border-ugm-gold/20">
                  {plan.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleArchive}
            disabled={isArchiving}
            className="text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
            title="Arsipkan rencana"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-white/50">
              {completedSteps}/{totalSteps} langkah
            </span>
            <span className="text-[10px] font-bold text-ugm-gold">
              {completionPercentage}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className={`bg-linear-to-r from-ugm-gold to-ugm-gold-light h-1.5 rounded-full ${styles.progressBar} ${progressClass}`}
            />
          </div>
        </div>
      </div>

      {/* Expandable Steps */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left px-4 py-2.5 hover:bg-white/2 transition-colors"
        >
          <span className="text-[11px] font-medium text-white/50 flex items-center gap-1.5">
            {isExpanded ? 'Sembunyikan' : 'Tampilkan'} Langkah
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {plan.plan_data?.plan_steps?.map((step, index) => {
              const isCompleted = plan.completion_tracking?.completed_steps?.includes(index) || false;
              
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
                    isCompleted 
                      ? 'bg-emerald-500/10 border border-emerald-500/20' 
                      : 'bg-white/2 border border-white/5 hover:border-white/10'
                  }`}
                >
                  <button
                    onClick={() => handleStepToggle(index, isCompleted)}
                    disabled={isCompletingStep}
                    className="shrink-0 mt-0.5 disabled:opacity-50 transition-transform hover:scale-110"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/30 hover:text-white/50" />
                    )}
                  </button>
                  <p className={`text-xs leading-relaxed ${
                    isCompleted ? 'text-white/40 line-through' : 'text-white/70'
                  }`}>
                    {step.description}
                  </p>
                </div>
              );
            })}

            {/* Next Check-in */}
            {plan.plan_data?.next_check_in && (
              <div className="mt-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <h4 className="text-[10px] font-medium text-purple-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Check-in Berikutnya
                </h4>
                <p className="text-xs text-white/70">
                  {plan.plan_data.next_check_in.timeframe}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {plan.plan_data.next_check_in.method}
                </p>
              </div>
            )}

            {/* Resources */}
            {plan.plan_data?.resource_cards && plan.plan_data.resource_cards.length > 0 && (
              <div className="mt-3">
                <h4 className="text-[10px] font-medium text-white/50 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" />
                  Sumber Direkomendasikan
                </h4>
                <div className="space-y-2">
                  {plan.plan_data.resource_cards.map((resource, idx) => (
                    <div key={idx} className="p-2.5 bg-white/2 rounded-lg border border-white/5">
                      <p className="text-xs font-medium text-white/70 mb-1">
                        {resource.title}
                      </p>
                      <p className="text-[10px] text-white/40 leading-relaxed">
                        {resource.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
