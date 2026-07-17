'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down';
    value: number;
    label?: string;
  };
  icon?: React.ReactNode;
  severity?: 'critical' | 'warning' | 'success' | 'info';
}

const severityStyles = {
  critical: 'border-red-500/30 bg-red-500/5',
  warning: 'border-yellow-500/30 bg-yellow-500/5',
  success: 'border-green-500/30 bg-green-500/5',
  info: 'border-white/10 bg-white/5',
};

const severityAccents = {
  critical: 'text-red-400',
  warning: 'text-yellow-400',
  success: 'text-green-400',
  info: 'text-[#FFCA40]',
};

export function KPICard({ title, value, subtitle, trend, icon, severity = 'info' }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative overflow-hidden rounded-2xl border p-6
        ${severityStyles[severity]}
        hover:border-white/20 transition-all duration-300
        shadow-lg shadow-[#00153a]/20 backdrop-blur
      `}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-50" />
      
      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="text-xs font-medium text-white/60 uppercase tracking-wide">
              {title}
            </div>
            <div className={`text-3xl font-bold ${severityAccents[severity]}`}>
              {value}
            </div>
          </div>
          
          {icon && (
            <div className={`p-2 rounded-lg ${severityStyles[severity]}`}>
              {icon}
            </div>
          )}
        </div>

        {/* Footer */}
        {(subtitle || trend) && (
          <div className="flex items-center justify-between text-xs">
            {subtitle && (
              <span className="text-white/50">{subtitle}</span>
            )}
            
            {trend && (
              <div className={`
                flex items-center gap-1 px-2 py-1 rounded-full
                ${trend.direction === 'up' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
              `}>
                {trend.direction === 'up' ? (
                  <ArrowUpIcon className="w-3 h-3" />
                ) : (
                  <ArrowDownIcon className="w-3 h-3" />
                )}
                <span className="font-medium">
                  {trend.value.toFixed(1)}{trend.label || '%'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
