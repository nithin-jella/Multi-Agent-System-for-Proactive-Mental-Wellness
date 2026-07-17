/**
 * ReportsListClient Component
 * Displays paginated list of all IA insights reports
 */

'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Filter, ChevronDown, FileText, Download, Trash2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { listInsightsReports } from '@/services/adminDashboardApi';
import type { InsightsReport } from '@/services/adminDashboardApi';
import toast from 'react-hot-toast';

const REPORT_TYPES = ['weekly', 'monthly', 'ad_hoc'];

export function ReportsListClient() {
  const [reports, setReports] = useState<InsightsReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    report_type: '',
    limit: 20,
    offset: 0,
  });

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const data = await listInsightsReports({
          report_type: filters.report_type || undefined,
          limit: filters.limit,
          offset: filters.offset,
        });
        setReports(data.reports);
        setTotal(data.total);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [filters]);

  const handleFilterChange = (reportType: string) => {
    setFilters(prev => ({ ...prev, report_type: reportType, offset: 0 }));
  };

  const handleRefresh = () => {
    setFilters(prev => ({ ...prev, offset: 0 }));
  };

  const totalPages = Math.ceil(total / filters.limit);
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/insights"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Insights
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Reports</h1>
              <p className="text-white/60 text-sm">
                {total} report{total !== 1 ? 's' : ''} generated
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/15 border border-[#FFCA40]/40 text-[#FFCA40] rounded-lg hover:bg-[#FFCA40]/25 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={18} className="text-white/70" />
            {REPORT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleFilterChange(filters.report_type === type ? '' : type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filters.report_type === type
                    ? 'bg-[#FFCA40]/20 border border-[#FFCA40]/40 text-[#FFCA40]'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Reports List */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="text-white/30 mx-auto mb-4" size={64} />
              <h3 className="text-xl font-semibold text-white mb-2">No Reports Found</h3>
              <p className="text-white/60">
                {filters.report_type
                  ? `No ${filters.report_type} reports have been generated yet.`
                  : 'No reports have been generated yet. Run a query to create your first report.'}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-white/5">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/admin/insights/reports/${report.id}`}
                    className="block hover:bg-white/5 transition-colors"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white capitalize">
                              {report.report_type} Report
                            </h3>
                            {report.sentiment_data?.llm_powered && (
                              <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold rounded-full">
                                AI-Powered
                              </span>
                            )}
                            <span className="text-white/50 text-xs">
                              {formatDistanceToNow(new Date(report.generated_at), { addSuffix: true })}
                            </span>
                          </div>
                          {report.summary && (
                            <p className="text-white/70 text-sm line-clamp-2 mb-3">
                              {report.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2 text-white/70">
                              <Calendar size={14} />
                              <span>
                                {new Date(report.period_start).toLocaleDateString()} – {new Date(report.period_end).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-white/70">
                              <FileText size={14} />
                              <span>{report.assessment_count} assessments</span>
                            </div>
                            {report.high_risk_count > 0 && (
                              <div className="flex items-center gap-2 text-orange-400">
                                <Filter size={14} />
                                <span>{report.high_risk_count} high risk</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Download size={18} className="text-white/40 hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-t border-white/10">
                  <span className="text-white/60 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      const isCurrent = pageNum === currentPage;
                      const isNearStart = pageNum <= 2 || Math.abs(pageNum - currentPage) <= 2;
                      
                      if (!isNearStart && i === 2) {
                        return <span key="ellipsis-1" className="text-white/50">...</span>;
                      }
                      if (!isNearStart) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setFilters(prev => ({ ...prev, offset: (pageNum - 1) * prev.limit }))}
                          className={`min-w-[40px] p-2 rounded-lg transition-colors ${
                            isCurrent
                              ? 'bg-[#FFCA40]/20 border border-[#FFCA40]/40 text-[#FFCA40]'
                              : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white/80'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && <span className="text-white/50">...</span>}
                    <button
                      onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
