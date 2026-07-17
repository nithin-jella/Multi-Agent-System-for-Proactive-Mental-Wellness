'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FiCalendar,
  FiClock,
  FiUser,
  FiVideo,
  FiMapPin,
  FiCheckCircle,
  FiXCircle,
  FiEdit,
  FiAlertTriangle,
  FiX,
} from 'react-icons/fi';
import apiClient from '@/services/api';
import toast from 'react-hot-toast';

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type AppointmentType = 'in_person' | 'video_call' | 'phone_call';

interface BackendAppointmentType {
  id: number;
  name: string;
  duration_minutes: number;
}

interface BackendAppointmentUser {
  id: number;
  name?: string | null;
}

interface BackendAppointment {
  id: number;
  user_id: number;
  appointment_datetime: string;
  status: string;
  notes?: string | null;
  appointment_type?: BackendAppointmentType;
  user?: BackendAppointmentUser;
}

interface Appointment {
  appointment_id: string;
  patient_id_hash: string;
  patient_name?: string;
  date: string;
  time: string;
  duration_minutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  location?: string;
  notes?: string;
}

type ActionMode = 'complete' | 'reschedule' | 'cancel';

const statusColors = {
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  no_show: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const typeIcons = {
  in_person: FiMapPin,
  video_call: FiVideo,
  phone_call: FiClock,
};

const toYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toHm = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const mapStatus = (raw: string): AppointmentStatus => {
  switch (raw) {
    case 'scheduled':
    case 'completed':
    case 'cancelled':
    case 'no_show':
      return raw;
    case 'moved':
      return 'scheduled';
    default:
      return 'scheduled';
  }
};

const inferType = (appointmentTypeName?: string): AppointmentType => {
  const name = (appointmentTypeName || '').toLowerCase();
  if (name.includes('video') || name.includes('online')) return 'video_call';
  if (name.includes('phone') || name.includes('call')) return 'phone_call';
  return 'in_person';
};

export default function CounselorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ mode: ActionMode; appointment: Appointment } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [actionNote, setActionNote] = useState('');

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<BackendAppointment[]>('/counselor/appointments');

      const mapped: Appointment[] = (response.data || []).map((apt) => {
        const dt = new Date(apt.appointment_datetime);
        const appointmentTypeName = apt.appointment_type?.name;
        return {
          appointment_id: String(apt.id),
          patient_id_hash: `user_${apt.user_id}`,
          patient_name: apt.user?.name || undefined,
          date: toYmd(dt),
          time: toHm(dt),
          duration_minutes: apt.appointment_type?.duration_minutes ?? 60,
          type: inferType(appointmentTypeName),
          status: mapStatus(apt.status),
          notes: apt.notes || undefined,
        };
      });

      setAppointments(mapped);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      setError('Failed to load appointments');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const openActionModal = (mode: ActionMode, appointment: Appointment) => {
    if (mode === 'reschedule') {
      setRescheduleDate(appointment.date);
      setRescheduleTime(appointment.time);
    }
    setActionNote(appointment.notes || '');
    setActionModal({ mode, appointment });
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionNote('');
    setRescheduleDate('');
    setRescheduleTime('');
  };

  const submitActionModal = async () => {
    if (!actionModal) return;

    const { mode, appointment } = actionModal;
    const appointmentId = appointment.appointment_id;

    if (mode === 'reschedule') {
      if (!rescheduleDate || !rescheduleTime) {
        toast.error('Please provide date and time for reschedule');
        return;
      }
      const parsed = new Date(`${rescheduleDate}T${rescheduleTime}`);
      if (Number.isNaN(parsed.getTime())) {
        toast.error('Invalid reschedule date/time');
        return;
      }
    }

    try {
      setActionLoading(appointmentId);

      if (mode === 'complete') {
        await apiClient.put(`/appointments/${appointmentId}`, {
          status: 'completed',
          notes: actionNote.trim() || undefined,
        });
        toast.success('Appointment marked as completed');
      }

      if (mode === 'reschedule') {
        const parsed = new Date(`${rescheduleDate}T${rescheduleTime}`);
        await apiClient.put(`/appointments/${appointmentId}`, {
          appointment_datetime: parsed.toISOString(),
          status: 'scheduled',
          notes: actionNote.trim() || undefined,
        });
        toast.success('Appointment rescheduled');
      }

      if (mode === 'cancel') {
        await apiClient.delete(`/appointments/${appointmentId}`);
        toast.success('Appointment cancelled');
      }

      closeActionModal();
      await loadAppointments();
    } catch (err) {
      if (mode === 'complete') {
        console.error('Failed to complete appointment:', err);
        toast.error('Failed to complete appointment');
      }
      if (mode === 'reschedule') {
        console.error('Failed to reschedule appointment:', err);
        toast.error('Failed to reschedule appointment');
      }
      if (mode === 'cancel') {
        console.error('Failed to cancel appointment:', err);
        toast.error('Failed to cancel appointment');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const statusMatch = filterStatus === 'all' || apt.status === filterStatus;
    return statusMatch;
  });

  const todayStr = toYmd(new Date());
  const todayAppointments = filteredAppointments.filter(
    (apt) => apt.date === todayStr
  );
  const upcomingAppointments = filteredAppointments.filter(
    (apt) => apt.date >= todayStr && apt.date !== todayStr || (apt.date === todayStr && apt.status === 'scheduled')
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 max-w-md text-center">
          <FiAlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Error</h2>
          <p className="text-white/70 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={loadAppointments}
            className="px-4 py-2 bg-[#FFCA40] text-[#001d58] rounded-lg font-medium hover:bg-[#FFD55C] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FiCalendar className="w-8 h-8 text-[#FFCA40]" />
            Appointments
          </h1>
          <p className="text-white/60">Manage your appointment schedule</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
            title="Filter appointments by status"
          >
            <option value="all" className="bg-[#001d58]">All Status</option>
            <option value="scheduled" className="bg-[#001d58]">Scheduled</option>
            <option value="completed" className="bg-[#001d58]">Completed</option>
            <option value="cancelled" className="bg-[#001d58]">Cancelled</option>
            <option value="no_show" className="bg-[#001d58]">No Show</option>
          </select>
          <div className="flex bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                viewMode === 'list'
                  ? 'bg-[#FFCA40] text-[#001d58] font-medium'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                viewMode === 'calendar'
                  ? 'bg-[#FFCA40] text-[#001d58] font-medium'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{todayAppointments.length}</div>
          <div className="text-xs text-white/60 mt-1">Today</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{upcomingAppointments.length}</div>
          <div className="text-xs text-white/60 mt-1">Upcoming</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">
            {appointments.filter((a) => a.status === 'completed').length}
          </div>
          <div className="text-xs text-white/60 mt-1">Completed</div>
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">
            {appointments.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length}
          </div>
          <div className="text-xs text-white/60 mt-1">Cancelled/No-Show</div>
        </div>
      </div>

      {/* Appointments List */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredAppointments.length === 0 ? (
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
              <FiCalendar className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">No appointments found</p>
            </div>
          ) : (
            filteredAppointments.map((appointment) => {
              const TypeIcon = typeIcons[appointment.type];
              return (
                <div
                  key={appointment.appointment_id}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Date/Time */}
                    <div className="shrink-0 text-center bg-[#FFCA40]/10 rounded-xl p-4 min-w-30">
                      <div className="text-2xl font-bold text-[#FFCA40]">
                        {new Date(appointment.date + 'T00:00:00').getDate()}
                      </div>
                      <div className="text-xs text-white/70 uppercase">
                        {new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="text-sm font-medium text-white">{appointment.time}</div>
                        <div className="text-xs text-white/60">{appointment.duration_minutes}m</div>
                      </div>
                    </div>

                    {/* Middle: Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-mono text-white/90">{appointment.appointment_id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[appointment.status]}`}>
                          {appointment.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <FiUser className="w-4 h-4 text-white/40" />
                        <span className="text-sm text-white/90">{appointment.patient_name || appointment.patient_id_hash}</span>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <TypeIcon className="w-4 h-4 text-[#FFCA40]" />
                          <span>{appointment.type.replace('_', ' ')}</span>
                        </div>
                        {appointment.location && (
                          <div className="flex items-center gap-2 text-sm text-white/70">
                            <FiMapPin className="w-4 h-4 text-[#FFCA40]" />
                            <span>{appointment.location}</span>
                          </div>
                        )}
                      </div>

                      {appointment.notes && (
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-sm text-white/70">{appointment.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="shrink-0 flex flex-col gap-2">
                      {appointment.status === 'scheduled' && (
                        <>
                          <button 
                            onClick={() => openActionModal('complete', appointment)}
                            disabled={actionLoading === appointment.appointment_id}
                            className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            <FiCheckCircle className="w-4 h-4" />
                            {actionLoading === appointment.appointment_id ? 'Processing...' : 'Complete'}
                          </button>
                          <button 
                            onClick={() => openActionModal('reschedule', appointment)}
                            disabled={actionLoading === appointment.appointment_id}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white/70 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            <FiEdit className="w-4 h-4" />
                            Reschedule
                          </button>
                          <button 
                            onClick={() => openActionModal('cancel', appointment)}
                            disabled={actionLoading === appointment.appointment_id}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                          >
                            <FiXCircle className="w-4 h-4" />
                            Cancel
                          </button>
                        </>
                      )}
                      {appointment.status === 'completed' && appointment.notes && (
                        <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-white/70">
                          <span className="text-xs text-white/50 block mb-1">Notes:</span>
                          {appointment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Calendar View (Placeholder) */}
      {viewMode === 'calendar' && (
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
          <FiCalendar className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Calendar View</h3>
          <p className="text-white/60 mb-4">Full calendar integration coming soon</p>
          <button
            onClick={() => setViewMode('list')}
            className="px-4 py-2 bg-[#FFCA40]/20 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40]"
          >
            Switch to List View
          </button>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#001A4D] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {actionModal.mode === 'complete' && 'Complete Appointment'}
                  {actionModal.mode === 'reschedule' && 'Reschedule Appointment'}
                  {actionModal.mode === 'cancel' && 'Cancel Appointment'}
                </h2>
                <p className="mt-1 text-sm text-white/60">Appointment #{actionModal.appointment.appointment_id}</p>
              </div>
              <button
                onClick={closeActionModal}
                className="rounded-lg border border-white/20 p-2 text-white/70 hover:text-white"
                aria-label="Close action dialog"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                <div>Patient: {actionModal.appointment.patient_name || actionModal.appointment.patient_id_hash}</div>
                <div className="mt-1 text-white/60">
                  Current schedule: {actionModal.appointment.date} at {actionModal.appointment.time}
                </div>
              </div>

              {actionModal.mode === 'reschedule' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm text-white/80">
                    New Date
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-white/80">
                    New Time
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                    />
                  </label>
                </div>
              )}

              {(actionModal.mode === 'complete' || actionModal.mode === 'reschedule') && (
                <label className="flex flex-col gap-1 text-sm text-white/80">
                  Session Note (optional)
                  <textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    rows={3}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                    placeholder="Add a short note for the appointment record"
                  />
                </label>
              )}

              {actionModal.mode === 'cancel' && (
                <p className="text-sm text-red-200/90 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  This action will remove the appointment from the schedule.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 p-5">
              <button
                onClick={closeActionModal}
                className="px-4 py-2 border border-white/20 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10"
              >
                Back
              </button>
              <button
                onClick={submitActionModal}
                disabled={actionLoading === actionModal.appointment.appointment_id}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                  actionModal.mode === 'cancel'
                    ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200'
                    : 'bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 text-[#FFCA40]'
                }`}
              >
                {actionLoading === actionModal.appointment.appointment_id
                  ? 'Processing...'
                  : actionModal.mode === 'complete'
                    ? 'Confirm Complete'
                    : actionModal.mode === 'reschedule'
                      ? 'Confirm Reschedule'
                      : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
