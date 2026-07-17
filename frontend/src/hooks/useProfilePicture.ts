"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fetchUserProfileOverview } from "@/services/api";

const DEFAULT_AVATAR = "/default-avatar.png";

interface UseProfilePictureResult {
  /** Always a non-null resolved URL ready to pass to <Image src={...}> */
  src: string;
  isLoading: boolean;
}

function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  // Next/Image blocks remote SVG optimization by default.
  // DiceBear supports PNG endpoints, so normalize legacy SVG URLs to PNG.
  if (url.includes("api.dicebear.com")) {
    return url.replace(/\/svg(\?|$)/, "/png$1");
  }

  return url;
}

/**
 * Canonical hook for resolving the current user's profile picture.
 *
 * Fallback chain (in priority order):
 *   1. `profile.header.avatar_url`  — always resolved server-side:
 *      either the user-uploaded DB photo OR the DiceBear initials fallback.
 *   2. `session.user?.image`        — OAuth Google picture (first-login gap).
 *   3. `"/default-avatar.png"`      — static asset, always available.
 *
 * Components that need the profile picture should import this hook instead of
 * reading `session.user?.image` directly, so the canonical source of truth is
 * the backend `user_profiles.profile_photo_url` field.
 */
export function useProfilePicture(): UseProfilePictureResult {
  const { data: session } = useSession();
  const [src, setSrc] = useState<string>(DEFAULT_AVATAR);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setIsLoading(true);
      try {
        const overview = await fetchUserProfileOverview();
        if (!cancelled) {
          const resolved =
            normalizeAvatarUrl(overview.header.avatar_url) ||
            session?.user?.image ||
            DEFAULT_AVATAR;
          setSrc(resolved);
        }
      } catch {
        // Backend unavailable — fall back to OAuth image or static default
        if (!cancelled) {
          setSrc(session?.user?.image || DEFAULT_AVATAR);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (session) {
      resolve();
    } else {
      setSrc(DEFAULT_AVATAR);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [session]);

  return { src, isLoading };
}
