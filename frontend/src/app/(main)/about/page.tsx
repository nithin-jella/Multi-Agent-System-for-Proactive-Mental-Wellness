"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { FiHeart, FiShield, FiUsers, FiZap, FiBookOpen } from "react-icons/fi";
import { FaGraduationCap, FaStar } from "react-icons/fa";
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-24 pb-14 px-4 sm:px-6 relative">
      <div className="absolute inset-0 z-0 opacity-40">
        <ParticleBackground count={60} colors={["#FFCA40", "#6A98F0", "#ffffff"]} minSize={2} maxSize={8} speed={0.8} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero */}
        <section className="mb-14">
          <div className="grid gap-10 md:grid-cols-12 md:items-center">
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="md:col-span-7"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FFCA40]/20 backdrop-blur-xl rounded-full border border-[#FFCA40]/30 shadow-lg mb-6"
              >
                <FaStar className="text-[#FFCA40]" />
                <span className="text-white font-medium text-sm">About UGM-AICare</span>
              </motion.div>

              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                A student-first framework for <span className="text-[#FFCA40]">university mental health support</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 leading-relaxed">
                UGM-AICare combines safety triage, supportive coaching, and case management workflows. The goal is not to replace counselors.
                It is to reduce friction in help-seeking, detect risk earlier, and route students to the right support pathway.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/aika"
                  className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold text-[#001D58] bg-[#FFCA40] hover:bg-[#FFCA40]/90 transition-colors"
                >
                  Talk to Aika
                </Link>
                <Link
                  href="/about/privacy"
                  className="inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
                >
                  Privacy & Security
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="md:col-span-5"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md">
                <div className="absolute inset-0 opacity-20">
                  <Image
                    src="/wave-pattern.svg"
                    alt=""
                    fill
                    className="object-cover"
                    priority={false}
                  />
                </div>
                <div className="relative p-5">
                  <div className="relative aspect-4/5 w-full overflow-hidden rounded-xl border border-white/15">
                    <Image
                      src="/aika-human.jpeg"
                      alt="Aika companion illustration"
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white/20">
                        <Image
                          src="/UGM_Lambang.png"
                          alt="UGM"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white leading-tight">Designed for UGM students</div>
                        <div className="text-xs text-white/60">Support pathways, not generic chat</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#FFCA40]" />
                      <span className="text-xs font-medium text-white/70">Safety-first</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Mission */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#FFCA40]/20 rounded-full p-3">
              <FiHeart className="text-[#FFCA40] text-2xl" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Our Mission</h2>
          </div>

          <p className="text-white/90 text-lg leading-relaxed mb-6">
            Many campus mental health services are forced into a reactive posture: help arrives late, workflows are fragmented, and risk signals are easy to miss.
            UGM-AICare is built to shift the default from crisis response to earlier support.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FiZap />,
                title: "Earlier Signals",
                description: "Surface risk indicators sooner to reduce time-to-support"
              },
              {
                icon: <FiUsers />,
                title: "Workflow-Aware",
                description: "Route students across coaching, counseling, and follow-up pathways"
              },
              {
                icon: <FiShield />,
                title: "Privacy-First",
                description: "Minimize exposure by design through redaction and least-privilege access"
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="text-[#FFCA40] text-3xl mb-3">{item.icon}</div>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/70 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-[#FFCA40]/20 rounded-full p-3">
              <FiShield className="text-[#FFCA40] text-2xl" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Safety Agent Suite</h2>
          </div>

          <p className="text-white/90 text-lg mb-8">
            The system is orchestrated as a workflow rather than a single chatbot. Each agent has a narrow job, and higher-risk cases can be escalated.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: "Safety Triage Agent (STA)",
                description: "Classifies messages, estimates risk level, and decides whether a case should be routed to coaching or escalation"
              },
              {
                name: "Therapeutic Coach Agent (TCA)",
                description: "Provides structured, CBT-informed support, grounded exercises, and small next-step plans"
              },
              {
                name: "Case Management Agent (CMA)",
                description: "Turns escalations into actionable cases with assignment, follow-up prompts, and documented outcomes"
              },
              {
                name: "Insights Agent (IA)",
                description: "Aggregates patterns for campus-level insights while aiming to reduce privacy risk"
              }
            ].map((agent, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 hover:border-[#FFCA40]/50 transition-all"
              >
                <h3 className="text-xl font-bold text-white mb-3">{agent.name}</h3>
                <p className="text-white/70 leading-relaxed">{agent.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {[
              { label: "Signal", detail: "Student message / check-in" },
              { label: "Triage", detail: "Risk estimation + routing" },
              { label: "Support", detail: "Coaching + exercises" },
              { label: "Escalate", detail: "Case creation when needed" },
              { label: "Audit", detail: "Notes + follow-up" },
            ].map((step, idx) => (
              <div
                key={step.label}
                className="relative rounded-xl border border-white/15 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{step.label}</div>
                  <div className="text-xs text-white/50">{String(idx + 1).padStart(2, "0")}</div>
                </div>
                <div className="mt-2 text-sm text-white/70 leading-relaxed">{step.detail}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Research / Team */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#FFCA40]/20 rounded-full p-3">
              <FaGraduationCap className="text-[#FFCA40] text-2xl" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Research Context</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <div className="text-white font-semibold mb-2">Why an agentic workflow?</div>
              <p className="text-white/75 leading-relaxed">
                A single assistant often mixes responsibilities (triage, coaching, escalation) in ways that are hard to audit.
                In contrast, a workflow separates roles and makes routing decisions explicit.
              </p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-6">
              <div className="text-white font-semibold mb-2">What “safety-first” means here</div>
              <p className="text-white/75 leading-relaxed">
                The design prioritizes conservative handling for higher-risk signals: clearer handoff, more structure, and fewer assumptions.
                It also aims to reduce privacy risk through redaction and minimal exposure.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Explore More - Navigation Cards */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Explore More</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                href: "/about/aika",
                icon: <FiHeart />,
                title: "Meet Aika",
                description: "Learn about your AI companion",
                color: "from-[#FFCA40] to-[#FFB700]"
              },
              {
                href: "/about/instruments",
                icon: <FiBookOpen />,
                title: "Clinical Instruments",
                description: "Our validated methodologies",
                color: "from-[#FF6B9D] to-[#B8A4FF]"
              },
              {
                href: "/about/features",
                icon: <FiZap />,
                title: "Features & Services",
                description: "Explore our comprehensive tools",
                color: "from-[#6A98F0] to-[#00308F]"
              },
              {
                href: "/about/privacy",
                icon: <FiShield />,
                title: "Privacy & Security",
                description: "How we protect your data",
                color: "from-[#FFCA40] to-[#6A98F0]"
              },
              {
                href: "/about/research",
                icon: <FaGraduationCap />,
                title: "Research & Team",
                description: "Our methodology and team",
                color: "from-[#6A98F0] to-[#FFCA40]"
              }
            ].map((card, idx) => (
              <Link key={idx} href={card.href}>
                <motion.div
                  whileHover={{ y: -10, scale: 1.02 }}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:border-[#FFCA40]/50 transition-all h-full cursor-pointer"
                >
                  <div className={`w-14 h-14 bg-linear-to-br ${card.color} rounded-xl flex items-center justify-center mb-4 text-white text-2xl`}>
                    {card.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-white/70 text-sm">{card.description}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-center bg-linear-to-r from-[#FFCA40]/20 to-[#FFB700]/20 backdrop-blur-xl rounded-2xl p-12 border border-[#FFCA40]/30"
        >
          <h2 className="text-3xl font-bold text-white mb-4">
            Want to explore the workflow?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Try a guided conversation with Aika, or read how privacy and escalation are handled.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/aika">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-linear-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold text-lg shadow-2xl shadow-[#FFCA40]/50"
              >
                Talk to Aika
              </motion.button>
            </Link>
            <Link href="/about/research">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-white/10 backdrop-blur-md text-white rounded-full font-semibold text-lg border border-white/20 hover:bg-white/20 transition-all"
              >
                Read the research context
              </motion.button>
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
