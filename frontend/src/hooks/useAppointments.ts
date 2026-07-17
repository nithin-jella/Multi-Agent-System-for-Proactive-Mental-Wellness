// hooks/useAppointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as appointmentsApi from '@/lib/appointments-api';
import type {
  Appointment,
  CreateAppointmentData,
  UpdateAppointmentData,
  GetMyAppointmentsParams
} from '@/lib/appointments-api';

// ========================================
// Query Keys
// ========================================

export const appointmentsKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentsKeys.all, 'list'] as const,
  list: (filters?: GetMyAppointmentsParams) => [...appointmentsKeys.lists(), filters] as const,
  details: () => [...appointmentsKeys.all, 'detail'] as const,
  detail: (id: number) => [...appointmentsKeys.details(), id] as const,
  stats: () => [...appointmentsKeys.all, 'stats'] as const,
  psychologists: () => ['psychologists'] as const,
  psychologistsList: (availableOnly?: boolean) => 
    [...appointmentsKeys.psychologists(), { availableOnly }] as const,
  appointmentTypes: () => ['appointment-types'] as const,
};

// ========================================
// Hooks - Queries
// ========================================

/**
 * Fetch current user's appointments with filters
 */
export function useMyAppointments(filters?: GetMyAppointmentsParams) {
  const { data: session } = useSession();
  const router = useRouter();

  return useQuery({
    queryKey: appointmentsKeys.list(filters),
    queryFn: () => appointmentsApi.getMyAppointments(filters),
    enabled: !!session?.user, // Only fetch if user is authenticated
    staleTime: 30000, // 30 seconds
    retry: (failureCount: number, error: Error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        router.push('/login');
        return false;
      }
      return failureCount < 2;
    }
  });
}

/**
 * Fetch appointment statistics
 */
export function useMyAppointmentStats() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: appointmentsKeys.stats(),
    queryFn: appointmentsApi.getMyAppointmentStats,
    enabled: !!session?.user,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch single appointment by ID
 */
export function useAppointment(id: number | null) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: appointmentsKeys.detail(id!),
    queryFn: () => appointmentsApi.getAppointment(id!),
    enabled: !!session?.user && id !== null,
    staleTime: 30000,
  });
}

/**
 * Fetch all psychologists/counselors
 */
export function usePsychologists(availableOnly: boolean = false) {
  return useQuery({
    queryKey: appointmentsKeys.psychologistsList(availableOnly),
    queryFn: () => appointmentsApi.getPsychologists(availableOnly),
    staleTime: 300000, // 5 minutes (psychologists don't change often)
  });
}

/**
 * Fetch all appointment types
 */
export function useAppointmentTypes() {
  return useQuery({
    queryKey: appointmentsKeys.appointmentTypes(),
    queryFn: appointmentsApi.getAppointmentTypes,
    staleTime: 300000, // 5 minutes (types don't change often)
  });
}

// ========================================
// Hooks - Mutations
// ========================================

/**
 * Create a new appointment
 */
export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAppointmentData) =>
      appointmentsApi.createAppointment(data),
    onSuccess: () => {
      // Invalidate and refetch appointments list
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.stats() });
    },
    onError: (error: Error) => {
      console.error('Failed to create appointment:', error);
    }
  });
}

/**
 * Update an appointment (reschedule, change status, update notes)
 */
export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, Error, { id: number; data: UpdateAppointmentData }, { previousAppointment?: Appointment }>({
    mutationFn: ({ id, data }) =>
      appointmentsApi.updateAppointment(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentsKeys.detail(id) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData<Appointment>(
        appointmentsKeys.detail(id)
      );

      // Optimistically update
      if (previousAppointment) {
        queryClient.setQueryData<Appointment>(appointmentsKeys.detail(id), {
          ...previousAppointment,
          ...data,
          updated_at: new Date().toISOString()
        });
      }

      return { previousAppointment };
    },
    onError: (error, { id }, context) => {
      // Rollback on error
      if (context?.previousAppointment) {
        queryClient.setQueryData(
          appointmentsKeys.detail(id),
          context.previousAppointment
        );
      }
      console.error('Failed to update appointment:', error);
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.stats() });
    }
  });
}

/**
 * Update appointment notes only
 */
export function useUpdateAppointmentNotes() {
  const queryClient = useQueryClient();

  return useMutation<Appointment, Error, { id: number; notes: string }, { previousAppointment?: Appointment }>({
    mutationFn: ({ id, notes }) =>
      appointmentsApi.updateAppointmentNotes(id, notes),
    onMutate: async ({ id, notes }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentsKeys.detail(id) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData<Appointment>(
        appointmentsKeys.detail(id)
      );

      // Optimistically update notes in detail view
      if (previousAppointment) {
        queryClient.setQueryData<Appointment>(appointmentsKeys.detail(id), {
          ...previousAppointment,
          notes,
          updated_at: new Date().toISOString()
        });
      }

      // Also update in lists
      queryClient.setQueriesData<Appointment[]>(
        { queryKey: appointmentsKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((appt: Appointment) =>
            appt.id === id
              ? { ...appt, notes, updated_at: new Date().toISOString() }
              : appt
          );
        }
      );

      return { previousAppointment };
    },
    onError: (error, { id }, context) => {
      // Rollback on error
      if (context?.previousAppointment) {
        queryClient.setQueryData(
          appointmentsKeys.detail(id),
          context.previousAppointment
        );
      }
      console.error('Failed to update notes:', error);
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
    }
  });
}

/**
 * Cancel an appointment
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number, { previousAppointment?: Appointment }>({
    mutationFn: (id) => appointmentsApi.cancelAppointment(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: appointmentsKeys.detail(id) });

      // Snapshot previous value
      const previousAppointment = queryClient.getQueryData<Appointment>(
        appointmentsKeys.detail(id)
      );

      // Optimistically update status
      if (previousAppointment) {
        queryClient.setQueryData<Appointment>(appointmentsKeys.detail(id), {
          ...previousAppointment,
          status: 'cancelled',
          updated_at: new Date().toISOString()
        });
      }

      // Update in lists
      queryClient.setQueriesData<Appointment[]>(
        { queryKey: appointmentsKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.map((appt: Appointment) =>
            appt.id === id
              ? { ...appt, status: 'cancelled' as const, updated_at: new Date().toISOString() }
              : appt
          );
        }
      );

      return { previousAppointment };
    },
    onError: (error, id, context) => {
      // Rollback on error
      if (context?.previousAppointment) {
        queryClient.setQueryData(
          appointmentsKeys.detail(id),
          context.previousAppointment
        );
      }
      console.error('Failed to cancel appointment:', error);
    },
    onSettled: (_data, _error, id) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.stats() });
    }
  });
}
