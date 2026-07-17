/**
 * CaseAssignment Component
 * Handles case assignment and reassignment
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { assignCase } from '@/services/adminCaseApi';
import { listAgentUsers } from '@/services/adminAgentApi';
import type { AgentUserSummary } from '@/types/admin/agentUsers';
import toast from 'react-hot-toast';

interface CaseAssignmentProps {
  caseId: string;
  currentAssignee: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CaseAssignment({
  caseId,
  currentAssignee,
  isOpen,
  onClose,
  onSuccess,
}: CaseAssignmentProps) {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customAssignee, setCustomAssignee] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agentUsers, setAgentUsers] = useState<AgentUserSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedOption('');
      setCustomAssignee('');
      setReason('');
      return;
    }

    setSelectedOption(currentAssignee ?? '');
    setCustomAssignee('');
    setReason('');
    setAgentsLoading(true);

    listAgentUsers()
      .then((agents) => {
        setAgentUsers(agents);
      })
      .catch((error) => {
        console.error('Failed to load agent users:', error);
        toast.error('Unable to load counselor list. You can still enter an ID manually.');
        setAgentUsers([]);
      })
      .finally(() => setAgentsLoading(false));
  }, [isOpen, currentAssignee]);

  const availableAgentOptions = useMemo(() => {
    const ids = new Set(agentUsers.map((agent) => agent.id));
    const options = [...agentUsers];
    if (currentAssignee && !ids.has(currentAssignee)) {
      options.push({ id: currentAssignee, role: 'unknown', created_at: new Date().toISOString() });
    }
    return options;
  }, [agentUsers, currentAssignee]);

  const hasValidAssignee = (() => {
    if (selectedOption === '__unassign__') return true;
    if (selectedOption === '__custom__') return customAssignee.trim().length > 0;
    return selectedOption.trim().length > 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetAssignee: string | null;
    if (selectedOption === '__unassign__') {
      targetAssignee = null;
    } else if (selectedOption === '__custom__') {
      const trimmed = customAssignee.trim();
      if (!trimmed) {
        toast.error('Please enter an agent ID');
        return;
      }
      targetAssignee = trimmed;
    } else if (selectedOption.trim()) {
      targetAssignee = selectedOption.trim();
    } else {
      toast.error('Please choose an assignee');
      return;
    }

    setSubmitting(true);
    try {
      await assignCase(caseId, {
        assigned_to: targetAssignee,
        reason: reason.trim() || undefined,
      });
      const actionLabel = targetAssignee
        ? currentAssignee
          ? `reassigned to ${targetAssignee}`
          : `assigned to ${targetAssignee}`
        : 'unassigned';
      toast.success(`Case ${actionLabel}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to assign case:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign case');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const disableSubmit = submitting || !hasValidAssignee;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {currentAssignee ? 'Reassign Case' : 'Assign Case'}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {currentAssignee && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Assignee
              </label>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
                {currentAssignee}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="case-assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assign To <span className="text-red-500">*</span>
            </label>
            {agentsLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Loading counselors...</p>
            )}
            <select
              id="case-assignee"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">Select counselor...</option>
              {availableAgentOptions.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.id} ({agent.role})
                </option>
              ))}
              <option value="__custom__">Enter custom ID...</option>
              {currentAssignee && <option value="__unassign__">Unassign case</option>}
            </select>
          </div>

          {selectedOption === '__custom__' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Counselor ID/Username
              </label>
              <input
                type="text"
                value={customAssignee}
                onChange={(e) => setCustomAssignee(e.target.value)}
                placeholder="Enter counselor ID or username"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>
          )}

          {currentAssignee && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reason for Reassignment {currentAssignee && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the case is being reassigned..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required={!!currentAssignee}
              />
            </div>
          )}

          {!currentAssignee && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assignment Note (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}

          {/* Info Box */}
          <div className="bg-yellow-50 dark:bg-yellow-900 p-3 rounded-md">
            <p className="text-sm text-yellow-700 dark:text-yellow-200">
              <strong>Note:</strong> Assignment history is tracked for audit purposes.
              {currentAssignee && ' Previous assignee will be recorded.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disableSubmit}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : currentAssignee ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
