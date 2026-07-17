"use client";

import { motion } from 'framer-motion';
import { FiHeart, FiMessageCircle, FiSmile, FiClock } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import Link from 'next/link';
import Image from 'next/image';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function AboutAikaPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-24 pb-10 px-4 sm:px-6 relative">
      <div className="absolute inset-0 z-0 opacity-40">
        <ParticleBackground count={60} colors={["#FFCA40", "#6A98F0", "#ffffff"]} minSize={2} maxSize={8} speed={0.8} />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
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
            <FiHeart className="text-[#FFCA40]" />
            <span className="text-white font-medium text-sm">Meet Aika</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Meet <span className="text-[#FFCA40]">Aika</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            Your AI-powered mental health companion, designed to support you around the clock
          </p>
        </motion.div>

        {/* Who is Aika Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-2/3">
              <h2 className="text-3xl font-bold text-white mb-6">Who is Aika?</h2>
              <p className="text-white/90 text-lg mb-4 leading-relaxed">
                Aika is an AI-powered mental health companion designed specifically for Indonesian university students. Named after the Japanese word for <span className="text-[#FFCA40] font-semibold">&quot;love song,&quot;</span> Aika represents our commitment to care and support for the UGM community.
              </p>
              <p className="text-white/90 text-lg mb-4 leading-relaxed">
                With a focus on accessibility and privacy, Aika provides a safe space for students to discuss their feelings, get support during stressful periods, and access resources that promote mental wellbeing.
              </p>
              <p className="text-white/90 text-lg leading-relaxed">
                Whether you&apos;re dealing with academic pressure, relationship issues, or just need someone to talk to, Aika is here for you 24/7, offering judgment-free support and guidance whenever you need it.
              </p>
            </div>
            <div className="md:w-1/3 relative">
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 2, 0, -2, 0]
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 8,
                  ease: "easeInOut"
                }}
                className="relative h-[300px] w-[300px] mx-auto"
              >
                <Image 
                  src="/aika-human.jpeg"
                  alt="Aika Character" 
                  fill
                  className="object-contain drop-shadow-2xl rounded-full"
                />
                <div className="absolute -bottom-2 -right-2">
                  <div className="bg-white/15 backdrop-blur-xl p-2 rounded-full border border-white/20">
                    <div className="h-3 w-3 bg-[#FFCA40] rounded-full animate-pulse"></div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Aika's Personality */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Aika's Personality</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FiHeart />,
                title: "Empathetic",
                description: "Aika listens without judgment and provides warm, understanding responses tailored to your emotional state."
              },
              {
                icon: <FiSmile />,
                title: "Culturally Aware",
                description: "Understands Indonesian context, university pressures, and the unique challenges faced by students in Indonesia."
              },
              {
                icon: <FiMessageCircle />,
                title: "Conversational",
                description: "Speaks naturally in Bahasa Indonesia, making you feel like you're talking to a caring friend who truly understands."
              }
            ].map((trait, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 text-center"
              >
                <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFCA40] text-3xl">
                  {trait.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{trait.title}</h3>
                <p className="text-white/70">{trait.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* What Aika Can Help With */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">What Aika Can Help With</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Academic Stress",
                items: ["Exam anxiety", "Assignment overwhelm", "Study burnout", "Performance pressure"]
              },
              {
                title: "Emotional Wellbeing",
                items: ["Feeling lonely or isolated", "Managing sadness", "Dealing with anxiety", "Building self-esteem"]
              },
              {
                title: "Life Challenges",
                items: ["Relationship issues", "Family conflicts", "Future uncertainty", "Identity exploration"]
              },
              {
                title: "Daily Support",
                items: ["Affective check-ins", "Coping strategies", "Stress management", "Building resilience"]
              }
            ].map((category, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10"
              >
                <h3 className="text-xl font-bold text-[#FFCA40] mb-4">{category.title}</h3>
                <ul className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-center gap-3 text-white/80">
                      <div className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full"></div>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How Aika Works */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">How Aika Works</h2>
          
          <div className="space-y-6">
            {[
              {
                step: "1",
                title: "Safety-First Triage",
                description: "Every message is assessed by our Safety Triage Agent (STA) to detect any crisis indicators and determine the appropriate level of support."
              },
              {
                step: "2",
                title: "CBT-Informed Coaching",
                description: "For everyday challenges, Aika provides evidence-based cognitive behavioral therapy (CBT) techniques and coping strategies."
              },
              {
                step: "3",
                title: "Professional Escalation",
                description: "If Aika detects high-risk situations, she immediately connects you with licensed counselors through our Case Management Agent."
              },
              {
                step: "4",
                title: "Continuous Learning",
                description: "Your interactions help Aika understand your patterns better (while maintaining strict privacy), allowing for more personalized support over time."
              }
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="flex gap-6 items-start"
              >
                <div className="shrink-0 w-12 h-12 bg-linear-to-br from-[#FFCA40] to-[#FFB700] rounded-full flex items-center justify-center text-[#001D58] font-bold text-lg">
                  {step.step}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-white/70">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Availability Badge */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-linear-to-r from-[#FFCA40]/20 to-[#FFB700]/20 backdrop-blur-xl rounded-2xl p-8 border border-[#FFCA40]/30 mb-12 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <FiClock className="text-[#FFCA40] text-3xl" />
            <h2 className="text-2xl font-bold text-white">Always Available</h2>
          </div>
          <p className="text-white/90 text-lg max-w-2xl mx-auto">
            Aika is here for you 24/7, whether it's 2 AM before an exam or late night when you need someone to talk to. 
            No appointments needed, no waiting time—just genuine support whenever you need it.
          </p>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Talk to Aika?
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/aika">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-10 py-4 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold text-lg shadow-2xl shadow-[#FFCA40]/50"
              >
                Start Chatting Now
              </motion.button>
            </Link>
            <Link href="/about">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-10 py-4 bg-white/10 backdrop-blur-md text-white rounded-full font-semibold text-lg border border-white/20 hover:bg-white/20 transition-all"
              >
                Back to About
              </motion.button>
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
