/**
 * Authentication wrapper component for protected pages
 */
'use client';

import React from 'react';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function AuthWrapper({ children, requireAdmin = false }: AuthWrapperProps) {
  // For now, we'll just render the children
  // In a real implementation, you'd check authentication state
  
  if (requireAdmin) {
    // Add admin check logic here when auth is implemented
    console.log('Admin access required');
  }

  return <>{children}</>;
}