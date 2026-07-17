// hooks/useCounselors.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/appointments-api';
import { toast } from 'react-hot-toast';

// ========================================
// ADMIN HOOKS
// ========================================

export function useAdminCounselors(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  is_available?: boolean;
  specialization?: string;
}) {
  return useQuery({
    queryKey: ['admin-counselors', params],
    queryFn: () => api.listCounselors(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useAdminCounselor(id: number | null) {
  return useQuery({
    queryKey: ['admin-counselor', id],
    queryFn: () => api.getAdminCounselor(id!),
    enabled: !!id,
  });
}

export function useAdminCounselorStats(id: number | null) {
  return useQuery({
    queryKey: ['admin-counselor-stats', id],
    queryFn: () => api.getCounselorStatsAdmin(id!),
    enabled: !!id,
  });
}

export function useCreateCounselor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCounselor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-counselors'] });
      toast.success('Counselor profile created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create counselor profile');
    },
  });
}

export function useUpdateCounselor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: api.CounselorUpdate }) =>
      api.updateCounselor(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-counselors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-counselor', variables.id] });
      toast.success('Counselor profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update counselor profile');
    },
  });
}

export function useToggleCounselorAvailabilityAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_available }: { id: number; is_available: boolean }) =>
      api.toggleCounselorAvailabilityAdmin(id, is_available),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-counselors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-counselor', variables.id] });
      toast.success('Availability updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update availability');
    },
  });
}

export function useDeleteCounselor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCounselor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-counselors'] });
      toast.success('Counselor profile deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete counselor profile');
    },
  });
}

// ========================================
// COUNSELOR HOOKS
// ========================================

/**
 * Hook to get own profile (Counselor)
 */
export function useCounselorProfile() {
  return useQuery({
    queryKey: ['counselor-profile'],
    queryFn: api.getCounselorProfile,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to update own profile (Counselor)
 */
export function useUpdateCounselorProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateCounselorProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counselor-profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}

/**
 * Hook to toggle own availability (Counselor)
 */
export function useToggleCounselorAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (is_available: boolean) =>
      api.toggleCounselorAvailability(is_available),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['counselor-profile'] });
      toast.success('Availability updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update availability');
    },
  });
}

/**
 * Hook to get own appointments (Counselor)
 */
export function useCounselorAppointments(params?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ['counselor-appointments', params],
    queryFn: () => api.getCounselorAppointments(params),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to get single appointment (Counselor)
 */
export function useCounselorAppointment(id: number | null) {
  return useQuery({
    queryKey: ['counselor-appointment', id],
    queryFn: () => api.getCounselorAppointment(id!),
    enabled: !!id,
  });
}

/**
 * Hook to get dashboard statistics (Counselor)
 */
export function useCounselorStats() {
  return useQuery({
    queryKey: ['counselor-stats'],
    queryFn: api.getCounselorStats,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to get today's appointments (Counselor)
 */
export function useTodayAppointments() {
  return useQuery({
    queryKey: ['today-appointments'],
    queryFn: api.getTodayAppointments,
    refetchInterval: 60000, // Refetch every minute
  });
}
