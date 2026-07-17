"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { FiUser } from "@/icons";
import ParticleBackground from "@/components/ui/ParticleBackground";
import SignupProgress from "@/components/signup/SignupProgress";
import SignupStep1 from "@/components/signup/SignupStep1";
import SignupStep2 from "@/components/signup/SignupStep2";
import SignupStep3 from "@/components/signup/SignupStep3";
import SignupStep4 from "@/components/signup/SignupStep4";
import { registerUser } from "@/services/api";

export default function SignUp() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  const [formData, setFormData] = useState({
    // Step 1: Account
    email: "",
    password: "",
    confirmPassword: "",
    
    // Step 2: Personal
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    
    // Step 3: Academic
    university: "",
    major: "",
    yearOfStudy: "",
    city: "",
    
    // Step 4: Preferences
    phone: "",
    allowEmailCheckins: true,
    agreeToTerms: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const studentTestimonials = [
    {
      name: "Sari Dewi",
      image: "/images/student-testimonials/sari.jpg",
      university: "Universitas Gadjah Mada",
      major: "Psychology",
      review: "Aika telah membantu saya mengatasi kecemasan akademik. Fitur journaling dan sesi CBT-nya sangat membantu dalam perjalanan mental health saya."
    },
    {
      name: "Budi Santoso",
      image: "/images/student-testimonials/budi.jpg",
      university: "Institut Teknologi Bandung",
      major: "Computer Science",
      review: "Sebagai mahasiswa teknik yang sering stress, Aika memberikan dukungan 24/7 yang saya butuhkan. AI companion yang sangat understanding dan supportive."
    },
    {
      name: "Maya Kusuma",
      image: "/images/student-testimonials/maya.jpg",
      university: "Universitas Indonesia",
      major: "Medical Student",
      review: "Platform yang luar biasa! Aika membantu saya manage burnout selama masa koass. Fitur affective tracking berbasis PAD dan mindfulness exercises sangat efektif."
    },
    {
      name: "Rian Pratama",
      image: "/images/student-testimonials/rian.jpg",
      university: "Universitas Padjadjaran",
      major: "Business Administration",
      review: "UGM-AICare bukan hanya aplikasi, tapi teman yang selalu ada. Aika membantu saya develop self-awareness dan coping strategies yang lebih baik."
    },
    {
      name: "Indira Sari",
      image: "/images/student-testimonials/indira.jpg",
      university: "Universitas Airlangga",
      major: "Public Health",
      review: "Sangat impressed dengan kualitas therapeutic modules di platform ini. Aika memberikan guidance yang personal dan evidence-based untuk mental wellness."
    }
  ];

  // Rotate testimonials every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % studentTestimonials.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [studentTestimonials.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    // Clear errors when user types
    if (error) setError(null);
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    setError(null);

    switch (step) {
      case 1:
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          setError("Please enter a valid email address.");
          return false;
        }
        
        // Password validation
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters long.");
          return false;
        }
        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        if (!passwordRegex.test(formData.password)) {
          setError("Password must contain uppercase, lowercase, number, and special character.");
          return false;
        }
        
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match.");
          return false;
        }
        break;
        
      case 2:
        if (!formData.firstName || !formData.lastName) {
          setError("Please enter your first and last name.");
          return false;
        }
        break;
        
      case 3:
        // Academic info is optional, no validation needed
        break;
        
      case 4:
        if (!formData.agreeToTerms) {
          setError("Please agree to the Terms of Service and Privacy Policy.");
          return false;
        }
        break;
    }
    
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(4)) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await registerUser({
        name: `${formData.firstName} ${formData.lastName}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        city: formData.city,
        university: formData.university,
        major: formData.major,
        yearOfStudy: formData.yearOfStudy,
        password: formData.password,
        allowEmailCheckins: formData.allowEmailCheckins
      });

      setSuccess("Account created successfully! Redirecting to sign in...");
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 2000);
    } catch (err: unknown) {
      setError(
        (err instanceof Error && err.message) ||
          "An unexpected error occurred. Please try again."
      );
      console.error("Registration error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#001D58] via-[#00308F] to-[#002A7A] flex relative pt-24">
      {/* Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <ParticleBackground count={60} colors={["#FFCA40", "#B8A4FF", "#50E3C2"]} minSize={2} maxSize={8} speed={0.8} />
      </div>

      {/* Left Side - Student Testimonials Carousel */}
      <div className="hidden lg:flex lg:w-1/3 flex-col justify-center relative overflow-hidden z-10">
        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3">
              Trusted by Students Across Indonesia
            </h2>
            <p className="text-white/70 text-sm">
              Join thousands of students who found support through UGM-AICare
            </p>
          </div>

          {/* Large Square Picture Carousel */}
          <motion.div
            key={testimonialIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7 }}
            className="relative flex flex-col items-center"
          >
            {/* Large Square Profile Image with Overlay */}
            <div className="relative w-80 h-80 rounded-2xl overflow-hidden shadow-2xl group">
              {/* Background placeholder with gradient */}
              <div className="w-full h-full bg-linear-to-br from-[#FFCA40]/20 to-[#001d58]/60 flex items-center justify-center">
                {/* Using initials as placeholder for student photos */}
                <span className="text-white/40 font-bold text-8xl">
                  {studentTestimonials[testimonialIndex].name.charAt(0)}
                </span>
              </div>
              
              {/* Bottom gradient overlay for text readability */}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent"></div>
              
              {/* Overlay content */}
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                {/* Student Name */}
                <h3 className="text-2xl font-bold mb-2 drop-shadow-lg">
                  {studentTestimonials[testimonialIndex].name}
                </h3>
                
                {/* Academic Info */}
                <div className="mb-3">
                  <p className="text-[#FFCA40] font-semibold text-sm mb-1 drop-shadow">
                    {studentTestimonials[testimonialIndex].major}
                  </p>
                  <p className="text-white/90 text-xs drop-shadow">
                    {studentTestimonials[testimonialIndex].university}
                  </p>
                </div>
                
                {/* Testimonial Quote */}
                <div className="relative">
                  <div className="text-[#FFCA40] text-2xl leading-none">&ldquo;</div>
                  <p className="text-white/95 text-sm leading-relaxed italic px-4 drop-shadow">
                    {studentTestimonials[testimonialIndex].review}
                  </p>
                  <div className="text-[#FFCA40] text-2xl leading-none text-right rotate-180">&ldquo;</div>
                </div>
              </div>
              
              {/* Subtle border glow */}
              <div className="absolute inset-0 rounded-2xl border border-[#FFCA40]/20 group-hover:border-[#FFCA40]/40 transition-all duration-300"></div>
            </div>
          </motion.div>

          {/* Testimonial Indicators */}
          <div className="flex justify-center mt-8 space-x-2">
            {studentTestimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setTestimonialIndex(index)}
                aria-label={`View testimonial ${index + 1}`}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === testimonialIndex
                    ? "bg-[#FFCA40] scale-125"
                    : "bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-between items-center mt-6 px-4">
            <button
              onClick={() => setTestimonialIndex((prev) => 
                prev === 0 ? studentTestimonials.length - 1 : prev - 1
              )}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-200"
              aria-label="Previous testimonial"
            >
              <span className="text-white text-sm">‹</span>
            </button>
            <span className="text-white/50 text-xs">
              {testimonialIndex + 1} / {studentTestimonials.length}
            </span>
            <button
              onClick={() => setTestimonialIndex((prev) => 
                prev === studentTestimonials.length - 1 ? 0 : prev + 1
              )}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-200"
              aria-label="Next testimonial"
            >
              <span className="text-white text-sm">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Multi-Step Registration Form */}
      <div className="w-full lg:w-2/3 flex items-center justify-center p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-xl">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8"
          >
            {/* Progress Indicator */}
            <SignupProgress currentStep={currentStep} totalSteps={totalSteps} />

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-300 text-sm"
              >
                {success}
              </motion.div>
            )}

            {/* Multi-Step Form */}
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <SignupStep1
                  key="step1"
                  formData={formData}
                  onChange={handleInputChange}
                  onNext={handleNext}
                />
              )}
              {currentStep === 2 && (
                <SignupStep2
                  key="step2"
                  formData={formData}
                  onChange={handleInputChange}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === 3 && (
                <SignupStep3
                  key="step3"
                  formData={formData}
                  onChange={handleInputChange}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === 4 && (
                <SignupStep4
                  key="step4"
                  formData={formData}
                  onChange={handleInputChange}
                  onSubmit={handleSubmit}
                  onBack={handleBack}
                  isLoading={isLoading}
                />
              )}
            </AnimatePresence>

            {/* Alternative Options */}
            <div className="mt-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-transparent text-white/60 text-xs">or</span>
                </div>
              </div>

              <div className="text-center">
                <Link 
                  href="/signin-ugm" 
                  className="inline-flex items-center text-sm text-[#FFCA40] hover:text-[#FFAB00] transition-colors"
                >
                  <FiUser className="mr-2" size={16} />
                  UGM Students - Sign in with Google
                </Link>
              </div>

              <p className="text-white/70 text-sm text-center">
                Already have an account?{" "}
                <Link
                  href="/signin"
                  className="text-[#FFCA40] hover:text-[#FFAB00] font-semibold transition-colors duration-200"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

