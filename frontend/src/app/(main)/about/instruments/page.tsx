"use client";

import { motion } from 'framer-motion';
import { FiBookOpen } from 'react-icons/fi';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { INSTRUMENT_CONFIG, DIMENSION_LABELS } from '@/types/admin/screening';

export default function AboutInstrumentsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] pt-24 pb-14 px-4 sm:px-6 relative">
            <div className="absolute inset-0 z-0 opacity-40">
                <ParticleBackground count={60} colors={["#FFCA40", "#6A98F0", "#ffffff"]} minSize={2} maxSize={8} speed={0.8} />
            </div>

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-16"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFCA40]/20 backdrop-blur-xl rounded-full border border-[#FFCA40]/30 shadow-lg mb-6"
                    >
                        <FiBookOpen className="text-[#FFCA40]" />
                        <span className="text-white font-medium text-sm">Clinical Instruments</span>
                    </motion.div>

                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                        Validated Psychological <span className="text-[#FFCA40]">Instruments</span>
                    </h1>
                    <p className="text-xl text-white/80 max-w-3xl mx-auto">
                        Our AI screening is strictly mapped to parameters from established clinical tools to ensure reliability and evidence-based assessment.
                    </p>
                </motion.div>

                {/* Instruments Grid */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-lg">
                            <InformationCircleIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Assessment Methodology</h2>
                            <p className="text-sm text-white/60 mt-1">
                                The Safety Triage Agent extracts signals from conversations and aligns them with these clinical scales.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(INSTRUMENT_CONFIG).map(([dim, info], idx) => (
                            <motion.div
                                key={dim}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.05 }}
                                className="p-6 rounded-xl border border-white/10 bg-[#001D58]/40 hover:bg-white/5 hover:border-[#FFCA40]/30 transition-all group"
                            >
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${info.color} bg-white/5 border border-white/5 shadow-sm`}>
                                        {info.code}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                                        {DIMENSION_LABELS[dim as keyof typeof DIMENSION_LABELS] || dim}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white/90 mb-2 leading-tight group-hover:text-white">{info.name}</h3>
                                <p className="text-sm text-white/60 mb-4 leading-relaxed line-clamp-2 md:line-clamp-none">
                                    {info.description}
                                </p>
                                <div className="mt-auto pt-4 border-t border-white/10">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Reference</span>
                                        <span className="text-[11px] text-white/70 font-medium">{info.reference}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.section>

                {/* Back navigation */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="flex justify-center"
                >
                    <Link href="/about">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-8 py-3 bg-white/10 backdrop-blur-md text-white rounded-full font-semibold border border-white/20 hover:bg-white/20 transition-all shadow-lg"
                        >
                            Back to About
                        </motion.button>
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}
