'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChartBarIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useAdminCounselors, useAdminCounselorStats } from '@/hooks/useCounselors';
import type { CounselorResponse } from '@/lib/appointments-api';

const MAX_ON_DUTY_ITEMS = 8;

function calculateCompletionRate(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (completed / total) * 100;
}

function classifyWorkload(upcomingAppointments: number): {
  label: 'Low' | 'Moderate' | 'High';
  barClass: string;
  textClass: string;
  width: number;
} {
  if (upcomingAppointments <= 2) {
    return {
      label: 'Low',
      barClass: 'bg-emerald-400',
      textClass: 'text-emerald-300',
      width: 30,
    };
  }

  if (upcomingAppointments <= 5) {
    return {
      label: 'Moderate',
      barClass: 'bg-yellow-400',
      textClass: 'text-yellow-300',
      width: 65,
    };
  }

  return {
    label: 'High',
    barClass: 'bg-red-400',
    textClass: 'text-red-300',
    width: 100,
  };
}

function CounselorDutyRow({ counselor, index }: { counselor: CounselorResponse; index: number }) {
  const { data: stats, isLoading } = useAdminCounselorStats(counselor.id);

  const totalAppointments = stats?.total_appointments ?? 0;
  const completedAppointments = stats?.completed_appointments ?? 0;
  const upcomingAppointments = stats?.upcoming_appointments ?? 0;
  const totalPatients = stats?.total_patients ?? 0;

  const completionRate = calculateCompletionRate(completedAppointments, totalAppointments);
  const workload = classifyWorkload(upcomingAppointments);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border-b border-white/10 last:border-b-0"
    >
      <td className="px-4 py-3 text-sm text-white">
        <div className="flex flex-col">
          <span className="font-semibold">{counselor.name}</span>
          <span className="text-xs text-white/55">{counselor.specialization || 'General Counseling'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-white/80">
        {isLoading ? 'Loading…' : totalPatients}
      </td>
      <td className="px-4 py-3 text-sm text-white/80">
        {isLoading ? 'Loading…' : `${completionRate.toFixed(0)}%`}
      </td>
      <td className="px-4 py-3 text-sm">
        {isLoading ? (
          <span className="text-white/60">Loading…</span>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={workload.textClass}>{workload.label}</span>
              <span className="text-white/60">{upcomingAppointments} upcoming</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className={`h-1.5 rounded-full ${workload.barClass}`}
                style={{ width: `${workload.width}%` }}
              />
            </div>
          </div>
        )}
      </td>
    </motion.tr>
  );
}

export function OnDutyCounselorsPanel() {
  const { data, isLoading, error } = useAdminCounselors({ page: 1, page_size: 200 });

  const onDutyCounselors = (data?.counselors ?? [])
    .filter((counselor) => counselor.is_available)
    .slice(0, MAX_ON_DUTY_ITEMS);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur" aria-label="On-duty counselors">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Counselors On-duty</h2>
          <p className="text-xs text-white/55">Live availability, performance, and workload indicators</p>
        </div>
        <Link
          href="/admin/counselors"
          className="rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-xs font-medium text-white hover:bg-white/12"
        >
          Manage Counselors
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load counselor data.
        </div>
      ) : onDutyCounselors.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/65">
          No counselors are currently marked as available.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/60">
                <UserGroupIcon className="h-4 w-4" />
                On-duty Count
              </div>
              <p className="text-2xl font-bold text-white">{onDutyCounselors.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/60">
                <ChartBarIcon className="h-4 w-4" />
                Average Rating
              </div>
              <p className="text-2xl font-bold text-white">
                {(onDutyCounselors.reduce((acc, item) => acc + item.rating, 0) / onDutyCounselors.length).toFixed(1)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-white/60">
                <ClockIcon className="h-4 w-4" />
                Avg Experience
              </div>
              <p className="text-2xl font-bold text-white">
                {Math.round(
                  onDutyCounselors.reduce((acc, item) => acc + (item.years_of_experience ?? 0), 0) /
                    onDutyCounselors.length,
                )}
                y
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/60">
                  <th className="px-4 py-2">Counselor</th>
                  <th className="px-4 py-2">Active Patients</th>
                  <th className="px-4 py-2">Completion Rate</th>
                  <th className="px-4 py-2">Workload</th>
                </tr>
              </thead>
              <tbody>
                {onDutyCounselors.map((counselor, index) => (
                  <CounselorDutyRow
                    key={counselor.id}
                    counselor={counselor}
                    index={index}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
