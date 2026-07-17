"use client";

import React, { useState } from 'react';
import { FiCalendar, FiGrid, FiList } from 'react-icons/fi';
import ActivityCalendar from './ActivityCalendar';
import type { ActivitySummary } from './ActivityCalendar';

interface ActivityData {
  hasJournal: boolean;
  hasConversation: boolean;
}

interface EnhancedActivityCalendarProps {
  currentMonth: Date;
  activityData: ActivitySummary;
  onMonthChange: (newMonth: Date) => void;
  isLoading?: boolean;
  onDateClick?: (date: Date) => void;
  className?: string;
}

type CalendarViewMode = 'monthly' | 'list';

export default function EnhancedActivityCalendar({
  currentMonth,
  activityData,
  onMonthChange,
  isLoading = false,
  onDateClick,
  className = '',
}: EnhancedActivityCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('monthly');

  const sortedDates = Object.keys(activityData)
    .filter(date => {
      const dateObj = new Date(date);
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      return dateObj >= monthStart && dateObj <= monthEnd;
    })
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const listEntries = sortedDates.map(dateStr => {
    const data = activityData[dateStr];
    const date = new Date(dateStr);
    return {
      date,
      dateStr,
      ...data,
    };
  });

  return (
    <div className={`bg-white/3 backdrop-blur-xl rounded-2xl border border-white/10 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FiCalendar className="text-[#FFCA40]" />
          Activity Calendar
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('monthly')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'monthly'
                ? 'bg-[#FFCA40] text-[#001D58]'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
            title="Monthly View"
          >
            <FiGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-[#FFCA40] text-[#001D58]'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
            title="List View"
          >
            <FiList size={18} />
          </button>
        </div>
      </div>

      {viewMode === 'monthly' ? (
        <ActivityCalendar
          currentMonth={currentMonth}
          activityData={activityData}
          onMonthChange={onMonthChange}
          isLoading={isLoading}
          onDateClick={onDateClick}
        />
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {listEntries.length > 0 ? (
            listEntries.map((entry, index) => (
              <div
                key={index}
                onClick={() => onDateClick?.(entry.date)}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 hover:border-[#FFCA40]/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {entry.hasJournal && (
                      <span className="w-3 h-3 bg-green-500 rounded-full" title="Journal" />
                    )}
                    {entry.hasConversation && (
                      <span className="w-3 h-3 bg-blue-500 rounded-full" title="Chat" />
                    )}
                  </div>
                  <span className="text-white text-sm font-medium">
                    {entry.date.toLocaleDateString('en-US', { 
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-white/50 text-sm">
              No activity this month
            </div>
          )}
        </div>
      )}
    </div>
  );
}
