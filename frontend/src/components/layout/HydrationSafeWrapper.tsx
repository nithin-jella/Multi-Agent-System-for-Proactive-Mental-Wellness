// src/components/layout/HydrationSafeWrapper.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface HydrationSafeWrapperProps {
  children: React.ReactNode;
}

export default function HydrationSafeWrapper({ children }: HydrationSafeWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null; // Render nothing on the server, or until mounted on client
  }

  return (
    <React.Fragment> {/* Use Fragment to avoid adding extra div */}
      {children}
    </React.Fragment>
  );
}