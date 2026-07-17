"use client";

export default function CounselorFooter() {
  return (
    <footer className="bg-white/5 border-t border-white/10 px-6 py-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-white/50">
        <p>© {new Date().getFullYear()} UGM AICare Counselor Portal</p>
        <p>Clinical Care Platform v1.0</p>
      </div>
    </footer>
  );
}
