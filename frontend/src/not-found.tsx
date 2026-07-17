"use client";

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, 
  FaRobot, 
  FaHeart, 
  FaSearch, 
  FaStar, 
  FaMagic,
  BiSmile, 
  BiSad 
} from '@/icons';
import { useEffect, useState } from 'react';

// Floating particles animation component
const FloatingParticles = () => {
  const particles = Array.from({ length: 15 }, (_, i) => i);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle}
          className="absolute w-2 h-2 bg-[#FFCA40]/30 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

// Animated Aika character component
const AnimatedAika = () => {
  const [expression, setExpression] = useState<'happy' | 'sad' | 'thinking'>('sad');
  
  useEffect(() => {
    const expressions: ('happy' | 'sad' | 'thinking')[] = ['sad', 'thinking', 'happy'];
    let index = 0;
    
    const interval = setInterval(() => {
      setExpression(expressions[index]);
      index = (index + 1) % expressions.length;
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <motion.div 
      className="relative"
      animate={{ 
        y: [0, -10, 0],
        rotate: [-2, 2, -2]
      }}
      transition={{ 
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div className="h-40 w-40 rounded-full bg-linear-to-br from-[#FFCA40] to-[#FF8C00] flex items-center justify-center shadow-xl">
        <motion.div
          key={expression}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {expression === 'sad' && <BiSad className="text-[#001D58] text-6xl" />}
          {expression === 'thinking' && <FaSearch className="text-[#001D58] text-4xl" />}
          {expression === 'happy' && <BiSmile className="text-[#001D58] text-6xl" />}
        </motion.div>
      </div>
      
      {/* Floating hearts around Aika */}
      <motion.div
        className="absolute -top-2 -right-2"
        animate={{ 
          y: [-5, -15, -5],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          delay: 0.5
        }}
      >
        <FaHeart className="text-red-400 text-xl" />
      </motion.div>
      
      <motion.div
        className="absolute -bottom-2 -left-2"
        animate={{ 
          y: [-8, -18, -8],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{ 
          duration: 2.5,
          repeat: Infinity,
          delay: 1
        }}
      >
        <FaStar className="text-yellow-300 text-lg" />
      </motion.div>
    </motion.div>
  );
};

// Glitch text effect component
const GlitchText = ({ children, className }: { children: string; className?: string }) => {
  const [isGlitching, setIsGlitching] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 200);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <motion.h1 
      className={`relative ${className}`}
      animate={isGlitching ? {
        x: [0, -2, 2, -1, 1, 0],
      } : {}}
      transition={{ duration: 0.2 }}
    >
      {children}
      {isGlitching && (
        <>
          <span className="absolute top-0 left-0 text-red-500 opacity-70 -translate-x-1">
            {children}
          </span>
          <span className="absolute top-0 left-0 text-blue-500 opacity-70 translate-x-1">
            {children}
          </span>
        </>
      )}
    </motion.h1>
  );
};

// Typewriter effect component
const TypewriterText = ({ text, className }: { text: string; className?: string }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50);
      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);
  
  return (
    <p className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="inline-block w-0.5 h-5 bg-current ml-1"
      />
    </p>
  );
};

export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowMessage(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  
  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-linear-to-br from-[#001D58] via-[#00308F] to-[#1e3a8a] flex flex-col relative overflow-hidden">
      <FloatingParticles />
      
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 left-10 w-32 h-32 bg-[#FFCA40]/10 rounded-full blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 4,
            repeat: Infinity
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            duration: 6,
            repeat: Infinity
          }}
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="max-w-lg w-full">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              duration: 0.8,
              type: "spring",
              stiffness: 100
            }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 overflow-hidden shadow-2xl relative"
          >
            {/* Animated border glow */}
            <motion.div
              className="absolute inset-0 bg-linear-to-r from-[#FFCA40]/20 via-purple-500/20 to-[#FFCA40]/20 rounded-3xl"
              animate={{
                background: [
                  'linear-gradient(90deg, rgba(255,202,64,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,202,64,0.2) 100%)',
                  'linear-gradient(90deg, rgba(168,85,247,0.2) 0%, rgba(255,202,64,0.2) 50%, rgba(168,85,247,0.2) 100%)',
                  'linear-gradient(90deg, rgba(255,202,64,0.2) 0%, rgba(168,85,247,0.2) 50%, rgba(255,202,64,0.2) 100%)'
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity
              }}
            />
            
            {/* Aika Character Section */}
            <div className="bg-linear-to-r from-[#001545] to-[#173a7a] p-8 flex justify-center relative">
              <AnimatedAika />
              
              {/* Magic sparkles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    top: `${20 + i * 10}%`,
                    left: `${10 + i * 15}%`,
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    rotate: [0, 180, 360],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3
                  }}
                >
                  <FaMagic className="text-[#FFCA40] text-sm" />
                </motion.div>
              ))}
            </div>
            
            {/* Message Section */}
            <div className="p-8 text-center relative">
              <GlitchText className="text-4xl font-bold text-white mb-2">
                404
              </GlitchText>
              
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-xl font-semibold text-white/90 mb-4"
              >
                Oops! Aika can&apos;t find this page
              </motion.h2>
              
              <AnimatePresence>
                {showMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mb-6"
                  >
                    <TypewriterText 
                      text="Don't worry! Even AI companions get lost sometimes. Let's help you find your way back to mental wellness."
                      className="text-gray-300 text-sm leading-relaxed"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 }}
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 10px 30px rgba(255, 202, 64, 0.3)"
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-linear-to-r from-[#FFCA40] to-[#FF8C00] text-[#001D58] rounded-full font-bold flex items-center justify-center w-full sm:w-auto transition-all duration-300 group"
                  >
                    <FaArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                  </motion.button>
                </Link>
                
                <Link href="/aika">
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.4 }}
                    whileHover={{ 
                      scale: 1.05,
                      boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)"
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-white/20 text-white rounded-full font-bold flex items-center justify-center backdrop-blur-sm w-full sm:w-auto border border-white/30 hover:bg-white/30 transition-all duration-300 group"
                  >
                    <FaRobot className="mr-2 group-hover:rotate-12 transition-transform" />
                    Talk to Aika
                  </motion.button>
                </Link>
              </div>
              
              {/* Fun fact */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10"
              >
                <p className="text-xs text-white/70">
                  💡 <strong>Fun fact:</strong> This 404 page was designed to make getting lost a little more delightful!
                </p>
              </motion.div>
            </div>
          </motion.div>
          
          {/* Support Link */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="text-center text-white/60 text-sm mt-8"
          >
            Need help? Contact{' '}
            <motion.a 
              href="mailto:support@ugm-aicare.com" 
              className="text-[#FFCA40] hover:text-[#FF8C00] transition-colors duration-300"
              whileHover={{ scale: 1.05 }}
            >
              support@ugm-aicare.com
            </motion.a>
          </motion.p>
        </div>
      </div>
      
      {/* Enhanced Footer */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3 }}
        className="py-6 px-6 text-center border-t border-white/10 bg-black/20 backdrop-blur-sm"
      >
        <p className="text-sm text-gray-400">
          © 2025 Universitas Gadjah Mada. All rights reserved.
        </p>
        <motion.div
          className="flex justify-center mt-2 space-x-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3
              }}
            >
              <FaStar className="text-[#FFCA40]/50 text-xs" />
            </motion.div>
          ))}
        </motion.div>
      </motion.footer>
    </main>
  );
}