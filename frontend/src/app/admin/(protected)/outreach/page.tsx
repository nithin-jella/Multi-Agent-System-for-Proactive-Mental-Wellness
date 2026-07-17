'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  PencilSquareIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  CalendarDaysIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import {
  getSchedulerJobs,
  toggleJob,
  rescheduleJob,
  runJobNow,
  triggerUserCheckin,
  type SchedulerJob
} from '@/services/adminSchedulerApi';

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'checkins' | 'counselor-reminders'>('automations');
  
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['scheduler-jobs'],
    queryFn: getSchedulerJobs,
  });

  return (
    <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-white/10"
        >
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center">
              <CalendarDaysIcon className="mr-3 text-[#FFCA40] w-8 h-8" />
              Outreach Hub
            </h1>
            <p className="text-gray-400 mt-1 max-w-2xl">
              Manage proactive student check-ins, automated workflows, and system-wide reminders.
            </p>
          </div>
          <Link 
            href="/admin/campaigns"
            className="group relative flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-[#FFCA40] border border-white/10 hover:border-[#FFCA40]/50 rounded-2xl font-medium transition-all duration-300 backdrop-blur-md overflow-hidden"
          >
            <div className="absolute inset-0 bg-linear-to-r from-[#FFCA40]/0 via-[#FFCA40]/10 to-[#FFCA40]/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            <SparklesIcon className="w-5 h-5" />
            Manage Campaigns
            <span className="transition-transform group-hover:translate-x-1 ml-1">→</span>
          </Link>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 overflow-x-auto pb-px hide-scrollbar">
          {[
            { id: 'automations', label: 'Automations', icon: ClockIcon },
            { id: 'checkins', label: 'Check-ins', icon: PaperAirplaneIcon },
            { id: 'counselor-reminders', label: 'Counselor Reminders', icon: UserGroupIcon }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-6 py-4 font-medium text-sm transition-colors duration-300 whitespace-nowrap flex items-center gap-2 ${
                  isActive 
                    ? 'text-[#FFCA40]' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#FFCA40]' : 'text-white/40'}`} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCA40] shadow-[0_-2px_10px_rgba(255,202,64,0.5)]"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="pt-2 min-h-125">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'automations' && <AutomationsTab jobs={jobs} isLoading={isLoading} error={error} />}
              {activeTab === 'checkins' && <CheckinsTab />}
              {activeTab === 'counselor-reminders' && <CounselorRemindersTab />}
            </motion.div>
          </AnimatePresence>
        </div>
    </div>
  );
}

function AutomationsTab({ jobs, isLoading, error }: { jobs?: SchedulerJob[], isLoading: boolean, error: unknown }) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-[#FFCA40] rounded-full animate-spin"></div>
          <p className="text-white/50 text-sm font-medium animate-pulse">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex items-start gap-4 backdrop-blur-md">
        <ExclamationCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-lg text-red-300">Failed to load scheduler jobs</h3>
          <p className="text-red-400/70 mt-1">Please try refreshing the page or check your connection.</p>
        </div>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-32 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm shadow-xl">
        <CalendarDaysIcon className="w-20 h-20 text-white/20 mx-auto mb-6" />
        <h3 className="text-2xl font-bold mb-3 text-white">No Automations Found</h3>
        <p className="text-white/60 max-w-md mx-auto text-lg">
          There are currently no scheduled jobs configured in the system.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <AnimatePresence>
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <JobCard job={job} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ job }: { job: SchedulerJob }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [hour, setHour] = useState<number | ''>('');
  const [minute, setMinute] = useState<number | ''>('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  
  const [runStatus, setRunStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [runMessage, setRunMessage] = useState('');

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => toggleJob(job.id, enabled),
    onMutate: async (newEnabled) => {
      await queryClient.cancelQueries({ queryKey: ['scheduler-jobs'] });
      const previousJobs = queryClient.getQueryData<SchedulerJob[]>(['scheduler-jobs']);
      if (previousJobs) {
        queryClient.setQueryData<SchedulerJob[]>(['scheduler-jobs'], previousJobs.map(j => 
          j.id === job.id ? { ...j, enabled: newEnabled } : j
        ));
      }
      return { previousJobs };
    },
    onError: (err, newEnabled, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(['scheduler-jobs'], context.previousJobs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs'] });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => runJobNow(job.id),
    onMutate: () => {
      setRunStatus('loading');
    },
    onSuccess: (data) => {
      setRunStatus('success');
      setRunMessage(data.detail || 'Job triggered successfully.');
      setTimeout(() => setRunStatus('idle'), 4000);
    },
    onError: (error: any) => {
      setRunStatus('error');
      setRunMessage(error.message || 'Failed to trigger job.');
      setTimeout(() => setRunStatus('idle'), 4000);
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => rescheduleJob(job.id, Number(hour) || 0, Number(minute) || 0, dayOfWeek || undefined),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['scheduler-jobs'] });
      setHour('');
      setMinute('');
      setDayOfWeek('');
    }
  });

  const formatJobName = (id: string) => {
    return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleToggle = () => {
    toggleMutation.mutate(!job.enabled);
  };

  const handleEditClick = () => {
    if (!isEditing) {
      setHour('');
      setMinute('');
      setDayOfWeek('');
    }
    setIsEditing(!isEditing);
  };

  return (
    <div className={`group relative bg-white/5 border ${job.enabled ? 'border-white/10' : 'border-white/5'} rounded-3xl overflow-hidden flex flex-col transition-all duration-500 hover:bg-white/10 hover:shadow-2xl hover:shadow-black/50 backdrop-blur-md h-full`}>
      {/* Status indicator glow */}
      <div className={`absolute top-0 left-0 w-full h-1 transition-colors duration-500 ${job.enabled ? 'bg-[#FFCA40] shadow-[0_0_15px_#FFCA40]' : 'bg-transparent'}`} />

      <div className="p-6 grow flex flex-col">
        {/* Header Area */}
        <div className="flex justify-between items-start mb-6">
          <div className="pr-4">
            <h3 className={`text-xl font-bold mb-2 transition-colors ${job.enabled ? 'text-white' : 'text-white/50'}`}>
              {formatJobName(job.id)}
            </h3>
            <p className="text-white/50 text-sm line-clamp-2 leading-relaxed" title={job.description}>
              {job.description || 'No description available for this automation.'}
            </p>
          </div>
          
          {/* Toggle Switch */}
          <button 
            onClick={handleToggle}
            disabled={toggleMutation.isPending}
            className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:ring-offset-2 focus:ring-offset-[#00153a] ${
              job.enabled ? 'bg-[#FFCA40]' : 'bg-white/10 hover:bg-white/20'
            } ${toggleMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            role="switch"
            aria-checked={job.enabled}
          >
            <motion.span
              layout
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out ${
                job.enabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Info Pills */}
        <div className="space-y-3 mb-6 grow">
          <div className={`flex items-center gap-4 bg-black/20 p-4 rounded-2xl border transition-colors ${job.enabled ? 'border-white/5' : 'border-transparent opacity-60'}`}>
            <div className={`p-2.5 rounded-xl ${job.enabled ? 'bg-[#FFCA40]/10 text-[#FFCA40]' : 'bg-white/5 text-white/40'}`}>
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">Schedule (Cron)</div>
              <div className={`font-mono text-sm font-medium tracking-wide ${job.enabled ? 'text-[#FFCA40]' : 'text-white/40'}`}>
                {job.cron_expression || 'None'}
              </div>
            </div>
          </div>
          
          <div className={`flex items-center gap-4 bg-black/20 p-4 rounded-2xl border transition-colors ${job.enabled ? 'border-white/5' : 'border-transparent opacity-60'}`}>
            <div className={`p-2.5 rounded-xl ${job.enabled ? 'bg-green-400/10 text-green-400' : 'bg-white/5 text-white/40'}`}>
              <CalendarDaysIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-white/40 font-bold uppercase tracking-widest mb-1">Next Run</div>
              <div className={`text-sm font-medium ${job.enabled ? 'text-white' : 'text-red-400/70'}`}>
                {job.enabled && job.next_run_time 
                  ? new Date(job.next_run_time).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                  : 'Paused'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Inline Feedback Toast */}
        <AnimatePresence>
          {runStatus !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className={`p-3.5 rounded-xl text-sm font-medium flex items-center gap-3 backdrop-blur-md ${
                runStatus === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                runStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {runStatus === 'success' && <CheckCircleIcon className="w-5 h-5 shrink-0" />}
                {runStatus === 'error' && <XCircleIcon className="w-5 h-5 shrink-0" />}
                {runStatus === 'loading' && <div className="w-5 h-5 shrink-0 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />}
                <span className="truncate">{runStatus === 'loading' ? 'Executing job...' : runMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-auto pt-2">
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || toggleMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white/5 hover:bg-[#FFCA40] text-white hover:text-[#00153a] font-bold rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 hover:border-transparent group/btn"
          >
            {runMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlayIcon className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
            )}
            Run Now
          </button>
          
          <button
            onClick={handleEditClick}
            className={`flex items-center justify-center w-14 rounded-2xl transition-all duration-300 border ${
              isEditing 
                ? 'bg-white/20 border-white/30 text-white shadow-inner scale-95' 
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60 hover:text-white'
            }`}
            title="Edit Schedule"
          >
            <PencilSquareIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Edit Schedule Drawer */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-black/40 border-t border-white/5 overflow-hidden"
          >
            <div className="p-6">
              <h4 className="text-sm font-bold text-white/90 mb-5 flex items-center gap-2">
                <PencilSquareIcon className="w-4 h-4 text-[#FFCA40]" />
                Reschedule Automation
              </h4>
              <div className="grid grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Hour (0-23)</label>
                  <input 
                    type="number" 
                    min="0" max="23"
                    value={hour}
                    onChange={(e) => setHour(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-colors"
                    placeholder="e.g. 9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Minute (0-59)</label>
                  <input 
                    type="number" 
                    min="0" max="59"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-colors"
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Day of Week (Optional)</label>
                  <input 
                    type="text" 
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] transition-colors"
                    placeholder="e.g. mon-fri or mon,wed,fri"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => rescheduleMutation.mutate()}
                  disabled={rescheduleMutation.isPending || hour === '' || minute === ''}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 border border-white/10 flex items-center gap-2"
                >
                  {rescheduleMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Schedule'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckinsTab() {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('manual_admin');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const mutation = useMutation({
    mutationFn: () => triggerUserCheckin(parseInt(userId), reason),
    onMutate: () => {
      setStatus('loading');
    },
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.detail || 'Check-in triggered successfully.');
      setTimeout(() => setStatus('idle'), 5000);
      setUserId('');
      setReason('manual_admin');
    },
    onError: (error: any) => {
      setStatus('error');
      setMessage(error.message || 'Failed to trigger check-in.');
      setTimeout(() => setStatus('idle'), 5000);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    mutation.mutate();
  };

  return (
    <div className="max-w-3xl">
      <div className="bg-white/5 border border-white/10 rounded-4xl p-8 md:p-12 backdrop-blur-md shadow-2xl relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFCA40]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-5 gap-10">
          <div className="md:col-span-2 space-y-6">
            <div className="p-4 bg-[#FFCA40]/10 w-fit rounded-2xl border border-[#FFCA40]/20">
              <PaperAirplaneIcon className="w-8 h-8 text-[#FFCA40]" />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-3 text-white">
                Manual Check-in
              </h2>
              <p className="text-white/60 text-base leading-relaxed">
                Manually trigger a proactive check-in message (in-app + email) for a specific student. 
                This bypasses the scheduler and immediately queues a check-in intervention.
              </p>
            </div>
          </div>

          <div className="md:col-span-3">
            {/* Feedback area */}
            <AnimatePresence>
              {status !== 'idle' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-2xl text-sm flex items-start gap-4 ${
                    status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                    status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {status === 'success' && <CheckCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />}
                    {status === 'error' && <XCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />}
                    {status === 'loading' && <div className="w-6 h-6 shrink-0 mt-0.5 border-[3px] border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />}
                    <div>
                      <div className="font-bold text-base mb-1">{status === 'success' ? 'Success' : status === 'error' ? 'Error' : 'Processing'}</div>
                      <div className="opacity-90">{status === 'loading' ? 'Queuing check-in request...' : message}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="userId" className="block text-sm font-bold text-white/80 mb-2 uppercase tracking-wide">
                  Student User ID <span className="text-red-400">*</span>
                </label>
                <input
                  id="userId"
                  type="number"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg placeholder-white/20 focus:outline-none focus:border-[#FFCA40] focus:ring-2 focus:ring-[#FFCA40]/20 transition-all"
                  placeholder="Enter numerical ID..."
                />
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-bold text-white/80 mb-2 uppercase tracking-wide">
                  Trigger Reason
                </label>
                <input
                  id="reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-lg placeholder-white/20 focus:outline-none focus:border-[#FFCA40] focus:ring-2 focus:ring-[#FFCA40]/20 transition-all"
                  placeholder="e.g. follow_up, high_risk"
                />
                <p className="text-xs text-white/40 mt-3 flex items-center gap-1.5">
                  <ExclamationCircleIcon className="w-4 h-4" />
                  Included in system logs for auditing.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={mutation.isPending || !userId}
                  className="w-full py-4 bg-[#FFCA40] hover:bg-[#FFCA40]/90 text-[#00153a] font-extrabold text-lg rounded-2xl transition-all shadow-[0_0_20px_rgba(255,202,64,0.15)] hover:shadow-[0_0_30px_rgba(255,202,64,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                >
                  {mutation.isPending ? (
                    <>
                      <div className="w-6 h-6 border-4 border-[#00153a]/30 border-t-[#00153a] rounded-full animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-6 h-6" />
                      Send Proactive Check-in
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function CounselorRemindersTab() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const runMutation = useMutation({
    mutationFn: () => runJobNow("counselor_reminder_job"),
    onMutate: () => {
      setStatus('loading');
    },
    onSuccess: (data) => {
      setStatus('success');
      setMessage(data.detail || 'Counselor reminder job triggered successfully.');
      setTimeout(() => setStatus('idle'), 5000);
    },
    onError: (error: any) => {
      setStatus('error');
      setMessage(error.message || 'Failed to trigger job.');
      setTimeout(() => setStatus('idle'), 5000);
    }
  });

  return (
    <div className="max-w-3xl">
      <div className="bg-white/5 border border-white/10 rounded-4xl p-8 md:p-12 backdrop-blur-md shadow-2xl relative overflow-hidden text-center flex flex-col items-center">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        
        <div className="relative z-10 w-full max-w-xl flex flex-col items-center">
          <div className="p-5 bg-purple-500/10 rounded-3xl border border-purple-500/20 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <UserGroupIcon className="w-12 h-12 text-purple-400" />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-4">
            Counselor Reminders
          </h2>
          
          <div className="space-y-4 text-white/60 text-lg leading-relaxed mb-10">
            <p>
              Instantly evaluate all active cases and send 
              in-app notifications and summary emails to counselors detailing which of their assignments need follow-up.
            </p>
          </div>

          <div className="w-full">
            <AnimatePresence>
              {status !== 'idle' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`p-4 rounded-2xl text-sm flex items-start gap-4 text-left ${
                    status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                    status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {status === 'success' && <CheckCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />}
                    {status === 'error' && <XCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />}
                    {status === 'loading' && <div className="w-6 h-6 shrink-0 mt-0.5 border-[3px] border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />}
                    <div>
                      <div className="font-bold text-base mb-1">{status === 'success' ? 'Success' : status === 'error' ? 'Error' : 'Processing'}</div>
                      <div className="opacity-90">{status === 'loading' ? 'Triggering reminder job...' : message}</div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-2xl transition-all border border-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              {runMutation.isPending ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PlayIcon className="w-6 h-6" />
              )}
              Run Reminders Now
            </button>
            
            <Link 
              href="/admin/campaigns"
              className="flex-1 py-4 bg-transparent hover:bg-[#FFCA40]/5 text-[#FFCA40] font-bold text-lg rounded-2xl transition-all border border-[#FFCA40]/30 hover:border-[#FFCA40]/60 flex items-center justify-center gap-2 hover:-translate-y-0.5"
            >
              <SparklesIcon className="w-5 h-5" />
              Manage Campaigns
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
