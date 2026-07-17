import React from "react";

interface SessionStatCardProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export function SessionStatCard({ label, value, icon: Icon }: SessionStatCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/50 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-[#FFCA40]" />}
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}
