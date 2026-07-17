import React from 'react';
import { Metadata } from 'next';
import { FiBook, FiInfo } from 'react-icons/fi';
import ContentResourcesTable from '@/components/admin/content-resources/ContentResourcesTable';

export const metadata: Metadata = {
    title: 'Admin: Content Resources',
};

const ContentResourcesPage = () => {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FiBook className="text-[#FFCA40]" />
                        Content Resources
                    </h1>
                    <p className="text-sm text-white/60 mt-1">
                        Knowledge base for AI mental health support agents
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-[#FFCA40]/10 to-[#FFD700]/10 border border-[#FFCA40]/30 rounded-xl p-5">
                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#FFCA40]/20 flex items-center justify-center">
                            <FiInfo className="h-5 w-5 text-[#FFCA40]" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold text-white mb-2">
                            What are Content Resources?
                        </h3>
                        <p className="text-sm text-white/80 leading-relaxed mb-3">
                            Content Resources are the knowledge base that powers our AI agents&apos; RAG (Retrieval-Augmented Generation) system. 
                            When users chat with our AI counselors, the system searches through these resources to provide accurate, 
                            evidence-based mental health guidance.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                <div className="text-xs font-semibold text-[#FFCA40] uppercase tracking-wide mb-1">Text Resources</div>
                                <p className="text-xs text-white/70">
                                    Mental health guides, therapy techniques, coping strategies, and educational content
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                <div className="text-xs font-semibold text-[#FFCA40] uppercase tracking-wide mb-1">PDF Documents</div>
                                <p className="text-xs text-white/70">
                                    Clinical guidelines, research papers, workbooks, and professional resources
                                </p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                                <div className="text-xs font-semibold text-[#FFCA40] uppercase tracking-wide mb-1">Web Resources</div>
                                <p className="text-xs text-white/70">
                                    Trusted websites, online articles, and external mental health resources
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <ContentResourcesTable />
        </div>
    );
};

export default ContentResourcesPage;