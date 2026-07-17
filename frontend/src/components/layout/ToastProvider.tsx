// src/components/layout/ToastProvider.tsx
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const hasWelcomedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const userKey =
        (session.user as { id?: string })?.id ?? session.user.email ?? session.user.name ?? "unknown-user";

      if (hasWelcomedRef.current !== userKey) {
        const firstName = session.user.name?.split(" ")[0] ?? session.user.name ?? "friend";
        toast.success(`Welcome back, ${firstName}!`);
        hasWelcomedRef.current = userKey;
      }
    }

    if (status === "unauthenticated") {
      hasWelcomedRef.current = null;
    }
  }, [status, session]);

  return <>{children}</>;
}
