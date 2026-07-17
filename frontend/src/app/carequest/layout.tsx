'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useWellnessState } from '@/hooks/useQuests';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { Home, Sword, Users, ShoppingBag, Activity, Sparkles, Crown, Shield, Menu, X, ChevronDown } from 'lucide-react';
import ParticleBackground from '@/components/ui/ParticleBackground';
import ProfileDropdown from '@/components/ui/ProfileDropdown';
import { useState, useEffect } from 'react';

/**
 * CareQuest Layout - Epic Game-Style Design
 * 
 * Features:
 * - Game HUD-inspired navbar with floating elements
 * - Animated resource counters with glow effects
 * - RPG-style navigation with hover animations
 * - Dynamic level progression display
 * - Ornamental borders and fantasy aesthetics
 */
export default function CareQuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { data: wellness } = useWellnessState();
  const { src: profilePictureSrc } = useProfilePicture();
  const { joy, care, harmony, setWellnessState } = useGameStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Sync wellness state from backend to game store
  useEffect(() => {
    if (wellness) {
      setWellnessState({
        joy: wellness.joy_balance,
        care: 0, // CARE tokens come from user profile, not wellness
        harmony: wellness.harmony_score,
      });
    }
  }, [wellness, setWellnessState]);

  const handleSignOut = () => {
    setIsProfileOpen(false);
    signOut({ callbackUrl: '/' });
  };

  const navItems = [
    { href: '/carequest', label: 'Hub', icon: Home, color: '#001D58', glow: '#00308F' },
    { href: '/carequest/game', label: 'Game', icon: Sword, color: '#FFCA40', glow: '#FFD700' },
    { href: '/carequest/guild', label: 'Guild', icon: Users, color: '#B8A4FF', glow: '#9F7AEA' },
    { href: '/carequest/market', label: 'Market', icon: ShoppingBag, color: '#50E3C2', glow: '#2DD4BF' },
    { href: '/carequest/activities', label: 'Quests', icon: Activity, color: '#FF6B9D', glow: '#EC4899' },
  ];

  const isActive = (href: string) => pathname === href;

  // Calculate player level and XP progress
  const playerLevel = Math.floor(harmony / 100) + 1;
  const xpInCurrentLevel = harmony % 100;
  const xpProgress = (xpInCurrentLevel / 100) * 100;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#001D58] via-[#00308F] to-[#002A7A] relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <ParticleBackground count={60} colors={["#FFCA40", "#B8A4FF", "#50E3C2"]} minSize={2} maxSize={8} speed={0.5} />
      </div>

      {/* Decorative Corner Ornaments */}
      <div className="fixed top-0 left-0 w-32 h-32 border-t-4 border-l-4 border-[#FFCA40]/30 pointer-events-none z-40" />
      <div className="fixed top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-[#FFCA40]/30 pointer-events-none z-40" />
      <div className="fixed bottom-0 left-0 w-32 h-32 border-b-4 border-l-4 border-[#FFCA40]/30 pointer-events-none z-40" />
      <div className="fixed bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 border-[#FFCA40]/30 pointer-events-none z-40" />

      {/* Epic Game Navbar - Only show on non-game pages */}
      {pathname !== '/carequest/game' && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="sticky top-0 z-50 backdrop-blur-xl bg-linear-to-r from-[#001D58]/95 via-[#00308F]/95 to-[#001D58]/95 border-b-2 border-[#FFCA40]/50 shadow-2xl"
        >
          {/* Top decorative border */}
          <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-[#FFCA40] to-transparent" />
          
          <div className="container mx-auto px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              {/* Left: Exit + Logo */}
              <div className="flex items-center gap-2">
                {/* Exit button - icon only with tooltip */}
                <Link href="/">
                  <button 
                    className="group relative flex items-center justify-center w-9 h-9 bg-white/10 backdrop-blur-md rounded-md border border-white/20 hover:bg-white/15 hover:border-[#FFCA40]/50 transition-all"
                    title="Exit to UGM-AICare"
                  >
                    <Home className="w-4 h-4 text-[#FFCA40]" />
                    {/* Tooltip */}
                    <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                      Exit to UGM-AICare
                    </span>
                  </button>
                </Link>

                {/* Compact Logo */}
                <Link href="/carequest" className="flex items-center gap-2 group relative">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-lg bg-linear-to-br from-[#FFCA40]/20 via-white/10 to-[#B8A4FF]/20 backdrop-blur-md border border-[#FFCA40]/50">
                    <Image
                      src="/carequest-logo.png"
                      alt="CareQuest Logo"
                      fill
                      className="object-contain p-1.5"
                    />
                  </div>
                  <div className="hidden md:block">
                    <h1 className="text-xl font-black text-transparent bg-clip-text bg-linear-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
                      CareQuest
                    </h1>
                    <p className="text-[9px] text-[#FFCA40]/70 font-semibold tracking-wide leading-none">
                      MENTAL HEALTH SAGA
                    </p>
                  </div>
                </Link>
              </div>

              {/* Desktop Navigation - Simplified */}
              <nav className="hidden lg:flex items-center gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`relative px-3 py-2 rounded-lg transition-all duration-200 border ${
                          active
                            ? 'bg-white/15 border-white/30'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon
                            className="w-4 h-4"
                            style={{ color: active ? item.color : '#ffffff99' }}
                          />
                          <span
                            className="font-semibold text-xs"
                            style={{ color: active ? '#ffffff' : '#ffffff99' }}
                          >
                            {item.label}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Ultra Compact Resource Display + Profile */}
              <div className="flex items-center gap-1.5">
                {/* All Stats in Single Compact Bar */}
                <div className="hidden md:flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/20 text-[11px]">
                  {/* JOY with tooltip */}
                  <div className="group relative flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FFCA40]" />
                    <span className="font-black text-white">{joy.toFixed(0)}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-[#FFCA40]/30">
                      <div className="font-bold text-[#FFCA40] mb-1">JOY Points</div>
                      <div className="text-[10px] text-gray-300">Earned from positive interactions</div>
                      <div className="text-[10px] text-gray-300">and completing activities</div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-3 bg-white/20" />

                  {/* CARE with tooltip */}
                  <div className="group relative flex items-center gap-1">
                    <span className="text-xs">💎</span>
                    <span className="font-black text-white">{care.toFixed(0)}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-[#50E3C2]/30">
                      <div className="font-bold text-[#50E3C2] mb-1">CARE Tokens</div>
                      <div className="text-[10px] text-gray-300">Premium currency for special items</div>
                      <div className="text-[10px] text-gray-300">and exclusive activities</div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>

                  <div className="w-px h-3 bg-white/20" />

                  {/* Level with tooltip */}
                  <div className="group relative flex items-center gap-1">
                    <Crown className="w-3 h-3 text-[#B8A4FF]" />
                    <span className="font-black text-white">{playerLevel}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-[#B8A4FF]/30">
                      <div className="font-bold text-[#B8A4FF] mb-1">Adventurer Level</div>
                      <div className="text-[10px] text-gray-300">Current Harmony: {harmony.toFixed(0)}</div>
                      <div className="text-[10px] text-gray-300">Next level: {((playerLevel) * 100).toFixed(0)} Harmony</div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Button */}
                {status === 'authenticated' && session?.user && (
                  <div className="relative">
                    <motion.button
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/8 backdrop-blur-xl rounded-2xl p-2 pr-3 transition-all duration-200 border border-white/8 hover:border-white/15"
                      aria-haspopup="true"
                      aria-expanded={isProfileOpen ? 'true' : 'false'}
                    >
                      <div className="relative h-7 w-7 rounded-xl overflow-hidden border border-white/15">
                        <Image
                          src={profilePictureSrc}
                          alt={session.user.name || "User"}
                          fill 
                          className="object-cover"
                        />
                      </div>
                      <span className="ml-1 text-white/80 text-sm font-medium hidden sm:inline-block">
                        {session.user.name?.split(' ')[0]}
                      </span>
                      <motion.div
                        animate={{ rotate: isProfileOpen ? 180 : 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                      >
                        <ChevronDown className="ml-0.5 text-white/50" size={14} />
                      </motion.div>
                    </motion.button>

                    <ProfileDropdown
                      isOpen={isProfileOpen}
                      user={session.user}
                      wellness={wellness}
                      profilePictureSrc={profilePictureSrc}
                      onClose={() => setIsProfileOpen(false)}
                      onSignOut={handleSignOut}
                    />
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-white" />
                ) : (
                  <Menu className="w-6 h-6 text-white" />
                )}
              </motion.button>
            </div>

            {/* Mobile Navigation Menu */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.nav
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="lg:hidden overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 mt-4 pb-4">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                          <motion.div
                            whileTap={{ scale: 0.95 }}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all border-2 ${
                              active
                                ? 'bg-white/20 border-white/40'
                                : 'bg-white/5 border-white/10'
                            }`}
                            style={{
                              boxShadow: active ? `0 0 15px ${item.glow}40` : 'none',
                            }}
                          >
                            <Icon
                              className="w-6 h-6"
                              style={{ color: active ? item.color : '#ffffff99' }}
                            />
                            <span
                              className="text-sm font-bold"
                              style={{ color: active ? '#ffffff' : '#ffffff99' }}
                            >
                              {item.label}
                            </span>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Mobile Resources */}
                  <div className="flex items-center justify-center gap-2 pb-4 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-1.5 bg-linear-to-br from-[#FF6B9D]/20 to-[#FFCA40]/20 backdrop-blur-md px-3 py-2 rounded-lg border border-[#FFCA40]/50">
                      <Sparkles className="w-4 h-4 text-[#FFCA40]" />
                      <span className="text-sm font-bold text-white">{joy.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-linear-to-br from-[#50E3C2]/20 to-[#2DD4BF]/20 backdrop-blur-md px-3 py-2 rounded-lg border border-[#50E3C2]/50">
                      <span className="text-base">💎</span>
                      <span className="text-sm font-bold text-white">{care.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-linear-to-br from-[#B8A4FF]/20 to-[#9F7AEA]/20 backdrop-blur-md px-3 py-2 rounded-lg border border-[#B8A4FF]/50">
                      <Shield className="w-4 h-4 text-[#B8A4FF]" />
                      <span className="text-sm font-bold text-white">Lv.{playerLevel}</span>
                    </div>
                  </div>
                </motion.nav>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom decorative border */}
          <div className="absolute bottom-0 inset-x-0 h-1 bg-linear-to-r from-transparent via-[#FFCA40]/50 to-transparent" />
        </motion.header>
      )}

      {/* Main content */}
      <main className={`relative z-10 ${pathname === '/carequest/game' ? 'h-screen' : 'py-6'}`}>
        {children}
      </main>
    </div>
  );
}
