'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Clock, Users, Send, AlertCircle, CheckCircle } from 'lucide-react';
import type { CampaignExecutionHistory } from '@/types/admin/campaigns';

interface CampaignHistoryTableProps {
  executions: CampaignExecutionHistory[];
  loading?: boolean;
}

export function CampaignHistoryTable({ executions, loading }: CampaignHistoryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No execution history yet</p>
        <p className="text-sm mt-2">Execute this campaign to see logs here</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-12 px-4 py-3"></th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Execution Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Targets
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Messages
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {executions.map((execution) => {
            const isExpanded = expandedRows.has(execution.id);
            const successRate = execution.total_targeted > 0
              ? Math.round((execution.messages_sent / execution.total_targeted) * 100)
              : 0;

            return (
              <>
                <tr
                  key={execution.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleRow(execution.id)}
                >
                  <td className="px-4 py-4 text-center">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(execution.executed_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(execution.executed_at), 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-900">{execution.total_targeted}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <span className="text-green-600 font-medium">{execution.messages_sent}</span>
                      {execution.messages_failed > 0 && (
                        <span className="text-red-600 ml-2">
                          / {execution.messages_failed} failed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {execution.execution_time_seconds.toFixed(2)}s
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {execution.dry_run ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <AlertCircle className="w-3 h-3" />
                        Dry Run
                      </span>
                    ) : successRate >= 90 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3" />
                        Success ({successRate}%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        <AlertCircle className="w-3 h-3" />
                        Partial ({successRate}%)
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${execution.id}-details`}>
                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                      <div className="space-y-4">
                        {/* Message Content */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Message Sent:</h4>
                          <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
                            {execution.message_content}
                          </div>
                        </div>

                        {/* Targeted Users */}
                        {execution.targeted_user_ids && execution.targeted_user_ids.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Targeted Users ({execution.targeted_user_ids.length}):
                            </h4>
                            <div className="bg-white border border-gray-200 rounded p-3 max-h-40 overflow-y-auto">
                              <div className="flex flex-wrap gap-2">
                                {execution.targeted_user_ids.map((userId) => (
                                  <span
                                    key={userId}
                                    className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                                  >
                                    User {userId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {execution.error_message && (
                          <div>
                            <h4 className="text-sm font-semibold text-red-700 mb-2">Errors:</h4>
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                              {execution.error_message}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-6 text-xs text-gray-500">
                          <div>
                            <span className="font-medium">Campaign:</span> {execution.campaign_name}
                          </div>
                          <div>
                            <span className="font-medium">Execution ID:</span> {execution.id.substring(0, 8)}...
                          </div>
                          {execution.executed_by && (
                            <div>
                              <span className="font-medium">Executed by:</span> User {execution.executed_by}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
