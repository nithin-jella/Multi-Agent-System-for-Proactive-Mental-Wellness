"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { id } from 'date-fns/locale';
import { FiCalendar, FiClock, FiUser, FiMapPin, FiChevronLeft, FiChevronRight, FiInfo, FiCheck } from 'react-icons/fi';
import { useCreateAppointment, usePsychologists, useAppointmentTypes } from '@/hooks/useAppointments';
import { toast } from 'react-hot-toast';
import type { Psychologist, AppointmentType } from '@/lib/appointments-api';

// Mock data for available time slots
const generateTimeSlots = (date: string | number | Date) => {
  // Generate different availability based on the day
  const day = new Date(date).getDay();
  
  // Weekend has fewer slots
  if (day === 0 || day === 6) {
    return [
      { time: "09:00", available: true },
      { time: "10:30", available: false },
      { time: "13:00", available: true }
    ];
  }
  
  // Weekdays have more slots
  return [
    { time: "08:00", available: true },
    { time: "09:30", available: true },
    { time: "11:00", available: false },
    { time: "13:00", available: true },
    { time: "14:30", available: true },
    { time: "16:00", available: day !== 5 } // Friday afternoon off
  ];
};
  

export default function AppointmentsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<{time: string, available: boolean} | null>(null);
  const [selectedCounselor, setSelectedCounselor] = useState<Psychologist | null>(null);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ time: string; available: boolean }[]>([]);
  
  // React Query hooks to fetch data
  const createAppointmentMutation = useCreateAppointment();
  const { data: psychologists = [], isLoading: isLoadingPsychologists } = usePsychologists(true);
  const { data: appointmentTypes = [], isLoading: isLoadingTypes } = useAppointmentTypes();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/signin?callbackUrl=/appointments');
    }
  }, [status, router]);
  
  // Update time slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      setTimeSlots(generateTimeSlots(selectedDate));
    }
  }, [selectedDate]);
  
  // Generate array of dates for the week view
  const weekDates = Array.from({ length: 7 }, (_, i) => 
    addDays(currentWeekStart, i)
  );
  
  const nextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };
  
  const prevWeek = () => {
    // Don't allow selecting dates in the past
    if (currentWeekStart > new Date()) {
      setCurrentWeekStart(addWeeks(currentWeekStart, -1));
    }
  };
  
  const isDateSelectable = (date: number | Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const handleBookAnotherAppointment = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedCounselor(null);
    setSelectedType(null);
    setNotes("");
    setSuccess(false);
  }
  
  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime || !selectedCounselor || !selectedType) {
      toast.error("Please complete all required fields");
      return;
    }
    
    setLoading(true);
    
    try {
      // Create ISO 8601 datetime string
      const appointmentDateTime = new Date(`${selectedDate}T${selectedTime.time}:00`).toISOString();
      
      // Call the API to create appointment
      await createAppointmentMutation.mutateAsync({
        psychologist_id: selectedCounselor.id,
        appointment_type_id: selectedType.id,
        appointment_datetime: appointmentDateTime,
        notes: notes || undefined,
        status: 'scheduled'
      });
      
      setSuccess(true);
      setLoading(false);
      toast.success('Appointment booked successfully!');
      
    } catch (error) {
      console.error("Error booking appointment:", error);
      setLoading(false);
      
      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          toast.error('Please log in again to book an appointment');
          router.push('/login');
        } else if (error.message.includes('conflict') || error.message.includes('already have')) {
          toast.error('You already have an appointment at this time. Please choose a different time slot.');
        } else {
          toast.error(error.message || 'Something went wrong. Please try again.');
        }
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    }
  };

  if (status === "loading" || status === "unauthenticated") {
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

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] p-6 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-8 max-w-lg w-full text-center"
        >
          <div className="bg-green-500/20 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <FiCheck className="text-green-400 text-4xl" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Appointment Scheduled!</h2>
          <p className="text-gray-200 mb-6">
            Your appointment has been successfully booked with {selectedCounselor?.name} on {format(new Date(selectedDate!), 'EEEE, d MMMM yyyy', { locale: id })} at {selectedTime?.time}.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-300 mb-1"><strong>Appointment Type:</strong> {selectedType?.name}</p>
            <p className="text-sm text-gray-300 mb-1"><strong>Duration:</strong> {selectedType?.duration_minutes} minutes</p>
            <p className="text-sm text-gray-300"><strong>Location:</strong> Gadjah Mada Medical Center, Psychology Dept., 2nd Floor</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/aika">
              <button className="px-6 py-3 bg-[#FFCA40] text-[#001D58] rounded-lg font-medium">
                Talk to Aika
              </button>
            </Link>
            <Link href="/appointments">
              <button className="px-6 py-3 bg-white/20 text-white rounded-lg font-medium" onClick={handleBookAnotherAppointment}>
                Book Another Appointment
              </button>
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            You will receive a confirmation email shortly. Please arrive 15 minutes early.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001D58] to-[#00308F] pt-24 pb-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">Schedule an Appointment</h1>
          <p className="text-gray-300 mt-2 max-w-xl mx-auto">
            Book a session with Gadjah Mada Medical Center&apos;s psychological services team
          </p>
        </div>
        
        {/* Appointment Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  step === s 
                    ? 'bg-[#FFCA40] text-[#001D58]' 
                    : step > s 
                      ? 'bg-green-500 text-white'
                      : 'bg-white/20 text-white/60'
                }`}>
                  {step > s ? <FiCheck /> : s}
                </div>
                <span className={`text-xs mt-2 ${step >= s ? 'text-white' : 'text-white/60'}`}>
                  {s === 1 ? 'Select Date & Time' : s === 2 ? 'Choose Provider' : 'Confirm'}
                </span>
              </div>
            ))}
            
            {/* Progress bar connecting circles */}
            <div className="absolute left-0 right-0 flex justify-center">
              <div className="h-0.5 bg-white/20 w-32 sm:w-52 -z-10 mt-4">
                <div 
                  className={`h-full bg-[#FFCA40] ${
                    step === 1 ? 'w-0' : step === 2 ? 'w-1/2' : 'w-full'
                  }`}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 sm:p-8">
          {/* Step 1: Date and Time Selection */}
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-white mb-6">Select Date & Time</h2>
              
              {/* Calendar Week View */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <button 
                    onClick={prevWeek}
                    className="p-2 rounded-full hover:bg-white/10 transition"
                    aria-label="Previous week"
                  >
                    <FiChevronLeft className="text-white" />
                  </button>
                  <h3 className="text-white font-medium">
                    {format(currentWeekStart, 'd MMM')} - {format(addDays(currentWeekStart, 6), 'd MMM yyyy')}
                  </h3>
                  <button 
                    onClick={nextWeek}
                    className="p-2 rounded-full hover:bg-white/10 transition"
                    aria-label="Next week"
                  >
                    <FiChevronRight className="text-white" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headings */}
                  {weekDates.map((date, i) => (
                    <div key={`heading-${i}`} className="text-center">
                      <p className="text-xs text-gray-400 mb-1">
                        {format(date, 'EEE', { locale: id })}
                      </p>
                    </div>
                  ))}
                  
                  {/* Date buttons */}
                  {weekDates.map((date, i) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const isSelected = selectedDate === dateStr;
                    const isSelectable = isDateSelectable(date);
                    
                    return (
                      <button
                        key={`date-${i}`}
                        onClick={() => isSelectable && setSelectedDate(dateStr)}
                        disabled={!isSelectable}
                        className={`py-2 rounded-lg text-center transition-all ${
                          isSelected
                            ? 'bg-[#FFCA40] text-[#001D58]'
                            : isSelectable
                              ? 'hover:bg-white/20 bg-white/5'
                              : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm block">{format(date, 'd')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Time Selection */}
              {selectedDate && (
                <div className="mb-8">
                  <h3 className="text-white font-medium mb-3">Available Times</h3>
                  <p className="text-sm text-gray-300 mb-4">
                    <FiCalendar className="inline mr-2" />
                    {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: id })}
                  </p>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {timeSlots.map((slot, i) => (
                      <button
                        key={`time-${i}`}
                        onClick={() => slot.available && setSelectedTime(slot)}
                        disabled={!slot.available}
                        className={`py-3 rounded-lg text-center transition ${
                          selectedTime?.time === slot.time
                            ? 'bg-[#FFCA40] text-[#001D58]'
                            : slot.available
                              ? 'hover:bg-white/20 bg-white/5'
                              : 'bg-white/5 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                  
                  {timeSlots.length === 0 && (
                    <p className="text-gray-300 text-center py-4">
                      No available times for this date
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex justify-between mt-8">
                <Link href="/">
                  <button className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">
                    Cancel
                  </button>
                </Link>
                <button
                  onClick={() => selectedDate && selectedTime && setStep(2)}
                  disabled={!selectedDate || !selectedTime}
                  className={`px-6 py-2 rounded-lg ${
                    selectedDate && selectedTime
                      ? 'bg-[#FFCA40] text-[#001D58] hover:bg-[#ffb700]'
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Step 2: Counselor and Appointment Type Selection */}
          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-white mb-6">Choose Provider & Session Type</h2>
              
              {/* Counselor Selection */}
              <div className="mb-8">
                <h3 className="text-white font-medium mb-3">Select a Mental Health Professional</h3>
                {isLoadingPsychologists ? (
                  <div className="text-center py-8 text-gray-300">Loading psychologists...</div>
                ) : psychologists.length === 0 ? (
                  <div className="text-center py-8 text-gray-300">No psychologists available at the moment.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {psychologists.map((counselor: Psychologist) => (
                      <button
                        key={counselor.id}
                        onClick={() => counselor.is_available && setSelectedCounselor(counselor)}
                        disabled={!counselor.is_available}
                        className={`p-4 rounded-lg flex items-center transition ${
                          selectedCounselor?.id === counselor.id
                            ? 'bg-[#FFCA40]/20 border-2 border-[#FFCA40]'
                            : counselor.is_available
                              ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                              : 'bg-white/5 border border-white/10 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-white/20 flex-shrink-0 mr-4">
                          <div className="w-full h-full bg-gradient-to-br from-[#173a7a] to-[#0a2a6e] flex items-center justify-center">
                            <FiUser className="text-2xl text-white/70" />
                          </div>
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-white">{counselor.name}</h4>
                          <p className="text-sm text-gray-300">{counselor.specialization || 'Psychologist'}</p>
                          {!counselor.is_available && (
                            <span className="text-xs text-red-300 mt-1 block">
                              Currently unavailable
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Appointment Type Selection */}
              <div className="mb-8">
                <h3 className="text-white font-medium mb-3">Select Appointment Type</h3>
                {isLoadingTypes ? (
                  <div className="text-center py-8 text-gray-300">Loading appointment types...</div>
                ) : appointmentTypes.length === 0 ? (
                  <div className="text-center py-8 text-gray-300">No appointment types available.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {appointmentTypes.map((type: AppointmentType) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type)}
                        className={`p-4 rounded-lg text-left transition ${
                          selectedType?.id === type.id
                            ? 'bg-[#FFCA40]/20 border-2 border-[#FFCA40]'
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                      <div className="flex justify-between">
                        <h4 className="font-medium text-white">{type.name}</h4>
                        <span className="text-sm text-gray-300">{type.duration_minutes} min</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{type.description || 'Standard consultation session'}</p>
                    </button>
                  ))}
                </div>
                )}
              </div>
              
              <div className="flex justify-between mt-8">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={() => selectedCounselor && selectedType && setStep(3)}
                  disabled={!selectedCounselor || !selectedType}
                  className={`px-6 py-2 rounded-lg ${
                    selectedCounselor && selectedType
                      ? 'bg-[#FFCA40] text-[#001D58] hover:bg-[#ffb700]'
                      : 'bg-white/10 text-white/50 cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}
          
          {/* Step 3: Confirmation and Additional Info */}
          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-white mb-6">Confirm Your Appointment</h2>
              
              {/* Appointment Summary */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                <h3 className="font-medium text-white mb-4">Appointment Details</h3>
                
                <div className="space-y-4">
                  <div className="flex">
                    <FiCalendar className="text-[#FFCA40] mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white">
                        {selectedDate && format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: id })}
                      </p>
                      <p className="text-sm text-gray-300">
                        {selectedTime?.time} WIB
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <FiUser className="text-[#FFCA40] mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white">
                        {selectedCounselor?.name}
                      </p>
                      <p className="text-sm text-gray-300">
                        {selectedCounselor?.specialization}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <FiClock className="text-[#FFCA40] mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white">
                        {selectedType?.name}
                      </p>
                      <p className="text-sm text-gray-300">
                        {selectedType?.duration_minutes} minutes
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <FiMapPin className="text-[#FFCA40] mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-white">
                        Gadjah Mada Medical Center
                      </p>
                      <p className="text-sm text-gray-300">
                        Psychology Department, 2nd Floor
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional Notes */}
              <div className="mb-6">
                <label htmlFor="notes" className="block text-white font-medium mb-2">Additional Notes</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Share any information that might be helpful for your provider"
                  className="w-full bg-white/5 border border-white/20 rounded-lg p-3 text-white placeholder-gray-400"
                  rows={4}
                ></textarea>
              </div>
              
              {/* Appointment Policies */}
              <div className="bg-[#173a7a]/50 border border-white/10 rounded-lg p-4 mb-8">
                <div className="flex">
                  <FiInfo className="text-[#FFCA40] mr-3 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="text-white font-medium">Important Information</h4>
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1 mt-2">
                      <li>Please arrive 15 minutes before your scheduled time</li>
                      <li>Bring your UGM student/staff ID card</li>
                      <li>Cancellation requires 24-hour notice</li>
                      <li>For emergencies, please call the UGM Crisis Line at (0274) 123-4567</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between mt-8">
                <button 
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className={`px-6 py-2 bg-[#FFCA40] text-[#001D58] rounded-lg flex items-center ${
                    loading ? 'opacity-70' : 'hover:bg-[#ffb700]'
                  }`}
                >
                  {loading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#001D58]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {loading ? 'Processing...' : 'Confirm Appointment'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Help information */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Need assistance? Contact the UGM Medical Center at <a href="tel:+62274123456" className="text-[#FFCA40] hover:underline">+62 274 123456</a></p>
        </div>
      </div>
    </div>
  );
}