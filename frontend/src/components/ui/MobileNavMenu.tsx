// frontend/src/components/ui/MobileNavMenu.tsx
"use client";

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HiX } from 'react-icons/hi';
import { BsChatDots, BsCalendar, BsQuestionCircle } from 'react-icons/bs';
import { FiActivity, FiBookOpen, FiMapPin, FiInfo, FiShield } from 'react-icons/fi';
import { FaCoins } from 'react-icons/fa';
import AccountLinker from '@/components/AccountLinker'; //

// Define props for the component
interface MobileNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MobileNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

interface MobileNavGroup {
  title: string;
  items: MobileNavItem[];
}

// Define navigation items with updated icons and links
const mobileNavGroups: MobileNavGroup[] = [
  {
    title: "Core Support",
    items: [
      { href: "/aika", label: "Talk to Aika", icon: <BsChatDots size={18} />, highlight: true },
      { href: "/journaling", label: "Journaling", icon: <FiActivity size={18} />, highlight: true },
      { href: "/appointments", label: "Appointments", icon: <BsCalendar size={18} />, highlight: true },
    ],
  },
  {
    title: "Explore",
    items: [
      { href: "/dashboard", label: "Home", icon: <FiBookOpen size={18} /> },
      { href: "/carequest", label: "CareQuest", icon: <FiMapPin size={18} /> },
      { href: "/caretoken", label: "$CARE Token", icon: <FaCoins size={18} /> },
      { href: "/proof", label: "Proof Timeline", icon: <FiShield size={18} /> },
      { href: "/about", label: "About", icon: <FiInfo size={18} /> },
      { href: "/help", label: "Help & Support", icon: <BsQuestionCircle size={18} /> },
    ],
  },
];


export default function MobileNavMenu({ isOpen, onClose }: MobileNavMenuProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay - Enhanced iOS style */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-md z-40"
            aria-hidden="true"
          />

          {/* Sidebar container - Enhanced iOS Glassmorphism */}
          <motion.div
            key="mobile-nav-menu"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              opacity: { duration: 0.3 }
            }}
            className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-[320px] bg-white/10 backdrop-blur-2xl border-r border-white/20 shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
          >
            {/* Header within the sidebar - Enhanced */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
              <h2 className="text-xl font-semibold text-white">Navigation</h2>
              <motion.button
                onClick={onClose}
                whileHover={{ 
                  scale: 1.1, 
                  backgroundColor: "rgba(255,255,255,0.15)",
                  boxShadow: "0 0 20px rgba(255,202,64,0.3), 0 0 40px rgba(255,202,64,0.1)"
                }}
                whileTap={{ scale: 0.9 }}
                className="p-3 rounded-2xl bg-white/5 text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
                aria-label="Close menu"
              >
                <HiX size={18} />
              </motion.button>
            </div>

            {/* Navigation Links - Enhanced iOS Style */}
            <nav className="flex-1 p-6 overflow-y-auto">
              <div className="space-y-5">
                {mobileNavGroups.map((group, groupIndex) => (
                  <section key={group.title} aria-label={group.title}>
                    <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      {group.title}
                    </p>
                    <ul className="space-y-2">
                      {group.items.map((item, itemIndex) => (
                        <motion.li
                          key={item.href}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.06 * (groupIndex * 4 + itemIndex), duration: 0.3 }}
                        >
                          {(() => {
                            const isActive = pathname === item.href;
                            return (
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className={`flex items-center px-4 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                              isActive
                                ? item.highlight
                                  ? 'text-[#FFCA40] border border-[#FFCA40]/45 bg-[#FFCA40]/18 shadow-[0_0_22px_rgba(255,202,64,0.18)]'
                                  : 'text-white border border-white/20 bg-white/12'
                                : item.highlight
                                ? 'text-white border border-[#FFCA40]/25 bg-[#FFCA40]/8 hover:bg-[#FFCA40]/14'
                                : 'text-white/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isActive && item.highlight && (
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[#FFCA40]" aria-hidden="true" />
                            )}
                            <span className="flex items-center w-full relative">
                              <motion.div
                                className="absolute inset-0 bg-linear-to-r from-white/5 to-white/8 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300"
                                whileHover={{ 
                                  boxShadow: "0 0 20px rgba(255,202,64,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                                }}
                              />
                              <motion.span 
                                className={`mr-4 shrink-0 transition-colors duration-300 relative z-10 ${item.highlight ? 'text-[#FFCA40]' : 'text-white/60 group-hover:text-[#FFCA40]'}`}
                                whileHover={{ scale: 1.2 }}
                              >
                                {item.icon}
                              </motion.span>
                              <span className="truncate font-medium relative z-10">{item.label}</span>
                              {item.highlight && !isActive && (
                                <span className="ml-2 text-[10px] uppercase bg-[#FFCA40]/20 text-[#FFCA40] px-1.5 py-0.5 rounded relative z-10">Main</span>
                              )}
                              <motion.span
                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 relative z-10 flex items-center"
                                initial={{ x: -10 }}
                                whileHover={{ x: 0 }}
                              >
                                <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </motion.span>
                            </span>
                          </Link>
                            );
                          })()}
                        </motion.li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </nav>

             {/* Account Linker Section at the bottom - Enhanced */}
             <div className="p-6 border-t border-white/10 mt-auto bg-white/5">
                <AccountLinker />
             </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
