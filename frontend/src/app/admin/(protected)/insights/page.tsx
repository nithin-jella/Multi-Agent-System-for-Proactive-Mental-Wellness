/**
 * Insights Dashboard
 * 
 * Purpose: Privacy-preserving analytics through Insights Agent (IA)
 * - 6 allow-listed queries with k-anonymity (k≥5)
 * - Differential privacy budget tracking (ε-δ)
 * - Consent validation
 * 
 * User Role: Admin only
 */

'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Calendar, MoreVertical, Eye } from 'lucide-react';
import Link from 'next/link';
import { PrivacySafeguardsStatus } from './components/PrivacySafeguardsStatus';
import { IAQuerySelector } from './components/IAQuerySelector';
import { IAQueryResults } from './components/IAQueryResults';
import { useIAExecution } from './hooks/useIAExecution';
import { listInsightsReports } from '@/services/adminDashboardApi';
import type { InsightsReport } from '@/services/adminDashboardApi';
import toast from 'react-hot-toast';

export default function InsightsPage() {
  const { loading, result, executeQuery } = useIAExecution();
  const [reports, setReports] = useState<InsightsReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoadingReports(true);
        const data = await listInsightsReports({ limit: 5 });
        setReports(data.reports);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
        toast.error('Failed to load reports');
      } finally {
        setLoadingReports(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Insights Analytics</h1>
            <p className="text-white/60 text-sm">
              Privacy-preserving analytics with k-anonymity and differential privacy
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#FFCA40]/10 backdrop-blur-sm border border-[#FFCA40]/20 rounded-lg px-4 py-2.5">
            <svg className="h-4 w-4 text-[#FFCA40]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs font-medium text-[#FFCA40]">Privacy Compliant</span>
          </div>
        </div>

        {/* Privacy Safeguards Status */}
        <div>
          <PrivacySafeguardsStatus />
        </div>

        {/* Query Selector */}
        <div>
          <IAQuerySelector onExecute={executeQuery} loading={loading} />
        </div>

        {/* Query Results */}
        <div>
          <IAQueryResults result={result} loading={loading} />
        </div>

        {/* Recent Reports */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar size={18} className="text-[#FFCA40]" />
              Recent Reports
            </h3>
            <Link
              href="/admin/insights/reports"
              className="text-sm text-[#FFCA40]/80 hover:text-[#FFCA40] transition-colors"
            >
              View All
            </Link>
          </div>
          {loadingReports ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="text-white/30 mx-auto mb-3" size={48} />
              <p className="text-white/70">No reports generated yet</p>
              <p className="text-white/50 text-sm mt-1">Run a query to generate your first insights report</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/insights/reports/${report.id}`}
                  className="block bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium capitalize">
                          {report.report_type} Report
                        </span>
                        {report.sentiment_data?.llm_powered && (
                          <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold rounded-full">
                            AI
                          </span>
                        )}
                        <span className="text-white/50 text-xs">
                          {formatDistanceToNow(new Date(report.generated_at), { addSuffix: true })}
                        </span>
                      </div>
                      {report.summary && (
                        <p className="text-white/70 text-sm line-clamp-2">
                          {report.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {report.assessment_count} assessments
                        </span>
                        {report.high_risk_count > 0 && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <MoreVertical size={12} />
                            {report.high_risk_count} high risk
                          </span>
                        )}
                      </div>
                    </div>
                    <Eye size={18} className="text-white/40 group-hover:text-[#FFCA40] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Privacy Information */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-[#FFCA40]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white mb-3">Privacy Guarantees</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70">
                <div className="flex items-start gap-2">
                  <span className="text-[#FFCA40] mt-0.5">•</span>
                  <span><strong className="text-white/90">k-anonymity (k≥5):</strong> Every result group contains at least 5 users</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FFCA40] mt-0.5">•</span>
                  <span><strong className="text-white/90">Differential Privacy:</strong> ε-δ budget tracking prevents re-identification</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FFCA40] mt-0.5">•</span>
                  <span><strong className="text-white/90">Consent Validation:</strong> Only analyzes users who opted in to analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#FFCA40] mt-0.5">•</span>
                  <span><strong className="text-white/90">Allow-listed Queries:</strong> Only 6 pre-approved queries can be executed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
