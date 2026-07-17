// src/components/ui/LoadingDots.tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingDotsProps {
  text?: string;
  className?: string;
  dotClassName?: string; // Allow customizing dot color/size if needed
  textClassName?: string; // Allow customizing text style
}

export function LoadingDots({
  text, // Removed default "Loading..." text here, will be added in MessageBubble
  className,
  dotClassName = 'bg-current', // Default to current text color
  textClassName = 'text-xs font-medium text-current/80', // Default text style
}: LoadingDotsProps) {
  return (
    <div className={cn("flex items-center space-x-1.5", className)}>
      {/* Dot 1 */}
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full animate-pulse',
          dotClassName
        )}
        style={{ animationDelay: '0s', animationDuration: '1s' }} // Adjust duration/delay
      ></span>
      {/* Dot 2 */}
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full animate-pulse',
          dotClassName
        )}
         style={{ animationDelay: '0.15s', animationDuration: '1s' }} // Staggered delay
      ></span>
      {/* Dot 3 */}
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full animate-pulse',
          dotClassName
        )}
         style={{ animationDelay: '0.3s', animationDuration: '1s' }} // Staggered delay
      ></span>

      {/* Optional Text */}
      {text && (
        <span className={cn("ml-2", textClassName)}> {/* Add margin-left */}
            {text}
        </span>
      )}
    </div>
  );
}