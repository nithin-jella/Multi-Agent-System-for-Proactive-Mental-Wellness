'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  FiLock, 
  FiMail, 
  FiAlertCircle, 
  FiLogIn, 
  FiEye, 
  FiEyeOff, 
  FiHeart
} from "@/icons";
import { signIn, useSession } from "next-auth/react";

export default function CounselorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('sessionExpired') === 'true') {
        setSessionExpiredMessage('Your session has expired. Please log in again.');
        window.history.replaceState({}, '', '/counselor');
      }
      localStorage.removeItem('counselor-session-cleared');
    }

    if (status === "authenticated") {
      if (session?.user?.role === "counselor" || session?.user?.role === "admin") {
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        router.push(returnUrl || "/counselor/dashboard");
      } else {
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
          setError(`Login failed. Please check your credentials and ensure you have counselor access.`);
        }
      } else if (!result?.ok) {
        setError("Login failed. Please check your credentials.");
      }
    } catch (err: unknown) {
      setError("An unexpected error occurred during login.");
      console.error("Login submission error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && (session?.user?.role === "counselor" || session?.user?.role === "admin"))) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#001d58] via-[#0a2a6e] to-[#173a7a] flex items-center justify-center">
        <div className="animate-pulse text-white text-lg">Loading Counselor Portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#001d58] via-[#0a2a6e] to-[#173a7a] flex flex-col items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#FFCA40]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-linear-to-br from-[#FFCA40] to-[#FFD55C] rounded-2xl flex items-center justify-center shadow-xl">
              <FiHeart className="w-8 h-8 text-[#001d58]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Counselor Panel</h1>
          <p className="text-white/60 text-sm">UGM AICare Clinical Access</p>
        </div>

        {/* Session Expired Message */}
        {sessionExpiredMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
              <p className="text-sm text-orange-200">{sessionExpiredMessage}</p>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <FiAlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-white/40" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-transparent transition-all"
                  placeholder="counselor@ugm.ac.id"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-white/40" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white/60 transition-colors"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" />
                  ) : (
                    <FiEye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-[#FFCA40] to-[#FFD55C] text-[#001d58] rounded-xl font-semibold hover:shadow-lg hover:shadow-[#FFCA40]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#001d58] border-t-transparent"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <FiLogIn className="w-5 h-5" />
                  <span>Sign In to Panel</span>
                </>
              )}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-white/50">
              For clinical staff and counselors only. 
              <br />
              Need access? Contact admin@ugm.ac.id
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-white/60">
            Not a counselor?{' '}
            <a href="/signin" className="text-[#FFCA40] hover:text-[#FFD55C] font-medium">
              Student Login
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
