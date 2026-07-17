"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

export default function HeaderWrapper() {
  const pathname = usePathname();
  
  // Don't render the header on admin and aika chat pages
  if (pathname?.startsWith('/aika') || 
     (pathname?.startsWith('/admin/') && pathname !== '/admin')) {
    return null;
  }
  
  return <Header onToggleSidebar={() => {}} />;
}