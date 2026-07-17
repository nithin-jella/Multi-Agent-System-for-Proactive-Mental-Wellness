"use client";

import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { ArrowScribbleGlyph, CompassGlyph } from '@/components/landing/CustomGlyphs';
import { StarburstGlyph } from '@/components/landing/CustomGlyphs';

export default function HowItWorksSection() {
  const { t } = useI18n();

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 bg-transparent relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FFCA40] opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="mb-20 text-center">
           <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 leading-tight">
             {t('landing.how.title', 'Intelligent Intervention Flow')}
           </h2>
           <p className="text-slate-400 text-lg max-w-2xl mx-auto">
             {t('landing.how.subtitle', 'Unlike generic chatbots, Aika actively assesses risk and routes you to the right care.')}
           </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
            
            {/* Left: The Generic Vs Aika Comparison */}
            <div className="space-y-8">
               <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="p-6 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-sm grayscale opacity-60"
               >
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Typical Chatbot</h3>
                  <div className="space-y-3">
                     <div className="bg-white/5 p-3 rounded-lg text-sm text-slate-400">"I am sad."</div>
                     <div className="bg-[#000B1F]/70 p-3 rounded-lg text-sm text-slate-500">"I am sorry to hear that." (Generic sympathy)</div>
                     <div className="bg-[#000B1F]/70 p-3 rounded-lg text-sm text-slate-500">"What do you want to talk about?" (Passive loop)</div>
                  </div>
               </motion.div>

               <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="p-8 rounded-3xl border border-[#FFCA40]/30 bg-[#021029]/70 backdrop-blur-md shadow-[0_0_40px_-10px_rgba(255,202,64,0.1)]"
               >
                  <h3 className="text-sm font-bold text-[#FFCA40] uppercase tracking-widest mb-6 flex items-center gap-2">
                     <StarburstGlyph className="w-4 h-4" />
                     The Aika Difference
                  </h3>
                  
                  {/* Interactive Flow Diagram */}
                  <div className="relative space-y-6">
                     <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#FFCA40]/50 to-transparent" />
                     
                     {[{
                        title: "1. Distress Detection",
                        desc: "Analyzes clinical keywords (e.g., 'hopeless', 'overwhelmed') in real-time.",
                        icon: StarburstGlyph
                     }, {
                         title: "2. Active Intervention",
                         desc: "Immediately deploys CBT-based grounding tools to stabilize emotion.",
                         icon: CompassGlyph
                     }, {
                         title: "3. Professional Handoff",
                         desc: "Summarizes the session and securely forwards it to UGM Psychologists.",
                         icon: ArrowScribbleGlyph
                     }].map((step, idx) => (
                        <div key={idx} className="relative flex gap-4">
                           <div className="w-8 h-8 rounded-full bg-[#000B1F] border border-[#FFCA40] flex items-center justify-center shrink-0 z-10">
                              <step.icon className="w-4 h-4 text-[#FFCA40]" />
                           </div>
                           <div>
                              <h4 className="text-white font-bold">{step.title}</h4>
                              <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </motion.div>
            </div>

            {/* Right: The Psychologist Dashboard View */}
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               transition={{ delay: 0.4 }}
               className="relative"
            >
               <div className="absolute inset-x-0 -top-20 -bottom-20 bg-gradient-to-r from-transparent via-[#FFCA40]/5 to-transparent blur-xl" />
               
               <div className="bg-[#0B162E]/70 backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
                  {/* Fake UI Header */}
                  <div className="bg-[#000B1F]/70 p-4 border-b border-white/5 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                     </div>
                     <div className="text-xs font-bold text-slate-500 tracking-widest uppercase">Psychologist Dashboard</div>
                  </div>

                  {/* Body */}
                  <div className="p-8 space-y-6">
                     <div className="flex items-start justify-between">
                        <div>
                           <div className="text-2xl font-bold text-white mb-1">Student #8492</div>
                           <div className="text-[#FFCA40] text-sm font-medium">⚠️ Priority: High Risk Detected</div>
                        </div>
                        <div className="px-3 py-1 bg-[#4ADE80]/10 text-[#4ADE80] rounded-full text-xs font-bold border border-[#4ADE80]/20">
                           Awaiting Review
                        </div>
                     </div>

                     <div className="bg-[#000B1F]/70 rounded-xl p-4 border border-white/5">
                        <div className="text-xs text-slate-500 uppercase mb-2">Aika Summary</div>
                        <p className="text-slate-300 text-sm leading-relaxed">
                           "User exhibited signs of <span className="text-white font-bold">acute academic anxiety</span> and mentioned <span className="text-white font-bold">sleep deprivation</span>. Initial grounding exercise (4-7-8 breathing) was completed but user requested human support."
                        </p>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                           <div className="text-2xl font-bold text-white mb-1">8/10</div>
                           <div className="text-xs text-slate-400">Distress Level</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
                           <div className="text-2xl font-bold text-white mb-1">CBT</div>
                           <div className="text-xs text-slate-400">Intervention Type</div>
                        </div>
                     </div>

                     <button className="w-full py-3 bg-[#FFCA40] hover:bg-[#FFD770] text-[#000B1F] font-bold rounded-xl transition-colors">
                        Accept Case & Open Chat
                     </button>
                  </div>
               </div>

               {/* Caption */}
               <div className="mt-4 text-center">
                  <p className="text-sm text-slate-500">
                     *Psychologists receive structured summaries, allowing for faster, informed care.
                  </p>
               </div>
            </motion.div>

        </div>

      </div>
    </section>
  );
}
