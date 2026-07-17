'use client';

import Link from 'next/link';

/**
 * Minimal utility-only footer for static/public pages.
 * Contains only essential legal links and copyright.
 */
export default function MinimalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white/5 backdrop-blur-sm border-t border-white/10 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Copyright */}
          <p className="text-xs text-gray-400">
            © {currentYear} Universitas Gadjah Mada. All rights reserved.
          </p>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-xs">
            <Link 
              href="/privacy" 
              className="text-gray-400 hover:text-[#FFCA40] transition-colors duration-200"
            >
              Privacy
            </Link>
            <span className="text-gray-600">•</span>
            <Link 
              href="/terms" 
              className="text-gray-400 hover:text-[#FFCA40] transition-colors duration-200"
            >
              Terms
            </Link>
            <span className="text-gray-600">•</span>
            <Link 
              href="/about" 
              className="text-gray-400 hover:text-[#FFCA40] transition-colors duration-200"
            >
              About
            </Link>
          </div>
        </div>

        {/* Disclaimer - only shown on auth pages */}
        <p className="mt-3 text-center text-[10px] text-gray-500 italic">
          Aika is an AI assistant and not a substitute for professional medical advice.
        </p>
      </div>
    </footer>
  );
}
