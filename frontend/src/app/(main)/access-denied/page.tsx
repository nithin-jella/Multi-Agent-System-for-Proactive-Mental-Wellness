// filepath: d:\Astaga Ngoding\Github\UGM-AICare\frontend\src\app\access-denied\page.tsx
"use client";
import Link from "next/link";
import { FiLock } from "react-icons/fi";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] flex flex-col items-center justify-center text-white p-4">
      <FiLock size={64} className="text-[#FFCA40] mb-6" />
      <h1 className="text-4xl font-bold mb-3">Access Denied</h1>
      <p className="text-lg text-white/80 mb-8 text-center max-w-md">
        You do not have permission to view this page. Please contact an administrator if you believe this is an error.
      </p>
      <Link href="/">
        <button className="px-6 py-3 bg-[#FFCA40] text-[#001D58] font-semibold rounded-lg hover:bg-opacity-90 transition-colors">
          Go to Homepage
        </button>
      </Link>
    </div>
  );
}