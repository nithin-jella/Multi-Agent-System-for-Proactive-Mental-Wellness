"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowScribbleGlyph } from '@/components/landing/CustomGlyphs';
import { useI18n } from '@/i18n/I18nProvider';

// Replaced unstable 3D model with a high-quality SVG/CSS composition
// This ensures reliable rendering and fits the "transparent/particles" theme better.

export default function FinalCTASection() {
  const { t } = useI18n();

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 bg-transparent relative overflow-hidden">
      
      {/* Portal Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white opacity-[0.02] blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-12"
        >
             {/* Visual Icon Instead of 3D Model */}
             <div className="w-32 h-32 mx-auto mb-8 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[#FFCA40] blur-[40px] opacity-30 animate-pulse" />
                <div className="relative z-10">
                   <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#FFCA40" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8" />
                      <path d="M8 12h8" />
                   </svg>
                </div>
             </div>

             <h2 className="text-4xl lg:text-7xl font-bold text-white tracking-tight mb-8">
               {t('landing.final.title', 'Ready to start?')}
             </h2>
             <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
               {t('landing.final.subtitle', 'No forms. No waiting lists. Just a safe place to clear your mind.')}
             </p>
             
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/aika" className="group relative px-8 py-4 bg-white text-[#000B1F] rounded-full font-bold text-lg flex items-center justify-center hover:bg-slate-200 transition-colors w-full sm:w-auto">
                   {t('landing.cta.primary', 'Chat with Aika')}
                   <ArrowScribbleGlyph className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/resources" className="px-8 py-4 bg-[#000B1F]/70 border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/5 transition-colors w-full sm:w-auto">
                   {t('landing.cta.secondary', 'Browse Resources')}
                </Link>
             </div>
        </motion.div>

        <div className="pt-16 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
                { label: 'Anonymous', value: '100%' },
                { label: 'Available', value: '24/7' },
                { label: 'Wait time', value: '0s' },
                { label: 'Cost', value: 'Free' },
            ].map((stat, idx) => (
                <div key={idx}>
                    <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                    <div className="text-slate-500 text-sm uppercase tracking-wider">{stat.label}</div>
                </div>
            ))}
        </div>

      </div>
    </section>
  );
}
