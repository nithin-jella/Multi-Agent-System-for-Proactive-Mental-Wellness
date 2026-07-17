/**
 * InterventionPlanModal Component
 * Displays TCA-generated intervention plans with steps, resources, and metadata
 */

'use client';

import { XMarkIcon, CheckCircleIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface InterventionStep {
  step: string;
  description: string;
  order?: number;
}

interface InterventionPlan {
  intervention_type: string;
  steps?: InterventionStep[];
  resources?: string[];
  estimated_duration?: string;
  follow_up_recommended?: boolean;
  [key: string]: unknown;
}

interface InterventionPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: InterventionPlan | null;
  planId?: string;
  executionTime?: number;
}

export default function InterventionPlanModal({
  isOpen,
  onClose,
  plan,
  planId,
  executionTime,
}: InterventionPlanModalProps) {
  if (!isOpen || !plan) return null;

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'calm_down':
        return { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300', icon: '🧘' };
      case 'break_down_problem':
        return { bg: 'bg-purple-500/20', border: 'border-purple-500/30', text: 'text-purple-300', icon: '🧩' };
      case 'general_coping':
        return { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: '💪' };
      default:
        return { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-300', icon: '📋' };
    }
  };

  const typeColors = getTypeColor(plan.intervention_type);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-[#00153a] via-[#001a47] to-[#00153a] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${typeColors.bg} border ${typeColors.border} flex items-center justify-center text-2xl`}>
                {typeColors.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Intervention Plan Generated</h2>
                <p className="text-white/60 text-sm mt-0.5">
                  Type: <span className={`font-semibold ${typeColors.text}`}>{plan.intervention_type.replace(/_/g, ' ').toUpperCase()}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              aria-label="Close modal"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-6">
            {/* Metadata Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {planId && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Plan ID</p>
                  <p className="text-white font-mono text-sm">{planId}</p>
                </div>
              )}
              {executionTime && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Generation Time</p>
                  <p className="text-white font-semibold">{executionTime}ms</p>
                </div>
              )}
              {plan.estimated_duration && (
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Est. Duration</p>
                  <p className="text-white font-semibold">{plan.estimated_duration}</p>
                </div>
              )}
            </div>

            {/* Intervention Steps */}
            {plan.steps && plan.steps.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Intervention Steps</h3>
                </div>
                <div className="space-y-4">
                  {plan.steps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-4"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFCA40] text-[#00153a] flex items-center justify-center font-bold text-sm">
                        {step.order || index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">{step.step}</h4>
                        <p className="text-white/70 text-sm">{step.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Resources */}
            {plan.resources && plan.resources.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <LightBulbIcon className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-semibold text-white">Recommended Resources</h3>
                </div>
                <ul className="space-y-2">
                  {plan.resources.map((resource, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-2 text-white/80 text-sm"
                    >
                      <span className="text-[#FFCA40] mt-1">•</span>
                      <span>{resource}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up Recommendation */}
            {plan.follow_up_recommended && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-orange-300 font-semibold">Follow-up Recommended</p>
                    <p className="text-orange-200/80 text-sm mt-1">
                      This intervention plan may require follow-up assessment to ensure effectiveness. Consider scheduling a check-in session.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Raw Plan Data (Collapsible for debugging) */}
            <details className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <summary className="text-white/60 text-sm cursor-pointer hover:text-white transition-colors">
                View Raw Plan Data (Debug)
              </summary>
              <pre className="mt-3 text-xs text-white/50 overflow-x-auto bg-black/30 p-3 rounded-lg">
                {JSON.stringify(plan, null, 2)}
              </pre>
            </details>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
                // Could add toast notification here
              }}
              className="px-6 py-2 bg-[#FFCA40] hover:bg-[#FFD666] text-[#00153a] rounded-lg font-semibold transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
