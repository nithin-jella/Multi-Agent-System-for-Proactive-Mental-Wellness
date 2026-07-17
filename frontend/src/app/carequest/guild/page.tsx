'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, MessageSquare, Settings, Crown, Shield, Swords } from 'lucide-react';
import { ProgressRing } from '@/components/carequest/ProgressRing';
import { RewardBadge } from '@/components/carequest/RewardBadge';
import ParticleBackground from '@/components/ui/ParticleBackground';

/**
 * Guild System Page - RPG Redesign
 * 
 * Features:
 * - RPG guild roster with member cards (avatars, levels, stats)
 * - Game-style chat interface
 * - Guild achievements and badges
 * - Medieval/fantasy aesthetic with UGM colors
 */

interface GuildMember {
  id: number;
  name: string;
  level: number;
  role: 'leader' | 'officer' | 'member';
  joy: number;
  care: number;
  harmony: number;
  avatar: string;
  isOnline: boolean;
}

// Mock data - replace with API call
const mockMembers: GuildMember[] = [
  { id: 1, name: 'Budi Santoso', level: 12, role: 'leader', joy: 850, care: 1200, harmony: 450, avatar: '👑', isOnline: true },
  { id: 2, name: 'Siti Rahayu', level: 10, role: 'officer', joy: 720, care: 980, harmony: 380, avatar: '⚔️', isOnline: true },
  { id: 3, name: 'Ahmad Fauzi', level: 8, role: 'member', joy: 650, care: 840, harmony: 320, avatar: '🛡️', isOnline: false },
  { id: 4, name: 'Dewi Lestari', level: 11, role: 'member', joy: 780, care: 1050, harmony: 410, avatar: '✨', isOnline: true },
  { id: 5, name: 'Reza Pratama', level: 7, role: 'member', joy: 580, care: 720, harmony: 280, avatar: '🎯', isOnline: false },
];

const roleConfig = {
  leader: { icon: Crown, color: 'text-[#FFCA40]', bg: 'bg-[#FFCA40]/20', label: 'Guild Leader' },
  officer: { icon: Swords, color: 'text-[#B8A4FF]', bg: 'bg-[#B8A4FF]/20', label: 'Officer' },
  member: { icon: Shield, color: 'text-[#50E3C2]', bg: 'bg-[#50E3C2]/20', label: 'Member' },
};

