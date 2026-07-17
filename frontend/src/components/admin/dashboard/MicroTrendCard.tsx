'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/solid';

interface MicroTrendPoint {
  date: string;
  value: number;
}

interface MicroTrendCardProps {
  title: string;
  value: string;
  subtitle: string;
  data: MicroTrendPoint[];
  color: 'blue' | 'green' | 'purple' | 'cyan' | 'amber';
  /** Optional icon displayed in the header, used when there is no sparkline (e.g. point-in-time stats) */
  icon?: ReactNode;
}

const colorMap = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  cyan: '#06b6d4',
  amber: '#f59e0b',
} as const;

function getTrendDirection(values: number[]): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  const previous = values[values.length - 2];
  const current = values[values.length - 1];
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function calculateDeltaPercent(values: number[]): number {
  if (values.length < 2 || values[values.length - 2] === 0) return 0;
  const previous = values[values.length - 2];
  const current = values[values.length - 1];
  return ((current - previous) / previous) * 100;
}

function MiniTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/20 bg-[#001a47]/90 px-2 py-1 text-xs text-white">
      {payload[0].value.toFixed(1)}
    </div>
  );
}

export function MicroTrendCard({ title, value, subtitle, data, color, icon }: MicroTrendCardProps) {
  const values = data.map((point) => point.value);
  const direction = getTrendDirection(values);
  const delta = Math.abs(calculateDeltaPercent(values));
  const hasSparkline = data.length > 1;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-[#00153a]/20 backdrop-blur"
      aria-label={`${title} metric`}
    >
      <div className={`mb-3 flex items-start justify-between ${!hasSparkline ? 'mb-0' : ''}`}>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-white/60">{subtitle}</p>
        </div>
        {/* Show trend badge when sparkline data exists, icon otherwise */}
        {hasSparkline ? (
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              direction === 'up'
                ? 'bg-green-500/10 text-green-400'
                : direction === 'down'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-white/10 text-white/70'
            }`}
          >
            {direction === 'up' && <ArrowUpIcon className="h-3 w-3" />}
            {direction === 'down' && <ArrowDownIcon className="h-3 w-3" />}
            {direction === 'flat' ? 'Stable' : `${delta.toFixed(1)}%`}
          </div>
        ) : (
          icon && <div className="rounded-xl bg-white/8 p-2">{icon}</div>
        )}
      </div>

      {hasSparkline && (
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <Tooltip content={<MiniTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colorMap[color]}
                strokeWidth={2}
                fill={colorMap[color]}
                fillOpacity={0.15}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.article>
  );
}
