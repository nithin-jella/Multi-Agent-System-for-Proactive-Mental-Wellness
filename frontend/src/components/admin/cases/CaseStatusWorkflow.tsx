/**
 * CaseStatusWorkflow Component
 * Handles case status updates with validation
 */

'use client';

import { useState } from 'react';
import { updateCaseStatus } from '@/services/adminCaseApi';
import type { CaseStatus } from '@/types/admin/cases';
import toast from 'react-hot-toast';

interface CaseStatusWorkflowProps {
  caseId: string;
  currentStatus: CaseStatus;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CaseStatusWorkflow({
  caseId,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: CaseStatusWorkflowProps) {
  const [newStatus, setNewStatus] = useState<CaseStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getAvailableStatuses = (): CaseStatus[] => {
    const transitions: Record<CaseStatus, CaseStatus[]> = {
      new: ['in_progress', 'waiting', 'closed'],
      in_progress: ['waiting', 'resolved', 'closed'],
      waiting: ['in_progress', 'resolved', 'closed'],
      resolved: ['closed'],
      closed: [],
    };
    return transitions[currentStatus] || [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newStatus === currentStatus) {
      toast.error('Please select a different status');
      return;
    }

    setSubmitting(true);
    try {
      await updateCaseStatus(caseId, {
        status: newStatus,
        note: note.trim() || undefined,
      });
      toast.success(`Case status updated to ${newStatus.replace('_', ' ')}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update case status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const availableStatuses = getAvailableStatuses();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Update Case Status
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Status
            </label>
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-900 dark:text-gray-100">
              {currentStatus.replace('_', ' ')}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Status <span className="text-red-500">*</span>
            </label>
            {availableStatuses.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No status transitions available. Case is already closed.
              </p>
            ) : (
              <select
                id="case-new-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
                aria-label="Select new case status"
              >
                <option value="">Select new status...</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note explaining the status change..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Workflow Help */}
          <div className="bg-blue-50 dark:bg-blue-900 p-3 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              <strong>Workflow:</strong> new → in_progress → resolved → closed
              <br />
              <span className="text-xs">Emergency closure available from any status</span>
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
              disabled={submitting || availableStatuses.length === 0 || newStatus === currentStatus}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
