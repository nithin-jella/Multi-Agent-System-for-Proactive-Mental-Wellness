'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import type { HistoricalDataPoint } from '@/types/admin/dashboard';

interface TrendChartProps {
  title: string;
  data: HistoricalDataPoint[];
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan';
  suffix?: string;
  height?: number;
  showGrid?: boolean;
}

const colorConfig = {
  blue: {
    stroke: '#3b82f6',
    fill: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-500',
    bgGlow: 'shadow-blue-500/20',
  },
  green: {
    stroke: '#22c55e',
    fill: '#22c55e',
    gradient: 'from-green-500 to-emerald-500',
    bgGlow: 'shadow-green-500/20',
  },
  purple: {
    stroke: '#a855f7',
    fill: '#a855f7',
    gradient: 'from-purple-500 to-pink-500',
    bgGlow: 'shadow-purple-500/20',
  },
  orange: {
    stroke: '#f97316',
    fill: '#f97316',
    gradient: 'from-orange-500 to-yellow-500',
    bgGlow: 'shadow-orange-500/20',
  },
  red: {
    stroke: '#ef4444',
    fill: '#ef4444',
    gradient: 'from-red-500 to-rose-500',
    bgGlow: 'shadow-red-500/20',
  },
  cyan: {
    stroke: '#06b6d4',
    fill: '#06b6d4',
    gradient: 'from-cyan-500 to-teal-500',
    bgGlow: 'shadow-cyan-500/20',
  },
};

// Custom tooltip component with glassmorphism
function CustomTooltip({ 
  active, 
  payload, 
  label, 
  suffix 
}: { 
  active?: boolean; 
  payload?: Array<{ value: number }>; 
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#001a47]/90 backdrop-blur-md border border-white/20 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-white/60 mb-1">{label}</p>
      <p className="text-sm font-bold text-white">
        {payload[0].value.toFixed(1)}{suffix}
      </p>
    </div>
  );
}

export function TrendChart({
  title,
  data,
  color = 'blue',
  suffix = '',
  height = 180,
  showGrid = false,
}: TrendChartProps) {
  const config = colorConfig[color];

  // Process and validate data
  const { chartData, stats } = useMemo(() => {
    const validData = data.filter(d => d.value !== null && d.value !== undefined);
    
    if (validData.length === 0) {
      return { chartData: [], stats: null };
    }

    const values = validData.map(d => d.value as number);
    const currentValue = values[values.length - 1];
    const previousValue = values.length > 1 ? values[values.length - 2] : values[0];
    const changePercent = previousValue !== 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : 0;
    
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

    // Format data for Recharts
    const formatted = validData.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.value as number,
      fullDate: d.date,
    }));

    return {
      chartData: formatted,
      stats: {
        current: currentValue,
        change: changePercent,
        min: minValue,
        max: maxValue,
        avg: avgValue,
        isUp: changePercent >= 0,
      },
    };
  }, [data]);

  // No data state
  if (!stats || chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6"
      >
        <h4 className="text-sm font-medium text-white/80 mb-4">{title}</h4>
        <div className="flex items-center justify-center h-32 text-white/40 text-sm">
          No data available
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden shadow-lg ${config.bgGlow}`}
    >
      {/* Header with stats */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-medium text-white/70 mb-1">{title}</h4>
            <div className="flex items-baseline gap-3">
              <span className={`text-2xl font-bold bg-linear-to-r ${config.gradient} bg-clip-text text-transparent`}>
                {stats.current.toFixed(1)}{suffix}
              </span>
              {stats.change !== 0 && (
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  stats.isUp
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {stats.isUp ? (
                    <ArrowTrendingUpIcon className="w-3 h-3" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-3 h-3" />
                  )}
                  <span className="font-medium">
                    {stats.isUp ? '+' : ''}{stats.change.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Min/Max/Avg summary */}
          <div className="text-right text-xs text-white/50 space-y-0.5">
            <div>Max: <span className="text-white/70">{stats.max.toFixed(1)}{suffix}</span></div>
            <div>Avg: <span className="text-white/70">{stats.avg.toFixed(1)}{suffix}</span></div>
            <div>Min: <span className="text-white/70">{stats.min.toFixed(1)}{suffix}</span></div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-4">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.fill} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.fill} stopOpacity={0} />
              </linearGradient>
            </defs>
            
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
            )}
            
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              tickMargin={8}
              interval="preserveStartEnd"
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              tickFormatter={(value) => `${value}${suffix}`}
              domain={['dataMin - 5', 'dataMax + 5']}
              width={50}
            />
            
            <Tooltip
              content={<CustomTooltip suffix={suffix} />}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
            />
            
            <Area
              type="monotone"
              dataKey="value"
              stroke={config.stroke}
              strokeWidth={2}
              fill={`url(#gradient-${color})`}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
