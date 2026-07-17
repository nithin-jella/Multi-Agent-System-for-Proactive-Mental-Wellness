"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Footer from "./Footer";
import MinimalFooter from "./MinimalFooter";

/**
 * Smart footer wrapper that displays the appropriate footer based on context:
 * - Full footer: Landing page only (marketing context)
 * - Minimal footer: Auth pages, static content pages (about, privacy, terms, resources)
 * - No footer: Logged-in app pages, Aika chat, admin/counselor dashboards, CareQuest
 */
export default function FooterWrapper() {
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Pages that should NEVER have a footer (immersive experiences)
  const noFooterPages = [
    '/aika',
    '/carequest',
    '/admin',
    '/counselor',
  ];

  // Check if current path starts with any no-footer prefix
  const isNoFooterPage = noFooterPages.some(page => pathname?.startsWith(page));
  if (isNoFooterPage) {
    return null;
  }

  // Pages that get the FULL footer (marketing/landing context)
  const fullFooterPages = ['/'];
  const isFullFooterPage = fullFooterPages.includes(pathname || '');

  // For authenticated users on app pages, skip footer entirely
  // (sidebar provides navigation; footer is redundant)
  const appPages = [
    '/dashboard',
    '/journaling',
    '/profile',
    '/appointments',
    '/activities',
    '/quests',
    '/caretoken',
    '/survey',
  ];
  const isAppPage = appPages.some(page => pathname?.startsWith(page));
  
  if (isAuthenticated && isAppPage) {
    return null;
  }

  // Landing page gets full footer
  if (isFullFooterPage) {
    return <Footer />;
  }

  // Auth pages and static content pages get minimal footer
  const minimalFooterPages = [
    '/signin',
    '/signup',
    '/signin-ugm',
    '/forgot-password',
    '/reset-password',
    '/about',
    '/privacy',
    '/terms',
    '/resources',
    '/access-denied',
  ];
  const isMinimalFooterPage = minimalFooterPages.some(page => pathname?.startsWith(page));
  
  if (isMinimalFooterPage) {
    return <MinimalFooter />;
  }

  // Default: no footer for unmatched authenticated pages
  if (isAuthenticated) {
    return null;
  }

  // Default for unauthenticated: minimal footer
  return <MinimalFooter />;
}