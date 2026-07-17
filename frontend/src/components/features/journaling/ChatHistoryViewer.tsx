// frontend/src/components/journaling/ChatHistoryViewer.tsx
"use client";

import React, { useState, useEffect } from 'react';
import apiClient from '@/services/api';
import { Message } from '@/types/chat'; 
import { MessageBubble } from '@/components/features/chat/MessageBubble';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Interface matching backend response item
interface HistoryItem extends Message {
    session_id: string;
}

export default function ChatHistoryViewer() {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const baseUrl = process.env.INTERNAL_API_URL;
                // Assuming apiClient handles auth headers automatically now
                const response = await apiClient.get<HistoryItem[]>(`${baseUrl}/api/v1/history`); // Use your API client
                console.log("Chat history response:", response.data);
                // Group messages by session or date for better display (optional enhancement)
                setHistory(response.data);
            } catch (err) {
                console.error("Error fetching chat history:", err);
                setError("Failed to load chat history.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    if (loading) {
        return <div className="text-center p-6">Loading chat history...</div>;
    }

    if (error) {
        return <div className="text-center p-6 text-red-400">{error}</div>;
    }

    if (history.length === 0) {
        return <div className="text-center p-6 text-gray-400">No conversation history found.</div>;
    }

    // Simple rendering - consider grouping by date or session later
    return (
        <div className="space-y-6 min-h-[70vh] p-4 bg-white/10 text-white">
            {history.map((msg, index) => (
               <div key={index}>
                 {/* Optional: Display date dividers */}
                 {(index === 0 || new Date(msg.timestamp).toDateString() !== new Date(history[index - 1].timestamp).toDateString()) && (
                   <div className="text-center text-xs text-gray-400 my-4 py-1 border-y border-white/10">
                     {format(new Date(msg.timestamp), 'EEEE, d MMMM yyyy', { locale: id })}
                   </div>
                 )}
                 <MessageBubble message={msg} />
               </div>
            ))}
        </div>
    );
}