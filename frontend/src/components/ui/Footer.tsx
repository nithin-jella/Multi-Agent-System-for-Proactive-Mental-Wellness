'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FaLinkedinIn } from '@/icons';
import { Heart, Shield, MessageCircle, Github } from 'lucide-react';

/**
 * Full marketing footer for the landing page.
 * Contains branding, feature highlights, navigation, and legal links.
 */
export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-white/5 backdrop-blur-xl border-t border-white/10 text-white mt-auto">
      {/* Decorative top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-[#FFCA40] to-transparent opacity-50" />
      
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Brand Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/" className="inline-flex items-center group mb-3">
              <Image 
                src="/UGM_Lambang.png" 
                alt="UGM Logo" 
                width={36} 
                height={36}
                className="transition-transform duration-300 group-hover:scale-110"
              />
              <div className="ml-2.5">
                <h2 className="text-base font-bold text-white group-hover:text-[#FFCA40] transition-colors duration-300">
                  UGM-AICare
                </h2>
                <p className="text-[10px] text-[#FFCA40]/80">Mental Health Support</p>
              </div>
            </Link>
            
            <p className="text-xs text-gray-300/90 leading-relaxed max-w-xs mb-4">
              AI-powered mental health companion for UGM students.
            </p>

            {/* Key Features - Compact */}
            <div className="flex flex-wrap gap-2 mb-4">
              <FeatureBadge icon={<MessageCircle size={12} />} text="24/7" />
              <FeatureBadge icon={<Shield size={12} />} text="Private" />
              <FeatureBadge icon={<Heart size={12} />} text="Empathetic" />
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2">
              <SocialLink 
                href="https://linkedin.com/in/gigahidjrikaaa" 
                icon={<FaLinkedinIn size={14} />} 
                label="LinkedIn" 
              />
              <SocialLink 
                href="https://github.com/gigahidjrikaaa/UGM-AICare" 
                icon={<Github size={14} />} 
                label="GitHub" 
              />
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h3 className="text-xs font-semibold text-[#FFCA40] uppercase tracking-wider mb-3">
              Get Started
            </h3>
            <nav className="space-y-2">
              <FooterLink href="/signin">Sign In</FooterLink>
              <FooterLink href="/about">About Aika</FooterLink>
              <FooterLink href="/resources">Resources</FooterLink>
            </nav>
          </motion.div>

          {/* Support */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-xs font-semibold text-[#FFCA40] uppercase tracking-wider mb-3">
              Support
            </h3>
            <nav className="space-y-2">
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
            </nav>
          </motion.div>
        </div>

        {/* Bottom Section */}
        <motion.div 
          className="mt-8 pt-6 border-t border-white/10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            {/* UGM Logo & Copyright */}
            <div className="flex items-center gap-3">
              <Image 
                src="/UGM_Tipografi.png" 
                alt="UGM" 
                width={60} 
                height={16} 
                className="opacity-70 bg-white/90 px-1.5 py-0.5 rounded"
              />
              <p className="text-[10px] text-gray-400">
                © {currentYear} Universitas Gadjah Mada
              </p>
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-gray-400/70 italic text-center sm:text-right">
              Aika is an AI assistant, not a substitute for professional medical advice.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

// Helper Components

// Feature Badge - Compact version
interface FeatureBadgeProps {
  icon: React.ReactNode;
  text: string;
}

function FeatureBadge({ icon, text }: FeatureBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-300">
      <span className="text-[#FFCA40]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// Social Link - Compact version
interface SocialLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
}

function SocialLink({ href, icon, label }: SocialLinkProps) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      aria-label={label}
      className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:border-[#FFCA40]/50 flex items-center justify-center text-gray-300 hover:text-[#FFCA40] transition-colors duration-200"
    >
      {icon}
    </a>
  );
}

// Footer Link
interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
}

function FooterLink({ href, children }: FooterLinkProps) {
  return (
    <Link 
      href={href} 
      className="text-xs text-gray-300 hover:text-[#FFCA40] transition-colors duration-200 block"
    >
      {children}
    </Link>
  );
}