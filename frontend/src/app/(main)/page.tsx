"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports for code splitting and better performance
const HeroSection = dynamic(() => import('@/components/landing/HeroSection'), {
  loading: () => <HeroSkeleton />
});
const TrustSection = dynamic(() => import('@/components/landing/TrustSection'));
const BenefitsSection = dynamic(() => import('@/components/landing/BenefitsSection'));
const HowItWorksSection = dynamic(() => import('@/components/landing/HowItWorksSection'));
const TestimonialsSection = dynamic(() => import('@/components/landing/TestimonialsSection'));
const FAQSection = dynamic(() => import('@/components/landing/FAQSection'));
const FinalCTASection = dynamic(() => import('@/components/landing/FinalCTASection'));

// Loading skeleton for hero section
function HeroSkeleton() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center text-center px-4">
        <div className="h-8 w-48 bg-white/10 rounded-full mb-6" />
        <div className="h-16 w-80 md:w-125 bg-white/10 rounded-lg mb-4" />
        <div className="h-12 w-64 md:w-96 bg-white/10 rounded-lg mb-8" />
        <div className="h-6 w-72 bg-white/10 rounded-lg mb-4" />
        <div className="h-14 w-64 bg-[#FFCA40]/20 rounded-full" />
      </div>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HeroSkeleton />;
  }

  return (
    <main className="min-h-screen w-full bg-transparent text-white selection:bg-[#FFCA40] selection:text-[#001D58]">
      {/* 
        Landing Page Structure:
        1. Hero - First impression, main CTA
        2. Trust Section - Logos, stats, credibility
        3. Benefits - Core value for UGM students
        4. How It Works - Simple 3-step process
        5. Testimonials - Social proof from students
        6. FAQ - Address common concerns
        7. Final CTA - Last push to convert + emergency resources
      */}
      
      {/* Hero Section - Main landing area with CTA */}
      <HeroSection />
      
      {/* Trust Section - Partner logos and key stats */}
      <TrustSection />
      
      {/* Benefits Section - 3 core benefits of using UGM-AICare */}
      <BenefitsSection />
      
      {/* How It Works - Simple step-by-step guide */}
      <HowItWorksSection />
      
      {/* Testimonials - Student success stories */}
      <TestimonialsSection />
      
      {/* FAQ Section - Common questions answered */}
      <FAQSection />
      
      {/* Final CTA - Last conversion push with emergency resources */}
      <FinalCTASection />
    </main>
  );
}
