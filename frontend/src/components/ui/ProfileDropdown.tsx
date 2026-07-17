"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import type { Session } from "next-auth";
import { FiUser, FiLogOut, FiSettings, FiHelpCircle, FiZap } from "react-icons/fi";
import type { WellnessState } from "@/types/quests";

interface ProfileDropdownProps {
  isOpen: boolean;
  user: NonNullable<Session["user"]>;
  onClose: () => void;
  onSignOut: () => void;
  wellness?: WellnessState;
  /** Resolved profile picture URL from useProfilePicture hook (avoids double fetch) */
  profilePictureSrc?: string;
}

export default function ProfileDropdown({ isOpen, user, onClose, onSignOut, wellness, profilePictureSrc }: ProfileDropdownProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const role = user.role ?? "user";
  const isAdmin = role === "admin";
  const isCounselor = role === "counselor";

  const profileHref = isAdmin ? "/admin/profile" : isCounselor ? "/counselor/profile" : "/profile";
  const dashboardHref = isAdmin ? "/admin/dashboard" : isCounselor ? "/counselor/dashboard" : "/dashboard";
  const settingsHref = isAdmin ? "/admin/settings" : isCounselor ? "/counselor/settings" : null;

  const menuItems = [
    {
      href: dashboardHref,
      label: "Dashboard",
      icon: <FiUser className="w-4 h-4" />,
    },
    {
      href: profileHref,
      label: "My Profile",
      icon: <FiUser className="w-4 h-4" />,
    },
    {
      href: "/quests",
      label: "Quest Board",
      icon: <FiZap className="w-4 h-4" />,
    },
    ...(settingsHref
      ? [
          {
            href: settingsHref,
            label: "Settings",
            icon: <FiSettings className="w-4 h-4" />,
          },
        ]
      : []),
    {
      href: "/resources",
      label: "Resources",
      icon: <FiHelpCircle className="w-4 h-4" />,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dropdown Menu */}
          <motion.div
            key="profile-menu"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            id="profile-menu"
            role="menu"
            aria-label="Profile menu"
            className="absolute top-full right-0 mt-2 w-72 origin-top-right rounded-2xl border border-white/10 bg-[#001D58]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* User Header */}
            <div className="p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20">
                  <Image
                    src={profilePictureSrc || user.image || "/default-avatar.png"}
                    alt={user.name || "User"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Wellness Points */}
            <div className="p-4 border-b border-white/10">
              <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2">Wellness Points</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">JOY</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{wellness ? wellness.joy_balance : "—"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">CARE</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{wellness ? wellness.care_balance : "—"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Harmony</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{wellness ? wellness.harmony_score : "—"}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  role="menuitem"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors duration-200 group"
                >
                  <span className="text-white/60 group-hover:text-[#FFCA40] transition-colors">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10 mx-2 my-1" />

            {/* Sign Out */}
            <div className="p-2">
              <button
                onClick={onSignOut}
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-colors duration-200"
              >
                <FiLogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
