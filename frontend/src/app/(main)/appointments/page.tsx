"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiMapPin, 
  FiPlus,
  FiSearch,
  FiDownload,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiFileText,
  FiMap
} from 'react-icons/fi';
import dynamic from 'next/dynamic';
import { useMyAppointments, usePsychologists, useUpdateAppointmentNotes } from '@/hooks/useAppointments';
import { toast } from 'react-hot-toast';
import type { Appointment, Psychologist } from '@/lib/appointments-api';

// Dynamically import the map component to avoid SSR issues
const AppointmentMap = dynamic(() => import('@/components/appointments/AppointmentMap'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-white/5 animate-pulse rounded-lg"></div>
});

// Mock location for map (Gadjah Mada Medical Center)
const DEFAULT_LOCATION = {
  lat: -7.769689,
  lng: 110.378349,
  name: "Gadjah Mada Medical Center",
  address: "Jl. Farmako, Sekip Utara, Yogyakarta 55281"
};

export default function AppointmentsPage() {
  const { status } = useSession();
  const router = useRouter();
  
  // State management
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'counselors'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [preAppointmentNotes, setPreAppointmentNotes] = useState('');

  // React Query hooks for appointments
  const { 
    data: appointments = [], 
    isLoading: loading, 
    error: appointmentsError 
  } = useMyAppointments({
    upcoming_only: activeTab === 'upcoming' ? true : undefined,
    past_only: activeTab === 'history' ? true : undefined,
    status_filter: statusFilter === 'all' ? undefined : statusFilter
  });

  const { 
    data: psychologists = []
  } = usePsychologists(true);

  const updateNotesMutation = useUpdateAppointmentNotes();

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/signin?callbackUrl=/appointments');
    }
  }, [status, router]);

  // Show error toast if API fails
  useEffect(() => {
    if (appointmentsError) {
      toast.error(appointmentsError.message || 'Failed to load appointments');
    }
  }, [appointmentsError]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // Filter by tab
    const now = new Date();
    if (activeTab === 'upcoming') {
      filtered = filtered.filter((apt: Appointment) => 
        new Date(apt.appointment_datetime) >= now && apt.status === 'scheduled'
      );
    } else if (activeTab === 'history') {
      filtered = filtered.filter((apt: Appointment) => 
        new Date(apt.appointment_datetime) < now || ['completed', 'cancelled', 'moved'].includes(apt.status)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((apt: Appointment) => apt.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((apt: Appointment) =>
        apt.psychologist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.appointment_type.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [appointments, activeTab, statusFilter, searchQuery]);

  // Filter counselors by search
  const filteredCounselors = useMemo(() => {
    if (!searchQuery) return psychologists;
    return psychologists.filter((psy: Psychologist) =>
      psy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      psy.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [psychologists, searchQuery]);

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: { icon: FiClock, color: 'bg-blue-500/20 text-blue-400', label: 'Scheduled' },
      completed: { icon: FiCheckCircle, color: 'bg-green-500/20 text-green-400', label: 'Completed' },
      cancelled: { icon: FiXCircle, color: 'bg-red-500/20 text-red-400', label: 'Cancelled' },
      moved: { icon: FiAlertCircle, color: 'bg-yellow-500/20 text-yellow-400', label: 'Rescheduled' }
    };
    const badge = badges[status as keyof typeof badges] || badges.scheduled;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  // Handle add pre-appointment notes
  const handleAddNotes = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setPreAppointmentNotes(appointment.notes || '');
    setShowNotesModal(true);
  };

  // Save pre-appointment notes
  const savePreAppointmentNotes = async () => {
    if (!selectedAppointment) return;
    
    try {
      // Call the API to update notes
      await updateNotesMutation.mutateAsync({
        id: selectedAppointment.id,
        notes: preAppointmentNotes
      });

      setShowNotesModal(false);
      setSelectedAppointment(null);
      toast.success('Pre-appointment notes saved successfully!');
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error('Failed to save notes. Please try again.');
    }
  };

  // Export to Google Calendar
  const exportToGoogleCalendar = (appointment: Appointment) => {
    const startTime = new Date(appointment.appointment_datetime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appointment.appointment_type.name + ' - ' + appointment.psychologist.name)}&dates=${startTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${endTime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&details=${encodeURIComponent(appointment.notes || '')}&location=${encodeURIComponent(DEFAULT_LOCATION.address)}&sf=true&output=xml`;

    window.open(googleCalendarUrl, '_blank');
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] p-6 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-white/20 mb-4"></div>
          <div className="h-4 w-48 bg-white/20 rounded mb-2"></div>
          <div className="h-3 w-32 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] pt-24 pb-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Appointments</h1>
          <p className="text-gray-300">Manage your appointments and connect with counselors</p>
        </div>

        {/* Action Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments or counselors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFCA40]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowMapModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
              aria-label="View appointment location map"
            >
              <FiMap className="w-4 h-4" />
              <span className="hidden sm:inline">View Map</span>
            </button>
            <Link href="/appointments/book">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58] rounded-lg font-medium transition">
                <FiPlus className="w-4 h-4" />
                Book Appointment
              </button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'upcoming'
                ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'history'
                ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('counselors')}
            className={`px-4 py-3 font-medium transition whitespace-nowrap ${
              activeTab === 'counselors'
                ? 'text-[#FFCA40] border-b-2 border-[#FFCA40]'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Counselors Directory
          </button>
        </div>

        {/* Filters (only show for appointments tabs) */}
        {activeTab !== 'counselors' && (
          <div className="mb-6 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                statusFilter === 'all'
                  ? 'bg-[#FFCA40] text-[#001D58]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                statusFilter === 'scheduled'
                  ? 'bg-[#FFCA40] text-[#001D58]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                statusFilter === 'completed'
                  ? 'bg-[#FFCA40] text-[#001D58]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                statusFilter === 'cancelled'
                  ? 'bg-[#FFCA40] text-[#001D58]'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              Cancelled
            </button>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab !== 'counselors' ? (
            // Appointments List
            <motion.div
              key="appointments"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredAppointments.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-12 text-center">
                  <FiCalendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">No appointments found</h3>
                  <p className="text-gray-300 mb-6">
                    {activeTab === 'upcoming' 
                      ? "You don't have any upcoming appointments." 
                      : "No appointment history available."}
                  </p>
                  <Link href="/appointments/book">
                    <button className="px-6 py-3 bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58] rounded-lg font-medium transition">
                      Book Your First Appointment
                    </button>
                  </Link>
                </div>
              ) : (
                filteredAppointments.map((appointment: Appointment) => (
                  <motion.div
                    key={appointment.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 hover:bg-white/15 transition"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Counselor Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white/20 flex-shrink-0">
                          <div className="w-full h-full bg-gradient-to-br from-[#173a7a] to-[#0a2a6e] flex items-center justify-center">
                            <FiUser className="text-2xl text-white/70" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {appointment.psychologist.name}
                          </h3>
                          <p className="text-sm text-gray-300 mb-2">
                            {appointment.psychologist.specialization}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {getStatusBadge(appointment.status)}
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                              {appointment.appointment_type.name}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                              <FiCalendar className="w-4 h-4 text-[#FFCA40]" />
                              {format(new Date(appointment.appointment_datetime), 'EEEE, d MMMM yyyy', { locale: id })}
                            </div>
                            <div className="flex items-center gap-2">
                              <FiClock className="w-4 h-4 text-[#FFCA40]" />
                              {format(new Date(appointment.appointment_datetime), 'HH:mm')} WIB
                            </div>
                            <div className="flex items-center gap-2">
                              <FiMapPin className="w-4 h-4 text-[#FFCA40]" />
                              {DEFAULT_LOCATION.name}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 min-w-[180px]">
                        <button
                          onClick={() => handleAddNotes(appointment)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
                        >
                          <FiFileText className="w-4 h-4" />
                          {appointment.notes ? 'Edit Notes' : 'Add Notes'}
                        </button>
                        <button
                          onClick={() => exportToGoogleCalendar(appointment)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
                        >
                          <FiDownload className="w-4 h-4" />
                          Add to Calendar
                        </button>
                        {appointment.status === 'scheduled' && (
                          <Link href={`/appointments/book?reschedule=${appointment.id}`}>
                            <button className="w-full px-4 py-2 bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58] rounded-lg font-medium transition text-sm">
                              Reschedule
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Notes Preview */}
                    {appointment.notes && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-400 mb-1">Pre-appointment notes:</p>
                        <p className="text-sm text-gray-200">{appointment.notes}</p>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            // Counselors Directory
            <motion.div
              key="counselors"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              {filteredCounselors.map((counselor: Psychologist) => (
                <motion.div
                  key={counselor.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 hover:bg-white/15 transition"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-white/20 mb-4">
                      <div className="w-full h-full bg-gradient-to-br from-[#173a7a] to-[#0a2a6e] flex items-center justify-center">
                        <FiUser className="text-3xl text-white/70" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {counselor.name}
                    </h3>
                    <p className="text-sm text-gray-300 mb-4">
                      {counselor.specialization}
                    </p>
                    <div className="mb-4">
                      {counselor.is_available ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                          Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                          Currently Unavailable
                        </span>
                      )}
                    </div>
                    <Link href={`/appointments/book?counselor=${counselor.id}`} className="w-full">
                      <button
                        disabled={!counselor.is_available}
                        className={`w-full px-4 py-2 rounded-lg font-medium transition ${
                          counselor.is_available
                            ? 'bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58]'
                            : 'bg-white/10 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {counselor.is_available ? 'Book Appointment' : 'Unavailable'}
                      </button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-appointment Notes Modal */}
        <AnimatePresence>
          {showNotesModal && selectedAppointment && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowNotesModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#001D58] rounded-xl border border-white/20 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Pre-Appointment Notes</h2>
                    <p className="text-sm text-gray-300">
                      Share information that {selectedAppointment.psychologist.name} should know before your session
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close notes modal"
                  >
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <label htmlFor="pre-notes" className="block text-white font-medium mb-2">
                    Your Notes
                  </label>
                  <textarea
                    id="pre-notes"
                    value={preAppointmentNotes}
                    onChange={(e) => setPreAppointmentNotes(e.target.value)}
                    placeholder="Share any concerns, symptoms, or topics you'd like to discuss..."
                    className="w-full bg-white/5 border border-white/20 rounded-lg p-3 text-white placeholder-gray-400 min-h-[200px] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePreAppointmentNotes}
                    className="px-6 py-2 bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58] rounded-lg font-medium transition"
                  >
                    Save Notes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map Modal */}
        <AnimatePresence>
          {showMapModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowMapModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[#001D58] rounded-xl border border-white/20 p-6 max-w-4xl w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Appointment Location</h2>
                    <p className="text-sm text-gray-300">{DEFAULT_LOCATION.address}</p>
                  </div>
                  <button
                    onClick={() => setShowMapModal(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close map modal"
                  >
                    <FiXCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="rounded-lg overflow-hidden">
                  <AppointmentMap
                    center={[DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]}
                    markers={[
                      {
                        position: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng],
                        title: DEFAULT_LOCATION.name,
                        description: DEFAULT_LOCATION.address
                      }
                    ]}
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${DEFAULT_LOCATION.lat},${DEFAULT_LOCATION.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-[#FFCA40] hover:bg-[#ffb700] text-[#001D58] rounded-lg font-medium text-center transition"
                  >
                    Get Directions
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
