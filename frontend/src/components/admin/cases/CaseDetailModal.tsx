/**
 * CaseDetailModal Component
 * Shows full case details with notes, assignments, triage, and conversation preview
 */

'use client';

import { useEffect, useState } from 'react';
import { getCaseDetail, getCaseConversation } from '@/services/adminCaseApi';
import type { CaseDetailResponse, ConversationMessageSummary } from '@/types/admin/cases';
import { formatDistanceToNow, format } from 'date-fns';
import InterventionPlanModal from './InterventionPlanModal';
import type { TCAGraphResponse } from '@/services/langGraphApi';

interface CaseDetailModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate?: (caseId: string) => void;
  onAssign?: (caseId: string) => void;
}

export default function CaseDetailModal({
  caseId,
  isOpen,
  onClose,
  onStatusUpdate,
  onAssign,
}: CaseDetailModalProps) {
  const [caseDetail, setCaseDetail] = useState<CaseDetailResponse | null>(null);
  const [fullConversation, setFullConversation] = useState<ConversationMessageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'assignments' | 'triage' | 'conversation'>('overview');
  const [interventionPlanResult, setInterventionPlanResult] = useState<TCAGraphResponse | null>(null);
  const [showInterventionPlan, setShowInterventionPlan] = useState(false);

  useEffect(() => {
    if (!isOpen || !caseId) return;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCaseDetail(caseId);
        setCaseDetail(data);
      } catch (err) {
        console.error('Failed to fetch case details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load case details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [caseId, isOpen]);

  const loadFullConversation = async () => {
    if (!caseDetail?.conversation_id) return;

    try {
      const data = await getCaseConversation(caseId, 200);
      setFullConversation(data.messages);
      setShowFullConversation(true);
    } catch (err) {
      console.error('Failed to fetch full conversation:', err);
    }
  };

  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
      case 'med': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-200';
      case 'waiting': return 'text-amber-600 bg-amber-100 dark:bg-amber-900 dark:text-amber-200';
      case 'resolved': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
      case 'closed': return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Case Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close case details"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">Loading case details...</div>
            </div>
          ) : error ? (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-4 rounded-lg">
              {error}
            </div>
          ) : caseDetail ? (
            <div className="space-y-6">
              {/* Case Overview */}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Case ID</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100">{caseDetail.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">User Hash</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-gray-100">{caseDetail.user_hash}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(caseDetail.status)}`}>
                      {caseDetail.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Severity</p>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(caseDetail.severity)}`}>
                      {caseDetail.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Assigned To</p>
                    <p className="text-gray-900 dark:text-gray-100">
                      {caseDetail.assigned_to || <span className="text-gray-500 italic">Unassigned</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SLA Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        caseDetail.sla_status === 'breached' ? 'bg-red-500' :
                        caseDetail.sla_status === 'critical' ? 'bg-red-400 animate-pulse' :
                        caseDetail.sla_status === 'warning' ? 'bg-yellow-400' :
                        'bg-green-400'
                      }`} />
                      <span className="text-gray-900 dark:text-gray-100">
                        {caseDetail.sla_status}
                        {caseDetail.minutes_until_breach !== null && ` (${caseDetail.minutes_until_breach}m)`}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                    <p className="text-gray-900 dark:text-gray-100">
                      {formatDistanceToNow(new Date(caseDetail.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
                    <p className="text-gray-900 dark:text-gray-100">
                      {formatDistanceToNow(new Date(caseDetail.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {caseDetail.summary_redacted && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Summary</p>
                    <p className="text-gray-900 dark:text-gray-100">{caseDetail.summary_redacted}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onStatusUpdate?.(caseId)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Update Status
                </button>
                <button
                  onClick={() => onAssign?.(caseId)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Assign/Reassign
                </button>
                <button
                  onClick={async () => {
                    if (!caseDetail) return;
                    
                    try {
                      // Dynamic import to avoid circular dependencies
                      const { langGraphApi } = await import('@/services/langGraphApi');
                      const toast = (await import('react-hot-toast')).default;
                      
                      // Prepare TCA request from case data
                      // Note: user_id not available in CaseDetailResponse, using placeholder
                      const tcaRequest = {
                        user_id: parseInt(caseDetail.user_hash.substring(0, 8), 16) % 10000, // Derive numeric ID from hash
                        session_id: caseDetail.session_id || caseDetail.conversation_id || `case_${caseDetail.id}`,
                        user_hash: caseDetail.user_hash,
                        severity: caseDetail.severity === 'med' ? 'moderate' : caseDetail.severity as 'critical' | 'high' | 'moderate' | 'low',
                        message: caseDetail.summary_redacted || 'Generate intervention plan for this case',
                        intent: 'intervention_plan_generation',
                        risk_level: caseDetail.severity === 'critical' ? 3 : caseDetail.severity === 'high' ? 2 : caseDetail.severity === 'med' ? 1 : 0,
                      };
                      
                      toast.loading('Generating intervention plan with TCA...', { id: 'tca-gen' });
                      const result = await langGraphApi.executeTCA(tcaRequest);
                      
                      if (result.success && result.intervention_plan) {
                        toast.success(
                          `✅ Intervention Plan Generated!`,
                          { id: 'tca-gen', duration: 2000 }
                        );
                        
                        // Store result and show modal
                        setInterventionPlanResult(result);
                        setShowInterventionPlan(true);
                      } else {
                        toast.error(
                          result.errors?.join(', ') || 'Failed to generate intervention plan',
                          { id: 'tca-gen' }
                        );
                      }
                    } catch (err) {
                      const toast = (await import('react-hot-toast')).default;
                      toast.error(
                        `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
                        { id: 'tca-gen' }
                      );
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Intervention Plan (TCA)
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex gap-4">
                  {['overview', 'notes', 'assignments', 'triage', 'conversation'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as typeof activeTab)}
                      className={`px-4 py-2 border-b-2 font-medium text-sm ${
                        activeTab === tab
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      {tab === 'notes' && ` (${caseDetail.notes.length})`}
                      {tab === 'assignments' && ` (${caseDetail.assignments.length})`}
                      {tab === 'triage' && ` (${caseDetail.triage_assessments.length})`}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="space-y-4">
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    {caseDetail.notes.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 italic">No notes yet</p>
                    ) : (
                      caseDetail.notes.map((note) => (
                        <div key={note.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-gray-900 dark:text-gray-100">{note.note}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {format(new Date(note.created_at), 'MMM dd, yyyy HH:mm')}
                            {note.author_id && ` • Author ID: ${note.author_id}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'assignments' && (
                  <div className="space-y-3">
                    {caseDetail.assignments.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 italic">No assignment history</p>
                    ) : (
                      caseDetail.assignments.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <p className="text-gray-900 dark:text-gray-100 font-medium">
                            Assigned to: {assignment.assigned_to ?? 'Unassigned'}
                            {assignment.assignee_role && (
                              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                ({assignment.assignee_role})
                              </span>
                            )}
                          </p>
                          {assignment.previous_assignee && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Previous: {assignment.previous_assignee}
                            </p>
                          )}
                          {assignment.reassignment_reason && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                              Reason: {assignment.reassignment_reason}
                            </p>
                          )}
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {format(new Date(assignment.assigned_at), 'MMM dd, yyyy HH:mm')}
                            {assignment.assigned_by && ` • By: ${assignment.assigned_by}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'triage' && (
                  <div className="space-y-3">
                    {caseDetail.triage_assessments.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 italic">No triage assessments</p>
                    ) : (
                      caseDetail.triage_assessments.map((triage) => (
                        <div key={triage.id} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Risk Score</p>
                              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {(triage.risk_score * 100).toFixed(1)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Severity</p>
                              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(triage.severity_level)}`}>
                                {triage.severity_level}
                              </span>
                            </div>
                            {triage.confidence_score !== null && (
                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
                                <p className="text-gray-900 dark:text-gray-100">
                                  {(triage.confidence_score * 100).toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>
                          {triage.risk_factors && triage.risk_factors.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Risk Factors</p>
                              <div className="flex flex-wrap gap-2">
                                {triage.risk_factors.map((factor, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-xs rounded-full"
                                  >
                                    {factor}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {format(new Date(triage.created_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'conversation' && (
                  <div className="space-y-3">
                    {!caseDetail.conversation_preview || caseDetail.conversation_preview.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 italic">No conversation linked</p>
                    ) : (
                      <>
                        {(showFullConversation ? fullConversation : caseDetail.conversation_preview)?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-4 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-blue-50 dark:bg-blue-900'
                                : 'bg-gray-50 dark:bg-gray-900'
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {msg.role === 'user' ? 'User' : 'Assistant'}
                            </p>
                            <p className="text-gray-900 dark:text-gray-100">{msg.content}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {format(new Date(msg.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                            </p>
                          </div>
                        ))}
                        {!showFullConversation && caseDetail.conversation_id && (
                          <button
                            onClick={loadFullConversation}
                            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            Load Full Conversation
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>

      {/* Intervention Plan Modal */}
      <InterventionPlanModal
        isOpen={showInterventionPlan}
        onClose={() => setShowInterventionPlan(false)}
        plan={interventionPlanResult ? {
          intervention_type: interventionPlanResult.intervention_type,
          steps: interventionPlanResult.intervention_plan.plan_steps.map((step, idx) => ({
            step: step.title,
            description: step.description,
            order: idx + 1,
          })),
          resources: interventionPlanResult.intervention_plan.resource_cards.map(card => card.title),
          estimated_duration: interventionPlanResult.intervention_plan.next_check_in?.timeframe,
          follow_up_recommended: true,
        } : null}
        planId={interventionPlanResult?.intervention_plan_id?.toString()}
        executionTime={interventionPlanResult?.execution_time_ms}
      />
    </div>
  );
}
