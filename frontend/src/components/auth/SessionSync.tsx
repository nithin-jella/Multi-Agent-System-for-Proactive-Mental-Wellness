"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { setAccessToken } from "@/services/api";

/**
 * This component is responsible for synchronizing the NextAuth session token
 * with the API client's local state. This avoids calling getSession() on every
 * API request, which would trigger unnecessary network calls.
 */
export default function SessionSync() {
  const { data: session } = useSession();

  useEffect(() => {
    // Update the access token in the API client whenever the session changes
    setAccessToken(session?.accessToken);
  }, [session?.accessToken]);

  return null;
}