export default function GuildPage() {
  const [activeTab, setActiveTab] = useState<'roster' | 'chat' | 'settings'>('roster');

  const tabs = [
    { id: 'roster', label: 'Guild Roster', icon: Users },
    { id: 'chat', label: 'Guild Chat', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A] relative">
      {/* Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <ParticleBackground count={50} colors={["#FFCA40", "#B8A4FF", "#50E3C2"]} minSize={2} maxSize={6} speed={0.8} />
      </div>

      <div className="container mx-auto px-6 py-12 max-w-7xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-12 h-12 text-[#FFCA40]" />
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
              Guild Hall
            </h1>
            <Users className="w-12 h-12 text-[#FFCA40]" />
          </div>
          <p className="text-xl text-white/70">
            Unite with Fellow Warriors on Your Mental Health Journey
          </p>
        </motion.div>

        {/* Guild Info Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 mb-8 shadow-2xl"
        >
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#FFCA40] to-[#FFD700] flex items-center justify-center text-4xl shadow-lg shadow-[#FFCA40]/30">
                🏰
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">The Mindful Warriors</h2>
                <p className="text-white/70 text-sm">Est. October 2024 • {mockMembers.length} Members</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <RewardBadge
                title="Guild Level 5"
                description="Collective guild achievements"
                icon="trophy"
                rarity="epic"
                earned
                size="md"
              />
              <RewardBadge
                title="Support Champions"
                description="Helped 100+ students"
                icon="crown"
                rarity="legendary"
                earned
                size="md"
              />
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2
                  ${isActive 
                    ? 'bg-gradient-to-r from-[#FFCA40] to-[#FFD700] text-[#001D58] shadow-lg shadow-[#FFCA40]/50' 
                    : 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-[#FFCA40] to-[#FFD700] rounded-xl -z-10"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Guild Roster Tab */}
            {activeTab === 'roster' && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="w-8 h-8 text-[#FFCA40]" />
                  <h2 className="text-3xl font-bold text-white">Guild Members</h2>
                  <span className="px-3 py-1 bg-[#FFCA40]/20 border border-[#FFCA40]/50 rounded-full text-[#FFCA40] text-sm font-semibold">
                    {mockMembers.filter(m => m.isOnline).length} Online
                  </span>
                </div>
                
                <div className="grid gap-4">
                  {mockMembers.map((member, index) => {
                    const roleData = roleConfig[member.role];
                    const RoleIcon = roleData.icon;
                    
                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        className="relative overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-6 shadow-lg hover:shadow-xl transition-shadow"
                      >
                        {/* Shimmer effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                        />

                        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
                          {/* Member Info */}
                          <div className="flex items-center gap-4">
                            {/* Avatar with online indicator */}
                            <div className="relative">
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#50E3C2] to-[#B8A4FF] flex items-center justify-center text-3xl shadow-lg">
                                {member.avatar}
                              </div>
                              {member.isOnline && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#001D58] shadow-lg">
                                  <motion.div
                                    className="absolute inset-0 bg-green-500 rounded-full"
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Name and Level */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold text-white">{member.name}</h3>
                                <div className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${roleData.bg} ${roleData.color}`}>
                                  <RoleIcon className="w-3 h-3" />
                                  {roleData.label}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <ProgressRing
                                  progress={(member.harmony % 100)}
                                  size={40}
                                  strokeWidth={4}
                                  color="gold"
                                  showPercentage={false}
                                >
                                  <div className="text-xs font-bold text-[#FFCA40]">{member.level}</div>
                                </ProgressRing>
                                <span className="text-sm text-white/70">Level {member.level} Warrior</span>
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-[#FF6B9D]">{member.joy}</div>
                              <div className="text-xs text-white/60">JOY</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-[#50E3C2]">{member.care}</div>
                              <div className="text-xs text-white/60">CARE</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-[#B8A4FF]">{member.harmony}</div>
                              <div className="text-xs text-white/60">Harmony</div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-6 py-2 bg-gradient-to-r from-[#50E3C2] to-[#3BA99C] text-white font-bold rounded-lg shadow-lg hover:shadow-[#50E3C2]/50 transition-shadow"
                          >
                            View Profile
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Guild Chat Tab */}
            {activeTab === 'chat' && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="w-8 h-8 text-[#FFCA40]" />
                  <h2 className="text-3xl font-bold text-white">Guild Chat</h2>
                </div>
                
                {/* Chat Area */}
                <div className="bg-[#001D58]/50 rounded-xl p-6 h-[500px] overflow-y-auto mb-4 border border-white/10">
                  {/* Mock messages */}
                  <div className="space-y-4">
                    {[
                      { user: 'Budi Santoso', avatar: '👑', message: 'Welcome everyone! Let\'s support each other today 💪', time: '10:30 AM' },
                      { user: 'Siti Rahayu', avatar: '⚔️', message: 'Just completed the morning mindfulness quest!', time: '10:32 AM' },
                      { user: 'Dewi Lestari', avatar: '✨', message: 'Anyone want to team up for the group activity?', time: '10:35 AM' },
                    ].map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex gap-3"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-aurora-blue to-aurora-purple flex items-center justify-center text-xl flex-shrink-0">
                          {msg.avatar}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white text-sm">{msg.user}</span>
                            <span className="text-xs text-gray-400">{msg.time}</span>
                          </div>
                          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                            <p className="text-gray-200">{msg.message}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Coming soon message */}
                  <div className="text-center mt-12">
                    <div className="inline-block px-6 py-3 bg-ugm-gold/20 border border-ugm-gold/50 rounded-xl">
                      <p className="text-ugm-gold font-semibold">🚧 Real-time chat coming soon!</p>
                    </div>
                  </div>
                </div>
                
                {/* Message Input */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Type your message to the guild..."
                    className="flex-1 px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ugm-gold disabled:opacity-50"
                    disabled
                    aria-label="Guild chat message input"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-gradient-to-r from-ugm-gold to-yellow-500 text-ugm-blue-dark font-bold rounded-xl shadow-lg disabled:opacity-50"
                    disabled
                  >
                    Send
                  </motion.button>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl border-2 border-white/20 p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Settings className="w-8 h-8 text-ugm-gold" />
                  <h2 className="text-3xl font-bold text-white">Guild Settings</h2>
                </div>
                
                <div className="space-y-6">
                  {/* Guild Name */}
                  <div>
                    <label htmlFor="guild-name" className="block text-sm font-bold text-white mb-2">
                      Guild Name
                    </label>
                    <input
                      id="guild-name"
                      type="text"
                      defaultValue="The Mindful Warriors"
                      className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ugm-gold disabled:opacity-50"
                      disabled
                      aria-label="Guild Name"
                    />
                  </div>
                  
                  {/* Guild Description */}
                  <div>
                    <label htmlFor="guild-description" className="block text-sm font-bold text-white mb-2">
                      Guild Description
                    </label>
                    <textarea
                      id="guild-description"
                      rows={4}
                      defaultValue="A supportive community for UGM students practicing mental wellness together. We believe in the power of collective healing and mutual support."
                      className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ugm-gold disabled:opacity-50"
                      disabled
                      aria-label="Guild Description"
                    ></textarea>
                  </div>
                  
                  {/* Guild Privacy */}
                  <div>
                    <label htmlFor="guild-privacy" className="block text-sm font-bold text-white mb-2">
                      Privacy Setting
                    </label>
                    <select
                      id="guild-privacy"
                      className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-ugm-gold disabled:opacity-50"
                      disabled
                      aria-label="Guild Privacy Setting"
                    >
                      <option>Public - Anyone can join</option>
                      <option>Private - Invite only</option>
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 px-8 py-3 bg-gradient-to-r from-ugm-gold to-yellow-500 text-ugm-blue-dark font-bold rounded-xl shadow-lg disabled:opacity-50"
                      disabled
                    >
                      Save Changes
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-8 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                      disabled
                    >
                      Cancel
                    </motion.button>
                  </div>

                  {/* Info banner */}
                  <div className="mt-8 bg-aurora-blue/10 border border-aurora-blue/30 rounded-xl p-4">
                    <p className="text-aurora-blue text-sm leading-relaxed">
                      <strong>ℹ️ Guild features are in development.</strong> Soon you&apos;ll be able to create your own guilds,
                      invite friends, complete group challenges, and earn collective rewards!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
