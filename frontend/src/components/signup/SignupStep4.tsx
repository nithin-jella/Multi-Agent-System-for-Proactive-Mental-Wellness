"use client";

import { motion } from "framer-motion";
import { FiPhone, FiArrowLeft, FiCheck } from "@/icons";
import Link from "next/link";

interface SignupStep4Props {
  formData: {
    phone: string;
    allowEmailCheckins: boolean;
    agreeToTerms: boolean;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function SignupStep4({ formData, onChange, onSubmit, onBack, isLoading }: SignupStep4Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Almost There!</h2>
        <p className="text-white/70 text-sm">
          Set your preferences and complete your registration
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Phone Number (Optional) */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-white/90 mb-2">
            <FiPhone className="inline mr-1" />
            Phone Number <span className="text-white/50 text-xs">(Optional)</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={onChange}
            className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
            placeholder="+62 123 4567 8900"
          />
          <p className="text-xs text-white/60 mt-1">
            We&apos;ll only use this for emergency contacts and important updates
          </p>
        </div>

        {/* Preferences */}
        <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
          <p className="text-sm font-medium text-white/90 mb-3">Communication Preferences</p>
          
          <div className="flex items-start">
            <input
              type="checkbox"
              id="allowEmailCheckins"
              name="allowEmailCheckins"
              checked={formData.allowEmailCheckins}
              onChange={onChange}
              className="mt-1 w-4 h-4 text-[#FFCA40] bg-white/10 border-white/20 rounded focus:ring-[#FFCA40] focus:ring-2"
            />
            <label htmlFor="allowEmailCheckins" className="ml-3 text-sm text-white/80">
              <span className="font-medium text-white">Email Check-ins</span>
              <p className="text-white/60 text-xs mt-1">
                Receive periodic mental wellness check-ins, tips, and supportive content via email
              </p>
            </label>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="agreeToTerms"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={onChange}
              required
              className="mt-1 w-4 h-4 text-[#FFCA40] bg-white/10 border-white/20 rounded focus:ring-[#FFCA40] focus:ring-2"
            />
            <label htmlFor="agreeToTerms" className="ml-3 text-sm text-white/80">
              I agree to the{" "}
              <Link href="/terms" className="text-[#FFCA40] hover:text-[#FFAB00] underline font-medium">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#FFCA40] hover:text-[#FFAB00] underline font-medium">
                Privacy Policy
              </Link>
              {" "}*
            </label>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <motion.button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-white/10 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiArrowLeft className="inline mr-2" />
            Back
          </motion.button>
          <motion.button
            type="submit"
            disabled={isLoading || !formData.agreeToTerms}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-linear-to-r from-[#FFCA40] to-[#FFD700] text-[#001D58] font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:from-[#FFD700] hover:to-[#FFCA40] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#001D58] border-t-transparent mr-2"></div>
                Creating Account...
              </div>
            ) : (
              <>
                <FiCheck className="inline mr-2" />
                Create Account
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
