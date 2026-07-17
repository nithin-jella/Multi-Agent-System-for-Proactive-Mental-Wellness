// src/components/ui/Tooltip.tsx
// Custom lightweight tooltip to replace @mui/material/Tooltip

"use client";

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  title: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  children,
  placement = 'top',
  className = '',
  delay = 500
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none transition-opacity duration-200";
    const placementClasses = {
      top: "bottom-full left-1/2 transform -translate-x-1/2 mb-1",
      bottom: "top-full left-1/2 transform -translate-x-1/2 mt-1",
      left: "right-full top-1/2 transform -translate-y-1/2 mr-1",
      right: "left-full top-1/2 transform -translate-y-1/2 ml-1"
    };
    
    return cn(
      baseClasses,
      placementClasses[placement],
      isVisible ? "opacity-100" : "opacity-0",
      className
    );
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <div ref={tooltipRef} className={getTooltipClasses()}>
        {title}
        {/* Arrow */}
        <div className={cn(
          "absolute w-0 h-0 border-2 border-solid border-transparent",
          placement === 'top' && "top-full left-1/2 transform -translate-x-1/2 border-t-gray-900",
          placement === 'bottom' && "bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-900",
          placement === 'left' && "left-full top-1/2 transform -translate-y-1/2 border-l-gray-900",
          placement === 'right' && "right-full top-1/2 transform -translate-y-1/2 border-r-gray-900"
        )} />
      </div>
    </div>
  );
};

export default Tooltip;
