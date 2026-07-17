"use client";

import { motion } from 'framer-motion';
import { Disclosure } from '@headlessui/react';
import { CaretGlyph, CompassGlyph } from '@/components/landing/CustomGlyphs';
import { useI18n } from '@/i18n/I18nProvider';
import Link from 'next/link';

const faqs = [
  {
    qKey: 'landing.faq.q1',
    qDefault: 'Does Aika replace professional counselors?',
    aKey: 'landing.faq.a1',
    aDefault: "No. Aika is trained to provide immediate coping support and risk assessment. For clinical issues, it explicitly guides you to connect with UGM's psychologists via our integrated booking system."
  },
  {
    qKey: 'landing.faq.q2',
    qDefault: "Is my conversation private?",
    aKey: 'landing.faq.a2',
    aDefault: 'Yes. Your chats are end-to-end encrypted. Psychologists only receive a structured clinical summary if you explicitly agree to escalate the case or book a session.'
  },
  {
    qKey: 'landing.faq.q3',
    qDefault: 'How does the "active intervention" work?',
    aKey: 'landing.faq.a3',
    aDefault: 'Unlike standard chatbots that just listen, Aika recognizes distress patterns and proactively suggests grounding exercises (like CBT or Box Breathing) in real-time to help stabilize your mood.'
  },
  {
    qKey: 'landing.faq.q4',
    qDefault: 'Is it free for all students?',
    aKey: 'landing.faq.a4',
    aDefault: 'Yes, UGM-AICare is fully funded by the university as part of the student welfare initiative. There are no hidden costs.'
  }
];

export default function FAQSection() {
  const { t } = useI18n();

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 bg-transparent relative border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
            
            {/* Left Column: Header & Support Card */}
            <div className="lg:col-span-5 space-y-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
                        {t('landing.faq.title', 'Questions?')} <br/>
                        <span className="text-[#FFCA40]">{t('landing.faq.subtitle', 'We have answers.')}</span>
                    </h2>
                    <p className="text-slate-400 text-lg leading-relaxed mb-8">
                        Everything you need to know about how Aika protects your privacy and helps you manage your mental health.
                    </p>
                </motion.div>

                {/* Contact Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="bg-[#021029]/80 backdrop-blur-md rounded-3xl p-6 border border-white/10 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <CompassGlyph className="w-24 h-24 text-white" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 relative z-10">Still curious?</h3>
                    <p className="text-slate-400 text-sm mb-6 relative z-10">
                        Our support team is available to explain more about the platform&apos;s safety protocols.
                    </p>
                    
                    <Link href="/contact" className="inline-flex items-center text-[#FFCA40] font-bold text-sm hover:underline relative z-10">
                        Contact UGM-AICare Support &rarr;
                    </Link>
                </motion.div>
            </div>

            {/* Right Column: Accordion */}
            <div className="lg:col-span-7">
                <div className="space-y-4">
                  {faqs.map((faq, idx) => (
                     <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                     >
                        <Disclosure>
                          {({ open }) => (
                            <div className={`
                                group bg-[#000B1F]/40 backdrop-blur-sm rounded-2xl border transition-all duration-300
                                ${open ? 'border-[#FFCA40]/50 bg-[#000B1F]/80 shadow-[0_0_20px_rgba(255,202,64,0.1)]' : 'border-white/5 hover:border-white/10'}
                            `}>
                              <Disclosure.Button className="w-full px-8 py-6 flex items-start justify-between text-left">
                                <span className={`text-lg font-semibold transition-colors ${open ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                    {t(faq.qKey, faq.qDefault)}
                                </span>
                                <div className={`ml-4 p-1 rounded-full border transition-all ${open ? 'bg-[#FFCA40] border-[#FFCA40] text-[#000B1F]' : 'border-slate-600 text-slate-400'}`}>
                                    <CaretGlyph className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                                </div>
                              </Disclosure.Button>
                              
                              <Disclosure.Panel 
                                className="px-8 pb-8 text-slate-400 leading-relaxed"
                                as={motion.div}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                {t(faq.aKey, faq.aDefault)}
                              </Disclosure.Panel>
                            </div>
                          )}
                        </Disclosure>
                     </motion.div>
                  ))}
                </div>
            </div>

        </div>
      </div>
    </section>
  );
}
