import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Mail, Phone, ExternalLink, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { User, UserLog } from '@/types/admin/users';
import { ScreeningProfile, DIMENSION_LABELS, RISK_CONFIG, INSTRUMENT_CONFIG, RiskLevel } from '@/types/admin/screening';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

import Link from 'next/link';

interface UserProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    screeningProfile: ScreeningProfile | null;
    isLoading: boolean;
}

type TabType = 'overview' | 'screening' | 'crm';

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
};

export default function PatientProfileDrawer({ isOpen, onClose, user, screeningProfile, isLoading }: UserProfileDrawerProps) {
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    if (!isOpen || !user) return null;

    const renderRiskBadge = (level: RiskLevel) => {
        const config = RISK_CONFIG[level];
        if (!config) return null;
        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                {level === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                {config.label} Risk
            </span>
        );
    };

    const renderDimensionBar = (score: number, dimension: keyof typeof DIMENSION_LABELS) => {
        const config = INSTRUMENT_CONFIG[dimension];
        return (
            <div className="mb-4" key={dimension}>
                <div className="flex justify-between items-end mb-1">
                    <div>
                        <span className="text-sm font-medium text-white">{DIMENSION_LABELS[dimension] || dimension}</span>
                        <span className="ml-2 text-xs text-white/50">{config?.code}</span>
                    </div>
                    <span className="text-sm font-bold text-white/90">{(score * 100).toFixed(0)}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full ${config?.bgColor || 'bg-[#FFCA40]'}`}
                        style={{ width: `${Math.min(100, score * 100)}%` }}
                    />
                </div>
            </div>
        );
    };

    const formatWhatsAppLink = (phone: string | undefined | null) => {
        if (!phone) return '#';
        const cleanPhone = phone.replace(/\D/g, '');
        let finalPhone = cleanPhone;
        if (cleanPhone.startsWith('08')) {
            finalPhone = '62' + cleanPhone.substring(1);
        }
        const message = encodeURIComponent(`Hello ${user.name || ''}, this is the Admin from UGM-AICare reaching out regarding your recent wellness check-in.`);
        return `https://wa.me/${finalPhone}?text=${message}`;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
                onClick={onClose}
            >
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="w-full max-w-lg bg-[#001D58] border-l border-white/20 h-full overflow-hidden flex flex-col shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {isLoading ? (
                        <div className="p-8 flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCA40]"></div>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="p-6 border-b border-white/10 bg-white/5 shrink-0">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative h-16 w-16 rounded-full overflow-hidden border border-white/20 bg-white/5 shrink-0">
                                            {user.avatar_url ? (
                                                <Image src={user.avatar_url} alt="Avatar" fill className="object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-[#FFCA40]/10 text-xl font-bold text-[#FFCA40]">
                                                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{user.name || user.email || `User ${user.id}`}</h2>
                                            <p className="text-sm text-white/60">{user.email}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${user.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border bg-white/10 text-white/70 border-white/20">
                                                    {user.role}
                                                </span>
                                                {screeningProfile && renderRiskBadge(screeningProfile.overall_risk)}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-white/10 mt-6">
                                    {(['overview', 'screening', 'crm'] as TabType[]).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab
                                                ? 'border-[#FFCA40] text-[#FFCA40]'
                                                : 'border-transparent text-white/60 hover:text-white/80'
                                                }`}
                                        >
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/20">
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="text-sm text-white/50 mb-1">Joined</div>
                                                <div className="font-medium text-white">{formatDate(user.created_at)}</div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="text-sm text-white/50 mb-1">Last Active</div>
                                                <div className="font-medium text-white">{formatDate(user.last_activity_date)}</div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="text-sm text-white/50 mb-1">Current Streak</div>
                                                <div className="font-medium text-[#FFCA40] text-xl">{user.current_streak} <span className="text-sm text-white/50">days</span></div>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                                <div className="text-sm text-white/50 mb-1">Sentiment</div>
                                                <div className="font-medium text-white text-xl">{(user.sentiment_score * 100).toFixed(0)}%</div>
                                            </div>
                                        </div>

                                        {screeningProfile && screeningProfile.dimension_scores && (
                                            <div>
                                                <h3 className="text-lg font-bold text-white mb-3">Clinical Risk Radar</h3>
                                                <div className="bg-white/5 rounded-xl border border-white/10 p-4 h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RadarChart cx="50%" cy="50%" outerRadius="70%"
                                                            data={screeningProfile.dimension_scores.map(ds => ({
                                                                subject: DIMENSION_LABELS[ds.dimension] || ds.dimension,
                                                                score: ds.current_score * 100,
                                                                fullMark: 100,
                                                            }))}
                                                        >
                                                            <PolarGrid stroke="rgba(255,255,255,0.2)" />
                                                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} />
                                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                            <Radar name="Patient" dataKey="score" stroke="#FFCA40" fill="#FFCA40" fillOpacity={0.5} />
                                                        </RadarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-3">Activity Stats</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                                                    <div className="text-xl font-bold text-[#FFCA40]">{user.total_journal_entries}</div>
                                                    <div className="text-[10px] uppercase text-white/50 mt-1">Journals</div>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                                                    <div className="text-xl font-bold text-green-400">{user.total_conversations}</div>
                                                    <div className="text-[10px] uppercase text-white/50 mt-1">Chats</div>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                                                    <div className="text-xl font-bold text-yellow-400">{user.total_badges}</div>
                                                    <div className="text-[10px] uppercase text-white/50 mt-1">Badges</div>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                                                    <div className="text-xl font-bold text-purple-400">{user.total_appointments}</div>
                                                    <div className="text-[10px] uppercase text-white/50 mt-1">Visits</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-3">Quick Links</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <Link href={`/admin/conversations?user_id=${user.id}`} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
                                                    Chats <ExternalLink className="w-3 h-3" />
                                                </Link>
                                                <Link href={`/admin/cases?user_id=${user.id}`} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white flex items-center gap-2 transition-colors">
                                                    Cases <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'screening' && (
                                    <div className="space-y-6">
                                        {!screeningProfile ? (
                                            <div className="p-8 text-center border border-dashed border-white/20 rounded-xl bg-white/5">
                                                <p className="text-white/60">No screening data available for this user yet.</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10">
                                                    <div>
                                                        <div className="text-sm text-white/50 mb-1">Status</div>
                                                        <div className="flex items-center gap-2">
                                                            {screeningProfile.requires_attention && (
                                                                <AlertTriangle className="w-4 h-4 text-[#FFCA40]" />
                                                            )}
                                                            <span className="font-medium text-white">
                                                                {screeningProfile.requires_attention ? 'Requires Attention' : 'Monitoring'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-white/50 mb-1">Trajectory</div>
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold uppercase
                                ${screeningProfile.risk_trajectory === 'improving' ? 'bg-green-500/20 text-green-400' :
                                                                screeningProfile.risk_trajectory === 'declining' ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-blue-500/20 text-blue-400'}
                            `}>
                                                            {screeningProfile.risk_trajectory}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h3 className="text-lg font-bold text-white mb-4">Clinical Dimensions</h3>
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                                                        {screeningProfile.dimension_scores.map(ds => {
                                                            const config = INSTRUMENT_CONFIG[ds.dimension];
                                                            return (
                                                                <div className="mb-4 last:mb-0" key={ds.dimension}>
                                                                    <div className="flex justify-between items-end mb-1.5">
                                                                        <div>
                                                                            <span className="text-sm font-medium text-white">{DIMENSION_LABELS[ds.dimension] || ds.dimension}</span>
                                                                            <span className="ml-2 text-[10px] font-bold uppercase text-white/40">{config?.code}</span>
                                                                        </div>
                                                                        <span className="text-sm font-bold text-white/90">{(ds.current_score * 100).toFixed(0)}</span>
                                                                    </div>
                                                                    <div className="w-full bg-white/5 rounded-full h-2">
                                                                        <div
                                                                            className="h-2 rounded-full bg-[#FFCA40]"
                                                                            style={{ width: `${Math.min(100, ds.current_score * 100)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'crm' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-3">Contact Information</h3>
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-white/5 rounded-lg mt-1"><Mail className="w-4 h-4 text-white/60" /></div>
                                                    <div>
                                                        <div className="text-xs text-white/50 uppercase font-bold tracking-wider mb-1">Email</div>
                                                        <div className="text-sm text-white select-all">{user.email || 'Not provided'}</div>
                                                        {user.allow_email_checkins && (
                                                            <div className="mt-1 flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded inline-block w-fit">
                                                                <CheckCircle className="w-3 h-3" /> Check-ins enabled
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-white/5 rounded-lg mt-1"><Phone className="w-4 h-4 text-white/60" /></div>
                                                    <div>
                                                        <div className="text-xs text-white/50 uppercase font-bold tracking-wider mb-1">Phone</div>
                                                        <div className="text-sm text-white select-all">{user.phone || 'Not provided'}</div>
                                                        {user.phone && (
                                                            <a
                                                                href={formatWhatsAppLink(user.phone)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366] text-white rounded text-xs font-bold hover:bg-[#20b958] transition-colors"
                                                            >
                                                                Open in WhatsApp <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-3">CRM Operations</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                <button className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-colors">
                                                    <div>
                                                        <div className="text-sm font-medium text-white">Send Check-in Email</div>
                                                        <div className="text-xs text-white/50">Send an automated wellness check format</div>
                                                    </div>
                                                    <Mail className="w-4 h-4 text-white/60" />
                                                </button>
                                                <button className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-colors">
                                                    <div>
                                                        <div className="text-sm font-medium text-white">Schedule Evaluation</div>
                                                        <div className="text-xs text-white/50">Book a slot with counselor</div>
                                                    </div>
                                                    <Calendar className="w-4 h-4 text-white/60" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
