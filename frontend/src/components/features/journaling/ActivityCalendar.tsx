// frontend/src/components/journaling/ActivityCalendar.tsx
"use client";

import React from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addMonths,
    subMonths,
    addDays,
    isSameMonth,
    isSameDay,
    isAfter,
    startOfDay,
} from 'date-fns';
import { id } from 'date-fns/locale'; // For Indonesian day names if needed
import { FiChevronLeft, FiChevronRight, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';

// Define the structure of the data received from the backend
export interface ActivityData {
    hasJournal: boolean;
    hasConversation: boolean;
}
export interface ActivitySummary {
    [dateStr: string]: ActivityData; // Key is "YYYY-MM-DD"
}

interface ActivityCalendarProps {
    currentMonth: Date; // The month currently being displayed
    activityData: ActivitySummary; // Data fetched from the backend
    onMonthChange: (newMonth: Date) => void; // Callback to change month in parent
    isLoading?: boolean; // Optional loading state
    onDateClick?: (date: Date) => void; // Optional callback for date click
}

export default function ActivityCalendar({
    currentMonth,
    activityData,
    onMonthChange,
    isLoading = false,
    onDateClick,
}: ActivityCalendarProps) {

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start week on Monday
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = startDate;

    while (day <= endDate) {
        days.push(day);
        day = addDays(day, 1);
    }

    const getDayClasses = (day: Date): string => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const data = activityData[dateStr];
        const today = startOfDay(new Date());
        const isFutureDay = isAfter(startOfDay(day), today);

        let classes = `text-center py-1 text-xs rounded aspect-square flex flex-col items-center justify-center transition-colors duration-150 relative ${onDateClick ? 'cursor-pointer' : 'cursor-default'} `;
        

        if (!isSameMonth(day, monthStart)) {
            classes += " text-gray-600 hover:bg-gray-700/50"; // Dim days from other months
            if (onDateClick) classes += " hover:bg-gray-700/50 cursor-pointer";
            else classes += " cursor-default";
        } else {
             classes += " text-gray-200 hover:bg-gray-700/50";
             if (onDateClick) {
                if (isFutureDay) {
                    classes += " hover:bg-red-500/30 cursor-pointer"; // Indicate future days differently on hover if clickable
                } else {
                    classes += " hover:bg-gray-700/70 cursor-pointer"; // Brighter hover for current month past/present days
                }
             } else {
                classes += " cursor-default";
             }

             if (isSameDay(day, new Date())) {
                 classes += " border border-[#FFCA40]"; // Highlight today
             }

             // Apply activity markers (only for past/present days if desired, or all days)
             if (data && !isFutureDay) { // Example: only show markers for non-future days
                 if (data.hasJournal && data.hasConversation) {
                     classes += " bg-purple-600/40 hover:bg-purple-600/60";
                 } else if (data.hasJournal) {
                     classes += " bg-green-600/40 hover:bg-green-600/60";
                 } else if (data.hasConversation) {
                     classes += " bg-blue-600/40 hover:bg-blue-600/60";
                 }
             }
        }

        return classes;
    };

    const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']; // Adjust if locale needed

    const handleDayClick = (date: Date) => {
        if (!onDateClick) return;

        const today = startOfDay(new Date());
        const clickedDay = startOfDay(date);

        if (isAfter(clickedDay, today)) {
            toast.error("⏳ Oops! Looks like you're trying to write in the future. Please select today or a past date.", {
                duration: 4000,
                position: 'bottom-center',
            });
        } else {
            onDateClick(date); // Call original onDateClick for past or present days
        }
    };

    return (
        <div className="bg-white/5 p-2 sm:p-3 rounded-lg border border-white/10 mb-6">
            {/* Header: Month Navigation */}
            <div className="flex items-center justify-between mb-3 px-1">
                <button
                    onClick={() => onMonthChange(subMonths(currentMonth, 1))}
                    className="p-1.5 rounded-full hover:bg-white/10 transition"
                    aria-label="Previous month"
                >
                    <FiChevronLeft size={18} />
                </button>
                <h3 className="font-semibold text-base sm:text-lg text-center">
                    {format(currentMonth, 'MMMM yyyy', { locale: id })}
                </h3>
                <button
                    onClick={() => onMonthChange(addMonths(currentMonth, 1))}
                    className="p-1.5 rounded-full hover:bg-white/10 transition"
                    aria-label="Next month"
                >
                    <FiChevronRight size={18} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 relative">
                 {/* Loading Overlay */}
                 {isLoading && (
                    <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center z-10 rounded-lg">
                        <FiLoader className="animate-spin text-xl"/>
                    </div>
                 )}

                {/* Day Names Header */}
                {dayNames.map(name => (
                    <div key={name} className="text-center text-xs font-medium text-gray-400 pb-1">
                        {name}
                    </div>
                ))}

                {/* Day Cells */}
                {days.map((d, i) => {
                    const isInteractive = onDateClick && isSameMonth(d, monthStart);
                    return (
                        <div
                            key={i}
                            className={getDayClasses(d)}
                            onClick={isInteractive ? () => handleDayClick!(d) : undefined} // Call onDateClick only for current month days
                            onKeyDown={isInteractive ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleDayClick!(d);
                                }
                            } : undefined}
                            {...(isInteractive ? { role: "button" } : {})}
                            tabIndex={isInteractive ? 0 : undefined}
                            aria-label={isInteractive ? `Journal for ${format(d, 'MMMM d, yyyy')}` : undefined}
                        >
                            {format(d, 'd')}

                            {/* Activity markers - ensure they are not shown for future days if that's the logic in getDayClasses */}
                            {isSameMonth(d, monthStart) && !isAfter(startOfDay(d), startOfDay(new Date())) && activityData[format(d, 'yyyy-MM-dd')]?.hasJournal && (
                                <span className="absolute bottom-1 left-1/2 -translate-x-2 w-1 h-1 bg-green-400 rounded-full"></span>
                            )}
                            {isSameMonth(d, monthStart) && !isAfter(startOfDay(d), startOfDay(new Date())) && activityData[format(d, 'yyyy-MM-dd')]?.hasConversation && (
                                <span className="absolute bottom-1 left-1/2 translate-x-1 w-1 h-1 bg-blue-400 rounded-full"></span>
                            )}
                        </div>
                    );
                })}
            </div>

             {/* Optional Legend */}
            <div className="flex justify-center space-x-3 mt-3 text-xs">
                 <span className="flex items-center"><span className="w-2.5 h-2.5 bg-green-600 rounded-full mr-1.5"></span> Journal</span>
                 <span className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-600 rounded-full mr-1.5"></span> Chat</span>
                 <span className="flex items-center"><span className="w-2.5 h-2.5 bg-purple-600 rounded-full mr-1.5"></span> Both</span>
             </div>
        </div>
    );
}