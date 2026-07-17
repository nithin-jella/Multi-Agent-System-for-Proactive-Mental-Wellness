'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  ChartBarIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface QuickLinkItem {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
}

const QUICK_LINKS: QuickLinkItem[] = [
  {
    href: '/admin/cases',
    label: 'Cases',
    description: 'Manage high-priority and active mental health cases',
    icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-300" aria-hidden="true" />,
  },
  {
    href: '/admin/conversations',
    label: 'Conversations',
    description: 'Review user-agent interactions and escalation logs',
    icon: <ChatBubbleLeftRightIcon className="h-5 w-5 text-cyan-300" aria-hidden="true" />,
  },
  {
    href: '/admin/users',
    label: 'Users',
    description: 'Inspect user cohorts and account-level diagnostics',
    icon: <UsersIcon className="h-5 w-5 text-blue-300" aria-hidden="true" />,
  },
  {
    href: '/admin/screening',
    label: 'Screening',
    description: 'Track intake quality, triage rate, and screening outcomes',
    icon: <HeartIcon className="h-5 w-5 text-pink-300" aria-hidden="true" />,
  },
  {
    href: '/admin/insights',
    label: 'Insights',
    description: 'Access generated reports and intervention recommendations',
    icon: <ChartBarIcon className="h-5 w-5 text-amber-300" aria-hidden="true" />,
  },
  {
    href: '/admin/langgraph',
    label: 'LangGraph',
    description: 'Monitor agent health, parse failures, and system alerts',
    icon: <CpuChipIcon className="h-5 w-5 text-violet-300" aria-hidden="true" />,
  },
  {
    href: '/admin/autopilot',
    label: 'Autopilot',
    description: 'Audit queued actions, approvals, and automation outcomes',
    icon: <SparklesIcon className="h-5 w-5 text-emerald-300" aria-hidden="true" />,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    description: 'Configure platform controls and operational thresholds',
    icon: <Cog6ToothIcon className="h-5 w-5 text-slate-300" aria-hidden="true" />,
  },
];

export function QuickLinksPanel() {
  return (
    <section
      aria-label="Admin quick links"
      className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Admin Features</h2>
        <p className="text-xs text-white/50">Fast navigation</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-xl border border-white/10 bg-white/4 p-3 transition-all duration-200 hover:border-white/25 hover:bg-white/8"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <span className="rounded-lg bg-white/10 p-1.5">{link.icon}</span>
              {link.label}
            </div>
            <p className="text-xs text-white/60 group-hover:text-white/75">{link.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
