"use client";

import React from "react";
import {
  FiAlertTriangle,
  FiHeart,
  FiPhone,
  FiSearch,
  FiArrowRight,
  FiBookOpen,
  FiCheckCircle,
  FiStar,
  FiMonitor,
  FiMessageCircle,
} from "react-icons/fi";
import { BsChatDots } from "react-icons/bs";
import Link from "next/link";
import ParticleBackground from "@/components/ui/ParticleBackground";
import ResourceCard, { ResourceCardProps } from "@/components/ui/ResourceCard";
import { PlanCard } from "@/components/resources/PlanCard";
import { useInterventionPlans } from "@/hooks/useInterventionPlans";

interface PracticeCardProps {
  title: string;
  duration: string;
  goal: string;
  steps: string[];
  cta?: { label: string; href: string };
}

const PracticeCard: React.FC<PracticeCardProps> = ({ title, duration, goal, steps, cta }) => (
  <div className="p-5 bg-gradient-to-br from-white/5 via-white/8 to-white/5 border border-white/10 rounded-xl shadow-lg space-y-4">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
        <FiStar size={18} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-xs text-gray-300 uppercase tracking-widest">
          {duration} • {goal}
        </p>
      </div>
    </div>
    <ul className="space-y-2 text-sm text-gray-100">
      {steps.map((step) => (
        <li key={step} className="flex gap-2">
          <FiCheckCircle className="mt-1 flex-shrink-0 text-[#FFCA40]" size={14} />
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ul>
    {cta && (
      <a href={cta.href} className="inline-flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-sm text-white">
        {cta.label}
        <FiArrowRight className="ml-2" />
      </a>
    )}
  </div>
);

const selfGuidedPractices: PracticeCardProps[] = [
  {
    title: "Mindful Breathing Reset",
    duration: "5 minutes",
    goal: "Reduce stress spikes",
    steps: [
      "Sit upright, feet grounded. Place a hand on your chest to notice movement.",
      "Breathe in for 4 seconds, hold for 4, exhale for 6. Repeat for 5 cycles.",
      "Notice one thing you can see, hear, and feel to anchor yourself.",
      "Write a quick reflection in your journal about what shifted.",
    ],
    cta: { label: "Start breathing timer", href: "https://www.calm.com/breathe" },
  },
  {
    title: "Two-Line Journal Check-In",
    duration: "3 minutes",
    goal: "Spot emotional patterns",
    steps: [
      "Write one sentence about something that felt heavy today.",
      "Follow with one sentence about something that gave you energy or relief.",
      "Optional: jot a next-step intention for tomorrow.",
      "Revisit in a week to notice recurring themes and improvements.",
    ],
    cta: { label: "Open journal", href: "/(main)/journaling" },
  },
  {
    title: "Night-Time Wind Down",
    duration: "10 minutes",
    goal: "Ease busy thoughts before bed",
    steps: [
      "Dim screens and lights. Play soft audio or white noise.",
      "List three things you handled today—even the small wins.",
      "Write down worries for tomorrow, then schedule when you'll handle them.",
      "Try progressive muscle relaxation: tense and release each muscle group from toes to head.",
    ],
    cta: { label: "Download sleep checklist", href: "https://drive.google.com" },
  },
];

const ugmResources: ResourceCardProps[] = [
  {
    name: "Gadjah Mada Medical Center (GMC)",
    description:
      "Medical and psychological services for the UGM community. Book ahead for counseling sessions.",
    targetAudience: "UGM students & staff",
    servicesOffered: ["Psychological Counseling", "Medical Consultation", "Health Checks"],
    address: "SEKIP Blok L3, Sinduadi, Sleman, DIY",
    phone: "+62 (0274) 551412",
    whatsapp: "6281328786991",
    website: "https://gmc.ugm.ac.id",
    operatingHours: "Mon-Fri 07.30–20.00 • Sat 07.30–14.00",
  },
  {
    name: "HPU UGM (Health Promoting University)",
    description:
      "Workshops, peer programmes, and health consultations to support a thriving campus community.",
    targetAudience: "UGM community",
    servicesOffered: ["Mental Health Programs", "Workshops", "Peer Support"],
    address: "Jl. Mahoni, Sekip Utara, Yogyakarta",
    phone: "+62 (0274) 552406",
    website: "https://hpu.ugm.ac.id",
    operatingHours: "Office hours (check events for schedule)",
  },
  {
    name: "Faculty of Psychology Counseling (PPM)",
    description:
      "Licensed psychologists offer individual and group sessions by appointment.",
    targetAudience: "Students, staff, public",
    servicesOffered: ["Individual Counseling", "Group Counseling", "Psychological Assessment"],
    address: "Fakultas Psikologi UGM, Bulaksumur",
    phone: "+62 (0274) 550435",
    email: "ppm.psikologi@ugm.ac.id",
    website: "https://psikologi.ugm.ac.id/ppm",
  },
  {
    name: "UGM Student Affairs Crisis Line",
    description:
      "24/7 WhatsApp and phone line for urgent student support through Ditmawa.",
    targetAudience: "UGM students",
    servicesOffered: ["Crisis Support", "Emergency Response"],
    phone: "+62 812-2877-3800",
    whatsapp: "6281228773800",
    website: "https://ditmawa.ugm.ac.id",
    operatingHours: "24/7",
  },
];

const nationalResources: ResourceCardProps[] = [
  {
    name: "SEJIWA 119 ext. 8",
    description: "National mental-health hotline with counselors on standby.",
    targetAudience: "Anyone in Indonesia",
    servicesOffered: ["Counseling", "Crisis Support"],
    phone: "119 ext. 8",
    website: "https://healing119.id",
    operatingHours: "24/7",
  },
  {
    name: "LISA Suicide Prevention (Bahasa)",
    description: "Confidential suicide-prevention helpline in Bahasa Indonesia.",
    targetAudience: "Individuals in crisis",
    phone: "+62 811 3855 472",
  },
  {
    name: "LISA Suicide Prevention (English)",
    description: "English-language suicide-prevention helpline.",
    targetAudience: "International students & English speakers",
    phone: "+62 811 3815 472",
  },
  {
    name: "SAPA 129 – Ministry of Women & Child Protection",
    description: "Report violence or seek guidance for women and children.",
    targetAudience: "Women & children",
    servicesOffered: ["Violence Reporting", "Counseling"],
    phone: "129",
    whatsapp: "628119129129",
    website: "https://sap129.id",
  },
];

const digitalTools = [
  {
    title: "Grounding Audio Pack",
    description: "Short audio guides for panic, overthinking, and sleep support.",
    href: "https://drive.google.com",
  },
  {
    title: "Weekly Planner Template",
    description: "Printable planner to balance study, rest, and wellbeing goals.",
    href: "https://notion.so",
  },
  {
    title: "Mood Tracker (Google Sheet)",
    description: "Track emotions and triggers; share with a counselor if needed.",
    href: "https://docs.google.com",
  },
];

const upcomingEvents = [
  {
    title: "Stress Reset: Mini Workshop",
    date: "Wed, 16 Oct • 16:00 WIB",
    location: "HPU Studio, Sekip Utara",
    href: "https://hpu.ugm.ac.id/events",
  },
  {
    title: "Peer Circle: Homesickness Edition",
    date: "Fri, 18 Oct • 18:30 WIB",
    location: "Zoom (link shared after RSVP)",
    href: "https://bit.ly/peer-circle-ugm",
  },
];

export default function SupportHubPage() {
  const { data, isLoading, error, refetch } = useInterventionPlans(true);

  const plans = data?.plans || [];
  const hasPlan = plans.length > 0;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <ParticleBackground />
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 sm:pb-16 space-y-16">
        <header className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs sm:text-sm text-[#FFCA40] uppercase tracking-[0.3em]">
            <FiBookOpen /> Community Support Hub
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">UGM Mental Health Resources</h1>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto">
            Find trusted campus contacts, national hotlines, self-care practices, and upcoming events to support your wellbeing journey.
          </p>
          <div className="max-w-xl mx-auto">
            <label className="relative block">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                placeholder="Search resources (e.g., counseling, workshops, crisis line)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-transparent"
              />
            </label>
            <p className="text-xs text-gray-400 text-left mt-2">
              Quick links:
              <span className="text-[#FFCA40]"> #counseling</span>
              <span className="text-[#FFCA40]"> #workshops</span>
              <span className="text-[#FFCA40]"> #hotlines</span>
            </p>
          </div>
        </header>

        {/* TCA Integration Banner */}
        <section className="bg-gradient-to-r from-[#001D58] to-[#003580] border-2 border-[#FFCA40]/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-[#FFCA40]/10">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-[#FFCA40] blur-xl opacity-30 rounded-full"></div>
                <div className="relative p-4 bg-[#FFCA40] rounded-2xl">
                  <BsChatDots size={32} className="text-[#001D58]" />
                </div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                <FiMessageCircle className="text-[#FFCA40]" />
                Need Help Right Now?
              </h2>
              <p className="text-gray-200 text-sm sm:text-base leading-relaxed mb-4">
                Talk to <span className="font-semibold text-[#FFCA40]">Aika</span> for personalized support and contextual intervention plans. 
                Our AI companion can assess your situation and provide immediate guidance tailored to your needs.
              </p>
              <p className="text-xs text-gray-300 italic">
                ✨ Aika uses our Therapeutic Coach Agent (TCA) to generate personalized intervention plans with step-by-step actions and relevant resources.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/aika"
                className="group relative inline-flex items-center gap-3 px-6 py-4 bg-[#FFCA40] hover:bg-[#FFD770] text-[#001D58] font-bold rounded-xl shadow-lg shadow-[#FFCA40]/30 hover:shadow-[#FFCA40]/50 transition-all duration-300 transform hover:scale-105"
              >
                <BsChatDots size={20} />
                <span>Talk to Aika</span>
                <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* Emergency Crisis Support */}
        <section className="bg-red-700/80 border border-red-500/60 rounded-2xl p-6 sm:p-7 shadow-xl text-white flex flex-col sm:flex-row gap-5" id="immediate-help">
          <div className="sm:w-1/4 flex items-start gap-3">
            <div className="p-3 bg-red-600/80 rounded-xl shadow-inner">
              <FiAlertTriangle size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Emergency Crisis Support</h2>
              <p className="text-sm text-red-100/90">
                If you are in immediate danger or crisis, contact emergency services right away. These lines are available 24/7.
              </p>
            </div>
          </div>
          <div className="sm:w-3/4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="tel:112" className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10">
                  <FiPhone />
                </div>
                <div>
                  <p className="text-sm font-semibold">Emergency Services</p>
                  <p className="text-xs text-red-100/80">Call: 112</p>
                </div>
              </div>
              <FiArrowRight />
            </a>
            <a href="https://wa.me/6281228773800" className="flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/10">
                  <FiHeart />
                </div>
                <div>
                  <p className="text-sm font-semibold">UGM Crisis Line</p>
                  <p className="text-xs text-red-100/80">WhatsApp: +62 812-2877-3800</p>
                </div>
              </div>
              <FiArrowRight />
            </a>
          </div>
        </section>

        {/* My Intervention Plans Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
              <FiCheckCircle />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">My Intervention Plans</h2>
              <p className="text-sm text-gray-300">Review personalized plans generated by Aika during your support sessions.</p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-gray-400 animate-pulse">
                  <FiMessageCircle size={32} />
                </div>
                <p className="text-sm text-gray-400">Loading your intervention plans...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-400">
                  <FiAlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-semibold text-red-300">Failed to load plans</h3>
                <p className="text-sm text-red-400">
                  {error.message || 'Something went wrong while fetching your intervention plans.'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-lg transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Plans List */}
          {!isLoading && !error && hasPlan && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onUpdate={refetch} />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasPlan && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-gray-400">
                  <FiMessageCircle size={32} />
                </div>
                <h3 className="text-xl font-semibold text-white">No intervention plans yet</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  When you chat with Aika and our Therapeutic Coach Agent (TCA) identifies you need help, personalized intervention plans will appear here. 
                  These plans include step-by-step actions, resources, and follow-up guidance.
                </p>
                <Link
                  href="/aika"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#FFCA40] hover:bg-[#FFD770] text-[#001D58] font-semibold rounded-lg transition-colors"
                >
                  <BsChatDots />
                  Start a conversation with Aika
                  <FiArrowRight />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Self-Guided Practices */}
        <section className="space-y-6" id="self-guided">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
              <FiMonitor />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Self-guided practices</h2>
              <p className="text-sm text-gray-300">Try short exercises to calm your body, reflect, or prepare for tomorrow.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {selfGuidedPractices.map((practice) => (
              <PracticeCard key={practice.title} {...practice} />
            ))}
          </div>
        </section>

        {/* Professional Support Contacts */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
              <FiBookOpen />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Professional support contacts</h2>
              <p className="text-sm text-gray-300">Reach out for one-on-one counseling, workshops, or crisis support when you need more help.</p>
            </div>
          </div>
          <div className="space-y-10">
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-4">On-campus support (UGM)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {ugmResources.map((resource) => (
                  <ResourceCard key={resource.name} {...resource} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-4">National helplines (Indonesia)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {nationalResources.map((resource) => (
                  <ResourceCard key={resource.name} {...resource} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Digital Tools */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
              <FiMonitor />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Digital tools & worksheets</h2>
              <p className="text-sm text-gray-300">Download templates and audio guides to support your wellbeing practice.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {digitalTools.map((tool) => (
              <a
                key={tool.title}
                href={tool.href}
                className="p-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors space-y-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h3 className="text-lg font-semibold text-white">{tool.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{tool.description}</p>
                <span className="inline-flex items-center text-xs text-[#FFCA40] uppercase tracking-widest font-semibold">
                  Open resource <FiArrowRight className="ml-1" />
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* Upcoming Workshops */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFCA40]/10 text-[#FFCA40]">
              <FiBookOpen />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Upcoming workshops & circles</h2>
              <p className="text-sm text-gray-300">Join a live session to learn coping strategies and connect with others.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingEvents.map((event) => (
              <a
                key={event.title}
                href={event.href}
                className="p-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors flex flex-col gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-xs uppercase tracking-[0.3em] text-[#FFCA40]">Upcoming</span>
                <h3 className="text-lg font-semibold text-white">{event.title}</h3>
                <p className="text-sm text-gray-300">{event.date}</p>
                <p className="text-sm text-gray-400">{event.location}</p>
                <span className="text-xs text-[#FFCA40] inline-flex items-center mt-2">
                  RSVP <FiArrowRight className="ml-1" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
