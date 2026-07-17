"use client";

import { useState, Suspense, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ChatHistoryViewer from '@/components/features/journaling/ChatHistoryViewer';
import DailyJournal from '@/components/features/journaling/DailyJournal';
import { JournalingPageSkeleton } from '@/components/ui/GlobalSkeleton'; 
import EnhancedActivityCalendar from '@/components/features/journaling/EnhancedActivityCalendar';
import StreakDisplay from '@/components/features/journaling/StreakDisplay';
import apiClient from '@/services/api';
import { startOfMonth, format } from 'date-fns';
import JournalEntryModal from '@/components/features/journaling/JournalEntryModal';
import AffectiveTrackingDashboard from '@/components/features/journaling/MoodTrackingDashboard';
import JournalSearchFilters from '@/components/features/journaling/JournalSearchFilters';
import JournalExportButton from '@/components/features/journaling/JournalExportButton';
import toast from 'react-hot-toast';
import { 
  FiBarChart2, 
  FiBookOpen, 
  FiSearch, 
  FiMessageSquare, 
  FiPlus,
  FiCalendar,
  FiDownload,
  FiArrowRight
} from 'react-icons/fi';
import type { JournalEntryItem } from '@/types/api';

type JournalTab = 'analytics' | 'daily' | 'search' | 'history';

interface ActivityData {
  hasJournal: boolean;
  hasConversation: boolean;
}

interface ActivitySummary {
  [dateStr: string]: ActivityData;
}

interface ActivitySummaryResponse {
  summary: ActivitySummary;
  currentStreak: number;
  longestStreak: number;
}

export default function JournalingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<JournalTab>('daily');
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [activityData, setActivityData] = useState<ActivitySummary>({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [longestStreak, setLongestStreak] = useState<number>(0);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState<string | undefined>(undefined);
  const [dailyJournalRefreshKey, setDailyJournalRefreshKey] = useState(0);
  const [searchResults, setSearchResults] = useState<JournalEntryItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [todayHasEntry, setTodayHasEntry] = useState(false);

  const fetchActivityData = useCallback(async (monthDate: Date) => {
    setIsCalendarLoading(true);
    setCalendarError(null);
    const monthStr = format(monthDate, 'yyyy-MM');
    try {
      const response = await apiClient.get<ActivitySummaryResponse>(
        `/activity-summary/?month=${monthStr}`
      );
      setActivityData(response.data.summary || {});
      setCurrentStreak(response.data.currentStreak || 0);
      setLongestStreak(response.data.longestStreak || 0);
      
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      setTodayHasEntry(response.data.summary[todayStr]?.hasJournal || false);
    } catch (err) {
      console.error("Error fetching activity summary:", err);
      toast.error("Failed to load activity data");
      setCalendarError("Failed to load activity data.");
      setActivityData({});
      setCurrentStreak(0);
      setLongestStreak(0);
    } finally {
      setIsCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivityData(currentMonth);
  }, [currentMonth, fetchActivityData]);

  const handleOpenJournalModal = (dateString?: string) => {
    setSelectedDateForModal(dateString);
    setIsModalOpen(true);
  };

  const handleModalSaveSuccess = () => {
    setIsModalOpen(false);
    fetchActivityData(currentMonth);
    setDailyJournalRefreshKey(prevKey => prevKey + 1);
  };

  useEffect(() => {
    try {
      const tabParam = searchParams?.get('tab');
      if (tabParam === 'analytics' || tabParam === 'daily' || tabParam === 'search' || tabParam === 'history') {
        setActiveTab(tabParam as JournalTab);
      }
    } catch {}
  }, [searchParams]);

  const setTabAndUrl = (tab: JournalTab) => {
    setActiveTab(tab);
    try {
      const current = new URLSearchParams(searchParams?.toString());
      current.set('tab', tab);
      router.replace(`/journaling?${current.toString()}`);
    } catch {}
  };

  const journalDaysThisMonth = Object.values(activityData).filter(d => d.hasJournal).length;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  return (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                <span className="text-[#FFCA40]">Aika</span> Journal
              </h1>
              <p className="text-white/70">
                Your private space for reflection and growth
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTabAndUrl('analytics')}
                className={`hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <FiBarChart2 size={18} />
                <span className="font-medium">Analytics</span>
              </button>              
              <button
                onClick={() => handleOpenJournalModal(format(new Date(), 'yyyy-MM-dd'))}
                className="flex items-center gap-2 px-6 py-2.5 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] font-semibold rounded-xl shadow-lg shadow-[#FFCA40]/30 hover:shadow-[#FFCA40]/50 transition-all"
              >
                <FiPlus size={18} />
                <span>New Entry</span>
              </button>
            </div>
          </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-linear-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-sm rounded-2xl border border-green-500/30 p-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-green-500/30 flex items-center justify-center">
                  <FiBookOpen size={24} className="text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-green-300 uppercase tracking-wide">This Month</p>
                  <p className="text-2xl font-bold text-white">{journalDaysThisMonth}</p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-2xl border border-blue-500/30 p-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-500/30 flex items-center justify-center">
                  <FiCalendar size={24} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-blue-300 uppercase tracking-wide">Streak</p>
                  <p className="text-2xl font-bold text-white">{currentStreak} days</p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-purple-500/30 flex items-center justify-center">
                  <FiSearch size={24} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-purple-300 uppercase tracking-wide">Consistency</p>
                  <p className="text-2xl font-bold text-white">{Math.round((journalDaysThisMonth / daysInMonth) * 100)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-linear-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-orange-500/30 flex items-center justify-center">
                  <FiDownload size={24} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-orange-300 uppercase tracking-wide">Export</p>
                  <JournalExportButton />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className={`mb-8 p-6 rounded-2xl border backdrop-blur-sm transition-all ${
              todayHasEntry
                ? 'bg-linear-to-r from-green-500/20 to-emerald-600/20 border-green-500/30'
                : 'bg-linear-to-r from-[#FFCA40]/20 to-[#FFB700]/20 border-[#FFCA40]/30'
          }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${
                  todayHasEntry
                    ? 'bg-green-500/30'
                    : 'bg-[#FFCA40]/30'
                }`}>
                  {todayHasEntry ? (
                    <span className="text-4xl">🎉</span>
                  ) : (
                    <span className="text-4xl">✍️</span>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {todayHasEntry ? "Great job today!" : "Ready to write?"}
                  </h2>
                  <p className="text-white/70">
                    {todayHasEntry
                      ? "You've completed your journal entry for today."
                      : "Take a moment to reflect on your day."
                    }
                  </p>
                </div>
              </div>
              {!todayHasEntry && (
                <button
                  onClick={() => handleOpenJournalModal(format(new Date(), 'yyyy-MM-dd'))}
                  className="hidden md:flex items-center gap-2 px-6 py-3 bg-linear-to-r from-[#FFCA40] to-[#FFB700] hover:from-[#FFD060] hover:to-[#FFC730] text-[#001D58] font-semibold rounded-xl shadow-lg transition-all"
                >
                  <span>Write Now</span>
                  <FiArrowRight size={18} />
                </button>
              )}
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-4"
            >
              <div className="sticky top-24">
                <EnhancedActivityCalendar
                  currentMonth={currentMonth}
                  activityData={activityData}
                  onMonthChange={setCurrentMonth}
                  isLoading={isCalendarLoading}
                  onDateClick={(date) => handleOpenJournalModal(date ? format(date, 'yyyy-MM-dd') : undefined)}
                />
                {calendarError && <p className='text-red-400 text-sm text-center mt-2'>{calendarError}</p>}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="lg:col-span-8"
            >
                <div className="md:hidden mb-6 overflow-x-auto">
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
                    {['analytics', 'daily', 'search', 'history'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setTabAndUrl(tab as JournalTab)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                          activeTab === tab
                            ? 'bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] font-semibold'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {tab === 'analytics' && <FiBarChart2 size={18} />}
                        {tab === 'daily' && <FiBookOpen size={18} />}
                        {tab === 'search' && <FiSearch size={18} />}
                        {tab === 'history' && <FiMessageSquare size={18} />}
                        <span className="capitalize">{tab}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <nav className="hidden md:flex mb-6 border-b border-white/10">
                  {['analytics', 'daily', 'search', 'history'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTabAndUrl(tab as JournalTab)}
                      className={`px-5 py-3 font-medium text-sm transition-colors flex items-center gap-2 border-b-2 ${
                        activeTab === tab
                          ? 'border-[#FFCA40] text-[#FFCA40]'
                          : 'border-transparent text-white/60 hover:text-white'
                      }`}
                    >
                      {tab === 'analytics' && <FiBarChart2 size={16} />}
                      {tab === 'daily' && <FiBookOpen size={16} />}
                      {tab === 'search' && <FiSearch size={16} />}
                      {tab === 'history' && <FiMessageSquare size={16} />}
                      <span className="capitalize">{tab}</span>
                    </button>
                  ))}
                </nav>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Suspense fallback={<JournalingPageSkeleton />}>
                      {activeTab === 'analytics' && (
                        <AffectiveTrackingDashboard days={30} />
                      )}
                      {activeTab === 'daily' && (
                        <DailyJournal
                          onOpenModalRequest={handleOpenJournalModal}
                          refreshKey={dailyJournalRefreshKey}
                          displayMode="all"
                        />
                      )}
                      {activeTab === 'search' && (
                        <div className="space-y-4">
                          <JournalSearchFilters
                            onResults={(results) => setSearchResults(results)}
                            onLoadingChange={setIsSearchLoading}
                          />
                          <DailyJournal
                            onOpenModalRequest={handleOpenJournalModal}
                            refreshKey={dailyJournalRefreshKey}
                            displayMode="search"
                            searchResults={searchResults}
                          />
                        </div>
                      )}
                      {activeTab === 'history' && (
                        <ChatHistoryViewer />
                      )}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
          </div>

        {isModalOpen && (
          <JournalEntryModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSaveSuccess={handleModalSaveSuccess}
            initialDate={selectedDateForModal}
          />
        )}
      </div>
    </div>
  );
}
