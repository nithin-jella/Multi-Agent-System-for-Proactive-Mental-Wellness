// src/components/features/chat/AppointmentCard.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Appointment } from '@/types/chat';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertCircle,
  Languages,
  Briefcase,
  Phone,
  Mail,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (appointmentId: number, reason: string) => void;
  onReschedule?: (appointmentId: number, newDateTime: string) => void;
}

export function AppointmentCard({ appointment, onCancel, onReschedule }: AppointmentCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [newDateTime, setNewDateTime] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse appointment datetime
  const appointmentDate = parseISO(appointment.appointment_datetime);
  const formattedDate = format(appointmentDate, 'EEEE, dd MMMM yyyy', { locale: idLocale });
  const formattedTime = format(appointmentDate, 'HH:mm');

  // Status styling
  const statusConfig = {
    scheduled: {
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: CheckCircle2,
      label: 'Terjadwal',
    },
    completed: {
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: CheckCircle2,
      label: 'Selesai',
    },
    cancelled: {
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: XCircle,
      label: 'Dibatalkan',
    },
    no_show: {
      color: 'text-orange-700',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: AlertCircle,
      label: 'Tidak Hadir',
    },
  };

  const status = statusConfig[appointment.status];
  const StatusIcon = status.icon;

  const handleCancelSubmit = async () => {
    if (!onCancel || !cancelReason.trim()) return;
    
    setIsProcessing(true);
    try {
      await onCancel(appointment.id, cancelReason);
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!onReschedule || !newDateTime) return;
    
    setIsProcessing(true);
    try {
      await onReschedule(appointment.id, newDateTime);
      setShowRescheduleDialog(false);
      setNewDateTime('');
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mt-4 bg-white/95 backdrop-blur-xl border-2 border-ugm-blue/20 rounded-2xl overflow-hidden shadow-2xl hover:shadow-ugm-blue/20"
    >
      {/* Enhanced Header with Gradient */}
      <div className="bg-linear-to-br from-ugm-blue via-ugm-blue to-ugm-blue-light p-5 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-ugm-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-3 bg-linear-to-br from-ugm-gold to-ugm-gold-light rounded-2xl shadow-xl shrink-0">
                <Calendar className="w-6 h-6 text-ugm-blue" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  Konseling Terjadwal
                  <span className={cn(
                    "text-xs font-semibold px-3 py-1 rounded-full border",
                    status.color,
                    status.bgColor,
                    status.borderColor
                  )}>
                    <StatusIcon className="w-3 h-3 inline mr-1" />
                    {status.label}
                  </span>
                </h4>
                <p className="text-sm text-white/90 mt-1 leading-relaxed">
                  Janji temu telah dibuat. Jangan lupa hadir ya! 💙
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="p-6 space-y-4">
        {/* Date & Time */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-ugm-blue/5 rounded-xl">
            <Calendar className="w-5 h-5 text-ugm-blue" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500">Tanggal & Waktu</p>
            <p className="text-base font-bold text-gray-900 capitalize">{formattedDate}</p>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-ugm-gold" />
              <p className="text-base font-semibold text-ugm-blue">{formattedTime} WIB</p>
            </div>
          </div>
        </div>

        {/* Psychologist Info */}
        {appointment.psychologist && (
          <div className="flex items-start gap-4">
            <div className="p-3 bg-ugm-blue/5 rounded-xl">
              <User className="w-5 h-5 text-ugm-blue" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-500">Psikolog</p>
              <p className="text-base font-bold text-gray-900">{appointment.psychologist.full_name}</p>
              {appointment.psychologist.specialization && appointment.psychologist.specialization.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <Briefcase className="w-4 h-4 text-ugm-gold" />
                  <p className="text-sm text-gray-600">
                    {appointment.psychologist.specialization.join(', ')}
                  </p>
                </div>
              )}
              {appointment.psychologist.languages && appointment.psychologist.languages.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <Languages className="w-4 h-4 text-ugm-gold" />
                  <p className="text-sm text-gray-600">
                    {appointment.psychologist.languages.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-ugm-blue/5 rounded-xl">
            <MapPin className="w-5 h-5 text-ugm-blue" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-500">Lokasi</p>
            <p className="text-base font-bold text-gray-900">
              {appointment.location || 'GMC - Grhatama Pustaka UGM, Lantai 2'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Jl. Sosio Humaniora, Bulaksumur, Yogyakarta
            </p>
          </div>
        </div>

        {/* Appointment Type */}
        {appointment.appointment_type && (
          <div className="flex items-start gap-4">
            <div className="p-3 bg-ugm-blue/5 rounded-xl">
              <Briefcase className="w-5 h-5 text-ugm-blue" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-500">Jenis Konseling</p>
              <p className="text-base font-bold text-gray-900">{appointment.appointment_type.name}</p>
              {appointment.appointment_type.description && (
                <p className="text-sm text-gray-600 mt-1">{appointment.appointment_type.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {appointment.notes && (
          <div className="bg-ugm-gold/5 border border-ugm-gold/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-ugm-blue mb-2">Catatan:</p>
            <p className="text-sm text-gray-700 leading-relaxed">{appointment.notes}</p>
          </div>
        )}

        {/* Cancellation Reason (if cancelled) */}
        {appointment.status === 'cancelled' && appointment.cancellation_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Alasan Pembatalan:</p>
            <p className="text-sm text-red-600 leading-relaxed">{appointment.cancellation_reason}</p>
          </div>
        )}

        {/* Action Buttons (only for scheduled appointments) */}
        {appointment.status === 'scheduled' && (
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowRescheduleDialog(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-ugm-blue hover:bg-ugm-blue-dark text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <Edit3 className="w-4 h-4" />
              Reschedule
            </button>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-red-50 text-red-600 font-semibold rounded-xl border-2 border-red-200 hover:border-red-300 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <XCircle className="w-4 h-4" />
              Batalkan
            </button>
          </div>
        )}

        {/* Emergency Contact Info */}
        <div className="bg-ugm-blue/5 border border-ugm-blue/20 rounded-xl p-4 mt-4">
          <p className="text-xs font-semibold text-ugm-blue mb-2">📞 Kontak Darurat</p>
          <div className="space-y-1">
            <p className="text-xs text-gray-600 flex items-center gap-2">
              <Phone className="w-3 h-3" />
              Crisis Centre UGM: <span className="font-semibold">0274-544571</span>
            </p>
            <p className="text-xs text-gray-600 flex items-center gap-2">
              <Phone className="w-3 h-3" />
              SMS/WhatsApp: <span className="font-semibold">0851-0111-0800</span>
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isProcessing && setShowCancelDialog(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Batalkan Janji Temu</h3>
                <p className="text-sm text-gray-600">Apakah kamu yakin ingin membatalkan?</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Alasan Pembatalan
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Jelaskan alasan pembatalan (opsional)"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-ugm-blue focus:ring-2 focus:ring-ugm-blue/20 outline-none transition-all resize-none"
                  rows={3}
                  disabled={isProcessing}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleCancelSubmit}
                  disabled={isProcessing || !cancelReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Membatalkan...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Reschedule Dialog */}
      {showRescheduleDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !isProcessing && setShowRescheduleDialog(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-ugm-blue/10 rounded-xl">
                <Edit3 className="w-6 h-6 text-ugm-blue" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Reschedule Janji Temu</h3>
                <p className="text-sm text-gray-600">Pilih waktu baru untuk konseling</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="reschedule-datetime" className="block text-sm font-semibold text-gray-700 mb-2">
                  Tanggal & Waktu Baru
                </label>
                <input
                  id="reschedule-datetime"
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-ugm-blue focus:ring-2 focus:ring-ugm-blue/20 outline-none transition-all"
                  disabled={isProcessing}
                  aria-label="Pilih tanggal dan waktu baru"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRescheduleDialog(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleRescheduleSubmit}
                  disabled={isProcessing || !newDateTime}
                  className="flex-1 px-4 py-3 bg-ugm-blue hover:bg-ugm-blue-dark text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
