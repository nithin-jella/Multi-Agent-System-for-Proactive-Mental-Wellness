export default function CounselorDashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-9 w-56 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-4 w-full max-w-2xl animate-pulse rounded bg-white/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-8 w-14 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="h-6 w-52 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-white/10" />
            <div className="mt-5 space-y-3">
              <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
              <div className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/5" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-16 animate-pulse rounded-lg border border-red-500/20 bg-red-500/10" />
            <div className="mt-3 h-16 animate-pulse rounded-lg border border-red-500/20 bg-red-500/10" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="h-6 w-36 animate-pulse rounded bg-white/10" />
            <div className="mt-4 space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-white/10" />
              <div className="h-10 animate-pulse rounded-lg bg-white/10" />
              <div className="h-10 animate-pulse rounded-lg bg-white/10" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-white/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
