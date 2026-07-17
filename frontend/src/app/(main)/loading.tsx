import GlobalSkeleton from "@/components/ui/GlobalSkeleton";

/**
 * Next.js built-in loading state for (main) layout.
 * Automatically shows skeleton during page transitions and data fetching.
 */
export default function Loading() {
  return <GlobalSkeleton />;
}
