"use client";

import { format } from 'date-fns';

export default function AdminFooter() {
  return (
    <footer className="bg-[#000c24]/80 backdrop-blur-md border-t border-white/10 p-4 text-center md:text-left">
      <p className="text-xs text-gray-400">
        &copy; {format(new Date(), 'yyyy')} UGM-AICare Admin Panel. All rights reserved.
      </p>
      {/* You can add more links or information here if needed */}
    </footer>
  );
}