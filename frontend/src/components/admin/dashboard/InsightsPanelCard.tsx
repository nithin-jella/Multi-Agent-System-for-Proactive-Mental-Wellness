'use client';

import { motion } from 'framer-motion';
import { 
  ClockIcon, 
  CalendarIcon, 
  SparklesIcon, 
  BellAlertIcon,
  LightBulbIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import type { InsightsPanel, PatternInsight, RecommendationItem } from '@/types/admin/dashboard';

interface InsightsPanelProps {
  insights: InsightsPanel;
  onGenerateReport?: () => void;
  onGenerateCampaign?: () => void;
}

// Helper to get trend icon
function TrendIcon({ trend }: { trend: PatternInsight['trend'] }) {
  switch (trend) {
    case 'increasing':
      return <ArrowTrendingUpIcon className="w-4 h-4 text-red-400" />;
    case 'decreasing':
      return <ArrowTrendingDownIcon className="w-4 h-4 text-green-400" />;
    default:
      return <MinusIcon className="w-4 h-4 text-yellow-400" />;
  }
}

// Helper to get severity badge color
function getSeverityColor(severity: 'low' | 'medium' | 'high'): string {
  switch (severity) {
    case 'high':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

// Helper to get priority icon
function PriorityIcon({ priority }: { priority: RecommendationItem['priority'] }) {
  switch (priority) {
    case 'high':
      return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
    case 'medium':
      return <InformationCircleIcon className="w-4 h-4 text-yellow-400" />;
    default:
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
  }
}

// Helper to get category badge color
function getCategoryColor(category: RecommendationItem['category']): string {
  switch (category) {
    case 'intervention':
      return 'bg-red-500/20 text-red-300';
    case 'resource':
      return 'bg-blue-500/20 text-blue-300';
    case 'communication':
      return 'bg-purple-500/20 text-purple-300';
    case 'monitoring':
      return 'bg-cyan-500/20 text-cyan-300';
    default:
      return 'bg-slate-500/20 text-slate-300';
  }
}

export function InsightsPanelCard({ insights, onGenerateReport, onGenerateCampaign }: InsightsPanelProps) {
  const hasInsights = insights.ia_summary && insights.ia_summary.trim().length > 0;
  const hasPatterns = insights.patterns && insights.patterns.length > 0;
  const hasRecommendations = insights.recommendations && insights.recommendations.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">AI Insights</h3>
              {insights.llm_powered && (
                <span className="px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 
                  text-blue-300 rounded-full border border-blue-500/30 flex items-center gap-1">
                  <SparklesIcon className="w-3 h-3" />
                  Gemini
                </span>
              )}
            </div>
            {insights.report_generated_at && (
              <div className="flex items-center gap-2 text-xs text-white/60 mt-1">
                <ClockIcon className="w-4 h-4" />
                <span>
                  Updated {new Date(insights.report_generated_at).toLocaleDateString()}
                </span>
              </div>
            )}
            {insights.report_period && (
              <div className="flex items-center gap-2 text-xs text-white/60 mt-1">
                <CalendarIcon className="w-4 h-4" />
                <span>Period: {insights.report_period}</span>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Generate Report Button */}
            {onGenerateReport && (
              <button
                onClick={onGenerateReport}
                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 
                  hover:to-purple-600 text-white text-xs font-medium rounded-lg shadow-lg 
                  shadow-blue-500/30 transition-all duration-200 flex items-center gap-2"
                title="Generate new AI-powered IA report"
              >
                <SparklesIcon className="w-4 h-4" />
                Generate
              </button>
            )}
            
            {/* Generate Campaign Button */}
            {onGenerateCampaign && hasInsights && (
              <button
                onClick={onGenerateCampaign}
                className="px-3 py-2 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 
                  hover:to-orange-600 text-white text-xs font-medium rounded-lg shadow-lg 
                  shadow-pink-500/30 transition-all duration-200 flex items-center gap-2"
                title="Create campaign based on these insights"
              >
                <BellAlertIcon className="w-4 h-4" />
                Create Campaign
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* IA Summary */}
        <div>
          <h4 className="text-sm font-medium text-white/80 mb-2">Summary</h4>
          <p className="text-sm text-white/70 leading-relaxed">
            {insights.ia_summary || 'No insights available yet. Generate a report to see AI-powered analysis.'}
          </p>
        </div>

        {/* LLM-Powered Patterns Section */}
        {hasPatterns && (
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <LightBulbIcon className="w-4 h-4 text-yellow-400" />
              Identified Patterns
            </h4>
            <div className="space-y-3">
              {insights.patterns!.map((pattern, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={pattern.trend} />
                      <span className="text-sm font-medium text-white">{pattern.title}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSeverityColor(pattern.severity)}`}>
                      {pattern.severity}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed pl-6">
                    {pattern.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* LLM-Powered Recommendations Section */}
        {hasRecommendations && (
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-400" />
              Actionable Recommendations
            </h4>
            <div className="space-y-3">
              {insights.recommendations!.map((rec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <PriorityIcon priority={rec.priority} />
                      <span className="text-sm font-medium text-white">{rec.title}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(rec.category)}`}>
                      {rec.category}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed pl-6">
                    {rec.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Topics */}
        {insights.trending_topics && insights.trending_topics.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-3">Trending Topics</h4>
            <div className="space-y-2">
              {insights.trending_topics.map((topic, index) => {
                const maxCount = Math.max(...insights.trending_topics.map(t => t.count));
                const percentage = (topic.count / maxCount) * 100;
                
                return (
                  <div key={topic.topic} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 font-medium">
                        {index + 1}. {topic.topic}
                      </span>
                      <span className="text-white/50">{topic.count} mentions</span>
                    </div>
                    <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Severity Distribution */}
        {insights.severity_distribution && (
          <div>
            <h4 className="text-sm font-medium text-white/80 mb-3">Severity Distribution</h4>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(insights.severity_distribution).map(([level, count]) => (
                <div 
                  key={level} 
                  className={`p-2 rounded-lg text-center ${
                    level === 'critical' ? 'bg-red-500/20' :
                    level === 'high' ? 'bg-orange-500/20' :
                    level === 'medium' ? 'bg-yellow-500/20' :
                    'bg-green-500/20'
                  }`}
                >
                  <div className={`text-lg font-bold ${
                    level === 'critical' ? 'text-red-400' :
                    level === 'high' ? 'text-orange-400' :
                    level === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {count}
                  </div>
                  <div className="text-xs text-white/60 capitalize">{level}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
