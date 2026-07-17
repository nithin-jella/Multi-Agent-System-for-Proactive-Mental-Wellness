"use client";

import { motion } from "framer-motion";
import { FiBook, FiMapPin, FiArrowLeft } from "@/icons";

interface SignupStep3Props {
  formData: {
    university: string;
    major: string;
    yearOfStudy: string;
    city: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function SignupStep3({ formData, onChange, onNext, onBack }: SignupStep3Props) {
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
        <h2 className="text-2xl font-bold text-white mb-2">Your Academic Profile</h2>
        <p className="text-white/70 text-sm">
          Tell us about your studies and location
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* University and Major */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="university" className="block text-sm font-medium text-white/90 mb-2">
              <FiBook className="inline mr-1" />
              University
            </label>
            <input
              type="text"
              id="university"
              name="university"
              value={formData.university}
              onChange={onChange}
              className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
              placeholder="e.g., Universitas Gadjah Mada"
            />
          </div>
          <div>
            <label htmlFor="major" className="block text-sm font-medium text-white/90 mb-2">
              Major/Field of Study
            </label>
            <input
              type="text"
              id="major"
              name="major"
              value={formData.major}
              onChange={onChange}
              className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
              placeholder="e.g., Psychology"
            />
          </div>
        </div>

        {/* Year of Study */}
        <div>
          <label htmlFor="yearOfStudy" className="block text-sm font-medium text-white/90 mb-2">
            Year of Study
          </label>
          <select
            id="yearOfStudy"
            name="yearOfStudy"
            value={formData.yearOfStudy}
            onChange={onChange}
            className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
          >
            <option value="" className="bg-[#001d58] text-white">Select Year</option>
            <option value="1" className="bg-[#001d58] text-white">1st Year</option>
            <option value="2" className="bg-[#001d58] text-white">2nd Year</option>
            <option value="3" className="bg-[#001d58] text-white">3rd Year</option>
            <option value="4" className="bg-[#001d58] text-white">4th Year</option>
            <option value="5" className="bg-[#001d58] text-white">5th Year</option>
            <option value="6" className="bg-[#001d58] text-white">6th Year</option>
            <option value="graduate" className="bg-[#001d58] text-white">Graduate Student</option>
          </select>
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-white/90 mb-2">
            <FiMapPin className="inline mr-1" />
            City
          </label>
          <input
            type="text"
            id="city"
            name="city"
            value={formData.city}
            onChange={onChange}
            className="w-full px-4 py-3 bg-white/8 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:border-[#FFCA40] transition-all duration-200"
            placeholder="e.g., Yogyakarta"
          />
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
