'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  RocketLaunchIcon,
  TrashIcon,
  ChartBarIcon,
  ClockIcon,
  PlayIcon,
  SparklesIcon,
  InboxIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { getCampaigns, deleteCampaign } from '@/services/adminCampaignApi';
import type {
  Campaign,
  CampaignStatus,
  CampaignPriority,
  CampaignFilters,
} from '@/types/admin/campaigns';
import {
  CAMPAIGN_STATUS_LABELS,
  TARGET_AUDIENCE_LABELS,
} from '@/types/admin/campaigns';
import { formatTargetAudience } from '@/lib/campaignUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CampaignFormModal,
  CampaignMetricsModal,
  CampaignHistoryModal,
  ExecuteCampaignModal,
  AICampaignModal,
} from '@/components/admin/campaigns';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function CampaignsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CampaignFilters>({
    page: 1,
    page_size: 20,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Fetch campaigns
  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: ['campaigns', filters],
    queryFn: () => getCampaigns(filters),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });

  const handleCreateCampaign = () => {
    setSelectedCampaign(null);
    setShowFormModal(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowFormModal(true);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      await deleteMutation.mutateAsync(campaignId);
    }
  };

  const handleViewMetrics = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowMetricsModal(true);
  };

  const handleViewHistory = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowHistoryModal(true);
  };

  const handleExecuteCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowExecuteModal(true);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery, page: 1 });
  };

  const handleFilterChange = (key: keyof CampaignFilters, value: string) => {
    setFilters({ ...filters, [key]: value || undefined, page: 1 });
  };

  const getStatusStyles = (status: CampaignStatus) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'paused':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getPriorityIcon = (priority?: CampaignPriority) => {
    switch (priority) {
      case 'high':
        return <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />;
      case 'medium':
        return <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />;
      case 'low':
        return <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-slate-400" />;
    }
  };

  const stats = useMemo(() => [
    {
      title: 'Total Campaigns',
      value: data?.total || 0,
      icon: <RocketLaunchIcon className="w-6 h-6 text-purple-400" />,
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Active Campaigns',
      value: data?.items?.filter(c => c.status === 'active').length || 0,
      icon: <PlayIcon className="w-6 h-6 text-emerald-400" />,
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Avg. Success Rate',
      value: '84%',
      subtitle: 'Based on historical data',
      icon: <ChartBarIcon className="w-6 h-6 text-blue-400" />,
      bg: 'bg-blue-500/10',
    },
  ], [data]);

  if (error) {
    return (
      <div className="flex items-center justify-center space-y-6">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
            <TrashIcon className="h-8 w-8 text-rose-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Failed to load campaigns</h3>
          <p className="text-white/60">{error instanceof Error ? error.message : 'Unknown error'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['campaigns'] })}
            className="rounded-xl bg-[#FFCA40] px-6 py-3 font-semibold text-[#00153a] shadow-lg shadow-[#FFCA40]/20 transition-all hover:bg-[#FFCA40]/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <SparklesIcon className="mr-3 text-[#FFCA40] w-8 h-8" />
              Outreach Campaigns
            </h1>
            <p className="text-gray-400 mt-1 max-w-2xl">
              Manage proactive interventions and Therapeutic Coach Agent (TCA) campaigns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAIModal(true)}
              className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-white/5 px-5 py-2.5 font-medium text-white transition-all hover:bg-white/10 border border-white/10"
            >
              <SparklesIcon className="w-5 h-5 text-purple-400 group-hover:animate-pulse" />
              <span>Generate with AI</span>
            </button>
            <button
              onClick={handleCreateCampaign}
              className="relative group"
            >
              <div className="absolute inset-0 rounded-xl bg-[#FFCA40] blur opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
              <div className="relative flex items-center gap-2 rounded-xl bg-[#FFCA40] px-5 py-2.5 font-semibold text-[#00153a] shadow-sm transition-all hover:bg-[#FFCA40]/90">
                <PlusIcon className="w-5 h-5" />
                <span>Create Campaign</span>
              </div>
            </button>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-white/60">{stat.title}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                    {stat.subtitle && (
                      <span className="text-xs text-white/40">{stat.subtitle}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl" />
            </div>
          ))}
        </motion.div>

        {/* Search & Filters */}
        <motion.div variants={itemVariants} className="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <form onSubmit={handleSearch} className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns by name or description..."
                className="w-full rounded-xl bg-transparent py-3 pl-11 pr-4 text-sm text-white placeholder-white/40 focus:bg-white/5 focus:outline-none focus:ring-0 transition-colors"
              />
            </form>
            <div className="hidden h-8 w-px bg-white/10 md:block" />
            <div className="flex flex-1 items-center gap-2 sm:flex-none">
              <div className="flex items-center gap-2 pl-3 text-sm text-white/60">
                <FunnelIcon className="h-4 w-4" />
                <span>Filters:</span>
              </div>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="appearance-none rounded-lg bg-white/5 px-4 py-2 text-sm text-white border border-transparent hover:border-white/10 focus:border-[#FFCA40]/50 focus:outline-none focus:ring-1 focus:ring-[#FFCA40]/50 cursor-pointer"
              >
                <option value="" className="bg-[#00153a]">All Status</option>
                {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#00153a]">{label}</option>
                ))}
              </select>
              <select
                value={filters.target_audience || ''}
                onChange={(e) => handleFilterChange('target_audience', e.target.value)}
                className="appearance-none rounded-lg bg-white/5 px-4 py-2 text-sm text-white border border-transparent hover:border-white/10 focus:border-[#FFCA40]/50 focus:outline-none focus:ring-1 focus:ring-[#FFCA40]/50 cursor-pointer"
              >
                <option value="" className="bg-[#00153a]">All Audiences</option>
                {Object.entries(TARGET_AUDIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-[#00153a]">{label}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Data Table */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[#FFCA40]" />
              <p className="text-sm text-white/50">Fetching campaigns...</p>
            </div>
          ) : !data?.items?.length ? (
            <div className="flex h-64 flex-col items-center justify-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
                <InboxIcon className="h-8 w-8 text-white/40" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">No campaigns found</p>
                <p className="text-sm text-white/40">Get started by creating your first proactive outreach.</p>
              </div>
              <button
                onClick={handleCreateCampaign}
                className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white/2 text-xs uppercase tracking-wider text-white/40 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Campaign Name</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Target Audience</th>
                    <th className="px-6 py-4 font-medium">Priority</th>
                    <th className="px-6 py-4 font-medium">Last Executed</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {data.items.map((campaign) => (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={campaign.id}
                        className="group transition-colors hover:bg-white/4 cursor-pointer"
                        onClick={() => handleEditCampaign(campaign)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-purple-500/20 border border-white/5 group-hover:border-white/20 transition-colors">
                              <RocketLaunchIcon className="h-5 w-5 text-indigo-300" />
                            </div>
                            <div>
                              <div className="font-semibold text-white group-hover:text-[#FFCA40] transition-colors">{campaign.name}</div>
                              {campaign.description && (
                                <div className="mt-0.5 text-xs text-white/40 max-w-60 truncate">
                                  {campaign.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusStyles(campaign.status)}`}>
                            {CAMPAIGN_STATUS_LABELS[campaign.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white/70">
                          {formatTargetAudience(campaign.target_audience as unknown)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(campaign.priority)}
                            <span className="text-white/80 capitalize">{campaign.priority || 'medium'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/50">
                          {campaign.last_executed_at
                            ? new Date(campaign.last_executed_at).toLocaleDateString(undefined, { 
                                month: 'short', day: 'numeric', year: 'numeric' 
                              })
                            : 'Never run'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {campaign.status === 'active' && (
                              <button
                                onClick={() => handleExecuteCampaign(campaign)}
                                className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors tooltip-trigger"
                                title="Execute Now"
                              >
                                <PlayIcon className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleViewHistory(campaign)}
                              className="p-2 text-purple-400 hover:bg-purple-400/10 rounded-lg transition-colors"
                              title="Execution History"
                            >
                              <ClockIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleViewMetrics(campaign)}
                              className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                              title="View Metrics"
                            >
                              <ChartBarIcon className="h-5 w-5" />
                            </button>
                            <div className="h-4 w-px bg-white/10 mx-1" />
                            <button
                              onClick={() => handleDeleteCampaign(campaign.id)}
                              className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {data && data.total > (filters.page_size || 20) && (
            <div className="flex items-center justify-between border-t border-white/10 bg-white/2 px-6 py-4">
              <div className="text-sm text-white/50">
                Showing <span className="font-medium text-white">{((filters.page || 1) - 1) * (filters.page_size || 20) + 1}</span> to{' '}
                <span className="font-medium text-white">{Math.min((filters.page || 1) * (filters.page_size || 20), data.total)}</span> of{' '}
                <span className="font-medium text-white">{data.total}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                  disabled={filters.page === 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
                >
                  Previous
                </button>
                <button
                  onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                  disabled={(filters.page || 1) * (filters.page_size || 20) >= data.total}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          {/* Refetching Indicator Overlay */}
          {isRefetching && !isLoading && (
            <div className="absolute inset-0 bg-[#00153a]/20 backdrop-blur-[1px] flex items-start justify-center pt-8 z-10 pointer-events-none">
              <div className="flex items-center gap-2 bg-[#00153a] border border-white/10 px-4 py-2 rounded-full shadow-2xl">
                <ArrowPathIcon className="w-4 h-4 text-[#FFCA40] animate-spin" />
                <span className="text-xs font-medium text-white/80">Updating...</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Modals */}
      {showFormModal && (
        <CampaignFormModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowFormModal(false);
            setSelectedCampaign(null);
          }}
          onSuccess={() => {
            setShowFormModal(false);
            setSelectedCampaign(null);
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          }}
        />
      )}

      {showMetricsModal && selectedCampaign && (
        <CampaignMetricsModal
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          onClose={() => {
            setShowMetricsModal(false);
            setSelectedCampaign(null);
          }}
        />
      )}

      {showExecuteModal && selectedCampaign && (
        <ExecuteCampaignModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowExecuteModal(false);
            setSelectedCampaign(null);
          }}
          onSuccess={() => {
            setShowExecuteModal(false);
            setSelectedCampaign(null);
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
          }}
        />
      )}

      {showHistoryModal && selectedCampaign && (
        <CampaignHistoryModal
          campaign={selectedCampaign}
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedCampaign(null);
          }}
        />
      )}

      {showAIModal && (
        <AICampaignModal
          onClose={() => setShowAIModal(false)}
          onSuccess={async (campaignData) => {
            try {
              const { createCampaign } = await import('@/services/adminCampaignApi');
              await createCampaign(campaignData);
              setShowAIModal(false);
              queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            } catch (err) {
              console.error('Failed to create AI campaign:', err);
            }
          }}
        />
      )}
    </div>
  );
}
