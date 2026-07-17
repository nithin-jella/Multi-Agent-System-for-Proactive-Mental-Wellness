"use client";
import React, { useEffect, useState } from 'react';

interface AccessGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  introspectUrl?: string; // endpoint returning current user { role: string }
}

// Simple access guard leveraging an introspection endpoint (must exist server-side)
// If no endpoint provided, renders children (optimistic) but logs a warning.
export const AccessGuard: React.FC<AccessGuardProps> = ({
  children,
  requiredRoles = ["admin", "therapist"],
  fallback = <div className="text-red-400 text-sm">Access denied.</div>,
  introspectUrl = (process.env.NEXT_PUBLIC_BACKEND_BASE || process.env.NEXT_PUBLIC_API_URL || '')
    ? (process.env.NEXT_PUBLIC_BACKEND_BASE || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '') + '/api/v1/auth/me'
    : undefined
}) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if(!introspectUrl){
        console.warn('AccessGuard: introspect URL not configured (missing NEXT_PUBLIC_BACKEND_BASE or NEXT_PUBLIC_API_URL). Allowing access for development.');
        setAllowed(true);
        return;
      }
      try {
        const res = await fetch(introspectUrl, { credentials: 'include' });
        if(!res.ok){
          if(!cancelled) setAllowed(false);
          return;
        }
        const data = await res.json();
        const role = (data?.role || '').toLowerCase();
        if(!cancelled) setAllowed(requiredRoles.map(r=> r.toLowerCase()).includes(role));
      } catch {
        if(!cancelled) setAllowed(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [introspectUrl, requiredRoles]);

  if(allowed === null) {
    return <div className="text-xs text-gray-400">Verifying access…</div>;
  }
  if(!allowed) return <>{fallback}</>;
  return <>{children}</>;
};

export default AccessGuard;
