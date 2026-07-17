'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiUser,
  FiTrendingUp,
  FiAlertTriangle,
  FiRefreshCw,
  FiExternalLink,
} from 'react-icons/fi';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';

interface PlanStep {
  title: string;
  description?: string;
  completed?: boolean;
}

interface TreatmentPlan {
  id: number;
  user_id: number;
  user_email?: string;
  plan_title: string;
  risk_level?: number;
  status: string;
  is_active: boolean;
  total_steps: number;
  completed_steps: number;
  plan_steps: PlanStep[];
  resource_cards: { title: string; url?: string; description?: string }[];
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  archived: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  expired: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const riskLabels: Record<number, { label: string; color: string }> = {
  0: { label: 'Low', color: 'text-green-300' },
  1: { label: 'Moderate', color: 'text-yellow-300' },
  2: { label: 'High', color: 'text-orange-300' },
  3: { label: 'Critical', color: 'text-red-300' },
};

export default function CounselorTreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/counselor/treatment-plans');
      setPlans(response.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load treatment plans:', err);
      setError('Failed to load treatment plans');
      toast.error('Failed to load treatment plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredPlans = plans.filter((plan) => {
    if (filterStatus === 'all') return true;
    return plan.status === filterStatus;
  });

  const activeCount = plans.filter((p) => p.is_active).length;
  const completedCount = plans.filter((p) => p.status === 'completed').length;
  const avgProgress =
    plans.length > 0
      ? Math.round(
          plans.reduce(
            (sum, p) =>
              sum + (p.total_steps > 0 ? (p.completed_steps / p.total_steps) * 100 : 0),
            0
          ) / plans.length
        )
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading treatment plans...</p>
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
          <p className="text-red-300 font-semibold mb-2">Failed to load treatment plans</p>
          <p className="text-red-300/70 text-sm mb-4">{error}</p>
          <button
            onClick={loadPlans}
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
            <FiTarget className="w-8 h-8 text-[#FFCA40]" />
            Treatment Plans
          </h1>
          <p className="text-white/60">
            AI-generated intervention plans for your patients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPlans}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white/70 hover:text-white transition-all"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
            title="Filter treatment plans by status"
          >
            <option value="all" className="bg-[#001d58]">
              All Status
            </option>
            <option value="active" className="bg-[#001d58]">
              Active
            </option>
            <option value="completed" className="bg-[#001d58]">
              Completed
            </option>
            <option value="archived" className="bg-[#001d58]">
              Archived
            </option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{activeCount}</div>
          <div className="text-xs text-white/60 mt-1">Active Plans</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{completedCount}</div>
          <div className="text-xs text-white/60 mt-1">Completed</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{plans.length}</div>
          <div className="text-xs text-white/60 mt-1">Total Plans</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{avgProgress}%</div>
          <div className="text-xs text-white/60 mt-1">Avg Progress</div>
        </div>
      </div>

      {/* Treatment Plans List */}
      <div className="space-y-4">
        {filteredPlans.length === 0 ? (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <FiTarget className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60">
              {plans.length === 0
                ? 'No treatment plans yet. Plans are generated by the AI system when patients interact with the TCA agent.'
                : 'No plans match the selected filter'}
            </p>
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const progressPct =
              plan.total_steps > 0
                ? Math.round((plan.completed_steps / plan.total_steps) * 100)
                : 0;
            const risk = plan.risk_level != null ? riskLabels[plan.risk_level] : null;

            return (
              <div
                key={plan.id}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-base font-semibold text-white">
                        {plan.plan_title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[plan.status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}
                      >
                        {plan.status}
                      </span>
                      {risk && (
                        <span className={`text-xs font-medium ${risk.color}`}>
                          Risk: {risk.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <FiUser className="w-4 h-4 text-white/40" />
                      <span className="text-sm text-white/70">
                        {plan.user_email || `User #${plan.user_id}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/60">
                      Progress ({plan.completed_steps}/{plan.total_steps} steps)
                    </span>
                    <span className="text-xs font-medium text-[#FFCA40]">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFCA40] to-[#FFD55C] transition-all"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Plan Steps */}
                {plan.plan_steps.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                      <FiTarget className="w-4 h-4 text-[#FFCA40]" />
                      Plan Steps:
                    </p>
                    <ul className="space-y-1.5">
                      {plan.plan_steps.map((step, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm text-white/70"
                        >
                          <FiCheckCircle
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              step.completed
                                ? 'text-green-400'
                                : 'text-white/20'
                            }`}
                          />
                          <div>
                            <span
                              className={
                                step.completed
                                  ? 'line-through text-white/40'
                                  : ''
                              }
                            >
                              {step.title}
                            </span>
                            {step.description && (
                              <p className="text-xs text-white/40 mt-0.5">
                                {step.description}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resource Cards */}
                {plan.resource_cards.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-white/80 mb-2 flex items-center gap-2">
                      <FiTrendingUp className="w-4 h-4 text-[#FFCA40]" />
                      Resources:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {plan.resource_cards.map((resource, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 flex items-center gap-1.5"
                        >
                          {resource.title}
                          {resource.url && (
                            <FiExternalLink className="w-3 h-3 text-white/40" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    <FiClock className="w-3 h-3" />
                    Created: {formatDate(plan.created_at)}
                  </span>
                  <span>Updated: {formatDate(plan.updated_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
