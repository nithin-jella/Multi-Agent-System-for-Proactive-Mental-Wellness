"use client";

import { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import Link from 'next/link';
import ParticleBackground from '@/components/ui/ParticleBackground';
import { 
  FiTrendingUp, 
  FiShield, 
  FiUsers,
  FiGift,
  FiZap,
  FiLock,
  FiPieChart,
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiChevronRight,
  FiCheck,
  FiArrowRight,
  FaShoppingCart, 
  FaTicketAlt, 
  FaStar, 
  FaGraduationCap,
  FaHeart,
  FaHandHoldingHeart,
  FaCoins
} from '@/icons';

// ============ HERO SECTION ============
const HeroSection = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A]">
      {/* Particle Background - Consistent with design system */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground 
          count={60} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={8} 
          speed={0.8} 
        />
      </div>

      {/* Animated Mesh Gradient Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(255, 202, 64, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(106, 152, 240, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 80%, rgba(255, 202, 64, 0.2) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(255, 202, 64, 0.2) 0%, transparent 50%)',
            ]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
      
      <motion.div 
        style={{ y, opacity }}
        className="relative z-10 text-center px-6 max-w-6xl mx-auto"
      >
        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="mb-8 flex justify-center"
        >
          <div className="w-32 h-32 bg-gradient-to-br from-[#FFCA40] to-[#FFB700] rounded-full flex items-center justify-center shadow-2xl shadow-[#FFCA40]/50">
            <FaCoins className="text-[#001D58] text-6xl" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl md:text-7xl font-bold text-[#FFCA40] mb-6"
        >
          $CARE Token
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-xl md:text-2xl text-white/90 mb-4"
        >
          Empowering Mental Health Through Blockchain
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-md md:text-lg text-white/70 mb-12 max-w-3xl mx-auto"
        >
          The utility token powering UGM-AICare on SOMNIA blockchain. 
          Reward wellness activities, access real-world services, and join a community-driven mental health revolution.
        </motion.p>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12"
        >
          {[
            { value: "1B", label: "Max Supply" },
            { value: "ERC-20", label: "Standard" },
            { value: "SOMNIA", label: "Blockchain" },
            { value: "1M+ TPS", label: "Performance" }
          ].map((stat, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <div className="text-3xl font-bold text-[#FFCA40]">{stat.value}</div>
              <div className="text-sm text-white/70">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a
            href="#tokenomics"
            className="px-8 py-4 bg-[#FFCA40] text-[#001D58] rounded-full font-semibold hover:bg-yellow-500 transition-all hover:scale-105 flex items-center justify-center gap-2"
          >
            Explore Tokenomics
            <FiChevronRight />
          </a>
          <a
            href="#whitepaper"
            className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-all backdrop-blur-md border border-white/20 flex items-center justify-center gap-2"
          >
            <FiFileText />
            Read Whitepaper
          </a>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, repeat: Infinity, duration: 1.5 }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1.5 h-1.5 bg-[#FFCA40] rounded-full mt-2"
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

// ============ SHARIA COMPLIANCE SECTION ============
const ShariaComplianceSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-[#002A7A] via-[#001D58] to-[#00308F] relative overflow-hidden">
      {/* Particle Background for consistency */}
      <div className="absolute inset-0 z-0 opacity-30">
        <ParticleBackground 
          count={40} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={6} 
          speed={0.5} 
        />
      </div>

      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#FFCA40]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#FFCA40]/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/10 rounded-full border border-[#FFCA40]/30 mb-4">
            <FiShield className="text-[#FFCA40]" />
            <span className="text-[#FFCA40] text-sm font-semibold">SHARIA-COMPLIANT</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40] bg-clip-text text-transparent">
              Halal Staking & Ethical Finance
            </span>
          </h2>
          <p className="text-white/80 text-lg max-w-3xl mx-auto">
            $CARE staking follows Islamic finance principles with <strong>no interest (riba)</strong>, 
            using Mudarabah profit-sharing partnerships for transparent and ethical rewards
          </p>
        </motion.div>

        {/* Compliance Badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto"
        >
          {[
            {
              icon: <FiShield className="text-5xl" />,
              title: "Halal Certified",
              description: "Reviewed by Shariah scholars for compliance",
              color: "from-green-500 to-emerald-600"
            },
            {
              icon: <FiCheck className="text-5xl" />,
              title: "Riba-Free",
              description: "No interest - only profit-sharing from real revenue",
              color: "from-[#FFCA40] to-yellow-500"
            },
            {
              icon: <FaHeart className="text-5xl" />,
              title: "Ethical Finance",
              description: "Mudarabah partnership model with risk-sharing",
              color: "from-blue-500 to-cyan-600"
            }
          ].map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-[#FFCA40]/20 hover:border-[#FFCA40]/50 transition-all group hover:scale-105"
            >
              <div className={`w-20 h-20 bg-gradient-to-br ${badge.color} rounded-full flex items-center justify-center mx-auto mb-4 text-white group-hover:rotate-6 transition-transform shadow-2xl shadow-[#FFCA40]/20`}>
                {badge.icon}
              </div>
              <h3 className="text-2xl font-bold text-white text-center mb-3">{badge.title}</h3>
              <p className="text-white/70 text-center">{badge.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-white/5 backdrop-blur-md rounded-3xl p-10 border border-[#FFCA40]/10 max-w-5xl mx-auto"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-[#FFCA40] to-yellow-500 rounded-lg flex items-center justify-center">
              <FiZap className="text-white text-xl" />
            </div>
            <h3 className="text-3xl font-bold text-[#FFCA40]">How Mudarabah Works</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">1</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Stakers Provide Capital</h4>
                  <p className="text-white/70 text-sm">You stake CARE tokens as capital (Rabbul Mal) in the partnership</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">2</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Platform Manages Operations</h4>
                  <p className="text-white/70 text-sm">UGM-AICare manages staking operations as the Mudarib (entrepreneur)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">3</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Profits from Real Revenue</h4>
                  <p className="text-white/70 text-sm">Returns come from actual platform fees, subscriptions, and services</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">4</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Profit-Sharing Distribution</h4>
                  <p className="text-white/70 text-sm">Profits split 60-90% to stakers based on tier (Bronze/Silver/Gold/Platinum)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">5</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Fair Risk-Sharing</h4>
                  <p className="text-white/70 text-sm">No guaranteed returns - both parties share risk and reward equally</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#FFCA40]/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-[#FFCA40] font-bold">6</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Transparent On-Chain</h4>
                  <p className="text-white/70 text-sm">All profits verified by multi-sig oracle and recorded on blockchain</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Differences */}
          <div className="mt-8 pt-8 border-t border-[#FFCA40]/20">
            <h4 className="text-xl font-bold text-[#FFCA40] mb-4 flex items-center gap-2">
              <FiArrowRight />
              Key Differences from Traditional DeFi
            </h4>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-black/20 rounded-lg p-4 border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-red-500 text-xl">❌</span>
                  <span className="text-white/60 font-semibold">Traditional Staking</span>
                </div>
                <ul className="text-white/50 text-sm space-y-1">
                  <li>• Fixed APY (interest-based)</li>
                  <li>• Minted rewards = inflation</li>
                  <li>• Guaranteed returns = riba</li>
                </ul>
              </div>

              <div className="bg-black/20 rounded-lg p-4 border border-green-500/30 md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-500 text-xl">✅</span>
                  <span className="text-white font-semibold">CARE Halal Staking</span>
                </div>
                <ul className="text-white/70 text-sm space-y-1">
                  <li>• Variable profit-sharing (60-90% based on tier)</li>
                  <li>• Real platform revenue = sustainable</li>
                  <li>• Risk-shared partnership = halal</li>
                  <li>• Monthly transparent settlement via oracle</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Staking Tiers Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-8">Participation-Based Tiers</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { tier: "Bronze", min: "1K", share: "60%", activities: "0", color: "from-amber-600 to-amber-800" },
              { tier: "Silver", min: "10K", share: "70%", activities: "5", color: "from-gray-400 to-gray-600" },
              { tier: "Gold", min: "50K", share: "80%", activities: "15", color: "from-yellow-400 to-yellow-600" },
              { tier: "Platinum", min: "100K", share: "90%", activities: "30", color: "from-purple-400 to-purple-600" }
            ].map((tier, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.9 + index * 0.1 }}
                className={`bg-gradient-to-br ${tier.color} rounded-xl p-4 text-white shadow-lg hover:scale-105 transition-transform`}
              >
                <div className="font-bold text-lg mb-2">{tier.tier}</div>
                <div className="text-xs opacity-90 space-y-1">
                  <div>Min: {tier.min} CARE</div>
                  <div>Share: {tier.share}</div>
                  <div>Activities: {tier.activities}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-white/60 text-sm mt-6 max-w-2xl mx-auto">
            Higher tiers earn greater profit shares and unlock fee waivers + governance voting rights
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center mt-12"
        >
          <Link
            href="/docs/SHARIA_COMPLIANT_STAKING_DESIGN.md"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#FFCA40] to-yellow-500 text-[#001D58] rounded-full font-bold hover:scale-105 transition-all shadow-2xl shadow-[#FFCA40]/50"
          >
            <FiFileText />
            Read Full Sharia Compliance Design
            <FiExternalLink />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ============ TOKENOMICS SECTION ============
const TokenomicsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const distribution = [
    { name: "Community", percentage: 35, color: "bg-blue-500", amount: "350M", description: "Airdrops, Staking, Governance, Events" },
    { name: "Wellness", percentage: 20, color: "bg-green-500", amount: "200M", description: "CBT rewards, Daily check-ins, Milestones" },
    { name: "Team", percentage: 13, color: "bg-purple-500", amount: "130M", description: "4-year vesting with 12-month cliff" },
    { name: "Partners", percentage: 10, color: "bg-pink-500", amount: "100M", description: "Merchants & Clinical partners (2-year vesting)" },
    { name: "Treasury", percentage: 10, color: "bg-orange-500", amount: "100M", description: "Operations & Buyback fund" },
    { name: "Liquidity", percentage: 8, color: "bg-cyan-500", amount: "80M", description: "DEX pools (24-month lock)" },
    { name: "Grants", percentage: 4, color: "bg-yellow-500", amount: "40M", description: "Research & Developer ecosystem" },
  ];

  return (
    <section id="tokenomics" ref={ref} className="py-24 bg-gradient-to-b from-[#002A7A] via-[#001D58] to-[#00308F] relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ParticleBackground 
          count={40} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={6} 
          speed={0.5} 
        />
      </div>
      
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/10 rounded-full border border-[#FFCA40]/30 mb-4">
            <FiPieChart className="text-[#FFCA40]" />
            <span className="text-[#FFCA40] text-sm font-semibold">TOKENOMICS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Distribution Model
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Community-first approach with 55% allocated to users and mental health rewards
          </p>
        </motion.div>

        {/* Distribution Chart Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-16"
        >
          <div className="max-w-4xl mx-auto">
            {/* Horizontal Bar Chart */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <div className="space-y-4">
                {distribution.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -50 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.6, delay: 0.1 * index }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${item.color}`}></div>
                        <span className="text-white font-semibold">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[#FFCA40] font-bold text-lg">{item.percentage}%</span>
                        <span className="text-white/50 text-sm ml-2">({item.amount})</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={isInView ? { width: `${item.percentage}%` } : {}}
                        transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: "easeOut" }}
                        className={`h-full ${item.color} rounded-full`}
                      />
                    </div>
                    <p className="text-white/60 text-sm mt-1 ml-7">{item.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            {
              icon: <FiTrendingUp />,
              title: "Deflationary Design",
              description: "100% redemption burns + treasury buyback & burn program",
              color: "from-green-500 to-emerald-600"
            },
            {
              icon: <FiLock />,
              title: "Anti-Dump Protection",
              description: "4-year team vesting, 2-year liquidity lock ensures long-term commitment",
              color: "from-blue-500 to-cyan-600"
            },
            {
              icon: <FiZap />,
              title: "Halving Rewards",
              description: "Bitcoin-inspired halving schedule controls inflation over time",
              color: "from-purple-500 to-pink-600"
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 hover:border-[#FFCA40]/50 transition-all group"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-lg flex items-center justify-center mb-4 text-white text-2xl group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-white/70">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center mt-12"
        >
          <Link
            href="/docs/CARE_TOKEN/TOKENOMICS_FINAL.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCA40]/10 text-[#FFCA40] rounded-full border border-[#FFCA40]/30 hover:bg-[#FFCA40]/20 transition-all"
          >
            View Full Tokenomics
            <FiExternalLink />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

// ============ USE CASES SECTION WITH CAROUSEL ============
const UseCasesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState<'earn' | 'spend' | 'stake' | 'govern'>('earn');

  const tabs = [
    { id: 'earn', label: 'Earn CARE', icon: <FiGift /> },
    { id: 'spend', label: 'Spend CARE', icon: <FaShoppingCart /> },
    { id: 'stake', label: 'Stake & Grow', icon: <FiTrendingUp /> },
    { id: 'govern', label: 'Governance', icon: <FiUsers /> },
  ] as const;

  const content = {
    earn: {
      title: "Earn CARE Tokens",
      description: "Get rewarded for taking care of your mental health",
      items: [
        { icon: <FaHeart />, title: "Daily Check-ins", reward: "10 CARE", description: "Complete your daily mental health check-in" },
        { icon: <FaGraduationCap />, title: "CBT Modules", reward: "50 CARE", description: "Finish cognitive behavioral therapy sessions" },
        { icon: <FaStar />, title: "Weekly Streaks", reward: "100 CARE", description: "Maintain 7-day consistent engagement" },
        { icon: <FiUsers />, title: "Help Peers", reward: "20 CARE", description: "Share support and get upvoted by community" },
        { icon: <FaHandHoldingHeart />, title: "Monthly Goals", reward: "500 CARE", description: "Achieve 30-day mental wellness milestones" },
        { icon: <FiZap />, title: "Referrals", reward: "200 CARE", description: "Invite friends to join the platform" },
      ],
      gradient: "from-green-500 to-emerald-600"
    },
    spend: {
      title: "Real-World Utility",
      description: "Use CARE tokens for actual goods and services",
      items: [
        { icon: <FaShoppingCart />, title: "Food Vouchers", price: "200 CARE", description: "Grab Food, GoFood (50,000 IDR value)" },
        { icon: <FaTicketAlt />, title: "Event Tickets", price: "800 CARE", description: "Mental health workshops, seminars, movies" },
        { icon: <FiShield />, title: "Premium Features", price: "1,000 CARE", description: "Advanced AI coaching, personalized plans" },
        { icon: <FaGraduationCap />, title: "Counseling Sessions", price: "1,500 CARE", description: "Priority access to professional therapists" },
        { icon: <FaShoppingCart />, title: "UGM Merchandise", price: "500-2,000 CARE", description: "Official merch and mental health resources" },
        { icon: <FiZap />, title: "Transportation", price: "100 CARE", description: "Gojek/Grab rides (20,000 IDR value)" },
      ],
      gradient: "from-blue-500 to-cyan-600"
    },
    stake: {
      title: "Stake & Earn",
      description: "Lock your tokens for rewards and premium benefits",
      items: [
        { icon: <FiLock />, title: "30-Day Lock", reward: "5% APY", description: "Short-term staking with flexible withdrawal" },
        { icon: <FiLock />, title: "90-Day Lock", reward: "12% APY", description: "Quarterly commitment with better returns" },
        { icon: <FiLock />, title: "180-Day Lock", reward: "20% APY", description: "Bi-annual staking for serious holders" },
        { icon: <FiLock />, title: "365-Day Lock", reward: "35% APY", description: "Maximum rewards + governance voting rights" },
        { icon: <FiTrendingUp />, title: "Compound Interest", reward: "Auto-Stake", description: "Automatically reinvest rewards" },
        { icon: <FiShield />, title: "Anti-Dump", reward: "Protected", description: "Helps stabilize token price long-term" },
      ],
      gradient: "from-purple-500 to-pink-600"
    },
    govern: {
      title: "Community Governance",
      description: "Shape the future of UGM-AICare platform",
      items: [
        { icon: <FiUsers />, title: "Proposal Rights", requirement: "1,000 CARE", description: "Submit new platform features or changes" },
        { icon: <FiCheck />, title: "Voting Power", requirement: "365-day stake", description: "Vote on community proposals and decisions" },
        { icon: <FiPieChart />, title: "Treasury Control", requirement: "DAO member", description: "Influence allocation of community funds" },
        { icon: <FiZap />, title: "Feature Requests", requirement: "50 CARE vote", description: "Participate in platform development priorities" },
        { icon: <FaGraduationCap />, title: "Grant Decisions", requirement: "Staked holder", description: "Vote on research and developer grants" },
        { icon: <FiShield />, title: "Transparent", requirement: "Public ledger", description: "All decisions recorded on blockchain" },
      ],
      gradient: "from-orange-500 to-red-600"
    }
  };

  const activeContent = content[activeTab];

  return (
    <section id="usecases" ref={ref} className="py-24 bg-gradient-to-b from-[#00308F] via-[#002A7A] to-[#001D58] relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ParticleBackground 
          count={35} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={6} 
          speed={0.5} 
        />
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/10 rounded-full border border-[#FFCA40]/30 mb-4">
            <FiZap className="text-[#FFCA40]" />
            <span className="text-[#FFCA40] text-sm font-semibold">TOKEN UTILITY</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            How to Use $CARE
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Real utility token with multiple use cases for mental health and wellness
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-full font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[#FFCA40] text-[#001D58] shadow-lg shadow-[#FFCA40]/30'
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-white mb-2">{activeContent.title}</h3>
            <p className="text-white/70">{activeContent.description}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeContent.items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 hover:border-[#FFCA40]/50 transition-all group hover:scale-105"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${activeContent.gradient} rounded-lg flex items-center justify-center mb-4 text-white text-2xl group-hover:rotate-12 transition-transform`}>
                  {item.icon}
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{item.title}</h4>
                <div className="text-[#FFCA40] font-semibold mb-2">
                  {'reward' in item ? item.reward : 'price' in item ? item.price : item.requirement}
                </div>
                <p className="text-white/60 text-sm">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============ WHITEPAPER SECTION ============
const WhitepaperSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const documents = [
    {
      title: "Complete Tokenomics",
      description: "Full specification with distribution, vesting, and economic model",
      file: "TOKENOMICS_FINAL.md",
      icon: <FiPieChart />,
      color: "from-blue-500 to-cyan-600",
      pages: "50+ pages"
    },
    {
      title: "Distribution Summary",
      description: "Quick visual reference with charts and key metrics",
      file: "DISTRIBUTION_SUMMARY.md",
      icon: <FiTrendingUp />,
      color: "from-green-500 to-emerald-600",
      pages: "10 pages"
    },
    {
      title: "Vesting Schedules",
      description: "Detailed formulas, timelines, and smart contract specs",
      file: "VESTING_SCHEDULES.md",
      icon: <FiLock />,
      color: "from-purple-500 to-pink-600",
      pages: "30+ pages"
    },
  ];

  return (
    <section id="whitepaper" ref={ref} className="py-24 bg-gradient-to-b from-[#001D58] via-[#002A7A] to-[#00308F] relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ParticleBackground 
          count={40} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={6} 
          speed={0.5} 
        />
      </div>
      
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFCA40]/10 rounded-full border border-[#FFCA40]/30 mb-4">
            <FiFileText className="text-[#FFCA40]" />
            <span className="text-[#FFCA40] text-sm font-semibold">DOCUMENTATION</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Whitepaper & Resources
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Complete documentation for investors, developers, and community members
          </p>
        </motion.div>

        {/* Documents Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 mb-12"
        >
          {documents.map((doc, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
              className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 hover:border-[#FFCA40]/50 transition-all group"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${doc.color} rounded-xl flex items-center justify-center mb-6 text-white text-3xl group-hover:scale-110 transition-transform`}>
                {doc.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{doc.title}</h3>
              <p className="text-white/60 mb-4">{doc.description}</p>
              <div className="text-[#FFCA40] text-sm font-semibold mb-6">{doc.pages}</div>
              <a
                href={`https://github.com/gigahidjrikaaa/UGM-AICare/blob/main/docs/CARE_TOKEN/${doc.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFCA40] text-[#001D58] rounded-full font-semibold hover:bg-yellow-500 transition-all w-full justify-center"
              >
                <FiDownload />
                View Document
              </a>
            </motion.div>
          ))}
        </motion.div>

        {/* Key Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-[#FFCA40]/10 to-yellow-600/10 rounded-2xl p-8 border border-[#FFCA40]/30"
        >
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Key Highlights</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Total Supply", value: "1 Billion CARE", icon: <FaCoins /> },
              { label: "TGE Unlock", value: "12.5% (125M)", icon: <FiLock /> },
              { label: "Community First", value: "55% to Users", icon: <FiUsers /> },
              { label: "Team Vesting", value: "4 Years + Cliff", icon: <FiShield /> },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="text-[#FFCA40] text-3xl mb-2 flex justify-center">{item.icon}</div>
                <div className="text-2xl font-bold text-white mb-1">{item.value}</div>
                <div className="text-white/60 text-sm">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Additional Resources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <h4 className="text-xl font-bold text-white mb-6">More Resources</h4>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://github.com/gigahidjrikaaa/UGM-AICare"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/5 text-white rounded-full hover:bg-white/10 transition-all border border-white/10 flex items-center gap-2"
            >
              <FiExternalLink />
              GitHub Repository
            </a>
            <a
              href="https://shannon-explorer.somnia.network"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/5 text-white rounded-full hover:bg-white/10 transition-all border border-white/10 flex items-center gap-2"
            >
              <FiExternalLink />
              SOMNIA Explorer
            </a>
            <a
              href="https://docs.somnia.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/5 text-white rounded-full hover:bg-white/10 transition-all border border-white/10 flex items-center gap-2"
            >
              <FiExternalLink />
              SOMNIA Docs
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ============ FAQ SECTION ============
const FAQSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "What is $CARE token?",
      a: "$CARE is a utility token built on SOMNIA blockchain that powers the UGM-AICare mental health platform. It rewards users for wellness activities and can be used for real-world goods and services."
    },
    {
      q: "How do I earn $CARE tokens?",
      a: "You can earn CARE by completing daily check-ins (10 CARE), finishing CBT modules (50 CARE), maintaining weekly streaks (100 CARE), helping peers (20 CARE), and achieving monthly goals (500 CARE)."
    },
    {
      q: "What can I buy with $CARE?",
      a: "Use CARE for food vouchers (Grab/GoFood), event tickets, premium AI coaching, counseling sessions, UGM merchandise, and transportation. Prices range from 100-2,000 CARE depending on the item."
    },
    {
      q: "Is there a maximum supply?",
      a: "Yes, the maximum supply is capped at 1 billion CARE tokens. This hard cap prevents inflation and helps maintain token value over time."
    },
    {
      q: "How does staking work?",
      a: "Lock your CARE tokens for 30, 90, 180, or 365 days to earn APY rewards ranging from 5% to 35%. Longer lock periods provide higher returns and 365-day stakers gain governance voting rights."
    },
    {
      q: "When does the team unlock their tokens?",
      a: "Team tokens are subject to 4-year linear vesting with a 12-month cliff. This means 0% unlock in Year 1, then gradual monthly unlocks over the next 3 years."
    },
    {
      q: "Is $CARE deflationary?",
      a: "Yes! 100% of CARE spent on redemptions is burned. Additionally, the treasury uses 25% of revenue for buyback & burn programs. Combined with staking, this reduces circulating supply over time."
    },
    {
      q: "How can I participate in governance?",
      a: "Stake CARE for 365 days to gain voting rights. You can vote on platform features, treasury allocation, and grant decisions. Proposing new initiatives requires holding 1,000 CARE."
    }
  ];

  return (
    <section ref={ref} className="py-24 bg-gradient-to-b from-[#00308F] to-[#001D58]">
      <div className="container mx-auto px-6 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-white/70 text-lg">
            Everything you need to know about $CARE token
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-all"
              >
                <span className="text-white font-semibold pr-4">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-[#FFCA40] text-xl flex-shrink-0"
                >
                  <FiChevronRight className="rotate-90" />
                </motion.div>
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 text-white/70">
                  {faq.a}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============ CTA SECTION ============
const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="py-24 bg-gradient-to-br from-[#001D58] via-[#00308F] to-[#002A7A] relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 z-0 opacity-30">
        <ParticleBackground 
          count={40} 
          colors={["#FFCA40", "#6A98F0", "#ffffff"]} 
          minSize={2} 
          maxSize={6} 
          speed={0.6} 
        />
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="container mx-auto px-6 text-center relative z-10"
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Join the Revolution?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Start earning $CARE tokens today by taking care of your mental health
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-[#FFCA40] text-[#001D58] rounded-full font-bold text-lg hover:bg-yellow-500 transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-xl shadow-[#FFCA40]/30"
            >
              Get Started Now
              <FiArrowRight />
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-white/10 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-md border border-white/20 flex items-center justify-center gap-2"
            >
              View Dashboard
            </Link>
          </div>
          
          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-white/60">
            <div className="flex items-center gap-2">
              <FiShield className="text-[#FFCA40]" />
              <span>Audited Smart Contract</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUsers className="text-[#FFCA40]" />
              <span>Community Governed</span>
            </div>
            <div className="flex items-center gap-2">
              <FiLock className="text-[#FFCA40]" />
              <span>Secure & Transparent</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

// ============ MAIN PAGE COMPONENT ============
export default function CareTokenPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#001D58] via-[#00308F] to-[#002A7A] pt-24">
      <HeroSection />
      <ShariaComplianceSection />
      <TokenomicsSection />
      <UseCasesSection />
      <WhitepaperSection />
      <FAQSection />
      <CTASection />
    </main>
  );
}
