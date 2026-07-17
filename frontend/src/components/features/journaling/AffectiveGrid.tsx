"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AffectiveGridProps {
  valence: number | null;
  arousal: number | null;
  onChange: (valence: number, arousal: number) => void;
  disabled?: boolean;
}

const getAffectiveLabel = (v: number, a: number) => {
  if (v === 0 && a === 0) return "Neutral";
  
  // Quadrant detection
  if (v >= 0 && a >= 0) {
    if (a > v) return "Excited / Alert";
    return "Happy / Content";
  } else if (v < 0 && a >= 0) {
    if (a > Math.abs(v)) return "Tense / Nervous";
    return "Stressed / Upset";
  } else if (v < 0 && a < 0) {
    if (Math.abs(a) > Math.abs(v)) return "Bored / Lethargic";
    return "Sad / Depressed";
  } else {
    if (Math.abs(a) > v) return "Calm / Relaxed";
    return "Serene / Peaceful";
  }
};

export default function AffectiveGrid({ valence, arousal, onChange, disabled }: AffectiveGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerAction = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (disabled || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixels to -1.0 to 1.0
    // X-axis: 0 at left (-1), rect.width at right (1)
    // Y-axis: 0 at top (1), rect.height at bottom (-1)
    const v = Math.max(-1, Math.min(1, (x / rect.width) * 2 - 1));
    const a = Math.max(-1, Math.min(1, 1 - (y / rect.height) * 2));

    onChange(parseFloat(v.toFixed(2)), parseFloat(a.toFixed(2)));
  }, [disabled, onChange]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    handlePointerAction(e);
  }, [handlePointerAction]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDragging) handlePointerAction(e);
    };
    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerAction, isDragging]);

  const displayValence = valence ?? 0;
  const displayArousal = arousal ?? 0;

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <div 
        ref={gridRef}
        onPointerDown={onPointerDown}
        className={`relative w-full aspect-square max-w-[250px] bg-slate-800/50 rounded-xl border-2 border-white/10 cursor-crosshair overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Axes */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20"></div>
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20"></div>
        
        {/* Labels */}
        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">High Energy</span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Low Energy</span>
        <span className="absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-gray-500 font-bold uppercase tracking-wider rotate-90 origin-right translate-x-1/2">Positive</span>
        <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-gray-500 font-bold uppercase tracking-wider -rotate-90 origin-left -translate-x-1/2">Negative</span>

        {/* Quadrant Hints */}
        <div className="absolute top-4 right-4 text-[10px] text-blue-400/30 font-medium">Excited</div>
        <div className="absolute top-4 left-4 text-[10px] text-red-400/30 font-medium">Tense</div>
        <div className="absolute bottom-4 left-4 text-[10px] text-purple-400/30 font-medium">Sad</div>
        <div className="absolute bottom-4 right-4 text-[10px] text-green-400/30 font-medium">Calm</div>

        {/* The Point */}
        <div 
          className="absolute w-4 h-4 bg-[#FFCA40] rounded-full shadow-[0_0_15px_rgba(255,202,64,0.6)] border-2 border-white -translate-x-1/2 translate-y-1/2 transition-transform duration-75 ease-out pointer-events-none"
          style={{ 
            left: `${(displayValence + 1) * 50}%`, 
            bottom: `${(displayArousal + 1) * 50}%` 
          }}
        ></div>
      </div>
      
      <div className="text-center">
        <p className="text-sm font-semibold text-[#FFCA40]">
          {valence !== null ? getAffectiveLabel(displayValence, displayArousal) : "Tap the grid to set affective state"}
        </p>
        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">
          Valence: {displayValence} | Arousal: {displayArousal}
        </p>
      </div>
    </div>
  );
}
