"use client";

import Image from 'next/image';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  FiHome,
  FiClipboard,
  FiCalendar,
  FiUsers,
  FiUser,
  FiSettings,
  FiLogOut,
  FiHeart,
  FiAlertTriangle,
  FiMessageSquare,
  FiFileText,
  FiBookOpen,
  FiEye,
  FiActivity,
} from 'react-icons/fi';
import SidebarLink from '../admin/SidebarLink';

import MobileNavDrawer from '../MobileNavDrawer';

const navGroups = [
  {
    label: 'Clinical Workflow',
    items: [
      { name: 'Dashboard', icon: <FiHome size={18}/>, href: '/counselor/dashboard' },
      { name: 'Escalations', icon: <FiAlertTriangle size={18}/>, href: '/counselor/escalations' },
      { name: 'My Cases', icon: <FiClipboard size={18}/>, href: '/counselor/cases' },
      { name: 'Session Notes', icon: <FiFileText size={18}/>, href: '/counselor/notes' },
      { name: 'Appointments', icon: <FiCalendar size={18}/>, href: '/counselor/appointments' },
      { name: 'Patients & Contacts', icon: <FiUsers size={18}/>, href: '/counselor/patients' },
    ]
  },
  {
    label: 'Care Intelligence',
    items: [
      { name: 'Conversations', icon: <FiMessageSquare size={18}/>, href: '/counselor/conversations' },
      { name: 'Progress Tracking', icon: <FiActivity size={18}/>, href: '/counselor/progress' },
      { name: 'Treatment Plans', icon: <FiBookOpen size={18}/>, href: '/counselor/treatment-plans' },
      { name: 'Agent Decisions', icon: <FiEye size={18}/>, href: '/counselor/agent-decisions' },
    ]
  }
];

const secondaryNavItems = [
  { name: 'My Profile', icon: <FiUser size={18}/>, href: '/counselor/profile' },
  { name: 'Settings', icon: <FiSettings size={18}/>, href: '/counselor/settings' },
];

export default function CounselorSidebar({
  isMobileOpen = false,
  onMobileClose = () => {},
}: {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const sidebarContent = (
    <>
      {/* Logo/Header */}
      <div className="p-4 border-b border-white/10 h-16 flex items-center shrink-0">
        <Link href="/counselor/dashboard" className="flex items-center group">
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
              <FiHeart className="mr-1" size={11} />
              Counselor Portal
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">{group.label}</p>
            <div className="space-y-1.5">
              {group.items.map(item => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                />
              ))}
            </div>
          </div>
        ))}
        <hr className="my-3 border-white/10" />
        <div>
          <p className="px-2 mb-1 text-[10px] uppercase tracking-wider text-white/40 font-medium">Account</p>
          <div className="space-y-1.5">
            {secondaryNavItems.map(item => (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.name}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer / Sign Out */}
      <div className="p-3 border-t border-white/10 mt-auto shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: '/counselor' })}
          className="flex items-center w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group text-white/70 hover:bg-red-500/15 hover:text-red-300"
        >
          <FiLogOut className="mr-3 shrink-0 text-white/60 group-hover:text-red-300" size={18}/>
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
