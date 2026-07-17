"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactElement } from 'react';

interface SidebarLinkProps {
  href: string;
  icon: ReactElement;
  label: string;
}

export default function SidebarLink({ href, icon, label }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href) && href.split('/').length <= pathname.split('/').length);


  return (
    <li>
      <Link
        href={href}
        className={`flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 group ${
          isActive
            ? 'bg-[#FFCA40]/15 text-[#FFCA40] shadow-sm'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
      >
        <span className={`mr-3 shrink-0 ${isActive ? 'text-[#FFCA40]' : 'text-white/60 group-hover:text-white/80'}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}