'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Wallet, Sparkles, Tag, Package, Gift } from 'lucide-react';
import ParticleBackground from '@/components/ui/ParticleBackground';

/**
 * Block Market Page - RPG Shop Redesign
 * 
 * Features:
 * - RPG shop interface with item rarity
 * - Animated purchase effects
 * - Inventory-style grid
 * - Wallet display with $CARE token animations
 */

interface MarketItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'voucher' | 'merch' | 'powerup';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  imageUrl?: string;
  icon: string;
  stock: number;
}

const rarityConfig = {
  common: {
    gradient: 'from-gray-400 to-gray-600',
    glow: 'shadow-gray-400/30',
    border: 'border-gray-400/50',
    text: 'text-gray-300',
    bg: 'bg-gray-500/20',
  },
  rare: {
    gradient: 'from-[#50E3C2] to-[#3BA99C]',
    glow: 'shadow-[#50E3C2]/50',
    border: 'border-[#50E3C2]/70',
    text: 'text-[#50E3C2]',
    bg: 'bg-[#50E3C2]/20',
  },
  epic: {
    gradient: 'from-[#B8A4FF] to-[#9B7FE5]',
    glow: 'shadow-[#B8A4FF]/50',
    border: 'border-[#B8A4FF]/70',
    text: 'text-[#B8A4FF]',
    bg: 'bg-[#B8A4FF]/20',
  },
  legendary: {
    gradient: 'from-[#FFCA40] via-[#FFD700] to-[#FFCA40]',
    glow: 'shadow-[#FFCA40]/60',
    border: 'border-[#FFCA40]',
    text: 'text-[#FFCA40]',
    bg: 'bg-[#FFCA40]/20',
  },
};

const categories = [
  { id: 'all', label: 'All Items', icon: Package },
  { id: 'voucher', label: 'Vouchers', icon: Gift },
  { id: 'merch', label: 'Merchandise', icon: Tag },
  { id: 'powerup', label: 'Power-ups', icon: Sparkles },
];

