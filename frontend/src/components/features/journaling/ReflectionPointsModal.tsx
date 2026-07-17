"use client";

import React from 'react';
import { FiInfo, FiMessageCircle, FiX, FiLoader } from 'react-icons/fi'; // Added FiX for a potential close button if used standalone
import type { JournalReflectionPointResponse } from '@/types/api';

interface ReflectionPointsPanelProps { // Renamed to PanelProps
    reflectionPoints: JournalReflectionPointResponse[];
    entryDate?: string;
    isLoading?: boolean; // To show loading state
    onClose?: () => void; // Optional: if you want a close button within this panel
    className?: string; // To allow custom styling for embedding
}

export default function ReflectionPointsPanel({ // Renamed to ReflectionPointsPanel
    reflectionPoints,
    entryDate,
    isLoading,
    onClose,
    className = "",
}: ReflectionPointsPanelProps) {
    if (isLoading) {
        return (
            <div className={`p-6 text-white ${className}`}>
                <h3 className="text-lg font-semibold text-ugm-gold mb-3">Reflection Insights</h3>
                <div className="flex justify-center items-center h-40">
                    <FiLoader className="animate-spin text-ugm-gold-light" size={24} />
                    <p className="ml-2 text-gray-300">Loading insights...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-6 text-white ${className}`}>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-ugm-gold">
                    Reflection Insights
                    {entryDate && <span className="text-sm text-gray-400 ml-2">for {entryDate}</span>}
                </h3>
                {onClose && ( // Conditionally render close button if handler is provided
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close reflections">
                        <FiX size={20} />
                    </button>
                )}
            </div>
            
            {reflectionPoints.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto pr-2"> {/* Adjust max-h as needed */}
                    <p className="text-sm text-gray-300 mb-3">
                        Personalized points based on your journal entries:
                    </p>
                    <ul className="space-y-3">
                        {reflectionPoints.map(reflection => (
                            <li 
                                key={reflection.id} 
                                className="p-3 bg-ugm-blue-dark/50 rounded-lg border border-ugm-blue-light/40"
                            >
                                <div className="flex items-start">
                                    <FiMessageCircle className="text-ugm-gold-light mr-3 mt-1 flex-shrink-0" size={18} />
                                    <p className="text-sm text-gray-200">
                                        {reflection.reflection_text}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="text-center py-8">
                    <FiInfo size={30} className="mx-auto text-ugm-blue-light mb-3" />
                    <p className="text-gray-400">No specific reflection insights available yet.</p>
                    <p className="text-xs text-gray-500 mt-1">Keep journaling to receive personalized reflections!</p>
                </div>
            )}
        </div>
    );
}