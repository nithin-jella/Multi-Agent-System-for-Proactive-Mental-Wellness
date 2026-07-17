"use client";

import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  FiUsers,
  FiMessageSquare,
  FiCalendar,
  FiSettings,
  FiShield,
  FiLogOut,
  FiHelpCircle,
  FiHeart,
  FiUser,
  FiUserCheck,
  FiSend,
  FiBarChart2,
  FiClipboard,
  FiActivity,
  FiBookOpen,
  FiTrendingUp,
  FiBriefcase,
  FiMonitor,
  FiTarget,
  FiZap,
  FiDatabase,
  FiEye,
  FiAward,
  FiKey,
  FiFlag,
  FiTerminal,
  FiLink,
  FiPhone,
} from 'react-icons/fi';
import SidebarLink from './SidebarLink';

import MobileNavDrawer from '../MobileNavDrawer';

// Reorganized navigation: clearer operational categories for admin workflows
const navGroups = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', icon: <FiBarChart2 size={18} />, href: '/admin/dashboard' },
      { name: 'Insights Analytics', icon: <FiTrendingUp size={18} />, href: '/admin/insights' },
      { name: 'Retention Analytics', icon: <FiTarget size={18} />, href: '/admin/retention' },
    ],
  },
  {
    label: 'Care Operations',
    items: [
      { name: 'Cases', icon: <FiShield size={18} />, href: '/admin/cases' },
      { name: 'Quick Triage', icon: <FiBriefcase size={18} />, href: '/admin/quick-triage' },
      { name: 'Appointments', icon: <FiCalendar size={18} />, href: '/admin/appointments' },
      { name: 'Flagged Chats', icon: <FiFlag size={18} />, href: '/admin/flags' },
    ],
  },
  {
    label: 'People & Activity',
    items: [
      { name: 'Users', icon: <FiUsers size={18} />, href: '/admin/users' },
      { name: 'Counselors', icon: <FiUserCheck size={18} />, href: '/admin/counselors' },
      { name: 'Conversations', icon: <FiMessageSquare size={18} />, href: '/admin/conversations' },
      { name: 'Activities', icon: <FiActivity size={18} />, href: '/admin/activities' },
    ],
  },
  {
    label: 'Agentic & On-Chain',
    items: [
      { name: 'Agent Decisions', icon: <FiEye size={18} />, href: '/admin/agent-decisions' },
      { name: 'Autopilot Queue', icon: <FiZap size={18} />, href: '/admin/autopilot' },
      { name: 'Autopilot Policy', icon: <FiShield size={18} />, href: '/admin/policy' },
      { name: 'Blockchain Hub', icon: <FiLink size={18} />, href: '/admin/blockchain' },
    ],
  },
  {
    label: 'Programs & Content',
    items: [
      { name: 'Intervention Plans', icon: <FiClipboard size={18} />, href: '/admin/interventions' },
      { name: 'Outreach', icon: <FiSend size={18} />, href: '/admin/outreach' },
      { name: 'CBT Modules', icon: <FiHeart size={18} />, href: '/admin/cbt-modules' },
      { name: 'Quest Templates', icon: <FiZap size={18} />, href: '/admin/quests' },
      { name: 'Content Resources', icon: <FiBookOpen size={18} />, href: '/admin/content-resources' },
      { name: 'Surveys', icon: <FiHelpCircle size={18} />, href: '/admin/surveys' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { name: 'LangGraph Monitoring', icon: <FiMonitor size={18} />, href: '/admin/langgraph' },
      { name: 'Testing Console', icon: <FiTerminal size={18} />, href: '/admin/testing' },
      { name: 'Database Viewer', icon: <FiDatabase size={18} />, href: '/admin/database' },
      { name: 'API Key Monitor', icon: <FiKey size={18} />, href: '/admin/api-keys' },
    ],
  },
];

const secondaryNavItems = [
  { name: 'My Profile', icon: <FiUser size={18} />, href: '/admin/profile' },
  { name: 'System Settings', icon: <FiSettings size={18} />, href: '/admin/settings' },
];

export default function AdminSidebar({
  isMobileOpen = false,
  onMobileClose = () => { },
}: {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const sidebarContent = (
    <>
      {/* Logo/Header */}
      <div className="p-4 border-b border-white/10 h-16 flex items-center shrink-0">
        <Link href="/admin/dashboard" className="flex items-center group">
          <Image
            src="/UGM_Lambang.png"
            alt="UGM Logo"
            width={36}
            height={36}
            className="mr-2.5 group-hover:opacity-90 transition-opacity"
          />
          <div>
            <h2 className="font-semibold text-lg text-white leading-tight group-hover:text-[#FFCA40] transition-colors">AICare</h2>
            <p className="text-xs text-[#FFCA40] flex items-center">
              <FiShield className="mr-1" size={11} />
              Admin Panel
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(item => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                />
              ))}
            </ul>
          </div>
        ))}
        <hr className="my-3 border-white/10" />
        <div>
          <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">Account & System</p>
          <ul className="space-y-0.5">
            {secondaryNavItems.map(item => (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.name}
              />
            ))}
          </ul>
        </div>
      </nav>

      {/* Footer / Sign Out */}
      <div className="p-3 border-t border-white/10 mt-auto shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: '/admin' })}
          className="flex items-center w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group text-white/70 hover:bg-red-500/15 hover:text-red-300"
        >
          <FiLogOut className="mr-3 shrink-0 text-white/60 group-hover:text-red-300" size={18} />
          <span className="truncate">Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="w-64 bg-[#000c24] h-screen sticky top-0 shrink-0 overflow-y-auto hidden md:flex flex-col border-r border-white/10">
        {sidebarContent}
      </aside>
      <MobileNavDrawer isOpen={isMobileOpen} onClose={onMobileClose}>
        {sidebarContent}
      </MobileNavDrawer>
    </>
  );
}
