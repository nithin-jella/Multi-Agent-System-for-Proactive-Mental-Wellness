"use client";

import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { FaGoogle, FiChevronDown, FiUserPlus } from "@/icons";
import { motion, AnimatePresence } from "framer-motion";

interface GoogleSignInButtonProps {
  className?: string;
}

export default function GoogleSignInButton({ className = "" }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  // Regular sign in - uses last account or shows account picker if no recent session
  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Error signing in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Force account selection even if user is already logged in with a Google account
  const handleSwitchAccount = async () => {
    setIsLoading(true);
    setShowOptions(false);
    try {
      // Clear any existing authentication state before proceeding
      await signOut({ redirect: false });
      await signIn("google", { 
        callbackUrl: "/dashboard",
        authorizationParams: {
          prompt: "select_account"
        }
      });
    } catch (error) {
      console.error("Error switching accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        {/* Main sign in button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={isLoading}
          onClick={handleSignIn}
          className="flex items-center justify-center gap-2 bg-[#FFCA40] text-[#001D58] px-8 py-3 rounded-l-full font-bold text-lg shadow-lg hover:shadow-xl transition-all grow"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-[#001D58] border-t-transparent rounded-full animate-spin" />
          ) : (
            <FaGoogle size={20} />
          )}
          <span>Sign in with UGM Mail</span>
        </motion.button>
        
        {/* Dropdown toggle button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          disabled={isLoading}
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center justify-center bg-[#FFCA40] text-[#001D58] px-3 rounded-r-full font-bold text-lg shadow-lg hover:shadow-xl transition-all border-l border-[#001D58]/10"
          aria-label="More sign in options"
        >
          <FiChevronDown 
            size={20} 
            className={`transition-transform duration-300 ${showOptions ? 'rotate-180' : ''}`} 
          />
        </motion.button>
      </div>

      {/* Dropdown menu for account options */}
      <AnimatePresence>
        {showOptions && (
          <>
            {/* Backdrop to close dropdown when clicked outside */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10"
              onClick={() => setShowOptions(false)}
            />
            
            {/* Dropdown menu */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-20"
            >
              <div className="py-1">
                <button
                  onClick={handleSwitchAccount}
                  className="flex items-center w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <FiUserPlus className="mr-3 text-blue-600" />
                  <div>
                    <p className="font-medium">Use another account</p>
                    <p className="text-xs text-gray-500">Sign in with a different Google account</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}