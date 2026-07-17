"use client";

import { motion } from 'framer-motion';
import { FiMessageCircle, FiTrendingUp, FiBookOpen, FiCalendar, FiShield, FiHeart, FiUsers, FiZap } from 'react-icons/fi';
import { FaStar, FaTrophy } from 'react-icons/fa';
import Link from 'next/link';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function AboutFeaturesPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-24 pb-10 px-4 sm:px-6 relative">
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
            <FiZap className="text-[#FFCA40]" />
            <span className="text-white font-medium text-sm">Features & Services</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Comprehensive <span className="text-[#FFCA40]">Mental Health</span> Support
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            From AI-powered conversations to professional resources, everything you need for your mental wellbeing
          </p>
        </motion.div>

        {/* AI Chat Support - Safety Agent Suite */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FiMessageCircle className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">AI Chat Support</h2>
              <p className="text-white/70">Powered by our Safety Agent Suite</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {[
              {
                emoji: "🛡️",
                title: "Safety Triage Agent (STA)",
                description: "Real-time risk detection and assessment",
                features: [
                  "Crisis indicator detection",
                  "PII redaction for privacy",
                  "Multi-level risk classification",
                  "Automatic escalation protocols"
                ]
              },
              {
                emoji: "💬",
                title: "Therapeutic Coach Agent (TCA)",
                description: "CBT-informed therapeutic coaching",
                features: [
                  "Evidence-based interventions",
                  "Personalized coping strategies",
                  "Affective regulation techniques",
                  "Interactive CBT modules"
                ]
              },
              {
                emoji: "🗂️",
                title: "Case Management Agent (CMA)",
                description: "Professional case management",
                features: [
                  "Licensed counselor coordination",
                  "SLA tracking and compliance",
                  "Crisis intervention routing",
                  "Follow-up scheduling"
                ]
              },
              {
                emoji: "🔍",
                title: "Insights Agent (IA)",
                description: "Privacy-preserving analytics",
                features: [
                  "Differential privacy (ε-δ budgets)",
                  "K-anonymity aggregation",
                  "Pattern recognition",
                  "Quality improvement metrics"
                ]
              }
            ].map((agent, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{agent.emoji}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{agent.title}</h3>
                    <p className="text-white/60 text-sm">{agent.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {agent.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-center gap-2 text-white/70 text-sm">
                      <div className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full shrink-0"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <div className="bg-linear-to-r from-[#FFCA40]/10 to-[#FFB700]/10 rounded-xl p-6 border border-[#FFCA40]/20">
            <h3 className="text-xl font-bold text-white mb-4">How Agents Work Together</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
              <div className="bg-white/10 px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">User Message</p>
              </div>
              <div className="text-[#FFCA40] text-2xl">→</div>
              <div className="bg-white/10 px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">🛡️ STA (Triage)</p>
              </div>
              <div className="text-[#FFCA40] text-2xl">→</div>
              <div className="bg-white/10 px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">💬 TCA / 🗂️ CMA</p>
              </div>
              <div className="text-[#FFCA40] text-2xl">→</div>
              <div className="bg-white/10 px-4 py-2 rounded-lg">
                <p className="text-white font-semibold">Response</p>
              </div>
            </div>
            <p className="text-white/70 text-sm text-center mt-4">
              Every conversation is orchestrated by LangGraph to ensure safety, quality, and appropriate escalation
            </p>
          </div>
        </motion.section>

        {/* Affective Tracking & Journaling */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FiTrendingUp className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Affective Tracking & Journaling</h2>
              <p className="text-white/70">Understand your PAD patterns over time</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Daily Affective Check-ins</h3>
              <ul className="space-y-3">
                {[
                  "Capture valence and arousal using the affective grid",
                  "Track PAD signal movement across sessions",
                  "Add contextual notes about your day",
                  "Identify triggers and patterns over time"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-white/80">
                    <FiHeart className="text-[#FFCA40] mt-1 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Visual Analytics</h3>
              <ul className="space-y-3">
                {[
                  "Interactive PAD trend charts and distributions",
                  "Weekly and monthly trend analysis",
                  "Correlation insights (sleep, stress, etc.)",
                  "Exportable reports for counselors"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-white/80">
                    <FiTrendingUp className="text-[#FFCA40] mt-1 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-xl font-bold text-white mb-3">Private Journaling</h3>
            <p className="text-white/70 mb-4">
              Express yourself freely in a secure, encrypted journal. Use prompts, free-write, or reflect on your conversations with Aika.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Daily Reflection", "Gratitude Journal", "Thought Records", "CBT Worksheets"].map((type, idx) => (
                <span key={idx} className="px-4 py-2 bg-[#FFCA40]/10 text-[#FFCA40] rounded-full text-sm border border-[#FFCA40]/20">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Professional Resources */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FiUsers className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Professional Resources</h2>
              <p className="text-white/70">Connect with licensed counselors</p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              {
                title: "UGM Counselor Directory",
                description: "Browse verified mental health professionals at UGM, view their specializations, availability, and ratings from other students.",
                icon: <FiUsers />
              },
              {
                title: "Emergency Support Hotlines",
                description: "24/7 access to crisis hotlines and emergency contacts, including national mental health services and suicide prevention lines.",
                icon: <FiShield />
              },
              {
                title: "Self-Help Modules",
                description: "Evidence-based CBT modules for anxiety, depression, stress management, and more. Learn therapeutic techniques at your own pace.",
                icon: <FiBookOpen />
              },
              {
                title: "Appointment Booking",
                description: "Schedule in-person or virtual appointments with UGM counselors directly through the platform. Automated reminders included.",
                icon: <FiCalendar />
              }
            ].map((resource, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                className="flex items-start gap-4 bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="w-12 h-12 bg-[#FFCA40]/20 rounded-lg flex items-center justify-center text-[#FFCA40] text-2xl shrink-0">
                  {resource.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{resource.title}</h3>
                  <p className="text-white/70">{resource.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CareQuest & Gamification */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FaTrophy className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">CareQuest Hub</h2>
              <p className="text-white/70">Gamified mental wellness activities</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-4">Daily Quests</h3>
              <p className="text-white/70 mb-4">
                Complete simple, evidence-based activities to build healthy habits:
              </p>
              <ul className="space-y-2">
                {[
                  "Mindfulness meditation (5 minutes)",
                  "Gratitude journaling",
                  "Physical activity check-in",
                  "Social connection tasks",
                  "Sleep hygiene practices"
                ].map((quest, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/70">
                    <FaStar className="text-[#FFCA40] text-sm" />
                    {quest}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold text-white mb-4">Harmony System</h3>
              <p className="text-white/70 mb-4">
                Maintain balance across five dimensions of wellness:
              </p>
              <div className="space-y-3">
                {[
                  { name: "Mental", color: "#FFCA40" },
                  { name: "Physical", color: "#6A98F0" },
                  { name: "Social", color: "#FF6B9D" },
                  { name: "Academic", color: "#50E3C2" },
                  { name: "Spiritual", color: "#B8A4FF" }
                ].map((dimension, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/70">{dimension.name}</span>
                      <span className="text-white/70">Level {idx + 1}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(idx + 1) * 20}%` }}
                        transition={{ delay: 0.5 + idx * 0.1, duration: 0.8 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: dimension.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* $CARE Token Rewards */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-linear-to-r from-[#FFCA40]/20 to-[#FFB700]/20 backdrop-blur-xl rounded-2xl p-8 md:p-12 border border-[#FFCA40]/30 mb-12"
        >
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-4">Earn $CARE Tokens</h2>
            <p className="text-white/80 max-w-2xl mx-auto">
              Get rewarded for taking care of your mental health. Use tokens to unlock premium features, donate to mental health initiatives, or trade on the blockchain.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {[
              { activity: "Daily Check-in", reward: "10 $CARE" },
              { activity: "Complete Quest", reward: "25 $CARE" },
              { activity: "Journal Entry", reward: "15 $CARE" },
              { activity: "Affective Tracking (7 days)", reward: "100 $CARE" },
              { activity: "Help Others", reward: "50 $CARE" },
              { activity: "Achievements", reward: "Up to 500 $CARE" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-[#FFCA40]/20 text-center"
              >
                <p className="text-white font-semibold mb-2">{item.activity}</p>
                <p className="text-[#FFCA40] font-bold text-xl">{item.reward}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/caretoken">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold shadow-lg"
              >
                Learn More About $CARE Token
              </motion.button>
            </Link>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-6">
            Experience All Features
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-10 py-4 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold text-lg shadow-2xl shadow-[#FFCA40]/50"
              >
                Get Started Free
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
