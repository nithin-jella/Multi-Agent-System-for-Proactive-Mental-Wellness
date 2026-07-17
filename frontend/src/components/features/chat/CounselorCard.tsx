import React from 'react';
import { FiStar, FiClock, FiDollarSign, FiCheck } from 'react-icons/fi';

export interface Counselor {
    id: number;
    name: string;
    specialization: string;
    bio?: string;
    years_of_experience: number;
    languages: string[];
    rating: number;
    total_reviews: number;
    consultation_fee: number;
    has_availability: boolean;
}

export interface CounselorCardProps {
    counselor: Counselor;
    onSelect: (counselor: Counselor) => void;
}

export default function CounselorCard({ counselor, onSelect }: CounselorCardProps) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 w-64 flex-shrink-0 hover:bg-white/10 transition-colors group">
            <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                    {counselor.name.charAt(0)}
                </div>
                {counselor.has_availability && (
                    <span className="bg-green-500/20 text-green-300 text-[10px] px-2 py-0.5 rounded-full border border-green-500/30">
                        Available
                    </span>
                )}
            </div>

            <h4 className="text-white font-semibold text-sm mb-1 line-clamp-1">{counselor.name}</h4>
            <p className="text-white/60 text-xs mb-2 line-clamp-1">{counselor.specialization}</p>

            <div className="flex items-center gap-3 text-xs text-white/50 mb-3">
                <div className="flex items-center gap-1">
                    <FiStar className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span>{counselor.rating} ({counselor.total_reviews})</span>
                </div>
                <div className="flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    <span>{counselor.years_of_experience}y exp</span>
                </div>
            </div>

            <button
                onClick={() => onSelect(counselor)}
                className="w-full py-2 bg-[#FFCA40] hover:bg-[#ffc107] text-[#001D58] rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors opacity-90 hover:opacity-100"
            >
                Select Counselor <FiCheck className="w-3 h-3" />
            </button>
        </div>
    );
}
