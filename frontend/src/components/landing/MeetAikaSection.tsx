
"use client";

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { HeartPathGlyph, PulseGlyph, ShieldWaveGlyph, ThreadGlyph } from '@/components/landing/CustomGlyphs';
import { useI18n } from '@/i18n/I18nProvider';

const aikaFeatures = [
  {
    icon: ThreadGlyph,
    titleKey: 'landing.meet.features.f1.title',
    titleFallback: 'Thoughtful conversations',
    descriptionKey: 'landing.meet.features.f1.desc',
    descriptionFallback: 'Aika helps you reflect and put feelings into words, one question at a time.'
  },
  {
    icon: PulseGlyph,
    titleKey: 'landing.meet.features.f2.title',
    titleFallback: 'Open anytime',
    descriptionKey: 'landing.meet.features.f2.desc',
    descriptionFallback: 'No appointments needed. Start when you’re ready, pause when you’re not.'
  },
  {
    icon: ShieldWaveGlyph,
    titleKey: 'landing.meet.features.f3.title',
    titleFallback: 'Privacy-first',
    descriptionKey: 'landing.meet.features.f3.desc',
    descriptionFallback: 'You stay in control of what you share and when you share it.'
  },
  {
    icon: HeartPathGlyph,
    titleKey: 'landing.meet.features.f4.title',
    titleFallback: 'Guided techniques',
    descriptionKey: 'landing.meet.features.f4.desc',
    descriptionFallback: 'Exercises inspired by evidence-based approaches, designed for student life.'
  }
];

export default function MeetAikaSection() {
  const shouldReduceMotion = useReducedMotion();
  const { t } = useI18n();

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 bg-transparent relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#FFCA40] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-[#6A98F0] rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Aika Avatar & Visual */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            {/* Main Avatar Container */}
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Glow Effect */}
              <motion.div
                className="absolute inset-0 bg-linear-to-br from-[#FFCA40]/30 to-[#6A98F0]/30 rounded-full blur-3xl"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: [1, 1.08, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }
                }
                transition={shouldReduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Avatar Image */}
              <div className="relative z-10 rounded-3xl overflow-hidden border-4 border-[#FFCA40]/30 shadow-2xl">
                <Image
                  src="/aika-human.jpeg"
                  alt="Aika AI Companion"
                  width={500}
                  height={500}
                  className="object-cover w-full h-full"
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-linear-to-t from-[#001D58]/80 via-transparent to-transparent" />
                
                {/* Status Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                  className="absolute bottom-6 left-6 right-6"
                >
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={shouldReduceMotion ? undefined : { scale: [1, 1.2, 1] }}
                        transition={shouldReduceMotion ? undefined : { duration: 2, repeat: Infinity }}
                        className="w-3 h-3 bg-[#4ADE80] rounded-full"
                      />
                      <div>
                        <p className="text-white font-semibold">{t('landing.meet.status.title', 'Aika is available')}</p>
                        <p className="text-gray-400 text-sm">{t('landing.meet.status.subtitle', 'Ready when you are')}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* Floating Chat Bubble */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8, type: "spring" }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl rounded-br-sm p-4 shadow-2xl max-w-xs"
              >
                <p className="text-gray-800 text-sm">
                  {t(
                    'landing.meet.bubble',
                    '“Hi. If you want, we can unpack what’s been weighing on you.”'
                  )}
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-white/60 text-sm uppercase tracking-widest mb-6">
              {t('landing.meet.eyebrow', 'Meet Aika')}
            </p>

            {/* Title */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
              {t('landing.meet.title_prefix', 'Say hello to')}{' '}
              <span className="bg-linear-to-r from-[#FFCA40] via-[#FFD770] to-[#FFCA40] bg-clip-text text-transparent">
                Aika
              </span>
            </h2>

            {/* Description */}
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              {t(
                'landing.meet.description',
                'Aika is a conversation partner designed around UGM student life. It can help you reflect, practice coping tools, and prepare to reach out for professional support when you want it.'
              )}
            </p>

            {/* Features Grid */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {aikaFeatures.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#0B162E] rounded-[18px] p-4 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:border-[#FFCA40]/40 transition-colors"
                >
                  <feature.icon className="text-[#FFCA40] w-5 h-5 mb-3" />
                  <h3 className="text-white font-semibold mb-1">{t(feature.titleKey, feature.titleFallback)}</h3>
                  <p className="text-gray-400 text-sm">{t(feature.descriptionKey, feature.descriptionFallback)}</p>
                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <Link href="/aika">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold text-lg shadow-lg hover:shadow-[#FFCA40]/30 transition-shadow"
              >
                {t('landing.meet.cta', 'Talk to Aika')}
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
