"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

// Shimmer animation component for realistic loading effect
const Shimmer = ({ className = "" }: { className?: string }) => (
  <div className={`relative overflow-hidden ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// Reusable skeleton primitives
const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white/5 rounded-lg ${className}`}>
    <Shimmer className="h-full w-full rounded-lg" />
  </div>
);

const SkeletonCircle = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white/5 rounded-full ${className}`}>
    <Shimmer className="h-full w-full rounded-full" />
  </div>
);

const SkeletonText = ({ width = "w-full", className = "" }: { width?: string; className?: string }) => (
  <div className={`bg-white/5 h-4 rounded ${width} ${className}`}>
    <Shimmer className="h-full w-full rounded" />
  </div>
);

export default function GlobalSkeleton() {
  const pathname = usePathname();

  // Route-based skeleton selection
  if (pathname?.startsWith("/aika")) {
    return <AikaPageSkeleton />;
  } else if (pathname?.startsWith("/admin")) {
    return <AdminPageSkeleton />;
  } else if (pathname?.startsWith("/dashboard")) {
    return <DashboardPageSkeleton />;
  } else if (pathname?.startsWith("/appointments")) {
    return <AppointmentsPageSkeleton />;
  } else if (pathname?.startsWith("/resources")) {
    return <ResourcesPageSkeleton />;
  } else if (pathname?.startsWith("/profile")) {
    return <ProfilePageSkeleton />;
  } else if (pathname?.startsWith("/journaling")) {
    return <JournalingPageSkeleton />;
  } else if (pathname?.startsWith("/caretoken")) {
    return <CaretokenPageSkeleton />;
  } else {
    return <DefaultPageSkeleton />;
  }
}

function DefaultPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grow min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F]"
    >
      <div className="h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center w-full">
          {/* Logo placeholder */}
          <SkeletonBox className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-6 rounded-xl" />
          {/* Title */}
          <SkeletonText width="w-3/4 sm:w-1/2" className="mx-auto mb-3 h-6 sm:h-8" />
          {/* Subtitle */}
          <SkeletonText width="w-full sm:w-2/3" className="mx-auto mb-2 h-4" />
          <SkeletonText width="w-5/6 sm:w-1/2" className="mx-auto mb-8 h-4" />
          {/* CTA Button */}
          <SkeletonBox className="h-12 w-32 sm:w-40 mx-auto rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}

function AikaPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grow bg-linear-to-b from-[#001D58] to-[#00308F] min-h-screen"
    >
      {/* Header area */}
      <div className="pt-20 pb-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SkeletonCircle className="h-10 w-10 sm:h-12 sm:w-12" />
            <div>
              <SkeletonText width="w-24 sm:w-32" className="mb-1 h-5" />
              <SkeletonText width="w-16 sm:w-20" className="h-3" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
            <SkeletonBox className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Chat messages area */}
      <div className="flex-1 px-4 pb-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* AI message */}
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%] sm:max-w-[70%]">
              <SkeletonCircle className="h-8 w-8 shrink-0" />
              <div className="flex-1">
                <SkeletonBox className="h-20 sm:h-24 rounded-2xl rounded-tl-sm" />
              </div>
            </div>
          </div>
          {/* User message */}
          <div className="flex justify-end">
            <SkeletonBox className="h-12 w-[60%] sm:w-[50%] rounded-2xl rounded-tr-sm" />
          </div>
          {/* AI message */}
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%] sm:max-w-[70%]">
              <SkeletonCircle className="h-8 w-8 shrink-0" />
              <div className="flex-1">
                <SkeletonBox className="h-32 sm:h-40 rounded-2xl rounded-tl-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-linear-to-t from-[#00308F] to-transparent">
        <div className="max-w-4xl mx-auto">
          <SkeletonBox className="h-12 sm:h-14 w-full rounded-xl" />
        </div>
      </div>
    </motion.div>
  );
}

function AdminPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grow bg-[#001D58] min-h-screen p-4 sm:p-6"
    >
      <div className="max-w-7xl mx-auto pt-16 sm:pt-20">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <SkeletonText width="w-48 sm:w-64" className="h-6 sm:h-8 mb-2" />
          <SkeletonText width="w-64 sm:w-96" className="h-4" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-3 sm:p-4">
              <SkeletonText width="w-16 sm:w-24" className="h-3 mb-2" />
              <SkeletonText width="w-12 sm:w-16" className="h-6 sm:h-8" />
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white/5 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-5 gap-4 p-4 border-b border-white/10">
            {[...Array(5)].map((_, i) => (
              <SkeletonText key={i} width="w-20" className="h-4" />
            ))}
          </div>
          {/* Table rows */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 p-3 sm:p-4 border-b border-white/5">
              {[...Array(5)].map((_, j) => (
                <SkeletonText key={j} width={j === 0 ? "w-full" : "w-16"} className={`h-4 ${j > 1 ? 'hidden sm:block' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function DashboardPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F]"
    >
      <div className="max-w-6xl mx-auto px-4 pt-20 sm:pt-24 pb-12 space-y-6 sm:space-y-10">
        {/* Aika hero card */}
        <SkeletonBox className="h-28 sm:h-32 rounded-3xl" />

        {/* Stats cards */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/3 rounded-xl sm:rounded-2xl p-3 sm:p-4">
              <SkeletonCircle className="h-10 w-10 sm:h-12 sm:w-12 mb-2" />
              <SkeletonText width="w-16" className="h-3 mb-1" />
              <SkeletonText width="w-12" className="h-5" />
            </div>
          ))}
        </div>

        {/* Welcome card */}
        <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-white/3 p-4 sm:p-8">
          <div className="space-y-4 sm:space-y-6">
            <SkeletonText width="w-24" className="h-3" />
            <SkeletonText width="w-full sm:w-3/4" className="h-6 sm:h-8" />
            <SkeletonText width="w-full sm:w-2/3" className="h-4" />
            <div className="flex flex-col sm:flex-row gap-3">
              <SkeletonBox className="h-10 sm:h-12 w-full sm:w-40 rounded-full" />
              <SkeletonBox className="h-10 sm:h-12 w-full sm:w-36 rounded-full" />
            </div>
            <SkeletonBox className="h-16 rounded-2xl" />
          </div>
        </div>

        {/* Quest board */}
        <SkeletonBox className="h-56 rounded-3xl" />

        {/* Bento grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          <SkeletonBox className="h-64 rounded-3xl lg:col-span-7" />
          <SkeletonBox className="h-64 rounded-3xl lg:col-span-5" />
          <SkeletonBox className="h-72 rounded-3xl lg:col-span-7" />
          <div className="space-y-6 lg:col-span-5">
            <SkeletonBox className="h-40 rounded-3xl" />
            <SkeletonBox className="h-48 rounded-3xl" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AppointmentsPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-20 sm:pt-24 pb-10 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <SkeletonText width="w-48 sm:w-64" className="h-7 sm:h-9 mb-2" />
          <SkeletonText width="w-64 sm:w-96" className="h-4" />
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <SkeletonBox className="h-10 w-full sm:w-80 rounded-lg" />
          <div className="flex gap-3">
            <SkeletonBox className="h-10 w-28 sm:w-32 rounded-lg" />
            <SkeletonBox className="h-10 w-28 sm:w-32 rounded-lg" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[...Array(3)].map((_, i) => (
            <SkeletonBox key={i} className="h-10 w-24 sm:w-28 rounded-lg" />
          ))}
        </div>

        {/* Appointment cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <SkeletonCircle className="h-12 w-12 sm:h-14 sm:w-14" />
                <div className="flex-1">
                  <SkeletonText width="w-32 sm:w-40" className="h-5 mb-2" />
                  <SkeletonText width="w-24 sm:w-32" className="h-3 mb-3" />
                  <div className="flex gap-2">
                    <SkeletonBox className="h-6 w-20 rounded-full" />
                    <SkeletonBox className="h-6 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ResourcesPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-20 sm:pt-24 pb-10 px-4 sm:px-6"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <SkeletonText width="w-48 sm:w-64" className="h-8 sm:h-10 mx-auto mb-3" />
          <SkeletonText width="w-64 sm:w-96" className="h-4 mx-auto" />
        </div>

        {/* Crisis banner */}
        <SkeletonBox className="h-20 sm:h-24 rounded-xl mb-8" />

        {/* Section title */}
        <SkeletonText width="w-40 sm:w-56" className="h-6 mb-4" />

        {/* Resource cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <SkeletonBox className="h-10 w-10 rounded-lg" />
                <SkeletonText width="w-24 sm:w-32" className="h-5" />
              </div>
              <SkeletonText width="w-full" className="h-3 mb-2" />
              <SkeletonText width="w-3/4" className="h-3" />
            </div>
          ))}
        </div>

        {/* Practices section */}
        <SkeletonText width="w-48" className="h-6 mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonBox key={i} className="h-48 sm:h-56 rounded-xl" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ProfilePageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-20 sm:pt-24 pb-10 px-4 sm:px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Profile header */}
        <div className="bg-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <SkeletonCircle className="h-20 w-20 sm:h-24 sm:w-24" />
            <div className="text-center sm:text-left flex-1">
              <SkeletonText width="w-40 sm:w-48" className="h-6 sm:h-7 mb-2 mx-auto sm:mx-0" />
              <SkeletonText width="w-32 sm:w-40" className="h-4 mx-auto sm:mx-0" />
            </div>
            <SkeletonBox className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-3 sm:p-4 text-center">
              <SkeletonText width="w-12" className="h-6 mx-auto mb-1" />
              <SkeletonText width="w-16" className="h-3 mx-auto" />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <SkeletonBox key={i} className="h-10 w-24 sm:w-28 rounded-lg shrink-0" />
          ))}
        </div>

        {/* Content area */}
        <SkeletonBox className="h-64 sm:h-80 rounded-xl" />
      </div>
    </motion.div>
  );
}

function JournalingPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-20 sm:pt-24 pb-10 px-4 sm:px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <SkeletonText width="w-40 sm:w-48" className="h-7 sm:h-8 mb-2" />
          <SkeletonText width="w-64 sm:w-80" className="h-4" />
        </div>

        {/* New entry button */}
        <SkeletonBox className="h-12 w-full sm:w-48 rounded-xl mb-6" />

        {/* Journal entries */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <SkeletonText width="w-32 sm:w-40" className="h-5 mb-1" />
                  <SkeletonText width="w-20 sm:w-24" className="h-3" />
                </div>
                <SkeletonBox className="h-6 w-16 rounded-full" />
              </div>
              <SkeletonText width="w-full" className="h-3 mb-2" />
              <SkeletonText width="w-5/6" className="h-3 mb-2" />
              <SkeletonText width="w-2/3" className="h-3" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CaretokenPageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-linear-to-b from-[#001D58] to-[#00308F] pt-20 sm:pt-24 pb-10 px-4 sm:px-6"
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <SkeletonText width="w-48 sm:w-64" className="h-8 sm:h-10 mx-auto mb-3" />
          <SkeletonText width="w-64 sm:w-96" className="h-4 mx-auto" />
        </div>

        {/* Token balance card */}
        <div className="bg-white/5 rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-8 text-center">
          <SkeletonCircle className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4" />
          <SkeletonText width="w-32" className="h-8 mx-auto mb-2" />
          <SkeletonText width="w-24" className="h-4 mx-auto" />
          <div className="flex justify-center gap-3 mt-6">
            <SkeletonBox className="h-10 w-24 rounded-lg" />
            <SkeletonBox className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <SkeletonBox key={i} className="h-32 sm:h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Export individual skeletons for direct use
export {
  AikaPageSkeleton,
  AdminPageSkeleton,
  DashboardPageSkeleton,
  AppointmentsPageSkeleton,
  ResourcesPageSkeleton,
  ProfilePageSkeleton,
  JournalingPageSkeleton,
  CaretokenPageSkeleton,
  DefaultPageSkeleton,
  SkeletonBox,
  SkeletonCircle,
  SkeletonText,
  Shimmer,
};