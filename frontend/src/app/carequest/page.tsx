'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { StatBar } from '@/components/carequest/StatBar';
import { QuestCard } from '@/components/carequest/QuestCard';
import { ProgressRing } from '@/components/carequest/ProgressRing';
import { Sword, Map, Users, ShoppingBag, Zap, Trophy, Star, Home, ArrowLeft, Sparkles, Shield } from 'lucide-react';
import ParticleBackground from '@/components/ui/ParticleBackground';

/**
 * CareQuest Landing Page - Redesigned with UGM-AICare Design System
 * 
 * Features:
 * - UGM color palette consistency (#001D58, #FFCA40)
 * - ParticleBackground for unified design
 * - Glassmorphism with backdrop-blur-md
 * - RPG-style hero with animated stats
 * - Quest preview cards
 * - NFT Achievement showcase (EDU Chain / ERC-1155)
 * - Game-style navigation
 * 
 * NFT Badges are minted via UGMJournalBadges.sol contract on EDU Chain
 * Metadata: blockchain/metadata/*.json
 * Assets: public/nft-asset/*.jpeg
 */
export default function CareQuestPage() {
  const { joy, care, harmony } = useGameStore();

  // Calculate player level from harmony
  const playerLevel = Math.floor(harmony / 100) + 1;
  const levelProgress = (harmony % 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A] relative overflow-hidden">
      {/* ParticleBackground for consistency with main site */}
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <ParticleBackground count={50} colors={["#FFCA40", "#6A98F0", "#ffffff"]} minSize={2} maxSize={8} speed={0.8} />
      </div>

      {/* Simplified Full-Width Hero */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden py-12 pb-0">
        {/* Transparent - let particles show through */}
        <div className="absolute inset-0 z-0">
          {/* Very subtle overlay to maintain readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#001D58]/20 via-[#00308F]/10 to-transparent" />
        </div>

        {/* Hero Content - Full Width Grid */}
        <div className="container mx-auto px-6 lg:px-12 relative z-20">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center max-w-7xl mx-auto">
            {/* Left Column - Text Content */}
            <div className="text-left space-y-6">
              {/* Title */}
              <div className="relative">
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-black leading-none mb-3">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
                    CareQuest
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-xl md:text-2xl font-bold text-white mb-2">
                  Your Epic Mental Health Journey
                </p>
                <p className="text-base md:text-lg text-gray-300">
                  🏛️ Embark on therapeutic quests across UGM Campus
                </p>
              </div>

              {/* Inline Level Badge - Simplified */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FFCA40]/20 to-[#FFD700]/20 backdrop-blur-md border border-[#FFCA40]/50 rounded-full">
                <Zap className="w-5 h-5 text-[#FFCA40] fill-[#FFCA40]" />
                <span className="text-lg font-black text-[#FFCA40]">
                  Level {playerLevel}
                </span>
                <span className="text-sm font-bold text-white">Adventurer</span>
                <Trophy className="w-5 h-5 text-[#FFCA40] fill-[#FFCA40]" />
              </div>

              {/* CTA Button - Simplified */}
              <div>
                <Link href="/carequest/game" className="group inline-block">
                  <div className="relative px-10 py-4 bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40] text-[#001D58] text-xl md:text-2xl font-black rounded-xl shadow-xl border-2 border-[#FFE680] hover:shadow-2xl hover:scale-105 transition-all duration-200">
                    <span className="flex items-center gap-3">
                      <Sword className="w-6 h-6" />
                      BEGIN YOUR QUEST
                      <Zap className="w-6 h-6 fill-current" />
                    </span>
                  </div>
                </Link>
                
                {/* Tutorial hint */}
                <p className="text-sm text-gray-400 mt-3">
                  ✨ Complete quests • Earn XP • Level up your mental wellness
                </p>
              </div>
            </div>

            {/* Right Column - Hero Character - Simplified */}
            <div className="relative flex items-center justify-center lg:justify-end">
              <div className="relative w-72 h-72 md:w-96 md:h-96 lg:w-[450px] lg:h-[450px]">
                {/* Subtle glow background - No animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#FFCA40]/30 via-[#FFD700]/30 to-[#B8A4FF]/30 rounded-full blur-3xl opacity-60" />
                
                {/* Character display */}
                <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-[#FFCA40]/70 shadow-2xl">
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#001D58]/90 to-black/90">
                    <Image
                      src="/carequest-logo.png"
                      alt="CareQuest Hero"
                      width={250}
                      height={250}
                      className="object-contain drop-shadow-2xl"
                      priority
                    />
                  </div>
                </div>

                {/* Static decorative elements */}
                <div className="absolute -left-12 top-1/4 hidden lg:block opacity-70">
                  <Sword className="w-16 h-16 text-[#FFCA40] drop-shadow-xl" />
                </div>
                <div className="absolute -right-12 bottom-1/4 hidden lg:block opacity-70">
                  <Shield className="w-16 h-16 text-[#B8A4FF] drop-shadow-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simple scroll indicator - No animation */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 text-white/40 text-center">
          <span className="text-xs font-semibold tracking-wider block mb-1">SCROLL DOWN</span>
          <div className="w-5 h-8 border-2 border-white/30 rounded-full mx-auto flex items-start justify-center p-1">
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </div>
        </div>
      </section>

      {/* Simplified Stats Dashboard - Seamless Transition */}
      {(joy > 0 || care > 0 || harmony > 0) && (
        <section className="container mx-auto px-6 pb-12 relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] to-[#FFD700] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#FFCA40] fill-[#FFCA40]" />
                  Your Progress
                </h3>
                
                {/* Compact level ring */}
                <div className="relative">
                  <ProgressRing
                    progress={levelProgress}
                    size={50}
                    strokeWidth={5}
                    color="gold"
                    showPercentage={false}
                  >
                    <div className="text-center">
                      <div className="text-base font-black text-[#FFCA40]">{playerLevel}</div>
                    </div>
                  </ProgressRing>
                </div>
              </div>

              {/* Compact stat bars */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'JOY', value: joy, max: 1000, icon: 'joy', color: 'pink' },
                  { label: 'CARE', value: care, max: 10000, icon: 'care', color: 'cyan' },
                  { label: 'Harmony', value: harmony % 100, max: 100, icon: 'harmony', color: 'purple' },
                ].map((stat) => (
                  <StatBar
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    maxValue={stat.max}
                    icon={stat.icon as 'joy' | 'care' | 'harmony'}
                    color={stat.color as 'pink' | 'cyan' | 'purple'}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Enhanced Quick Access Navigation - Epic Game Style */}
      <section className="container mx-auto px-6 mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Section Title */}
          <div className="text-center mb-12">
            <motion.h2 
              className="text-5xl md:text-6xl font-black mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-white">
                Explore the{' '}
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-ugm-gold via-yellow-300 to-ugm-gold">
                CareQuest World
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-300"
            >
              🗺️ Choose your path to mental wellness 🗺️
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Navigation Cards */}
            {[
              {
                title: 'Quest Map',
                description: 'Explore UGM campus and complete therapeutic quests',
                icon: Map,
                href: '/carequest/game',
                color: 'from-aurora-blue to-blue-600',
                glow: 'shadow-aurora-blue/50',
              },
              {
                title: 'Activities',
                description: 'Mini-games and mindfulness exercises',
                icon: Zap,
                href: '/carequest/activities',
                color: 'from-aurora-purple to-purple-600',
                glow: 'shadow-aurora-purple/50',
              },
              {
                title: 'Guild',
                description: 'Join study groups and support communities',
                icon: Users,
                href: '/carequest/guild',
                color: 'from-aurora-cyan to-cyan-600',
                glow: 'shadow-aurora-cyan/50',
              },
              {
                title: 'Market',
                description: 'Spend $CARE on rewards and power-ups',
                icon: ShoppingBag,
                href: '/carequest/market',
                color: 'from-ugm-gold to-yellow-600',
                glow: 'shadow-ugm-gold/50',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Link href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative overflow-hidden rounded-xl border-2 border-white/30 bg-gradient-to-br from-ugm-blue/80 to-ugm-blue-dark/80 backdrop-blur-sm p-6 cursor-pointer ${item.glow} shadow-xl hover:shadow-2xl transition-shadow group`}
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />

                    {/* Decorative background icon */}
                    <motion.div
                      className={`absolute -right-8 -bottom-8 opacity-10 group-hover:opacity-20 transition-opacity`}
                      whileHover={{ rotate: 15, scale: 1.2 }}
                    >
                      <item.icon className="w-32 h-32 text-white" />
                    </motion.div>

                    {/* Floating particles on hover */}
                    <div className="absolute inset-0 pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={`particle-${item.title}-${i}`}
                          className="absolute w-1 h-1 bg-white rounded-full"
                          style={{
                            left: `${20 + i * 15}%`,
                            bottom: '10%',
                          }}
                          animate={{
                            y: [0, -60, -80],
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>

                    <div className="relative z-10">
                      <motion.div
                        className={`inline-block p-4 rounded-xl bg-gradient-to-br ${item.color} mb-4 shadow-lg`}
                        whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <item.icon className="w-8 h-8 text-white" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-ugm-gold transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                        {item.description}
                      </p>

                      {/* "Enter" indicator on hover */}
                      <motion.div
                        className="mt-4 flex items-center gap-2 text-xs font-semibold text-ugm-gold opacity-0 group-hover:opacity-100 transition-opacity"
                        initial={{ x: -10 }}
                        whileHover={{ x: 0 }}
                      >
                        <span>ENTER</span>
                        <motion.div
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          →
                        </motion.div>
                      </motion.div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Featured Quests Preview */}
      <section className="container mx-auto px-6 mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Featured <span className="text-ugm-gold">Quests</span>
          </h2>
          <p className="text-center text-gray-300 mb-8 max-w-2xl mx-auto">
            Practice real therapeutic skills through typing combat and mindfulness exercises
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <QuestCard
              title="Morning Affirmations"
              description="Start your day by typing 5 positive affirmations to boost your JOY."
              xpReward={50}
              progress={75}
              difficulty="easy"
              category="Daily"
              onClick={() => {}}
            />
            <QuestCard
              title="Defeat Stress Monster"
              description="Type CBT reframes to combat stress and anxiety in a timed challenge."
              xpReward={150}
              progress={0}
              difficulty="medium"
              category="Combat"
              onClick={() => {}}
            />
            <QuestCard
              title="Gratitude Journal"
              description="Write down three things you're grateful for today."
              xpReward={100}
              progress={100}
              difficulty="easy"
              category="Wellness"
              completed
              onClick={() => {}}
            />
          </div>
        </motion.div>
      </section>

      {/* Achievement Showcase - NFT Badges from EDU Chain */}
      <section className="container mx-auto px-6 mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-12">
            <motion.h2 
              className="text-5xl md:text-6xl font-black mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-white">
                Unlock{' '}
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-ugm-gold via-yellow-300 to-ugm-gold">
                NFT Achievements
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-300 mb-2"
            >
              🏆 Earn blockchain-verified badges on EDU Chain 🏆
            </motion.p>
            <p className="text-sm text-gray-400">
              Complete quests and milestones to unlock exclusive NFT badges
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                tokenId: 1,
                image: '/nft-asset/let_there_be_badge.jpeg',
                title: 'Let There Be Badge',
                description: 'First journal entry or chat',
                rarity: 'Common',
                color: 'from-gray-400 to-gray-600',
                unlocked: true,
              },
              {
                tokenId: 2,
                image: '/nft-asset/triple_threat_of_thoughts.jpeg',
                title: 'Triple Threat of Thoughts',
                description: '3 days of activity',
                rarity: 'Uncommon',
                color: 'from-green-500 to-emerald-500',
                unlocked: true,
              },
              {
                tokenId: 3,
                image: '/nft-asset/seven_days_a_week.jpeg',
                title: 'Seven Days a Week',
                description: '7 consecutive days streak',
                rarity: 'Rare',
                color: 'from-blue-500 to-cyan-500',
                unlocked: true,
              },
              {
                tokenId: 4,
                image: '/nft-asset/two_weeks_notice_you_gave_to_negativity.jpeg',
                title: 'Two Weeks Notice',
                description: '14-day activity streak',
                rarity: 'Epic',
                color: 'from-purple-500 to-pink-500',
                unlocked: false,
              },
              {
                tokenId: 5,
                image: '/nft-asset/full_moon_positivity.jpeg',
                title: 'Full Moon Positivity',
                description: '30 days of wellness',
                rarity: 'Legendary',
                color: 'from-yellow-500 to-orange-500',
                unlocked: false,
              },
              {
                tokenId: 6,
                image: '/nft-asset/quarter_century_of_journaling.jpeg',
                title: 'Quarter Century',
                description: '25 journal entries',
                rarity: 'Legendary',
                color: 'from-ugm-gold to-yellow-400',
                unlocked: false,
              },
              {
                tokenId: 7,
                image: '/nft-asset/unleash_the_words.jpeg',
                title: 'Unleash the Words',
                description: 'Complete journal milestone',
                rarity: 'Rare',
                color: 'from-indigo-500 to-purple-500',
                unlocked: false,
              },
              {
                tokenId: 8,
                image: '/nft-asset/besties.jpeg',
                title: 'Besties',
                description: 'Join a support guild',
                rarity: 'Rare',
                color: 'from-pink-500 to-rose-500',
                unlocked: false,
              },
            ].map((badge, index) => (
              <motion.div
                key={badge.title}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -10 }}
                className="group relative"
              >
                {/* Glow effect */}
                <motion.div
                  className={`absolute -inset-1 bg-gradient-to-r ${badge.color} rounded-2xl blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-300`}
                  animate={{
                    opacity: [0, 0.3, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: index * 0.5,
                  }}
                />

                {/* Badge Card */}
                <div className="relative bg-gradient-to-br from-ugm-blue/90 to-ugm-blue-dark/90 backdrop-blur-sm rounded-2xl border-2 border-white/20 overflow-hidden shadow-xl group-hover:shadow-2xl group-hover:border-white/40 transition-all">
                  {/* NFT Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <Image
                      src={badge.image}
                      alt={badge.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    
                    {/* Rarity badge */}
                    <div className={`absolute top-3 right-3 px-3 py-1 bg-gradient-to-r ${badge.color} rounded-full text-xs font-bold text-white shadow-lg backdrop-blur-sm`}>
                      {badge.rarity}
                    </div>

                    {/* Token ID badge */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-xs font-mono text-gray-300 border border-white/20">
                      #{badge.tokenId}
                    </div>

                    {/* Locked overlay */}
                    {!badge.unlocked && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 0.9 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center"
                      >
                        <div className="text-center">
                          <motion.div
                            animate={{ rotate: [0, -5, 5, 0] }}
                            transition={{ duration: 0.5 }}
                          >
                            🔒
                          </motion.div>
                          <p className="text-white text-sm font-semibold mt-2">Locked</p>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Badge Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-ugm-gold transition-colors">
                      {badge.title}
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {badge.description}
                    </p>

                    {/* Blockchain indicator */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-ugm-gold">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        >
                          ⛓️
                        </motion.div>
                        <span className="font-semibold">EDU Chain</span>
                      </div>
                      {badge.unlocked && (
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <span>✓</span>
                          <span className="font-semibold">Earned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Call to action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center mt-12"
          >
            <Link href="/carequest/activities">
              <motion.button
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-8 py-4 bg-gradient-to-r from-ugm-gold to-yellow-400 text-ugm-blue-dark font-bold rounded-xl shadow-lg hover:shadow-2xl hover:shadow-ugm-gold/50 transition-all overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-200%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Start Earning Badges
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    →
                  </motion.div>
                </span>
              </motion.button>
            </Link>
            <p className="text-sm text-gray-400 mt-4">
              All badges are minted as NFTs on EDU Chain • Fully owned by you • Tradeable
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-6 mb-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl border-2 border-white/20 p-8 shadow-2xl">
            <h2 className="text-4xl font-bold text-white text-center mb-8">
              How <span className="text-ugm-gold">CareQuest</span> Works
            </h2>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-aurora-blue to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                  1
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Practice Skills</h3>
                <p className="text-gray-300 text-sm">
                  Type therapeutic sentences with accuracy to defeat anxiety monsters
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-aurora-purple to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                  2
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Earn Rewards</h3>
                <p className="text-gray-300 text-sm">
                  Collect JOY and $CARE tokens to level up and unlock new features
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-ugm-gold to-yellow-600 flex items-center justify-center text-2xl font-bold text-white">
                  3
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Real Benefits</h3>
                <p className="text-gray-300 text-sm">
                  Spend $CARE on real-world rewards at UGM campus locations
                </p>
              </div>
            </div>

            <div className="bg-aurora-blue/10 border border-aurora-blue/30 rounded-xl p-6">
              <h4 className="text-lg font-bold text-aurora-blue mb-3">Why Gamification Works</h4>
              <p className="text-gray-300 leading-relaxed">
                Research shows that gamification increases engagement with mental health interventions by 40-60%. 
                By making therapeutic practice <span className="font-semibold text-white">fun and rewarding</span>, 
                students are more likely to build consistent habits that improve wellbeing.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-6 py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-5xl font-bold text-white mb-4">
            Ready to Begin Your <span className="text-ugm-gold">Adventure</span>?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Practice mental health skills, defeat anxiety monsters, and earn real rewards
          </p>
          
          <Link href="/carequest/game">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block px-16 py-6 bg-gradient-to-r from-ugm-gold to-yellow-500 text-ugm-blue-dark text-2xl font-black rounded-xl shadow-2xl shadow-ugm-gold/50"
            >
              <span className="flex items-center gap-3">
                <Sword className="w-8 h-8" />
                Start Your Quest
                <Star className="w-8 h-8 fill-current" />
              </span>
            </motion.div>
          </Link>

          <p className="text-sm text-gray-400 mt-6">
            Part of the UGM-AICare mental health ecosystem
          </p>
        </motion.div>
      </section>
    </div>
  );
}
