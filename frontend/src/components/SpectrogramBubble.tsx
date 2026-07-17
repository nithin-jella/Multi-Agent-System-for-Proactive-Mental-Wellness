'use client';

import React, { useMemo } from 'react';

interface SpectrogramBubbleProps {
  isActive: boolean;
  data: number[];
}

const BAR_COUNT = 28;
const MIN_BAR_HEIGHT = 8;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const SpectrogramBubble: React.FC<SpectrogramBubbleProps> = ({ isActive, data }) => {
  const bars = useMemo(() => {
    if (data && data.length > 0) {
      return Array.from({ length: BAR_COUNT }, (_, index) => {
        const sample = data[index % data.length] ?? 0;
        return clamp01(sample);
      });
    }
    return Array(BAR_COUNT).fill(0);
  }, [data]);

  return (
    <div
      className={`relative flex h-32 w-full max-w-md items-end justify-center overflow-hidden rounded-3xl border border-white/12 bg-slate-900/80 px-5 py-6 shadow-[0_28px_60px_rgba(8,12,36,0.55)] transition-shadow duration-500 ${
        isActive ? 'shadow-[0_32px_80px_rgba(46,118,255,0.35)]' : ''
      }`}
    >
      <div className="absolute inset-0 bg-linear-to-br from-[#1e2b5f]/55 via-slate-900/60 to-[#0f172a]/80" aria-hidden="true" />
      <div className="absolute inset-x-4 bottom-2 h-24 rounded-2xl bg-linear-to-t from-ugm-gold/10 via-transparent to-transparent blur-xl" aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full items-end justify-center gap-[6px]">
        {bars.map((value, index) => {
          const height = Math.max(MIN_BAR_HEIGHT, value * 100);
          const opacity = 0.35 + value * 0.6;
          return (
            <span
              key={`${index}-${value}`}
              className="flex-1 rounded-full bg-linear-to-t from-ugm-gold/15 via-ugm-gold/35 to-white/90 transition-[height,opacity,filter] duration-150 ease-out"
              style={{
                height: `${height}%`,
                opacity,
                filter: `drop-shadow(0 0 ${12 * value}px rgba(255,197,64,${0.35 + value * 0.25}))`,
              }}
            />
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/12" />
    </div>
  );
};

export default SpectrogramBubble;
