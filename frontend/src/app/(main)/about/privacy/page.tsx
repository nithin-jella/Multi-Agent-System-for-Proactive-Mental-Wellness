"use client";

import { motion } from 'framer-motion';
import { FiShield, FiLock, FiEye, FiEyeOff, FiCheck, FiUserCheck } from 'react-icons/fi';
import { FaUserShield } from 'react-icons/fa';
import Link from 'next/link';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function AboutPrivacyPage() {
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
            <FiShield className="text-[#FFCA40]" />
            <span className="text-white font-medium text-sm">Privacy & Security</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Your Privacy is <span className="text-[#FFCA40]">Non-Negotiable</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            We implement industry-leading privacy technologies to protect your mental health data
          </p>
        </motion.div>

        {/* Core Privacy Principles */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Our Privacy Commitment</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FiEyeOff />,
                title: "Privacy by Design",
                description: "Privacy is built into every feature from the ground up, not added as an afterthought."
              },
              {
                icon: <FiUserCheck />,
                title: "You Own Your Data",
                description: "Your conversations, affective check-ins, and journals belong to you. Export or delete them anytime."
              },
              {
                icon: <FiLock />,
                title: "No Data Selling",
                description: "We never sell, rent, or share your personal data with third parties. Ever."
              }
            ].map((principle, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 text-center"
              >
                <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFCA40] text-3xl">
                  {principle.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{principle.title}</h3>
                <p className="text-white/70">{principle.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Technical Privacy Measures */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8">Technical Safeguards</h2>
          
          <div className="space-y-8">
            {/* Differential Privacy */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/5 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-[#FFCA40]/20 rounded-lg flex items-center justify-center shrink-0">
                  <FaUserShield className="text-[#FFCA40] text-2xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Differential Privacy (ε-δ)</h3>
                  <p className="text-white/70">
                    Our analytics system adds calibrated mathematical noise to prevent individual identification, even if an attacker has access to other datasets.
                  </p>
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-white/60 text-sm font-mono">
                  ε (epsilon) = 0.1 | δ (delta) = 1e-5
                </p>
                <p className="text-white/70 text-sm mt-2">
                  This means there's less than 0.001% chance of your individual data being identified, even in aggregated statistics.
                </p>
              </div>
            </motion.div>

            {/* K-Anonymity */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/5 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-[#FFCA40]/20 rounded-lg flex items-center justify-center shrink-0">
                  <FiEye className="text-[#FFCA40] text-2xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">K-Anonymity (k ≥ 5)</h3>
                  <p className="text-white/70">
                    All aggregated reports require at least 5 similar records before displaying data. If fewer exist, the data is suppressed entirely.
                  </p>
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-white/70 text-sm">
                  <strong className="text-white">Example:</strong> If only 3 students from Computer Science reported anxiety this week, that statistic won't be shown to protect individual privacy.
                </p>
              </div>
            </motion.div>

            {/* PII Redaction */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white/5 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-[#FFCA40]/20 rounded-lg flex items-center justify-center shrink-0">
                  <FiShield className="text-[#FFCA40] text-2xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Automatic PII Redaction</h3>
                  <p className="text-white/70">
                    Our Safety Triage Agent automatically detects and redacts personally identifiable information (names, addresses, phone numbers) from logs and analytics.
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-red-400 text-sm font-semibold mb-2">❌ Before Redaction:</p>
                  <p className="text-white/60 text-sm font-mono">
                    "My name is Budi and I live at Jl. Kaliurang 123..."
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <p className="text-green-400 text-sm font-semibold mb-2">✅ After Redaction:</p>
                  <p className="text-white/60 text-sm font-mono">
                    "My name is [NAME] and I live at [ADDRESS]..."
                  </p>
                </div>
              </div>
            </motion.div>

            {/* End-to-End Encryption */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/5 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-[#FFCA40]/20 rounded-lg flex items-center justify-center shrink-0">
                  <FiLock className="text-[#FFCA40] text-2xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">End-to-End Encryption</h3>
                  <p className="text-white/70">
                    All conversations, affective check-ins, and journal data are encrypted at rest (AES-256) and in transit (TLS 1.3).
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {[
                  "Database encryption with rotating keys",
                  "Secure HTTPS connections only",
                  "No plain-text storage of sensitive data",
                  "Encrypted backups with separate keys"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/70">
                    <FiCheck className="text-[#FFCA40] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.section>

        {/* Consent Management */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8">Consent & Control</h2>
          
          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-3">Explicit Opt-In</h3>
              <p className="text-white/70 mb-4">
                We never assume consent. Every data use case requires your explicit permission through clear, jargon-free explanations.
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  "Analytics participation (optional)",
                  "Research study inclusion (optional)",
                  "Anonymous aggregated statistics (optional)",
                  "Platform improvement insights (optional)"
                ].map((item, idx) => (
                  <span key={idx} className="px-4 py-2 bg-[#FFCA40]/10 text-[#FFCA40] rounded-full text-sm border border-[#FFCA40]/20">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-3">Withdrawal Workflows</h3>
              <p className="text-white/70 mb-4">
                Changed your mind? You can withdraw consent at any time, and we'll stop using your data within 24 hours.
              </p>
              <ul className="space-y-2">
                {[
                  "One-click consent withdrawal",
                  "Automatic data deletion cascade",
                  "Audit log of all consent changes",
                  "Email confirmation of withdrawal"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/70">
                    <div className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-3">Transparency & Audit</h3>
              <p className="text-white/70 mb-4">
                View your complete data history, consent logs, and access records anytime from your account settings.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">What you can see:</p>
                  <ul className="space-y-1 text-sm text-white/70">
                    <li>• All conversations with Aika</li>
                    <li>• Affective tracking history</li>
                    <li>• Journal entries</li>
                    <li>• Consent history</li>
                  </ul>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">What you can do:</p>
                  <ul className="space-y-1 text-sm text-white/70">
                    <li>• Export all your data</li>
                    <li>• Delete specific conversations</li>
                    <li>• Revoke consent categories</li>
                    <li>• Request full account deletion</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Data Retention */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8">Data Retention & Deletion</h2>
          
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Active Account Data</h3>
                <span className="px-4 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm border border-green-500/30">
                  Retained indefinitely
                </span>
              </div>
              <p className="text-white/70">
                Your conversations, affective check-ins, and journals are kept as long as your account is active, so you can reference them anytime.
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Inactive Account Data</h3>
                <span className="px-4 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm border border-yellow-500/30">
                  Deleted after 24 months
                </span>
              </div>
              <p className="text-white/70">
                If you don't log in for 2 years, we'll send reminders before automatically deleting your account and all associated data.
              </p>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Account Deletion Request</h3>
                <span className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm border border-red-500/30">
                  Deleted within 30 days
                </span>
              </div>
              <p className="text-white/70">
                Request deletion from your settings, and we'll permanently erase all your data within 30 days (required for backup purging).
              </p>
            </div>

            <div className="bg-linear-to-r from-[#FFCA40]/10 to-[#FFB700]/10 rounded-xl p-6 border border-[#FFCA40]/20">
              <p className="text-white/90 text-sm">
                <strong className="text-white">Note:</strong> Anonymized, aggregated analytics (with differential privacy applied) may be retained for research purposes, but cannot be traced back to you individually.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Compliance & Oversight */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Compliance & Oversight</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "GDPR-Inspired Design",
                description: "While Indonesia doesn't have GDPR, we follow its principles for data protection, consent, and user rights.",
                icon: "🇪🇺"
              },
              {
                title: "Ethics Board Approval",
                description: "Our research protocols are reviewed and approved by UGM's Institutional Review Board (IRB).",
                icon: "✅"
              },
              {
                title: "Regular Security Audits",
                description: "Third-party penetration testing and security audits conducted quarterly to identify vulnerabilities.",
                icon: "🔍"
              },
              {
                title: "Incident Response Plan",
                description: "In the unlikely event of a breach, we'll notify affected users within 72 hours with clear remediation steps.",
                icon: "🚨"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-white/70">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="bg-linear-to-r from-[#FFCA40]/20 to-[#FFB700]/20 backdrop-blur-xl rounded-2xl p-8 border border-[#FFCA40]/30 text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-4">
            Questions About Privacy?
          </h2>
          <p className="text-white/80 mb-6 max-w-2xl mx-auto">
            We're committed to transparency. Read our full privacy policy or contact our data protection officer for detailed answers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/privacy-policy">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold shadow-lg"
              >
                Read Full Privacy Policy
              </motion.button>
            </Link>
            <Link href="/about">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3 bg-white/10 backdrop-blur-md text-white rounded-full font-semibold border border-white/20 hover:bg-white/20 transition-all"
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
