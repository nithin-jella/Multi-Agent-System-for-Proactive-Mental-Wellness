'use client';

import { useState, useCallback } from 'react';
import { X, History, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCampaignHistory } from '@/services/adminCampaignApi';
import { CampaignHistoryTable } from './CampaignHistoryTable';
import type { Campaign } from '@/types/admin/campaigns';

interface CampaignHistoryModalProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

export function CampaignHistoryModal({ campaign, isOpen, onClose }: CampaignHistoryModalProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-history', campaign.id, page],
    queryFn: () => getCampaignHistory(campaign.id, page * pageSize, pageSize),
    enabled: isOpen,
  });

  const handleExportCSV = useCallback(() => {
    if (!data?.items) return;

    const headers = [
      'Execution Time',
      'Total Targeted',
      'Messages Sent',
      'Messages Failed',
      'Duration (s)',
      'Dry Run',
      'Executor ID',
    ];

    const rows = data.items.map((exec) => [
      new Date(exec.executed_at).toISOString(),
      exec.total_targeted,
      exec.messages_sent,
      exec.messages_failed,
      exec.execution_time_seconds.toFixed(2),
      exec.dry_run ? 'Yes' : 'No',
      exec.executed_by || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campaign-${campaign.id}-history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data, campaign.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-[#00153a] via-[#001a47] to-[#00153a] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-[#FFCA40]" />
            <div>
              <h2 className="text-2xl font-bold text-white">Campaign History</h2>
              <p className="text-sm text-white/60 mt-1">{campaign.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && data.items.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center gap-2"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
              aria-label="Close campaign history modal"
              title="Close campaign history modal"
            >
              <X className="w-6 h-6" />
              <span className="sr-only">Close campaign history modal</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <CampaignHistoryTable executions={data?.items || []} loading={isLoading} />
          </div>

          {/* Pagination */}
          {data && data.total > pageSize && (
            <div className="flex items-center justify-between mt-6 px-4">
              <div className="text-sm text-white/60">
                Showing {page * pageSize + 1}-
                {Math.min((page + 1) * pageSize, data.total)} of {data.total} executions
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  title="Previous page"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= data.total}
                  title="Next page"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
