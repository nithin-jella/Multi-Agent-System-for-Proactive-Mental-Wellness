"use client";

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ArrowScribbleGlyph, StarburstGlyph } from '@/components/landing/CustomGlyphs';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { useI18n } from '@/i18n/I18nProvider';

// Animation variants for staggered entrance
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 50, damping: 20 }
  }
};

export default function HeroSection() {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-transparent">
      
      {/* 1. Background Layers */}
      {/* Subtle Image Backdrop removed as requested */}

      {/* Particle System - kept subtle */}
      <div className="absolute inset-0 z-0 pointer-events-none h-[120vh]">
        <ParticleBackground
          count={shouldReduceMotion ? 0 : 50}
          colors={["#FFCA40", "#6A98F0", "#ffffff"]}
          minSize={2}
          maxSize={8}
          speed={1}
        />
      </div>

      {/* Grid Pattern Overlay for "Tech/Structural" feel */}
      <div className="absolute inset-0 z-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-size-[4rem_4rem] h-[200vh]" />

      {/* 2. Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20 w-full pt-20 pb-16 lg:pt-32 lg:pb-24">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          {/* Left Column: Typography & CTA */}
          <div className="text-center lg:text-left space-y-8 max-w-2xl mx-auto lg:mx-0">
            
            {/* Headline */}
            <div className="space-y-4">
              <motion.h1 
                variants={itemVariants}
                className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight"
              >
                {t('landing.hero.title_line1', 'Your mental health,')}
                <br />
                <span className="text-[#FFCA40]">
                  {t('landing.hero.title_highlight', 'proactively managed.')}
                </span>
              </motion.h1>
              
              <motion.p 
                variants={itemVariants}
                className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-lg mx-auto lg:mx-0 font-light"
              >
                {t(
                  'landing.hero.description',
                  "Aika is an intelligent agent designed for UGM students. It helps you unpack your thoughts, find coping mechanisms, and connect with professional help when you're ready."
                )}
              </motion.p>
            </div>

            {/* CTAs */}
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4"
            >
              <Link href="/aika" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-4 bg-[#FFCA40] text-[#000B1F] rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,202,64,0.3)] hover:shadow-[0_0_30px_rgba(255,202,64,0.5)] transition-all flex items-center justify-center gap-2"
                >
                  {t('landing.hero.cta_primary', 'Chat with Aika')}
                  <ArrowScribbleGlyph className="w-5 h-5" />
                </motion.button>
              </Link>
              
              <Link href="/about" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/5 transition-all"
                >
                  {t('landing.hero.cta_secondary', 'How it works')}
                </motion.button>
              </Link>
            </motion.div>

            {/* Trust Signal Mini */}
            <motion.div variants={itemVariants} className="pt-4 flex items-center justify-center lg:justify-start gap-4 text-sm text-slate-400">
               <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#000B1F] bg-slate-700 overflow-hidden relative">
                       <Image src={`https://randomuser.me/api/portraits/thumb/men/${i+10}.jpg`} alt="User" fill className="object-cover" />
                    </div>
                  ))}
               </div>
               <p>{t('landing.hero.social_proof', 'Trusted by 500+ UGM Students')}</p>
            </motion.div>

          </div>
          
          {/* Right Column: Student Grid Layout */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:grid grid-cols-3 gap-4 h-150 items-center"
          >
             {/* Column 1 */}
             <div className="flex flex-col gap-4 mt-8">
                {/* Image Card */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="relative h-64 rounded-3xl overflow-hidden border border-white/10 group"
                >
                   <Image 
                     src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400&auto=format&fit=crop" 
                     alt="Sarah" 
                     fill 
                     className="object-cover transition-transform duration-700 group-hover:scale-110" 
                   />
                   <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                      <span className="font-bold text-[#000B1F] text-xs">Sarah</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#000B1F]"></span>
                      <span className="text-[#000B1F]/70 text-[10px] font-medium">Psychology</span>
                   </div>
                </motion.div>

                {/* Text Card (Yellow) */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-[#FFCA40] text-[#000B1F] p-6 rounded-3xl flex flex-col justify-center h-48 relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                   </div>
                   <h3 className="font-bold text-lg leading-tight mb-2">Remote Support</h3>
                   <p className="opacity-80 text-xs">Access help from anywhere, anytime.</p>
                </motion.div>
             </div>

             {/* Column 2 */}
             <div className="flex flex-col gap-4 -mt-8">
                {/* Text Card (White) */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white p-6 rounded-3xl flex flex-col justify-center h-40 relative overflow-hidden"
                >
                   <h3 className="text-[#001D58] font-bold text-lg leading-tight mb-2">Quick & Adaptive</h3>
                   <p className="text-[#001D58]/80 text-xs">Personalized care plans generated in seconds.</p>
                </motion.div>

                {/* Image Card */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="relative h-72 rounded-3xl overflow-hidden border border-white/10 group"
                >
                   <Image 
                     src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=400&auto=format&fit=crop" 
                     alt="Budi" 
                     fill 
                     className="object-cover transition-transform duration-700 group-hover:scale-110" 
                   />
                   <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                      <span className="font-bold text-[#000B1F] text-xs">Budi</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#000B1F]"></span>
                      <span className="text-[#000B1F]/70 text-[10px] font-medium">Engineering</span>
                   </div>
                </motion.div>
             </div>

             {/* Column 3 */}
             <div className="flex flex-col gap-4 mt-4">
                {/* Image Card */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="relative h-56 rounded-3xl overflow-hidden border border-white/10 group"
                >
                   <Image 
                     src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=400&auto=format&fit=crop" 
                     alt="Maya" 
                     fill 
                     className="object-cover transition-transform duration-700 group-hover:scale-110" 
                   />
                   <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                      <span className="font-bold text-[#000B1F] text-xs">Maya</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#000B1F]"></span>
                      <span className="text-[#000B1F]/70 text-[10px] font-medium">Economics</span>
                   </div>
                </motion.div>

                {/* Text Card (Yellow/Orange) */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-[#FFCA40] p-6 rounded-3xl flex flex-col justify-center h-56 relative overflow-hidden"
                >
                   <div className="absolute -bottom-4 -right-4 p-4 opacity-20">
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
                   </div>
                   <h3 className="text-[#000B1F] font-bold text-lg leading-tight mb-2">Rest Assured.</h3>
                   <p className="text-[#000B1F]/80 text-xs leading-relaxed">
                     No judgment, no fees for students, and complete privacy for your peace of mind.
                   </p>
                </motion.div>
             </div>

          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}