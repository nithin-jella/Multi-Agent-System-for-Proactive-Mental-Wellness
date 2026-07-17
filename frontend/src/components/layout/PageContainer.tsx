/**
 * Standard page container component
 * Provides consistent layout for non-full-screen pages with:
 * - Min-height for full viewport coverage
 * - Scrollable content area
 * 
 * NOTE: 
 * - Top padding for the fixed header is now handled by AppLayout
 * - Background gradient and particles are now handled by AppLayout
 * - You no longer need to add pt-16 or backgrounds manually to pages
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'min-h-screen overflow-y-auto',
        className
      )}
    >
      {children}
    </div>
  );
}
