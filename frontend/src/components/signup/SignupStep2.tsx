"use client";

import { motion } from "framer-motion";
import { FiUser, FiCalendar, FiArrowLeft } from "@/icons";

interface SignupStep2Props {
  formData: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function SignupStep2({ formData, onChange, onNext, onBack }: SignupStep2Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Tell Us About Yourself</h2>
        <p className="text-white/70 text-sm">
          Help us personalize your experience
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-white/90 mb-2">
              <FiUser className="inline mr-1" />
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={onChange}
              required
              className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
              placeholder="Enter your first name"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-white/90 mb-2">
              <FiUser className="inline mr-1" />
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={onChange}
              required
              className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
              placeholder="Enter your last name"
            />
          </div>
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-white/90 mb-2">
            <FiCalendar className="inline mr-1" />
            Date of Birth
          </label>
          <input
            type="date"
            id="dateOfBirth"
            name="dateOfBirth"
            value={formData.dateOfBirth}
            onChange={onChange}
            className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          />
        </div>

        {/* Gender */}
        <div>
          <label htmlFor="gender" className="block text-sm font-medium text-white/90 mb-2">
            Gender
          </label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={onChange}
            className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          >
            <option value="" className="bg-[#001d58] text-white">Select Gender</option>
            <option value="male" className="bg-[#001d58] text-white">Male</option>
            <option value="female" className="bg-[#001d58] text-white">Female</option>
            <option value="other" className="bg-[#001d58] text-white">Other</option>
            <option value="prefer_not_to_say" className="bg-[#001d58] text-white">Prefer not to say</option>
          </select>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <motion.button
            type="button"
            onClick={onBack}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-white/10 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 border border-white/20 hover:bg-white/20"
          >
            <FiArrowLeft className="inline mr-2" />
            Back
          </motion.button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 bg-linear-to-r from-[#FFCA40] to-[#FFD700] text-[#001D58] font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:from-[#FFD700] hover:to-[#FFCA40]"
          >
            Continue →
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
