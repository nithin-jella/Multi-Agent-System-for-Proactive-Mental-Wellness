import React from 'react';
import { FiCalendar, FiClock, FiCheckCircle } from 'react-icons/fi';

export interface TimeSlot {
    datetime: string;
    day_name: string;
    time_label: string;
    reason: string;
}

export interface TimeSlotCardProps {
    slot: TimeSlot;
    onSelect: (slot: TimeSlot) => void;
}

export default function TimeSlotCard({ slot, onSelect }: TimeSlotCardProps) {
    // Parse date for display
    const dateObj = new Date(slot.datetime);
    const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-56 flex-shrink-0 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => onSelect(slot)}>
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex flex-col items-center justify-center text-blue-300 border border-blue-500/30">
                    <span className="text-[10px] uppercase font-bold">{slot.day_name.substring(0, 3)}</span>
                    <span className="text-sm font-bold">{dateObj.getDate()}</span>
                </div>
                <div>
                    <div className="text-white font-medium text-sm">{slot.time_label}</div>
                    <div className="text-white/50 text-xs">{dateStr}</div>
                </div>
            </div>

            <div className="text-white/40 text-[10px] italic mb-3 line-clamp-2">
                "{slot.reason}"
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onSelect(slot); }}
                className="w-full py-1.5 bg-white/10 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 border border-white/10 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
            >
                Confirm Time
            </button>
        </div>
    );
}
