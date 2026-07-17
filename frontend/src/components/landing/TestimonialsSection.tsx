"use client";

import { motion } from 'framer-motion';
import { StarburstGlyph, ThreadGlyph, HeartPathGlyph, ShieldWaveGlyph } from '@/components/landing/CustomGlyphs';
import { useI18n } from '@/i18n/I18nProvider';
import Image from 'next/image';

const testimonials = [
  {
    name: "Sarah D.",
    role: "Psychology '21",
    text: "I didn't realize I was spiraling until Aika pointed out my sleep patterns. It gently nudged me to book a counselor before I crashed.",
    tag: "Early Detection",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop"
  },
  {
    name: "Dimas P.",
    role: "Engineering '23",
    text: "The breathing exercises actually work. I use them before every major presentation now.",
    tag: "Instant Relief",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop"
  },
  {
    name: "Putri R.",
    role: "Medicine '22",
    text: "Knowing my data is private makes all the difference. I can be honest with Aika in a way I can't be with friends.",
    tag: "100% Private",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=100&auto=format&fit=crop"
  }
];

export default function TestimonialsSection() {
  const { t } = useI18n();

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 bg-transparent relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        {/* Section Header - Side by Side on Large Screens */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-16 gap-8">
            <div className="max-w-2xl">
                <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 leading-tight">
                    {t('landing.stories.title', 'Real impact on real')} <br/>
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-[#FFCA40] to-[#FFD770]">
                        {t('landing.stories.highlight', 'student lives.')}
                    </span>
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
                    {t('landing.stories.subtitle', 'See how UGM students are using Aika to stay ahead of stress and maintain their mental well-being.')}
                </p>
            </div>
            
            <div className="flex items-center gap-4 text-slate-400 text-sm font-medium">
                <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-[#000B1F] bg-slate-800 relative overflow-hidden">
                            <Image 
                                src={`https://randomuser.me/api/portraits/thumb/men/${i+20}.jpg`} 
                                alt="User" 
                                fill 
                                className="object-cover" 
                            />
                        </div>
                    ))}
                </div>
                <div>
                   <span className="text-white font-bold">500+</span> Students Joined
                </div>
            </div>
        </div>

        {/* Dynamic Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          
          {/* Featured Testimonial - Spans 2 cols on tablet */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             className="md:col-span-2 lg:col-span-1 bg-linear-to-br from-[#1A2942]/80 to-[#021029]/80 backdrop-blur-xl p-8 rounded-4xl border border-white/10 relative overflow-hidden group hover:border-[#FFCA40]/30 transition-all duration-300"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <ThreadGlyph className="w-32 h-32 text-white" />
             </div>
             
             <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10">
                        <Image src={testimonials[0].avatar} alt={testimonials[0].name} fill className="object-cover" />
                    </div>
                    <div>
                        <div className="text-white font-bold">{testimonials[0].name}</div>
                        <div className="text-slate-500 text-sm">{testimonials[0].role}</div>
                    </div>
                </div>
                
                <div className="mb-6">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${testimonials[0].color}`}>
                        <StarburstGlyph className="w-3 h-3" />
                        {testimonials[0].tag}
                    </span>
                </div>

                <p className="text-xl text-slate-200 leading-relaxed font-medium">
                   "{testimonials[0].text}"
                </p>

                <div className="mt-auto pt-6 flex gap-1">
                    {[1,2,3,4,5].map(i => (
                        <StarIcon key={i} className="w-4 h-4 text-[#FFCA40]" />
                    ))}
                </div>
             </div>
          </motion.div>

          {/* Second Card */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.1 }}
             className="bg-[#021029]/60 backdrop-blur-md p-8 rounded-4xl border border-white/5 hover:bg-[#021029]/80 transition-colors flex flex-col"
          >
             <div className="flex items-center justify-between mb-6">
                 <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10">
                    <Image src={testimonials[1].avatar} alt={testimonials[1].name} fill className="object-cover" />
                 </div>
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                    <HeartPathGlyph className="w-4 h-4" />
                 </div>
             </div>
             
             <p className="text-slate-300 text-lg mb-6 grow">"{testimonials[1].text}"</p>
             
             <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div>
                    <div className="text-white font-bold text-sm">{testimonials[1].name}</div>
                    <div className="text-slate-500 text-xs">{testimonials[1].role}</div>
                </div>
                <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                    {testimonials[1].tag}
                </span>
             </div>
          </motion.div>

          {/* Third Card */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2 }}
             className="bg-[#021029]/60 backdrop-blur-md p-8 rounded-4xl border border-white/5 hover:bg-[#021029]/80 transition-colors flex flex-col"
          >
             <div className="flex items-center justify-between mb-6">
                 <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10">
                    <Image src={testimonials[2].avatar} alt={testimonials[2].name} fill className="object-cover" />
                 </div>
                 <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                    <ShieldWaveGlyph className="w-4 h-4" />
                 </div>
             </div>
             
             <p className="text-slate-300 text-lg mb-6 grow">"{testimonials[2].text}"</p>
             
             <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div>
                    <div className="text-white font-bold text-sm">{testimonials[2].name}</div>
                    <div className="text-slate-500 text-xs">{testimonials[2].role}</div>
                </div>
                <span className="text-purple-400 text-xs font-bold bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
                    {testimonials[2].tag}
                </span>
             </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}

function StarIcon({ className }: { className: string }) {
    return (
        <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
    )
}
