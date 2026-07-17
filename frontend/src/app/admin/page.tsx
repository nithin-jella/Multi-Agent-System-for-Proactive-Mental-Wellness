'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  FiLock, 
  FiMail, 
  FiAlertCircle, 
  FiLogIn, 
  FiEye, 
  FiEyeOff, 
  FiShield
} from "@/icons";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";

export default function AdminLoginPage() {
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_ADMIN_EMAIL_DEFAULT || "");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCredentials, setShowCredentials] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  // Development credentials - REMOVE IN PRODUCTION
  const developmentCredentials = {
    email: process.env.NEXT_PUBLIC_ADMIN_EMAIL_DEFAULT || "admin@ugm.ac.id",
    password: "admin123" // This would normally come from env, but shown for dev convenience
  };

  useEffect(() => {
    // Check for session expired query parameter
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sessionExpired') === 'true') {
        setSessionExpiredMessage('Your session has expired. Please log in again.');
        // Clear the query parameter
        window.history.replaceState({}, '', '/admin');
      }
      // Clear the session cleared flag
      localStorage.removeItem('admin-session-cleared');
    }

    if (status === "authenticated") {
      if (session?.user?.role === "admin") {
        // Check for return URL
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        router.push(returnUrl || "/admin/conversations");
      } else {
        // If a non-admin user lands here and is logged in, send them away.
        router.push("/signin"); 
      }
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(`Login failed. Please check your credentials and ensure you have admin rights.`);
        }
      } else if (!result?.ok) {
        setError("Login failed. Please check your credentials.");
      }
      // On successful sign-in, the useEffect will handle the redirect.
    } catch (err: unknown) {
      setError("An unexpected error occurred during login.");
      console.error("Login submission error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && session?.user?.role === "admin")) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] flex items-center justify-center">
        <div className="animate-pulse text-white text-lg">Loading Admin Access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] flex flex-col items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm sm:max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-xl shadow-2xl border border-white/20">
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/UGM_Lambang.png"
              alt="UGM AICare Logo"
              width={60}
              height={60}
              className="mb-3"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-white/70 text-sm sm:text-base">UGM-AICare Management</p>
          </div>

          {/* Development Credentials Hint - REMOVE IN PRODUCTION */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6">
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-orange-300 text-xs sm:text-sm hover:bg-orange-500/30 transition-colors"
              >
                {showCredentials ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                {showCredentials ? 'Hide' : 'Show'} Development Credentials
              </button>
              
              {showCredentials && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FiAlertCircle className="text-orange-400" size={14} />
                    <span className="text-orange-300 font-semibold text-xs">Development Only</span>
                  </div>
                  <div className="space-y-2 text-[11px] sm:text-xs">
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <span className="text-orange-300 ml-2 font-mono">{developmentCredentials.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Password:</span>
                      <span className="text-orange-300 ml-2 font-mono">{developmentCredentials.password}</span>
                    </div>
                  </div>
                  <p className="text-orange-400/80 text-xs mt-2">
                    ⚠️ This will be removed in production builds
                  </p>
                </motion.div>
              )}
            </div>
          )}

          {/* Session Expired Warning */}
          {sessionExpiredMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 p-3 rounded-lg mb-6 flex items-center"
            >
              <FiAlertCircle className="mr-2 flex-shrink-0" />
              <span className="text-sm">{sessionExpiredMessage}</span>
            </motion.div>
          )}

          {/* Error Message */}
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
              <label
                htmlFor="email"
                className="block text-xs sm:text-sm font-medium text-white/80 mb-1"
              >
                Admin Email Address
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
                  className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] outline-none transition-colors text-sm"
                  placeholder="admin@ugm.ac.id"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs sm:text-sm font-medium text-white/80 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] outline-none transition-colors text-sm"
                  placeholder="••••••••"
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
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#001D58]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <FiLogIn className="mr-2 h-5 w-5 transform transition-transform duration-150 group-hover:translate-x-1" />
                )}
                {isLoading ? "Signing In..." : "Sign In Securely"}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <Link href="/signin">
              <p className="text-xs sm:text-sm text-white/60 hover:text-white">Are you a user? Go to user login</p>
            </Link>
          </div>
        </div>
        
        <div className="mt-6 space-y-3">
          <p className="text-center text-[11px] sm:text-xs text-white/60">
            For authorized personnel only. All access is monitored.
          </p>
          <div className="flex items-center justify-center gap-2 text-center text-[11px] sm:text-xs text-white/40">
            <FiShield size={12} />
            <span>Data encrypted in transit and at rest</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
