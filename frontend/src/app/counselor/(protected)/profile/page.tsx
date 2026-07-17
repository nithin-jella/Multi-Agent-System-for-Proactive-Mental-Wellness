'use client';

import { useState, useEffect } from 'react';
import {
  FiUser,
  FiMail,
  FiPhone,
  FiBriefcase,
  FiAward,
  FiEdit,
  FiSave,
  FiX,
  FiCalendar,
  FiClock,
  FiAlertTriangle,
} from 'react-icons/fi';
import { apiCall } from '@/utils/adminApi';
import toast from 'react-hot-toast';

interface CounselorProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string[];
  license_number?: string;
  years_experience: number;
  bio?: string;
  availability: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
  };
  is_available: boolean;
  total_patients: number;
  total_sessions: number;
  rating: number;
  joined_date: string;
}

export default function CounselorProfilePage() {
  const [profile, setProfile] = useState<CounselorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<CounselorProfile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiCall<CounselorProfile>('/api/v1/counselor/profile');
      
      if (!data) {
        throw new Error('No profile data returned');
      }
      
      setProfile(data);
      setEditedProfile(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedProfile) return;
    
    try {
      const payload = {
        name: editedProfile.name,
        bio: editedProfile.bio,
      };
      
      const updated = await apiCall<CounselorProfile>('/api/v1/counselor/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      
      setProfile(updated || editedProfile);
      setEditedProfile(updated || editedProfile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error('Failed to save profile:', err);
      toast.error('Failed to save profile changes');
    }
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCA40] mb-4"></div>
          <p className="text-white/70">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <FiAlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-red-300 font-semibold mb-2">Failed to load profile</p>
          <p className="text-red-300/70 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-300 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!profile || !editedProfile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-white/60">Manage your professional information</p>
        </div>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white/70 hover:text-white transition-all flex items-center gap-2"
              >
                <FiX className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2"
              >
                <FiSave className="w-4 h-4" />
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2"
            >
              <FiEdit className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-full bg-[#FFCA40]/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold text-[#FFCA40]">
                {profile.name.charAt(0)}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{profile.name}</h2>
            <p className="text-sm text-white/60">{profile.specialization.join(', ')}</p>
            
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${profile.is_available ? 'bg-green-400' : 'bg-gray-400'}`}></div>
              <span className="text-xs text-white/70">
                {profile.is_available ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Total Patients</span>
              <span className="text-sm font-semibold text-white">{profile.total_patients}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Total Sessions</span>
              <span className="text-sm font-semibold text-white">{profile.total_sessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Rating</span>
              <span className="text-sm font-semibold text-[#FFCA40]">⭐ {profile.rating}/5.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/60">Experience</span>
              <span className="text-sm font-semibold text-white">{profile.years_experience} years</span>
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiUser className="w-5 h-5 text-[#FFCA40]" />
              Contact Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 block mb-1">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editedProfile.email}
                    onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                    placeholder="Email address"
                    title="Email"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <FiMail className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white">{profile.email}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">Phone</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    placeholder="Phone number"
                    title="Phone"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <FiPhone className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white">{profile.phone || 'Not set'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiBriefcase className="w-5 h-5 text-[#FFCA40]" />
              Professional Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/60 block mb-1">License Number</label>
                <div className="flex items-center gap-2">
                  <FiAward className="w-4 h-4 text-white/40" />
                  <span className="text-sm text-white">{profile.license_number || 'Not set'}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-2">Specializations</label>
                <div className="flex flex-wrap gap-2">
                  {profile.specialization.map((spec, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#FFCA40]/20 border border-[#FFCA40]/30 rounded-lg text-xs text-[#FFCA40]"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">Bio</label>
                {isEditing ? (
                  <textarea
                    value={editedProfile.bio || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    rows={4}
                    placeholder="Your professional bio"
                    title="Biography"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40] resize-none"
                  />
                ) : (
                  <p className="text-sm text-white/80">{profile.bio || 'No bio set'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Availability Schedule */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiCalendar className="w-5 h-5 text-[#FFCA40]" />
              Weekly Availability
            </h3>
            <div className="space-y-3">
              {Object.entries(profile.availability).map(([day, slots]) => (
                <div key={day} className="flex items-start gap-3">
                  <div className="w-24 pt-1">
                    <span className="text-sm font-medium text-white capitalize">{day}</span>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {slots.length > 0 ? (
                      slots.map((slot, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-xs text-white/80 flex items-center gap-1.5"
                        >
                          <FiClock className="w-3 h-3 text-[#FFCA40]" />
                          {slot}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/40">Not available</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
