import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, Loader2, UserRound } from 'lucide-react';
import {
  createAppointment,
  getAppointmentTypes,
  getPsychologists,
  type Appointment as ApiAppointment,
  type AppointmentType,
  type Psychologist,
} from '@/lib/appointments-api';
import type { Appointment } from '@/types/chat';

interface AikaSchedulingWidgetProps {
  onScheduled?: (appointment: Appointment) => void;
  onAikaFollowup?: (text: string) => void;
}

function mapApiAppointmentToChat(appointment: ApiAppointment): Appointment {
  return {
    id: appointment.id,
    student_id: appointment.user_id,
    psychologist_id: appointment.psychologist_id,
    appointment_datetime: appointment.appointment_datetime,
    appointment_type_id: appointment.appointment_type_id,
    status: appointment.status === 'moved' ? 'scheduled' : appointment.status,
    notes: appointment.notes ?? undefined,
    psychologist: appointment.psychologist
      ? {
          id: appointment.psychologist.id,
          full_name: appointment.psychologist.name,
          specialization: appointment.psychologist.specialization
            ? [appointment.psychologist.specialization]
            : undefined,
        }
      : undefined,
    appointment_type: appointment.appointment_type
      ? {
          id: appointment.appointment_type.id,
          name: appointment.appointment_type.name,
          description: appointment.appointment_type.description ?? undefined,
        }
      : undefined,
  };
}

export function AikaSchedulingWidget({ onScheduled, onAikaFollowup }: AikaSchedulingWidgetProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [counselors, setCounselors] = useState<Psychologist[]>([]);
  const [types, setTypes] = useState<AppointmentType[]>([]);

  const [selectedCounselorId, setSelectedCounselorId] = useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedDateTime, setSelectedDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    let ignore = false;

    const loadSchedulingData = async () => {
      setLoadingInitial(true);
      setError(null);
      try {
        const [psychologists, appointmentTypes] = await Promise.all([
          getPsychologists(true),
          getAppointmentTypes(),
        ]);

        if (ignore) {
          return;
        }

        setCounselors(psychologists);
        setTypes(appointmentTypes);
        if (psychologists.length > 0) {
          setSelectedCounselorId(psychologists[0].id);
        }
        if (appointmentTypes.length > 0) {
          setSelectedTypeId(appointmentTypes[0].id);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat data scheduling.');
        }
      } finally {
        if (!ignore) {
          setLoadingInitial(false);
        }
      }
    };

    loadSchedulingData();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedCounselor = useMemo(
    () => counselors.find((item) => item.id === selectedCounselorId) ?? null,
    [counselors, selectedCounselorId]
  );

  const selectedType = useMemo(
    () => types.find((item) => item.id === selectedTypeId) ?? null,
    [types, selectedTypeId]
  );

  const canSubmit = Boolean(selectedCounselorId && selectedTypeId && selectedDateTime);

  const handleBookAppointment = async () => {
    if (!canSubmit || !selectedCounselorId || !selectedTypeId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const apiAppointment = await createAppointment({
        psychologist_id: selectedCounselorId,
        appointment_type_id: selectedTypeId,
        appointment_datetime: new Date(selectedDateTime).toISOString(),
        notes: notes.trim() || undefined,
      });

      const mapped = mapApiAppointmentToChat(apiAppointment);
      setCreatedAppointment(mapped);
      onScheduled?.(mapped);
      onAikaFollowup?.(
        `Saya sudah jadwalkan konseling dengan ${mapped.psychologist?.full_name || 'psikolog'} pada ${mapped.appointment_datetime}.`
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Gagal membuat appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdAppointment) {
    return (
      <div className="mt-3 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-white/90">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-300" />
          <div>
            <p className="text-sm font-semibold text-green-200">Appointment berhasil dibuat</p>
            <p className="mt-1 text-xs text-white/80">
              {createdAppointment.psychologist?.full_name || 'Psikolog'} •{' '}
              {new Date(createdAppointment.appointment_datetime).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-white/90 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-ugm-gold" />
        <p className="text-sm font-semibold">Scheduling Konseling (Step-by-step)</p>
      </div>

      <div className="mb-3 flex items-center gap-2 text-[11px] text-white/70">
        <span className={step >= 1 ? 'text-ugm-gold' : ''}>1. Counselor</span>
        <ChevronRight className="h-3 w-3" />
        <span className={step >= 2 ? 'text-ugm-gold' : ''}>2. Tipe</span>
        <ChevronRight className="h-3 w-3" />
        <span className={step >= 3 ? 'text-ugm-gold' : ''}>3. Waktu</span>
      </div>

      {loadingInitial ? (
        <div className="flex items-center gap-2 py-2 text-xs text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data jadwal...
        </div>
      ) : (
        <div className="space-y-3">
          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-xs text-white/70">Pilih counselor</label>
              <select
                value={selectedCounselorId ?? ''}
                onChange={(event) => setSelectedCounselorId(Number(event.target.value))}
                className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-ugm-gold"
              >
                {counselors.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#0d1d35]">
                    {item.name}{item.specialization ? ` • ${item.specialization}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedCounselorId}
                className="w-full rounded-xl bg-ugm-gold px-3 py-2 text-sm font-semibold text-ugm-blue disabled:opacity-50"
              >
                Lanjut ke tipe konseling
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-xs text-white/70">Pilih jenis konseling</label>
              <select
                value={selectedTypeId ?? ''}
                onChange={(event) => setSelectedTypeId(Number(event.target.value))}
                className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-ugm-gold"
              >
                {types.map((item) => (
                  <option key={item.id} value={item.id} className="bg-[#0d1d35]">
                    {item.name} ({item.duration_minutes} menit)
                  </option>
                ))}
              </select>
              {selectedType?.description && (
                <p className="text-xs text-white/60">{selectedType.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedTypeId}
                  className="rounded-xl bg-ugm-gold px-3 py-2 text-xs font-semibold text-ugm-blue disabled:opacity-50"
                >
                  Lanjut ke waktu
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <UserRound className="h-3.5 w-3.5" />
                  <span>{selectedCounselor?.name || 'Counselor'}</span>
                </div>
              </div>
              <label className="block text-xs text-white/70">Pilih tanggal & waktu</label>
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(event) => setSelectedDateTime(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-ugm-gold"
                aria-label="Pilih tanggal dan waktu konseling"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Catatan opsional"
                className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-ugm-gold"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleBookAppointment}
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isSubmitting ? 'Membuat...' : 'Buat Appointment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
