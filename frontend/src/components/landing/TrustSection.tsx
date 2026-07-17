"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';

const partners = [
  { name: "Universitas Gadjah Mada", logo: "/UGM_Lambang.png" },
  { name: "DTETI UGM", logo: "/DTETI_Logo.png" }
];

export default function TrustSection() {
  const { t } = useI18n();

  return (
    <section className="py-10 bg-transparent border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
           
           <div className="text-sm font-bold text-[#FFCA40] uppercase tracking-widest whitespace-nowrap">
              {t('landing.trust.title', 'Built for')}
           </div>

           <div className="flex items-center gap-12">
              {partners.map((partner, index) => (
                <div key={index} className="flex items-center gap-4">
                   <div className="relative w-12 h-12">
                      <Image 
                        src={partner.logo} 
                        alt={partner.name} 
                        fill 
                        className="object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                      />
                   </div>
                   <span className="text-white font-bold text-sm hidden sm:block tracking-wide">
                     {partner.name}
                   </span>
                </div>
              ))}
           </div>

           <div className="hidden md:flex items-center gap-6">
              <div className="pl-6 border-l border-white/10">
                 <div className="text-2xl font-bold text-white">100%</div>
                 <div className="text-xs text-slate-400">Privacy First</div>
              </div>
              <div className="pl-6 border-l border-white/10">
                 <div className="text-2xl font-bold text-white">UGM</div>
                 <div className="text-xs text-slate-400">Exclusive</div>
              </div>
           </div>

        </div>
      </div>
    </section>
  );
}