export default function BlockMarketPage() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'voucher' | 'merch' | 'powerup'>('all');
  const [balance] = useState(1250);

  // TODO: Fetch from backend
  const mockItems: MarketItem[] = [
    {
      id: '1',
      name: 'Cafe Voucher',
      description: 'Redeem Rp 25.000 at selected cafes around UGM campus. Enjoy your favorite coffee!',
      price: 50,
      category: 'voucher',
      rarity: 'common',
      icon: '☕',
      stock: 100,
    },
    {
      id: '2',
      name: 'Bookstore Voucher',
      description: 'Rp 50.000 voucher for UGM bookstore. Get textbooks and supplies.',
      price: 100,
      category: 'voucher',
      rarity: 'rare',
      icon: '📚',
      stock: 50,
    },
    {
      id: '3',
      name: 'UGM T-Shirt',
      description: 'Official UGM-AICare branded t-shirt. Available in M, L, XL.',
      price: 200,
      category: 'merch',
      rarity: 'rare',
      icon: '👕',
      stock: 25,
    },
    {
      id: '4',
      name: 'UGM Tote Bag',
      description: 'Eco-friendly canvas tote bag with UGM logo. Stylish and sustainable.',
      price: 150,
      category: 'merch',
      rarity: 'common',
      icon: '👜',
      stock: 30,
    },
    {
      id: '5',
      name: 'XP Boost Potion',
      description: 'Double XP for 24 hours! Complete quests faster and level up quickly.',
      price: 300,
      category: 'powerup',
      rarity: 'epic',
      icon: '⚗️',
      stock: 15,
    },
    {
      id: '6',
      name: 'Legendary Quest Unlock',
      description: 'Unlock exclusive legendary-tier therapeutic quests with massive rewards.',
      price: 500,
      category: 'powerup',
      rarity: 'legendary',
      icon: '🔑',
      stock: 5,
    },
  ];

  const filteredItems = mockItems.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory
  );

  const handlePurchase = (item: MarketItem) => {
    if (balance >= item.price) {
      alert(`Purchasing ${item.name}... (Coming soon)`);
    } else {
      alert('Not enough $CARE tokens!');
    }
  };

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
            <ShoppingBag className="w-12 h-12 text-[#FFCA40]" />
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFCA40] via-[#FFD700] to-[#FFCA40]">
              Block Market
            </h1>
            <ShoppingBag className="w-12 h-12 text-[#FFCA40]" />
          </div>
          <p className="text-xl text-white/70">
            Trade Your $CARE Tokens for Real-World Rewards
          </p>
        </motion.div>

        {/* Wallet Balance */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-md rounded-2xl border-2 border-green-500/30 p-6 mb-8 shadow-2xl shadow-green-500/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="text-sm text-green-300 mb-1">Your $CARE Balance</div>
                <motion.div
                  className="text-5xl font-black text-green-400"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {balance} $CARE
                </motion.div>
              </div>
            </div>
            
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">500</div>
                <div className="text-sm text-gray-300">Total Spent</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-ugm-gold mb-1">12</div>
                <div className="text-sm text-gray-300">Items Owned</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex gap-3 flex-wrap">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              
              return (
                <motion.button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id as typeof activeCategory)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`
                    px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2
                    ${isActive
                      ? 'bg-gradient-to-r from-ugm-gold to-yellow-500 text-ugm-blue-dark shadow-lg shadow-ugm-gold/50'
                      : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border border-white/20'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {category.label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Items Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredItems.map((item, index) => {
            const rarity = rarityConfig[item.rarity];
            const canAfford = balance >= item.price;
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.03, y: -8 }}
                className={`relative overflow-hidden rounded-xl border-2 backdrop-blur-sm ${rarity.border} ${rarity.glow} shadow-xl`}
              >
                {/* Rarity glow animation */}
                {item.rarity === 'legendary' && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-ugm-gold/10 via-transparent to-ugm-gold/10"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  />
                )}

                {/* Item card content */}
                <div className={`relative bg-gradient-to-br from-ugm-blue/80 to-ugm-blue-dark/80 p-6`}>
                  {/* Rarity badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${rarity.bg} ${rarity.text} border ${rarity.border}`}>
                      {item.rarity}
                    </div>
                  </div>

                  {/* Item icon */}
                  <div className={`w-24 h-24 mx-auto mb-4 rounded-xl bg-gradient-to-br ${rarity.gradient} flex items-center justify-center text-5xl shadow-lg`}>
                    {item.icon}
                  </div>

                  {/* Item info */}
                  <h3 className="text-xl font-bold text-white mb-2 text-center">{item.name}</h3>
                  <p className="text-sm text-gray-300 mb-4 text-center min-h-12">{item.description}</p>

                  {/* Stock indicator */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">{item.stock} in stock</span>
                  </div>

                  {/* Price and purchase */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <Wallet className="w-5 h-5 text-green-400" />
                      <span className="text-3xl font-black text-green-400">{item.price}</span>
                      <span className="text-sm text-green-400 font-bold">$CARE</span>
                    </div>

                    <motion.button
                      onClick={() => handlePurchase(item)}
                      whileHover={canAfford ? { scale: 1.05 } : {}}
                      whileTap={canAfford ? { scale: 0.95 } : {}}
                      disabled={!canAfford}
                      className={`w-full py-3 rounded-xl font-bold transition-all ${
                        canAfford
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-green-500/50'
                          : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? '💰 Purchase' : '🔒 Not Enough $CARE'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Coming Soon Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-8 text-center backdrop-blur-md"
        >
          <div className="text-6xl mb-4">🚧</div>
          <h3 className="text-2xl font-bold text-yellow-400 mb-3">
            Marketplace Coming Soon
          </h3>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Purchase functionality is currently in development. Soon you&apos;ll be able to redeem your $CARE tokens
            for real vouchers and UGM merchandise delivered right to campus!
          </p>
        </motion.div>
      </div>
    </div>
  );
}
