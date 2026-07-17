// frontend/src/components/ui/AppSidebar.tsx
"use client";

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  BsChatDots, 
  BsCalendar, 
  BsQuestionCircle,
  FiActivity, 
  FiUsers, 
  FiPieChart, 
  FiSettings, 
  FiBookOpen, 
  FiUser,
  FiGrid,
  FiZap,
  HiX
} from '@/icons';
import { FiLink, FiCheckCircle } from 'react-icons/fi';

// Compact Wallet Section Component for Sidebar
function CompactWalletSection() {
  const { data: session } = useSession();
  const { address } = useAccount();
  const linkedAddress = session?.user?.wallet_address;
  
  const shortAddress = linkedAddress 
    ? `${linkedAddress.slice(0, 6)}...${linkedAddress.slice(-4)}`
    : address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <FiLink className="w-4 h-4 text-[#FFCA40]" />
        <span className="text-xs font-medium text-white/70">Wallet</span>
        {linkedAddress && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
            <FiCheckCircle className="w-3 h-3" />
            Linked
          </span>
        )}
      </div>
      
      {linkedAddress ? (
        <div className="flex items-center justify-between bg-white/5 rounded-md px-2 py-1.5">
          <code className="text-xs text-white/60 font-mono">{shortAddress}</code>
        </div>
      ) : (
        <div className="flex justify-center">
          <ConnectButton.Custom>
            {({ openConnectModal, connectModalOpen }) => (
              <button
                onClick={openConnectModal}
                disabled={connectModalOpen}
                className="w-full text-xs font-medium py-2 px-3 rounded-md bg-[#FFCA40]/10 text-[#FFCA40] border border-[#FFCA40]/20 hover:bg-[#FFCA40]/20 hover:border-[#FFCA40]/40 transition-all disabled:opacity-50"
              >
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        </div>
      )}
    </div>
  );
}

// Interface for navigation items, adding optional admin flag
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean; // Flag for admin-specific links
  featured?: boolean;
}

type NavGroup = {
  title: string;
  items: NavItem[];
};

const sidebarNavGroups: NavGroup[] = [
  {
    title: "Core Support",
    items: [
      { href: "/aika", label: "Talk to Aika", icon: <BsChatDots size={18} />, featured: true },
      { href: "/journaling", label: "Journaling", icon: <FiActivity size={18} />, featured: true },
      { href: "/appointments", label: "Appointments", icon: <BsCalendar size={18} />, featured: true },
      { href: "/quests", label: "Quest Board", icon: <FiZap size={18} />, featured: true },
    ],
  },
  {
    title: "My Space",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: <FiGrid size={18} /> },
      { href: "/proof", label: "Proof Timeline", icon: <FiCheckCircle size={18} /> },
      { href: "/profile", label: "Profile", icon: <FiUser size={18} /> },
      { href: "/resources", label: "Resources", icon: <FiBookOpen size={18} /> },
    ],
  },
  {
    title: "Admin Tools",
    items: [
      { href: "/admin/dashboard", label: "Admin Dashboard", icon: <FiPieChart size={18} />, adminOnly: true },
      { href: "/admin/users", label: "Manage Users", icon: <FiUsers size={18} />, adminOnly: true },
      { href: "/admin/settings", label: "Admin Settings", icon: <FiSettings size={18} />, adminOnly: true },
    ],
  },
  {
    title: "Help",
    items: [
      { href: "/help", label: "Help & Support", icon: <BsQuestionCircle size={18} /> },
    ],
  },
];


interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFeedback?: () => void; // Add feedback handler
}

export default function AppSidebar({ isOpen, onClose, onOpenFeedback }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession(); // Get session to check role
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'admin_viewer' || session?.user?.role === 'therapist';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for closing */}
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-80" // z-80 is below sidebar (z-90)
            aria-hidden="true"
          />

          {/* Sidebar */}
          <motion.div
            key="app-sidebar"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            // --- CHANGE HERE: Use 'fixed' positioning, remove lg:sticky ---
            className="fixed top-0 left-0 bottom-0 z-90 w-[85%] max-w-70 bg-linear-to-b from-[#001a4f]/95 to-[#00112e]/95 backdrop-blur-xl border-r border-white/10 shadow-xl flex flex-col"
            // --- No more lg:sticky, lg:translate-x-0, etc. ---
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Sidebar Header (with Close button for mobile) */}
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Menu</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <HiX size={24} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-5">
                {sidebarNavGroups.map((group) => {
                  const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
                  if (visibleItems.length === 0) {
                    return null;
                  }

                  return (
                    <section key={group.title} aria-label={group.title}>
                      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        {group.title}
                      </p>
                      <ul className="space-y-1.5">
                        {visibleItems.map((item) => {
                          const isActive = pathname === item.href;

                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={onClose}
                                className={`relative flex items-center px-3 py-3 rounded-lg transition-colors duration-150 ${
                                  isActive
                                    ? item.featured
                                      ? 'bg-[#FFCA40]/25 text-[#FFCA40] font-semibold border border-[#FFCA40]/40 shadow-[0_0_24px_rgba(255,202,64,0.18)]'
                                      : 'bg-[#FFCA40]/20 text-[#FFCA40] font-medium border border-[#FFCA40]/30'
                                    : item.featured
                                      ? 'text-white border border-white/10 bg-white/5 hover:bg-[#FFCA40]/10 hover:border-[#FFCA40]/30 hover:text-white'
                                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {isActive && item.featured && (
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[#FFCA40]" aria-hidden="true" />
                                )}
                                <span className={`mr-3 shrink-0 w-5 ${item.featured ? 'text-[#FFCA40]' : ''}`}>{item.icon}</span>
                                <span className="truncate">{item.label}</span>
                                {item.featured && !isActive && (
                                  <span className="ml-auto text-[10px] uppercase bg-[#FFCA40]/20 text-[#FFCA40] px-1.5 py-0.5 rounded">Main</span>
                                )}
                                {item.adminOnly && (
                                  <span className="ml-auto text-[10px] uppercase bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded">Admin</span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </nav>

            {/* Bottom Actions - Compact & Modern */}
            <div className="px-3 pb-4 space-y-2 mt-auto border-t border-white/10 pt-3">
              {/* Feedback Button - Minimal */}
              {onOpenFeedback && (
                <motion.button
                  onClick={() => {
                    onOpenFeedback();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-linear-to-r from-[#FFCA40]/10 to-[#FFCA40]/5 border border-[#FFCA40]/20 hover:border-[#FFCA40]/40 hover:bg-[#FFCA40]/15 transition-all duration-200 group"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FFCA40]/20 text-[#FFCA40]">
                    💬
                  </span>
                  <span className="text-sm font-medium text-white/90 group-hover:text-white">
                    Share Feedback
                  </span>
                  <span className="ml-auto text-white/40 group-hover:text-[#FFCA40] transition-colors">
                    →
                  </span>
                </motion.button>
              )}

              {/* Wallet Connection - Compact */}
              <CompactWalletSection />
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}