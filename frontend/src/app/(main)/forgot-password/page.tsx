"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  FiMail, 
  FiAlertCircle, 
  FiSend, 
  FiArrowLeft, 
  FiCheckCircle 
} from "@/icons";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (!email) {
      setError("Please enter your email address.");
      setIsLoading(false);
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.INTERNAL_API_URL;
      const response = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.detail || "Failed to send reset email. Please try again.");
      }
    } catch (err: unknown) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#001d58] via-[#0a2a6e] to-[#173a7a] text-white flex flex-col pt-24">
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-lg max-w-md w-full text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <FiCheckCircle className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-4">Check Your Email</h1>
            <p className="text-gray-300 mb-8">
              We&apos;ve sent a password reset link to <span className="text-[#FFCA40] font-medium">{email}</span>. 
              Please check your email and follow the instructions to reset your password.
            </p>
            <div className="space-y-4">
              <Link
                href="/signin"
                className="w-full flex items-center justify-center px-4 py-3 bg-[#FFCA40] text-[#001D58] font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-150"
              >
                <FiArrowLeft className="mr-2" />
                Back to Sign In
              </Link>
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="w-full px-4 py-3 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-all duration-150"
              >
                Send Another Email
              </button>
            </div>
          </motion.div>
        </div>
        <footer className="py-4 px-6 text-center text-sm text-gray-400 border-t border-white/10">
          <p>© 2025 UGM-AICare Team. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001d58] via-[#0a2a6e] to-[#173a7a] text-white flex flex-col pt-24">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-lg max-w-md w-full"
        >
          <div className="flex justify-center mb-6">
            <Image 
              src="/aika-avatar.png" 
              alt="Aika" 
              width={80} 
              height={80}
              className="rounded-full bg-[#FFCA40]/20 p-2"
            />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Forgot Password?</h1>
          <p className="text-gray-300 text-center mb-8">
            No worries! Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
          
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-lg mb-6 flex items-center"
            >
              <FiAlertCircle className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-1">
                Email Address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] outline-none transition-colors"
                  placeholder="your-email@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 bg-[#FFCA40] text-[#001D58] font-semibold rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:ring-offset-2 focus:ring-offset-[#001D58] transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#001D58]"></div>
                ) : (
                  <FiSend className="mr-2 h-5 w-5 transform transition-transform duration-150 group-hover:translate-x-1" />
                )}
                {isLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/signin" 
              className="inline-flex items-center text-sm text-white/70 hover:text-white transition-colors"
            >
              <FiArrowLeft className="mr-2" size={16} />
              Back to Sign In
            </Link>
          </div>
          
          <p className="text-xs text-center text-gray-400 mt-8">
            Remember your password? <Link href="/signin" className="text-[#FFCA40] hover:underline">Sign in here</Link>
          </p>
        </motion.div>
      </div>
      
      {/* Footer */}
      <footer className="py-4 px-6 text-center text-sm text-gray-400 border-t border-white/10">
        <p>© 2025 UGM-AICare Team. All rights reserved.</p>
      </footer>
    </div>
  );
}
