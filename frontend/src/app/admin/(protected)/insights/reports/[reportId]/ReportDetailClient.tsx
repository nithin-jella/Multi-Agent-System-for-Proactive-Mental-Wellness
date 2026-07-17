/**
 * ReportDetailClient Component
 * Client component for displaying IA insights report details
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, FileText, TrendingUp, AlertTriangle, CheckCircle, Users, Brain, Download } from 'lucide-react';
import Link from 'next/link';
import { getInsightsReport } from '@/services/adminDashboardApi';
import type { InsightsReport } from '@/services/adminDashboardApi';
import toast from 'react-hot-toast';

interface ReportDetailClientProps {
  reportId: string;
}

export function ReportDetailClient({ reportId }: ReportDetailClientProps) {
  const [report, setReport] = useState<InsightsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getInsightsReport(reportId);
        setReport(data);
      } catch (err) {
        console.error('Failed to fetch report:', err);
        setError(err instanceof Error ? err.message : 'Failed to load report');
        toast.error('Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-[#FFCA40]/30 border-t-[#FFCA40] animate-spin" />
          <p className="text-white/70">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="bg-white/5 backdrop-blur-sm border border-red-500/30 rounded-xl p-6 max-w-md">
          <AlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-semibold text-white text-center mb-2">
            Failed to Load Report
          </h2>
          <p className="text-white/70 text-center text-sm">
            {error || 'The report could not be found or loaded.'}
          </p>
          <Link
            href="/admin/insights"
            className="mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-[#FFCA40]/20 border border-[#FFCA40]/40 text-[#FFCA40] rounded-lg hover:bg-[#FFCA40]/30 transition-colors w-full"
          >
            <ArrowLeft size={16} />
            Back to Insights
          </Link>
        </div>
      </div>
    );
  }

  const sentimentData = report.sentiment_data;
  const severityDist = sentimentData?.severity_distribution;
  const patterns = sentimentData?.patterns || [];
  const recommendations = sentimentData?.recommendations || [];

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-[#FFCA40]/20 border border-[#FFCA40]/40 flex items-center justify-center">
                <FileText className="text-[#FFCA40]" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-white">
                    {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Insights Report
                  </h1>
                  {report.sentiment_data?.llm_powered && (
                    <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold rounded-full">
                      AI-Powered
                    </span>
                  )}
                </div>
                <p className="text-white/60 text-sm">
                  Generated {format(new Date(report.generated_at), 'PPPppp, dd MMMM yyyy')}
                </p>
              </div>
            </div>
            <Link
              href="/admin/insights"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </Link>
          </div>

          {/* Time Range */}
          <div className="mt-6 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-white/70">
              <span className="font-medium">Period:</span>
              <span className="text-white">
                {format(new Date(report.period_start), 'MMM dd, yyyy')} – {format(new Date(report.period_end), 'MMM dd, yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Users className="text-blue-400" size={20} />
              <span className="text-white/70 text-sm">Assessments</span>
            </div>
            <p className="text-3xl font-bold text-white">{report.assessment_count}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="text-orange-400" size={20} />
              <span className="text-white/70 text-sm">High Risk Cases</span>
            </div>
            <p className="text-3xl font-bold text-white">{report.high_risk_count}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="text-[#FFCA40]" size={20} />
              <span className="text-white/70 text-sm">AI Analysis</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {report.sentiment_data?.llm_powered ? 'Gemini-Powered' : 'Standard'}
            </p>
          </div>
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FileText size={18} className="text-[#FFCA40]" />
              Executive Summary
            </h2>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{report.summary}</p>
          </div>
        )}

        {/* Sentiment Data */}
        {sentimentData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Average Sentiment */}
            {sentimentData.avg_sentiment !== undefined && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Average Sentiment Score</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                      style={{ width: `${sentimentData.avg_sentiment * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-mono text-lg font-bold w-16 text-right">
                    {(sentimentData.avg_sentiment * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-white/50 text-xs mt-2">
                  Higher percentage indicates more positive sentiment
                </p>
              </div>
            )}

            {/* Average Risk */}
            {sentimentData.avg_risk !== undefined && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <h3 className="text-base font-semibold text-white mb-4">Average Risk Level</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        sentimentData.avg_risk < 0.3 ? 'bg-green-500' :
                        sentimentData.avg_risk < 0.6 ? 'bg-yellow-500' :
                        sentimentData.avg_risk < 0.8 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${sentimentData.avg_risk * 100}%` }}
                    />
                  </div>
                  <span className={`text-white font-mono text-lg font-bold w-16 text-right ${
                    sentimentData.avg_risk < 0.3 ? 'text-green-400' :
                    sentimentData.avg_risk < 0.6 ? 'text-yellow-400' :
                    sentimentData.avg_risk < 0.8 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {(sentimentData.avg_risk * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-white/50 text-xs mt-2">
                  Lower percentage indicates lower risk
                </p>
              </div>
            )}
          </div>
        )}

        {/* Severity Distribution */}
        {severityDist && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-400" />
              Risk Severity Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300 text-sm mb-1">Low</p>
                <p className="text-2xl font-bold text-white">{severityDist.low}</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm mb-1">Medium</p>
                <p className="text-2xl font-bold text-white">{severityDist.medium}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <p className="text-orange-300 text-sm mb-1">High</p>
                <p className="text-2xl font-bold text-white">{severityDist.high}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-1">Critical</p>
                <p className="text-2xl font-bold text-white">{severityDist.critical}</p>
              </div>
            </div>
          </div>
        )}

        {/* Patterns */}
        {patterns.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" />
              Detected Patterns
            </h3>
            <div className="space-y-3">
              {patterns.map((pattern, index) => (
                <div key={index} className={`border-l-4 rounded-lg p-4 ${
                  pattern.severity === 'high' ? 'border-red-500 bg-red-500/5' :
                  pattern.severity === 'medium' ? 'border-yellow-500 bg-yellow-500/5' :
                  'border-blue-500 bg-blue-500/5'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-1">{pattern.title}</h4>
                      <p className="text-white/70 text-sm">{pattern.description}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded ${
                        pattern.trend === 'increasing' ? 'bg-red-500/20 text-red-300' :
                        pattern.trend === 'decreasing' ? 'bg-green-500/20 text-green-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {pattern.trend}
                      </span>
                      <span className={`px-2 py-1 rounded font-medium ${
                        pattern.severity === 'high' ? 'bg-red-500/30 text-red-300' :
                        pattern.severity === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-blue-500/30 text-blue-300'
                      }`}>
                        {pattern.severity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-400" />
              Actionable Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((rec, index) => (
                <div key={index} className={`border rounded-lg p-4 ${
                  rec.priority === 'high' ? 'border-red-500/40 bg-red-500/5' :
                  rec.priority === 'medium' ? 'border-yellow-500/40 bg-yellow-500/5' :
                  'border-blue-500/40 bg-blue-500/5'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      rec.priority === 'high' ? 'bg-red-500/30 text-red-300' :
                      rec.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                      'bg-blue-500/30 text-blue-300'
                    }`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-white/50 text-xs uppercase tracking-wide">
                      {rec.category}
                    </span>
                  </div>
                  <h4 className="text-white font-semibold mb-1">{rec.title}</h4>
                  <p className="text-white/70 text-sm">{rec.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Topics */}
        {report.trending_topics && Object.keys(report.trending_topics).length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-[#FFCA40]" />
              Trending Topics
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.trending_topics).map(([topic, data], index) => (
                <div
                  key={index}
                  className="px-3 py-1.5 bg-[#FFCA40]/15 border border-[#FFCA40]/30 text-[#FFCA40] rounded-full text-sm"
                >
                  {typeof data === 'string'
                    ? data
                    : typeof data === 'object' && data !== null && 'topic' in data && typeof (data as { topic?: unknown }).topic === 'string'
                      ? (data as { topic: string }).topic
                      : topic}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/insights"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Reports
          </Link>
          <button
            onClick={() => toast.success('Report exported (mock)')}
            className="flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/15 border border-[#FFCA40]/40 text-[#FFCA40] rounded-lg hover:bg-[#FFCA40]/25 transition-colors"
          >
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>
    </div>
  );
}
