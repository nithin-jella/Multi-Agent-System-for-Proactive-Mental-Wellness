'use client';

import { useState, useEffect } from 'react';
import {
  FiBell,
  FiLock,
  FiToggleLeft,
  FiToggleRight,
  FiClock,
  FiShield,
  FiSave,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const SETTINGS_STORAGE_KEY = 'counselor_settings';

interface Settings {
  notifications: {
    email_alerts: boolean;
    new_escalations: boolean;
    appointment_reminders: boolean;
    patient_messages: boolean;
    weekly_summary: boolean;
  };
  privacy: {
    share_analytics: boolean;
    allow_research_data: boolean;
  };
  preferences: {
    session_duration_default: number;
    auto_save_notes: boolean;
    show_patient_photos: boolean;
    timezone: string;
  };
}

export default function CounselorSettingsPage() {
  const defaultSettings: Settings = {
    notifications: {
      email_alerts: true,
      new_escalations: true,
      appointment_reminders: true,
      patient_messages: true,
      weekly_summary: false,
    },
    privacy: {
      share_analytics: false,
      allow_research_data: false,
    },
    preferences: {
      session_duration_default: 60,
      auto_save_notes: true,
      show_patient_photos: false,
      timezone: 'Asia/Jakarta',
    },
  };

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        setSettings((prev) => ({
          notifications: { ...prev.notifications, ...parsed.notifications },
          privacy: { ...prev.privacy, ...parsed.privacy },
          preferences: { ...prev.preferences, ...parsed.preferences },
        }));
      }
    } catch {
      // Invalid stored data — use defaults
    }
  }, []);

  const handleToggle = (section: keyof Settings, key: string) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: !prev[section][key as keyof typeof prev[typeof section]],
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      setSaveStatus('saved');
      toast.success('Settings saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
      setSaveStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-white/60">Manage your account preferences and notifications</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-4 py-2 bg-[#FFCA40]/20 hover:bg-[#FFCA40]/30 border border-[#FFCA40]/30 rounded-lg text-sm font-medium text-[#FFCA40] transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <FiSave className="w-4 h-4" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Notifications */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiBell className="w-5 h-5 text-[#FFCA40]" />
          Notification Preferences
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Email Alerts"
            description="Receive email notifications for important updates"
            enabled={settings.notifications.email_alerts}
            onToggle={() => handleToggle('notifications', 'email_alerts')}
          />
          <SettingToggle
            label="New Escalations"
            description="Get notified when cases are escalated to you"
            enabled={settings.notifications.new_escalations}
            onToggle={() => handleToggle('notifications', 'new_escalations')}
          />
          <SettingToggle
            label="Appointment Reminders"
            description="Receive reminders 1 hour before appointments"
            enabled={settings.notifications.appointment_reminders}
            onToggle={() => handleToggle('notifications', 'appointment_reminders')}
          />
          <SettingToggle
            label="Patient Messages"
            description="Notifications for new patient messages"
            enabled={settings.notifications.patient_messages}
            onToggle={() => handleToggle('notifications', 'patient_messages')}
          />
          <SettingToggle
            label="Weekly Summary"
            description="Receive weekly performance and activity summary"
            enabled={settings.notifications.weekly_summary}
            onToggle={() => handleToggle('notifications', 'weekly_summary')}
          />
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiShield className="w-5 h-5 text-[#FFCA40]" />
          Privacy Settings
        </h3>
        <div className="space-y-4">
          <SettingToggle
            label="Share Anonymized Analytics"
            description="Help improve the platform by sharing anonymized usage data"
            enabled={settings.privacy.share_analytics}
            onToggle={() => handleToggle('privacy', 'share_analytics')}
          />
          <SettingToggle
            label="Allow Research Data Usage"
            description="Permit use of de-identified data for mental health research"
            enabled={settings.privacy.allow_research_data}
            onToggle={() => handleToggle('privacy', 'allow_research_data')}
          />
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiClock className="w-5 h-5 text-[#FFCA40]" />
          Preferences
        </h3>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-white block mb-1">
                Default Session Duration
              </label>
              <p className="text-xs text-white/60">Default length for new appointments</p>
            </div>
            <select
              value={settings.preferences.session_duration_default}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    session_duration_default: parseInt(e.target.value),
                  },
                }))
              }
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
              title="Select default session duration"
            >
              <option value="30" className="bg-[#001d58]">30 minutes</option>
              <option value="45" className="bg-[#001d58]">45 minutes</option>
              <option value="60" className="bg-[#001d58]">60 minutes</option>
              <option value="90" className="bg-[#001d58]">90 minutes</option>
            </select>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-white block mb-1">Timezone</label>
              <p className="text-xs text-white/60">Your local timezone for scheduling</p>
            </div>
            <select
              value={settings.preferences.timezone}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    timezone: e.target.value,
                  },
                }))
              }
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:border-[#FFCA40] focus:ring-1 focus:ring-[#FFCA40]"
              title="Select timezone"
            >
              <option value="Asia/Jakarta" className="bg-[#001d58]">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar" className="bg-[#001d58]">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura" className="bg-[#001d58]">Asia/Jayapura (WIT)</option>
            </select>
          </div>

          <SettingToggle
            label="Auto-Save Session Notes"
            description="Automatically save notes as you type"
            enabled={settings.preferences.auto_save_notes}
            onToggle={() => handleToggle('preferences', 'auto_save_notes')}
          />
          <SettingToggle
            label="Show Patient Photos"
            description="Display patient profile photos in lists (if available)"
            enabled={settings.preferences.show_patient_photos}
            onToggle={() => handleToggle('preferences', 'show_patient_photos')}
          />
        </div>
      </div>

      {/* Security */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiLock className="w-5 h-5 text-[#FFCA40]" />
          Security
        </h3>
        <div className="space-y-3">
          <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white text-left transition-all">
            Change Password
          </button>
          <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white text-left transition-all">
            Two-Factor Authentication
          </button>
          <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg text-sm text-white text-left transition-all">
            Active Sessions
          </button>
        </div>
      </div>
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function SettingToggle({ label, description, enabled, onToggle }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <label className="text-sm font-medium text-white block mb-1">{label}</label>
        <p className="text-xs text-white/60">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className="flex-shrink-0 transition-all"
        aria-label={`Toggle ${label}`}
      >
        {enabled ? (
          <FiToggleRight className="w-10 h-10 text-[#FFCA40]" />
        ) : (
          <FiToggleLeft className="w-10 h-10 text-white/30" />
        )}
      </button>
    </div>
  );
}
