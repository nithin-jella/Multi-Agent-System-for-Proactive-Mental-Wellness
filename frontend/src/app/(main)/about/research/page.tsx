"use client";

import { motion } from 'framer-motion';
import { FiTrendingUp, FiUsers, FiAward, FiBookOpen, FiTarget, FiCheckCircle } from 'react-icons/fi';
import { FaGraduationCap, FaMicroscope } from 'react-icons/fa';
import Link from 'next/link';
import ParticleBackground from '@/components/ui/ParticleBackground';

export default function AboutResearchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] pt-24 pb-10 px-4 sm:px-6 relative">
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
            <FaMicroscope className="text-[#FFCA40]" />
            <span className="text-white font-medium text-sm">Research & Team</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Evidence-Based <span className="text-[#FFCA40]">Research</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            Rigorous research methodology and clinical oversight to advance university mental health care
          </p>
        </motion.div>

        {/* Design Science Research Framework */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FiTarget className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Design Science Research (DSR)</h2>
              <p className="text-white/70">6 iterative stages of development and evaluation</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                stage: "1",
                title: "Problem Identification",
                description: "Reactive mental health services, under-resourced staff, limited data visibility at UGM.",
                color: "#FF6B9D"
              },
              {
                stage: "2",
                title: "Solution Objectives",
                description: "Build AI Safety Agent Suite for proactive crisis detection, automated support, and privacy-preserving insights.",
                color: "#FFCA40"
              },
              {
                stage: "3",
                title: "Design & Development",
                description: "LangGraph-orchestrated agents with CBT-informed coaching and differential privacy analytics.",
                color: "#6A98F0"
              },
              {
                stage: "4",
                title: "Demonstration",
                description: "Pilot deployment with UGM students, A/B testing of intervention strategies, usability studies.",
                color: "#50E3C2"
              },
              {
                stage: "5",
                title: "Evaluation",
                description: "Measure sensitivity/specificity of crisis detection, orchestration reliability, coaching quality.",
                color: "#B8A4FF"
              },
              {
                stage: "6",
                title: "Communication",
                description: "Publish findings, open-source code, present at conferences, share learnings with community.",
                color: "#FFB700"
              }
            ].map((stage, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-[#001D58] font-bold ${
                      idx === 0 ? 'bg-[#FF6B9D]' :
                      idx === 1 ? 'bg-[#FFCA40]' :
                      idx === 2 ? 'bg-[#6A98F0]' :
                      idx === 3 ? 'bg-[#50E3C2]' :
                      idx === 4 ? 'bg-[#B8A4FF]' :
                      'bg-[#FFB700]'
                    }`}
                  >
                    {stage.stage}
                  </div>
                  <h3 className="text-lg font-bold text-white">{stage.title}</h3>
                </div>
                <p className="text-white/70 text-sm">{stage.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Research Questions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8">Core Research Questions</h2>
          
          <div className="space-y-6">
            {[
              {
                id: "RQ1",
                question: "What is the sensitivity and specificity of AI-powered crisis detection in a university setting?",
                hypothesis: "The Safety Triage Agent can detect crisis indicators with >90% sensitivity while maintaining low false-positive rates.",
                methods: ["Ground truth labeling by licensed counselors", "ROC curve analysis", "Comparison with baseline keyword detection"]
              },
              {
                id: "RQ2",
                question: "How reliable is LangGraph-based agent orchestration for mental health workflows?",
                hypothesis: "Multi-agent orchestration improves response appropriateness compared to single-agent systems.",
                methods: ["Workflow success rate tracking", "Inter-agent coordination metrics", "Escalation timing analysis"]
              },
              {
                id: "RQ3",
                question: "Does CBT-informed coaching improve student mental health outcomes?",
                hypothesis: "Students receiving structured CBT interventions show measurable improvements in PAD-derived affective indicators over 4 weeks.",
                methods: ["Pre/post PHQ-9 and GAD-7 assessments", "Longitudinal PAD signal tracking", "Control group comparison"]
              },
              {
                id: "RQ4",
                question: "Can differential privacy provide actionable insights while protecting individual privacy?",
                hypothesis: "ε-δ differential privacy (ε=0.1) maintains k≥5 anonymity while surfacing statistically significant trends.",
                methods: ["Privacy budget analysis", "Re-identification attack simulations", "Information utility metrics"]
              }
            ].map((rq, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="px-3 py-1 bg-[#FFCA40]/20 text-[#FFCA40] rounded-lg font-bold text-sm border border-[#FFCA40]/30 flex-shrink-0">
                    {rq.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{rq.question}</h3>
                    <p className="text-white/70 mb-3">
                      <strong className="text-white">Hypothesis:</strong> {rq.hypothesis}
                    </p>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-white/60 text-sm font-semibold mb-2">Methods:</p>
                      <ul className="space-y-1">
                        {rq.methods.map((method, mIdx) => (
                          <li key={mIdx} className="flex items-center gap-2 text-white/70 text-sm">
                            <div className="w-1 h-1 bg-[#FFCA40] rounded-full flex-shrink-0"></div>
                            {method}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Clinical Governance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8">Clinical Governance & Ethics</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <FiAward className="text-[#FFCA40] text-3xl" />
                <h3 className="text-2xl font-bold text-white">IRB Approval</h3>
              </div>
              <p className="text-white/70 mb-4">
                All research protocols have been reviewed and approved by Universitas Gadjah Mada's Institutional Review Board (IRB).
              </p>
              <ul className="space-y-2">
                {[
                  "Informed consent protocols",
                  "Risk mitigation strategies",
                  "Data protection measures",
                  "Vulnerable population safeguards"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/70 text-sm">
                    <FiCheckCircle className="text-[#FFCA40] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <FiUsers className="text-[#FFCA40] text-3xl" />
                <h3 className="text-2xl font-bold text-white">Clinical Oversight</h3>
              </div>
              <p className="text-white/70 mb-4">
                Licensed mental health professionals provide ongoing supervision and quality assurance for AI-generated interventions.
              </p>
              <ul className="space-y-2">
                {[
                  "Weekly case review meetings",
                  "Intervention quality scoring",
                  "Crisis escalation audits",
                  "Professional approval logging"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-white/70 text-sm">
                    <FiCheckCircle className="text-[#FFCA40] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 bg-gradient-to-r from-[#FFCA40]/10 to-[#FFB700]/10 rounded-xl p-6 border border-[#FFCA40]/20">
            <h3 className="text-xl font-bold text-white mb-3">Harm Mitigation</h3>
            <p className="text-white/70 mb-4">
              We prioritize student safety above all else. Our harm mitigation protocols include:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <ul className="space-y-2">
                {[
                  "Immediate human escalation for crisis cases",
                  "24/7 emergency hotline availability",
                  "Opt-out mechanisms at any stage"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-white/70 text-sm">
                    <div className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {[
                  "Regular safety audits by external reviewers",
                  "Student advisory board feedback",
                  "Continuous monitoring of adverse events"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-white/70 text-sm">
                    <div className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* Research Team */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Research Team</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                role: "Principal Investigators",
                icon: <FaGraduationCap />,
                members: [
                  "Faculty from Computer Science",
                  "Faculty from Psychology",
                  "Faculty from Public Health"
                ]
              },
              {
                role: "Clinical Advisors",
                icon: <FiUsers />,
                members: [
                  "Licensed Clinical Psychologists",
                  "UGM Counseling Center Staff",
                  "Psychiatry Consultants"
                ]
              },
              {
                role: "Development Team",
                icon: <FiTrendingUp />,
                members: [
                  "AI/ML Engineers",
                  "Full-Stack Developers",
                  "UX/UI Designers"
                ]
              }
            ].map((group, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="bg-white/5 rounded-xl p-6 border border-white/10 text-center"
              >
                <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#FFCA40] text-3xl">
                  {group.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{group.role}</h3>
                <ul className="space-y-2">
                  {group.members.map((member, mIdx) => (
                    <li key={mIdx} className="text-white/70 text-sm">
                      {member}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Publications & Presentations */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 md:p-12 mb-12"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-[#FFCA40]/20 rounded-2xl flex items-center justify-center">
              <FiBookOpen className="text-[#FFCA40] text-3xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Publications & Presentations</h2>
              <p className="text-white/70">Sharing our findings with the research community</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-white">Journal Articles</h3>
                <span className="px-3 py-1 bg-[#FFCA40]/20 text-[#FFCA40] rounded-full text-xs border border-[#FFCA40]/30">
                  Upcoming
                </span>
              </div>
              <ul className="space-y-2">
                <li className="text-white/70 text-sm">
                  "AI-Powered Safety Agent Frameworks for University Mental Health: A Design Science Approach" (in preparation)
                </li>
                <li className="text-white/70 text-sm">
                  "Differential Privacy in Mental Health Analytics: Balancing Insights and Individual Privacy" (under review)
                </li>
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-white">Conference Presentations</h3>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30">
                  Accepted
                </span>
              </div>
              <ul className="space-y-2">
                <li className="text-white/70 text-sm">
                  ACM CHI 2025 Workshop on AI for Mental Health
                </li>
                <li className="text-white/70 text-sm">
                  International Conference on Design Science Research (DESRIST) 2025
                </li>
              </ul>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-white">Open Source</h3>
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs border border-blue-500/30">
                  Available
                </span>
              </div>
              <p className="text-white/70 text-sm mb-3">
                Key components of UGM-AICare are open-sourced to benefit the research community:
              </p>
              <div className="flex flex-wrap gap-2">
                {["Safety Agent Suite", "LangGraph Orchestration", "Differential Privacy Tools", "CBT Module Framework"].map((component, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-[#FFCA40]/10 text-[#FFCA40] rounded-lg text-xs border border-[#FFCA40]/20">
                    {component}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Collaboration Opportunities */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-[#FFCA40]/20 to-[#FFB700]/20 backdrop-blur-xl rounded-2xl p-8 border border-[#FFCA40]/30 text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-4">
            Interested in Collaborating?
          </h2>
          <p className="text-white/80 mb-6 max-w-2xl mx-auto">
            We welcome partnerships with researchers, universities, and mental health organizations. Get in touch to discuss collaboration opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-3 bg-gradient-to-r from-[#FFCA40] to-[#FFB700] text-[#001D58] rounded-full font-bold shadow-lg"
              >
                Contact Research Team
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
