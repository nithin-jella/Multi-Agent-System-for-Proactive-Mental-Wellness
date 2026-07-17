"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaExclamationTriangle } from 'react-icons/fa';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] flex flex-col">      
      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden shadow-xl"
          >
            {/* Error Illustration */}
            <div className="bg-gradient-to-r from-[#001545] to-[#173a7a] p-6 flex justify-center">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ 
                  duration: 0.5,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                <div className="h-32 w-32 rounded-full bg-[#FFCA40]/20 flex items-center justify-center">
                  <FaExclamationTriangle className="text-[#FFCA40] text-5xl" />
                </div>
              </motion.div>
            </div>
            
            {/* Message */}
            <div className="p-6 text-center">
              <h1 className="text-3xl font-bold text-white mb-2">Page Not Found</h1>
              <p className="text-gray-300 mb-6">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-[#FFCA40] text-[#001D58] rounded-full font-bold flex items-center justify-center w-full sm:w-auto"
                  >
                    <FaArrowLeft className="mr-2" />
                    Back to Home
                  </motion.button>
                </Link>
                <Link href="/aika">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-white/20 text-white rounded-full font-bold flex items-center justify-center backdrop-blur-sm w-full sm:w-auto"
                  >
                    Talk to Aika
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}