'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  EyeIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  BookOpenIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { Toast } from '@/components/admin/dashboard/Toast';
import {
  getScreeningDashboard,
  listScreeningProfiles,
  markProfileReviewed,
} from '@/services/adminScreeningApi';
import type {
  ScreeningDashboard,
  ScreeningProfile,
  ScreeningDimension,
  RiskLevel,
} from '@/types/admin/screening';
import {
  INSTRUMENT_CONFIG,
  DIMENSION_LABELS,
  RISK_CONFIG,
  getSeverityLabel,
} from '@/types/admin/screening';

export default function AdminScreeningPage() {
  const [dashboard, setDashboard] = useState<ScreeningDashboard | null>(null);
  const [profiles, setProfiles] = useState<ScreeningProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ScreeningProfile | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [attentionFilter, setAttentionFilter] = useState<boolean | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [markingReviewed, setMarkingReviewed] = useState<number | null>(null);
  const [showInstrumentInfo, setShowInstrumentInfo] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashboardData, profilesData] = await Promise.all([
        getScreeningDashboard(),
        listScreeningProfiles({
          risk_level: riskFilter !== 'all' ? riskFilter : undefined,
          requires_attention: attentionFilter,
          limit: 50,
        }),
      ]);

      setDashboard(dashboardData);
      setProfiles(profilesData.profiles);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load screening data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [riskFilter, attentionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkReviewed = async (userId: number) => {
    setMarkingReviewed(userId);
    try {
      await markProfileReviewed(userId);
      setToast({ message: 'Profile marked as reviewed', type: 'success' });
      loadData();
      if (selectedProfile?.user_id === userId) {
        setSelectedProfile(null);
      }
    } catch {
      setToast({ message: 'Failed to mark profile as reviewed', type: 'error' });
    } finally {
      setMarkingReviewed(null);
    }
  };

  /** Render risk level badge */
  const renderRiskBadge = (level: RiskLevel) => {
    const config = RISK_CONFIG[level];
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide border shadow-sm ${config.color} ${config.bgColor.replace('/10', '/20')} ${config.borderColor}`}>
        {config.label}
      </span>
    );
  };

  /** Render dimension score with instrument info for modal */
  const renderDimensionBar = (dimension: string, score: number, _confidence: number) => {
    const dim = dimension as ScreeningDimension;
    const instrument = INSTRUMENT_CONFIG[dim];
    const severity = getSeverityLabel(dim, score);
    const severityConfig = RISK_CONFIG[severity];
    const width = Math.min(score * 100, 100);
    
    return (
      <div key={dimension} className="space-y-3 bg-black/10 rounded-xl p-4 border border-white/5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider ${instrument?.bgColor || 'bg-white/10'} ${instrument?.color || 'text-white/70'}`}>
              {instrument?.code || dim}
            </span>
            <div>
              <div className="text-sm font-medium text-white/90">{DIMENSION_LABELS[dim] || dimension}</div>
              {instrument && (
                <div className="text-[10px] text-white/40 mt-0.5">{instrument.name}</div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 ${severityConfig.color}`}>{severityConfig.label}</span>
            <span className="text-[10px] font-mono text-white/40">{(score * 100).toFixed(0)}% Score</span>
          </div>
        </div>
        <div className="h-2.5 bg-[#001030] rounded-full overflow-hidden border border-white/5 relative">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full ${severityConfig.bgColor.replace('/10', '/60')} relative`}
          >
            <div className="absolute inset-0 bg-linear-to-r from-transparent to-white/20" />
          </motion.div>
        </div>
      </div>
    );
  };

  /** Get trend from profile */
  const getTrendLabel = (trajectory: string) => {
    if (trajectory === 'improving') return { label: 'Improving', icon: '↗', color: 'text-emerald-400' };
    if (trajectory === 'declining') return { label: 'Worsening', icon: '↘', color: 'text-rose-400' };
    return { label: 'Stable', icon: '→', color: 'text-slate-400' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-[#FFCA40] rounded-full animate-spin mx-auto shadow-[0_0_15px_rgba(255,202,64,0.3)]" />
          <p className="text-white/60 font-medium animate-pulse">Loading clinical screening data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="text-center space-y-4 bg-white/5 border border-red-500/20 p-8 rounded-2xl backdrop-blur-md max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Data Fetch Failed</h3>
          <p className="text-white/60 text-sm max-w-sm mx-auto">{error}</p>
          <button
            onClick={loadData}
            className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all duration-200 border border-white/10 hover:border-white/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-8">
      {/* Header Card */}
      <motion.div
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
         className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-2xl shadow-[#001030]/50"
      >
        <div className="absolute top-0 right-0 p-40 bg-[#FFCA40]/5 rounded-full blur-[120px] -z-10 -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 p-32 bg-blue-500/5 rounded-full blur-[100px] -z-10 -ml-20 -mb-20 pointer-events-none" />
        
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-linear-to-br from-[#FFCA40]/20 to-[#FFCA40]/5 rounded-xl border border-[#FFCA40]/20 shadow-lg shadow-[#FFCA40]/10">
              <ShieldExclamationIcon className="w-7 h-7 text-[#FFCA40]" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-1.5 flex items-center gap-2">
                Clinical Screening <span className="text-[#FFCA40] font-light">Dashboard</span>
              </h1>
              <p className="text-white/60 text-sm max-w-2xl leading-relaxed">
                Population-level mental health screening indicators automatically mapped to validated instruments (PHQ-9, GAD-7, etc.). Assess risks, prioritize interventions, and review flagged clinical profiles.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto mt-2 xl:mt-0">
            <button
              onClick={() => setShowInstrumentInfo(!showInstrumentInfo)}
              className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border ${
                showInstrumentInfo 
                  ? 'bg-[#FFCA40]/15 border-[#FFCA40]/30 text-[#FFCA40] shadow-inner' 
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <BookOpenIcon className="w-4 h-4" />
              {showInstrumentInfo ? 'Hide Methodology' : 'View Methodology'}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/80 transition-all duration-300 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </motion.div>

      {/* Info Methodology Panel */}
      <AnimatePresence>
        {showInstrumentInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10, transition: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/10 bg-[#001D58]/40 p-6 md:p-8 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <InformationCircleIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Validated Psychological Instruments</h2>
                  <p className="text-xs text-white/60">STA strictly maps conversation dimensions to parameters from established clinical tools.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(INSTRUMENT_CONFIG).map(([dim, info]) => (
                  <div key={dim} className="p-4 rounded-xl border border-white/5 bg-black/20 hover:bg-white/5 hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${info.color} bg-white/5 border border-white/5`}>
                        {info.code}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white/90 mb-1">{info.name}</h3>
                    <p className="text-xs text-white/50 mb-3 leading-relaxed hidden sm:block">{info.description}</p>
                    <div className="mt-auto pt-3 border-t border-white/5">
                      <p className="text-[10px] text-white/40 font-mono">Ref: {info.reference}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Cards (Quick Stats) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-2 relative z-10 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Extraction Scope
          </h2>
          <p className="text-sm text-white/70 leading-relaxed relative z-10 font-medium">
            Student conversations are analyzed longitudinally across 9 clinical dimensions including depression, anxiety, stress, sleep, and crisis indicators.
          </p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-violet-400 mb-2 relative z-10 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span> Processing Engine
          </h2>
          <p className="text-sm text-white/70 leading-relaxed relative z-10 font-medium">
            Signals are evaluated passively by the STA during conversation wind-down. Insights are strictly aligned to standardized thresholds.
          </p>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-rose-400 mb-2 relative z-10 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Alert Triggers
          </h2>
          <p className="text-sm text-white/70 leading-relaxed relative z-10 font-medium">
            Risk scores represent compound net limits (Current minus Protective factors). Flags trigger dynamically on Moderate+ severity or sudden downward trajectories.
          </p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard
            title="Total Profiles"
            value={dashboard.total_profiles}
            subtitle="Distinct students assessed"
            icon={<UserGroupIcon className="w-6 h-6 text-blue-400" />}
            severity="info"
          />
          
          <KPICard
            title="Clinical Threshold"
            value={dashboard.risk_distribution.moderate + dashboard.risk_distribution.severe + dashboard.risk_distribution.critical}
            subtitle="Moderate or higher risk"
            icon={<ExclamationTriangleIcon className="w-6 h-6 text-orange-400" />}
            severity={(dashboard.risk_distribution.moderate + dashboard.risk_distribution.severe + dashboard.risk_distribution.critical) > 0 ? 'warning' : 'success'}
          />
          
          <KPICard
            title="Crisis Alerts"
            value={dashboard.risk_distribution.critical}
            subtitle="C-SSRS positive indicators"
            icon={<ShieldExclamationIcon className="w-6 h-6 text-rose-400" />}
            severity={dashboard.risk_distribution.critical > 0 ? 'critical' : 'success'}
          />
          
          <KPICard
            title="Pending Actions"
            value={dashboard.profiles_requiring_attention}
            subtitle="Awaiting counselor review"
            icon={<ClockIcon className="w-6 h-6 text-amber-400" />}
            severity={dashboard.profiles_requiring_attention > 0 ? 'warning' : 'info'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column: Analytics (Distribution & Concerns) */}
        <div className="xl:col-span-1 space-y-6 lg:space-y-8">
          {/* Risk Distribution Block */}
          {dashboard && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ChartBarIcon className="w-5 h-5 text-[#FFCA40]" />
                  Risk Stratification
                </h2>
              </div>
              
              <div className="space-y-3">
                {(['critical', 'severe', 'moderate', 'mild', 'none'] as RiskLevel[]).map((level) => {
                  const count = dashboard.risk_distribution[level];
                  const config = RISK_CONFIG[level];
                  const percentage = dashboard.total_profiles > 0 
                    ? ((count / dashboard.total_profiles) * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <div
                      key={level}
                      className={`p-3 rounded-xl border ${config.borderColor} ${config.bgColor.replace('/10', '/5')} flex items-center justify-between relative overflow-hidden group`}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-current opacity-50" style={{ color: config.color.replace('text-', '') }} />
                      <div className="relative z-10 flex items-center gap-3 pl-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${config.bgColor.replace('/10', '/100')} border border-white/20`} />
                        <span className="text-sm font-bold text-white/90 uppercase tracking-wide">{config.label}</span>
                      </div>
                      <div className="relative z-10 flex flex-col items-end">
                        <div className={`text-xl font-bold shadow-sm ${config.color}`}>{count}</div>
                        <div className="text-[10px] text-white/40">{percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Top Concerns */}
          {dashboard && dashboard.top_concerns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl"
            >
              <h2 className="text-lg font-bold text-white mb-6">Prevailing Primary Concerns</h2>
              <div className="space-y-3">
                {dashboard.top_concerns.slice(0, 5).map((item, idx) => {
                  const key = item.concern as ScreeningDimension;
                  const instrument = INSTRUMENT_CONFIG[key];
                  const maxCount = Math.max(...dashboard.top_concerns.map(c => c.count));
                  const percentage = Math.min((item.count / (maxCount || 1)) * 100, 100);

                  return (
                    <div key={`${item.concern}-${item.count}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-white/80 font-medium">{DIMENSION_LABELS[key] || item.concern}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${instrument?.borderColor || 'border-white/20'} ${instrument?.color || 'text-white/70'}`}>
                            {instrument?.code || 'N/A'}
                          </span>
                        </div>
                        <span className="text-white/50 font-mono">{item.count} profiles</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-[#FFCA40]' : 'bg-white/30'}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Profiles & Filters */}
        <div className="xl:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col shadow-xl h-full"
          >
            {/* Header & Filters row */}
            <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white/5 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Student Profiles</h2>
                <div className="text-xs text-white/50 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFCA40] animate-pulse" />
                  Viewing {profiles.length} profiles, sorted by priority
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-[#001030]/60 rounded-xl p-1 border border-white/10 flex items-center overflow-x-auto max-w-full custom-scrollbar">
                  <button
                    onClick={() => setRiskFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                      riskFilter === 'all'
                        ? 'bg-white/20 text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    All Types
                  </button>
                  {(['critical', 'severe', 'moderate', 'mild', 'none'] as RiskLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setRiskFilter(level)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all whitespace-nowrap ${
                        riskFilter === level
                          ? `${RISK_CONFIG[level].bgColor} ${RISK_CONFIG[level].color} shadow-md`
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {RISK_CONFIG[level].label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setAttentionFilter(attentionFilter === true ? undefined : true)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                    attentionFilter === true
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
                      : 'bg-[#001030]/60 text-white/60 border-white/10 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {attentionFilter === true ? (
                    <CheckCircleIcon className="w-4 h-4" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40" />
                  )}
                  Needs Review
                </button>
              </div>
            </div>

            {/* Profiles Grid */}
            <div className="p-6 flex-1">
              {profiles.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 rounded-xl border border-white/5 bg-black/10">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <UserGroupIcon className="w-8 h-8 text-white/20" />
                  </div>
                  <h3 className="text-lg font-medium text-white/70 mb-2">No Profiles Found</h3>
                  <p className="text-sm text-white/40 max-w-sm">
                    No screening profiles match your current filters. Try changing the risk level or review criteria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {profiles.map((profile) => {
                    const trend = getTrendLabel(profile.risk_trajectory);
                    const topDimensions = [...profile.dimension_scores]
                      .sort((a, b) => b.net_score - a.net_score)
                      .slice(0, 3);

                    return (
                      <div
                        key={profile.user_id}
                        className="rounded-xl border border-white/10 bg-[#001D58]/30 p-5 hover:border-white/25 hover:bg-[#001D58]/60 transition-all group flex flex-col shadow-lg"
                      >
                        {/* Avatar & Risk Badge */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-linear-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold text-white/90 shadow-inner border border-white/10">
                              {profile.user_email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-white truncate">{profile.user_name || 'Anonymous User'}</h3>
                              <p className="text-[11px] text-white/50 truncate font-mono mt-0.5">
                                {profile.user_email}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">{renderRiskBadge(profile.overall_risk)}</div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-3 gap-0 mb-5 bg-black/20 rounded-lg border border-white/5 overflow-hidden">
                          <div className="text-center p-2.5">
                            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-semibold">Sessions</p>
                            <p className="text-xs font-bold text-white font-mono">{profile.total_sessions_analyzed}</p>
                          </div>
                          <div className="text-center p-2.5 border-l border-r border-white/5">
                            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-semibold">Trend</p>
                            <p className={`text-xs font-bold flex items-center justify-center gap-1 ${trend.color}`}>
                              <span>{trend.icon}</span>
                              {trend.label}
                            </p>
                          </div>
                          <div className="text-center p-2.5">
                            <p className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-semibold">Updated</p>
                            <p className="text-xs font-bold text-white/80">{new Date(profile.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>

                        {/* Primary Concerns Dimensions */}
                        {topDimensions.length > 0 && (
                          <div className="space-y-2.5 mb-6">
                            {topDimensions.map((dim) => {
                              const instrument = INSTRUMENT_CONFIG[dim.dimension as ScreeningDimension];
                              const barWidth = Math.min(dim.net_score * 100, 100);
                              return (
                                <div key={`${profile.user_id}-${dim.dimension}`} className="group/dim">
                                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`px-1.5 py-0.5 rounded-[4px] font-mono leading-none font-bold ${instrument?.bgColor || 'bg-white/10'} ${instrument?.color || 'text-white/70'}`}>
                                        {instrument?.code || dim.dimension}
                                      </span>
                                      <span className="text-white/60 font-medium truncate max-w-[100px]">{DIMENSION_LABELS[dim.dimension as ScreeningDimension] || dim.dimension}</span>
                                    </div>
                                    <span className="text-white/50 font-mono">{(dim.net_score * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
                                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${barWidth > 60 ? 'bg-rose-400' : barWidth > 30 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${barWidth}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10 mt-auto">
                          <button
                            onClick={() => setSelectedProfile(profile)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-all w-full justify-center shadow-sm"
                          >
                            <EyeIcon className="w-4 h-4" />
                            Clinical Details
                          </button>
                          {profile.requires_attention && (
                            <button
                              onClick={() => handleMarkReviewed(profile.user_id)}
                              disabled={markingReviewed === profile.user_id}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 w-full justify-center shadow-sm"
                            >
                              <CheckCircleIcon className={`w-4 h-4 ${markingReviewed === profile.user_id ? 'animate-pulse' : ''}`} />
                              {markingReviewed === profile.user_id ? 'Reviewing...' : 'Mark Reviewed'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Detail Modal overlay */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-[#00081c]/80 backdrop-blur-md"
              onClick={() => setSelectedProfile(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="relative bg-[#001D58] rounded-2xl border border-white/10 shadow-2xl shadow-black max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between px-6 py-6 border-b border-white/10 bg-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-white/15 to-white/5 flex items-center justify-center text-2xl font-bold text-white shadow-inner border border-white/20">
                    {selectedProfile.user_email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-1">{selectedProfile.user_name || 'Anonymous User'}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                      <span className="font-mono">{selectedProfile.user_email}</span>
                      <span className="text-white/20">•</span>
                      <span className="font-mono text-xs bg-black/20 px-2 py-0.5 rounded border border-white/5">ID: {selectedProfile.user_id}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 relative z-10">
                  <button 
                    onClick={() => setSelectedProfile(null)}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors absolute -top-2 -right-2"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                  <div className="mt-4">{renderRiskBadge(selectedProfile.overall_risk)}</div>
                </div>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8 bg-linear-to-b from-transparent to-black/20">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-white mb-1 font-mono">{selectedProfile.total_sessions_analyzed}</div>
                    <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Total Sessions</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center">
                    <div className={`text-2xl font-bold mb-1 flex items-center gap-2 ${getTrendLabel(selectedProfile.risk_trajectory).color}`}>
                      {getTrendLabel(selectedProfile.risk_trajectory).icon}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">{getTrendLabel(selectedProfile.risk_trajectory).label} Trend</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center">
                    <div className="text-sm font-bold text-white/90 mb-1">
                      {new Date(selectedProfile.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Last Updated</div>
                  </div>
                </div>

                {/* Protective Factors */}
                {selectedProfile.protective_factors && selectedProfile.protective_factors.length > 0 && (
                  <div>
                    <h3 className="text-xs text-emerald-400 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                       <ShieldExclamationIcon className="w-4 h-4" />
                       Protective Features
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProfile.protective_factors.map((factor, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                          {DIMENSION_LABELS[factor as ScreeningDimension] || factor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical Dimensions */}
                <div>
                  <h3 className="text-xs text-[#FFCA40] uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                    <BookOpenIcon className="w-4 h-4" />
                    Detailed Instrument Analysis
                  </h3>
                  <div className="space-y-3">
                    {[...selectedProfile.dimension_scores]
                      .sort((a, b) => b.net_score - a.net_score)
                      .map(d => 
                      renderDimensionBar(d.dimension, d.net_score, d.indicator_count > 0 ? 0.8 : 0.3)
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer Actions */}
              <div className="p-5 border-t border-white/10 bg-white/5 flex items-center justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-white/70 hover:text-white font-medium rounded-xl transition-colors"
                >
                  Close Window
                </button>
                {selectedProfile.requires_attention && (
                  <button
                    onClick={() => handleMarkReviewed(selectedProfile.user_id)}
                    disabled={markingReviewed === selectedProfile.user_id}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    Mark as Clinically Reviewed
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast
        message={toast?.message || ''}
        type={toast?.type || 'info'}
        isVisible={!!toast}
        onClose={() => setToast(null)}
      />

    </div>
  );
}
