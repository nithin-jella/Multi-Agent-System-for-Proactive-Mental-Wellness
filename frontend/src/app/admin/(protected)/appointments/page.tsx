'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  FiCalendar,
  FiClock,
  FiUser,
  FiSearch,
  FiFilter,
  FiDownload,
  FiX,
  FiCheck,
  FiAlertCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { apiCall } from '@/utils/adminApi';
import { Button } from '@/components/ui/Button';

interface User {
  id: number;
  email: string | null;
  avatar_url?: string | null;
}

interface AppointmentTherapist {
  id: number;
  name: string;
  specialization: string | null;
  is_available: boolean;
  image_url?: string | null;
}

interface Appointment {
  id: number;
  user: User;
  psychologist: AppointmentTherapist;
  appointment_type: string;
  appointment_datetime: string;
  notes: string | null;
  status: string;
  created_at: string;
}

type ViewMode = 'cards' | 'list';

export default function AppointmentManagementPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  
  // Detail view
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiCall<Appointment[]>('/api/v1/admin/appointments');
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    let list = [...appointments];
    const q = searchTerm.trim().toLowerCase();
    
    if (q) {
      list = list.filter(a =>
        (a.user.email || '').toLowerCase().includes(q) ||
        (a.psychologist.name || '').toLowerCase().includes(q) ||
        (a.appointment_type || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
      );
    }
    
    if (statusFilter) {
      list = list.filter(a => a.status === statusFilter);
    }
    
    if (typeFilter) {
      list = list.filter(a => a.appointment_type === typeFilter);
    }
    
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(a => new Date(a.appointment_datetime) >= from);
    }
    
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter(a => new Date(a.appointment_datetime) <= to);
    }
    
    const now = new Date();
    if (quickFilter === 'today') {
      list = list.filter(a => {
        const d = new Date(a.appointment_datetime);
        return d.toDateString() === now.toDateString();
      });
    } else if (quickFilter === 'upcoming') {
      list = list.filter(a => new Date(a.appointment_datetime) >= now);
    } else if (quickFilter === 'past') {
      list = list.filter(a => new Date(a.appointment_datetime) < now);
    }
    
    // Sort by date descending (most recent first)
    list.sort((a, b) => +new Date(b.appointment_datetime) - +new Date(a.appointment_datetime));
    return list;
  }, [appointments, searchTerm, statusFilter, typeFilter, dateFrom, dateTo, quickFilter]);

  const appointmentTypes = useMemo(() => {
    const types = new Set(appointments.map(a => a.appointment_type));
    return Array.from(types);
  }, [appointments]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const scheduled = appointments.filter(a => a.status === 'scheduled').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const cancelled = appointments.filter(a => a.status === 'cancelled').length;
    const now = new Date();
    const upcoming = appointments.filter(a => 
      new Date(a.appointment_datetime) >= now && a.status === 'scheduled'
    ).length;
    
    return { total, scheduled, completed, cancelled, upcoming };
  }, [appointments]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await apiCall(`/api/v1/admin/appointments/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ status }) 
      });
      toast.success('Status updated successfully');
      fetchAppointments();
      if (selectedAppt?.id === id) {
        setSelectedAppt(prev => prev ? { ...prev, status } : null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(message);
    }
  };

  const deleteAppointment = async (id: number) => {
    if (!confirm('Delete this appointment? This action cannot be undone.')) return;
    
    try {
      await apiCall(`/api/v1/admin/appointments/${id}`, { method: 'DELETE' });
      toast.success('Appointment deleted');
      fetchAppointments();
      if (selectedAppt?.id === id) {
        setSelectedAppt(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete appointment';
      toast.error(message);
    }
  };

  const exportCSV = () => {
    const rows = filteredAppointments;
    const header = ['ID', 'Patient Email', 'Counselor', 'Type', 'Date & Time', 'Status', 'Notes', 'Created At'];
    const lines = rows.map(a => [
      a.id,
      a.user.email || 'N/A',
      a.psychologist.name,
      a.appointment_type,
      new Date(a.appointment_datetime).toLocaleString(),
      a.status,
      (a.notes || '').replace(/\n/g, ' '),
      new Date(a.created_at).toLocaleString()
    ].join(','));
    
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setQuickFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Appointments</h1>
          <p className="text-sm text-white/60 mt-1">Manage and track all patient appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={filteredAppointments.length === 0}
            className="gap-2"
          >
            <FiDownload className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={fetchAppointments} size="sm" className="gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Total</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Upcoming</div>
          <div className="text-2xl font-bold text-[#FFCA40]">{stats.upcoming}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Scheduled</div>
          <div className="text-2xl font-bold text-blue-300">{stats.scheduled}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-300">{stats.completed}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-white/60 mb-1">Cancelled</div>
          <div className="text-2xl font-bold text-red-300">{stats.cancelled}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <FiFilter className="h-5 w-5" />
            <h2 className="font-semibold">Filters</h2>
          </div>
          {(searchTerm || statusFilter || typeFilter || dateFrom || dateTo || quickFilter !== 'all') && (
            <button
              onClick={clearFilters}
              className="text-sm text-white/60 hover:text-white transition-colors flex items-center gap-1"
            >
              <FiX className="h-4 w-4" />
              Clear all
            </button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickFilter === 'all'
                ? 'bg-[#FFCA40] text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setQuickFilter('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickFilter === 'today'
                ? 'bg-[#FFCA40] text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setQuickFilter('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickFilter === 'upcoming'
                ? 'bg-[#FFCA40] text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setQuickFilter('past')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              quickFilter === 'past'
                ? 'bg-[#FFCA40] text-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Past
          </button>
        </div>

        {/* Advanced Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#FFCA40] transition-colors text-sm"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] transition-colors text-sm"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] transition-colors text-sm"
          >
            <option value="">All Types</option>
            {appointmentTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            placeholder="From date"
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] transition-colors text-sm"
          />

          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            placeholder="To date"
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] transition-colors text-sm"
          />
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-white/60">
          Showing <span className="text-white font-medium">{filteredAppointments.length}</span> of{' '}
          <span className="text-white font-medium">{appointments.length}</span> appointments
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center p-12">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#FFCA40] rounded-full animate-spin" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <FiAlertCircle className="h-12 w-12 text-white/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No appointments found</h3>
          <p className="text-white/60">
            {searchTerm || statusFilter || typeFilter || dateFrom || dateTo || quickFilter !== 'all'
              ? 'Try adjusting your filters to see more results.'
              : 'No appointments have been scheduled yet.'}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map(appointment => {
                const patientAvatar = appointment.user.avatar_url;
                const patientInitial = (appointment.user.email || 'U').charAt(0).toUpperCase();
                const isPast = new Date(appointment.appointment_datetime) < new Date();

                return (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer group"
                    onClick={() => setSelectedAppt(appointment)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-full overflow-hidden border border-white/15 bg-white/5 flex-shrink-0">
                          {patientAvatar ? (
                            <Image
                              src={patientAvatar}
                              alt={`Avatar for ${appointment.user.email || 'user'}`}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#FFCA40]/10 text-base font-semibold text-[#FFCA40]">
                              {patientInitial}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">
                            {appointment.user.email || 'Unknown'}
                          </div>
                          <div className="text-xs text-white/60">Patient</div>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <FiCalendar className="h-4 w-4 text-white/40" />
                        <span>{formatDate(appointment.appointment_datetime)}</span>
                        {isPast && (
                          <span className="text-xs text-red-300">(Past)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <FiClock className="h-4 w-4 text-white/40" />
                        <span>{formatTime(appointment.appointment_datetime)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <FiUser className="h-4 w-4 text-white/40" />
                        <span className="truncate">{appointment.psychologist.name}</span>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <span className="text-xs text-white/60">Type: </span>
                      <span className="text-xs text-[#FFCA40] font-medium">{appointment.appointment_type}</span>
                    </div>

                    {/* Notes Preview */}
                    {appointment.notes && (
                      <div className="mt-3 text-xs text-white/50 line-clamp-2">
                        {appointment.notes}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Counselor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-white/60 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredAppointments.map(appointment => {
                      const patientAvatar = appointment.user.avatar_url;
                      const patientInitial = (appointment.user.email || 'U').charAt(0).toUpperCase();

                      return (
                        <tr key={appointment.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 rounded-full overflow-hidden border border-white/15 bg-white/5">
                                {patientAvatar ? (
                                  <Image
                                    src={patientAvatar}
                                    alt={`Avatar for ${appointment.user.email || 'user'}`}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-[#FFCA40]/10 text-sm font-semibold text-[#FFCA40]">
                                    {patientInitial}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{appointment.user.email || 'Unknown'}</div>
                                <div className="text-xs text-white/60">User #{appointment.user.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{appointment.psychologist.name}</div>
                            <div className="text-xs text-white/60">
                              {appointment.psychologist.specialization || 'General practice'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{formatDate(appointment.appointment_datetime)}</div>
                            <div className="text-xs text-white/60">{formatTime(appointment.appointment_datetime)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-white/80">{appointment.appointment_type}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={appointment.status}
                              onChange={e => updateStatus(appointment.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Update status for appointment ${appointment.id}`}
                              className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:border-[#FFCA40] transition-colors"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedAppt(appointment);
                                }}
                                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="View details"
                              >
                                <FiCalendar className="h-4 w-4" />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  deleteAppointment(appointment.id);
                                }}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <FiX className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </>
      )}

      {/* Appointment Detail Modal */}
      <AnimatePresence>
        {selectedAppt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedAppt(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/20 flex items-center justify-between sticky top-0 bg-white/10 backdrop-blur-md z-10">
                <div className="flex items-center gap-3">
                  <FiCalendar className="h-5 w-5 text-[#FFCA40]" />
                  <h3 className="text-lg font-semibold text-white">Appointment Details</h3>
                </div>
                <button
                  onClick={() => setSelectedAppt(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                  aria-label="Close modal"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Patient Info */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60 mb-3">Patient Information</div>
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border border-white/15 bg-white/5 flex-shrink-0">
                      {selectedAppt.user.avatar_url ? (
                        <Image
                          src={selectedAppt.user.avatar_url}
                          alt={`Avatar for ${selectedAppt.user.email || 'user'}`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#FFCA40]/10 text-xl font-semibold text-[#FFCA40]">
                          {(selectedAppt.user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{selectedAppt.user.email || 'Unknown'}</div>
                      <div className="text-sm text-white/60">User ID: {selectedAppt.user.id}</div>
                    </div>
                  </div>
                </div>

                {/* Counselor Info */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60 mb-3">Counselor</div>
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 rounded-full overflow-hidden border border-white/15 bg-white/5 flex-shrink-0">
                      {selectedAppt.psychologist.image_url ? (
                        <Image
                          src={selectedAppt.psychologist.image_url}
                          alt={`Avatar for ${selectedAppt.psychologist.name}`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10 text-xl font-semibold text-white/70">
                          {(selectedAppt.psychologist.name || 'P').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-white">{selectedAppt.psychologist.name}</div>
                      <div className="text-sm text-white/60">
                        {selectedAppt.psychologist.specialization || 'General practice'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Date</div>
                    <div className="flex items-center gap-2 text-white">
                      <FiCalendar className="h-4 w-4 text-white/60" />
                      <span className="font-medium">{formatDate(selectedAppt.appointment_datetime)}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Time</div>
                    <div className="flex items-center gap-2 text-white">
                      <FiClock className="h-4 w-4 text-white/60" />
                      <span className="font-medium">{formatTime(selectedAppt.appointment_datetime)}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Type</div>
                    <div className="text-[#FFCA40] font-medium">{selectedAppt.appointment_type}</div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Status</div>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedAppt.status)}`}>
                      {selectedAppt.status}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedAppt.notes && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Notes</div>
                    <p className="text-white/80 whitespace-pre-wrap">{selectedAppt.notes}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60 mb-2">Metadata</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Appointment ID</span>
                      <span className="text-white font-mono">#{selectedAppt.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Created At</span>
                      <span className="text-white">{new Date(selectedAppt.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Status Update */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="text-xs uppercase tracking-wide text-white/60 mb-3">Update Status</div>
                  <select
                    value={selectedAppt.status}
                    onChange={e => updateStatus(selectedAppt.id, e.target.value)}
                    aria-label="Update appointment status"
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#FFCA40] transition-colors"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/20 flex items-center justify-between bg-white/5">
                <Button
                  variant="outline"
                  onClick={() => {
                    deleteAppointment(selectedAppt.id);
                  }}
                  className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                >
                  Delete Appointment
                </Button>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => setSelectedAppt(null)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    const status = selectedAppt.status === 'completed' ? 'scheduled' : 'completed';
                    updateStatus(selectedAppt.id, status);
                  }}>
                    {selectedAppt.status === 'completed' ? (
                      <>
                        <FiX className="h-4 w-4 mr-2" />
                        Mark Incomplete
                      </>
                    ) : (
                      <>
                        <FiCheck className="h-4 w-4 mr-2" />
                        Mark Complete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
