"use client";

import { useEffect, useMemo, useState } from "react";
import { FiEdit, FiKey, FiRefreshCw, FiSave, FiShield } from "react-icons/fi";
import { toast } from "react-hot-toast";

import {
  changeAdminPassword,
  fetchAdminProfile,
  updateAdminProfile,
} from "@/utils/adminApi";
import type {
  AdminProfileResponse,
  AdminProfileUpdatePayload,
} from "@/types/admin/profile";

const initialProfileForm = {
  email: "",
  name: "",
  firstName: "",
  lastName: "",
  phone: "",
  allowEmailCheckins: true,
};

type ProfileForm = typeof initialProfileForm;

const PRIMARY_KEY_FIELDS: Array<keyof ProfileForm> = ["email"];

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function mapResponseToForm(profile: AdminProfileResponse): ProfileForm {
  return {
    email: profile.email ?? "",
    name: profile.name ?? "",
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    phone: profile.phone ?? "",
    allowEmailCheckins: profile.allow_email_checkins ?? true,
  };
}

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<ProfileForm>({ ...initialProfileForm });
  const [originalProfile, setOriginalProfile] = useState<ProfileForm>({ ...initialProfileForm });
  const [isEditing, setIsEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [timestamps, setTimestamps] = useState<{ createdAt?: string | null; updatedAt?: string | null }>({});

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAdminProfile();
        const mappedProfile = mapResponseToForm(data);
        setProfile(mappedProfile);
        setOriginalProfile(mappedProfile);
        setTimestamps({ createdAt: data.created_at, updatedAt: data.updated_at });
      } catch (error) {
        console.error("Failed to load admin profile", error);
        toast.error((error as Error).message || "Failed to load profile");
      } finally {
        setProfileLoading(false);
      }
    }

    load();
  }, []);

  const hasProfileChanges = useMemo(() => {
    return JSON.stringify(profile) !== JSON.stringify(originalProfile);
  }, [profile, originalProfile]);

  const isFieldDisabled = (field: keyof ProfileForm) => {
    return !isEditing || PRIMARY_KEY_FIELDS.includes(field);
  };

  const handleProfileChange = (field: keyof ProfileForm, value: string | boolean) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasProfileChanges) {
      toast.success("Profile is already up to date");
      setIsEditing(false);
      return;
    }

    setProfileSaving(true);

    const payload: AdminProfileUpdatePayload = {
      email: profile.email,
      name: profile.name || undefined,
      first_name: profile.firstName || undefined,
      last_name: profile.lastName || undefined,
      phone: profile.phone || undefined,
      allow_email_checkins: profile.allowEmailCheckins,
    };

    try {
      const updated = await updateAdminProfile(payload);
      const mappedProfile = mapResponseToForm(updated);
      setProfile(mappedProfile);
      setOriginalProfile(mappedProfile);
      setTimestamps({ createdAt: updated.created_at, updatedAt: updated.updated_at });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update admin profile", error);
      toast.error((error as Error).message || "Could not update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = (field: keyof typeof initialPasswordForm, value: string) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      await changeAdminPassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      toast.success("Password updated successfully");
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      console.error("Failed to update admin password", error);
      toast.error((error as Error).message || "Could not update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleActionButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isEditing) {
      event.preventDefault();
      setIsEditing(true);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center space-y-6 text-white/70">
        <div className="flex items-center gap-3">
          <FiRefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 text-white">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <FiShield className="h-6 w-6 text-[#FFCA40]" />
          Admin Profile
        </h1>
        <p className="text-sm text-white/70">
          Manage your administrative account details and security preferences.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Profile details</h2>
          <button
            type={isEditing ? "submit" : "button"}
            form={isEditing ? "admin-profile-form" : undefined}
            onClick={handleActionButtonClick}
            disabled={profileSaving}
            className={`${
              isEditing
                ? "inline-flex items-center gap-2 rounded-lg bg-[#FFCA40] px-4 py-2 text-sm font-semibold text-[#001D58] transition hover:bg-[#ffd45c]"
                : "inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {isEditing ? (
              profileSaving ? (
                <>
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="h-4 w-4" />
                  Save
                </>
              )
            ) : (
              <>
                <FiEdit className="h-4 w-4" />
                Edit
              </>
            )}
          </button>
        </div>

        <form id="admin-profile-form" className="space-y-6" onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Email address</label>
              <input
                type="email"
                required
                value={profile.email}
                onChange={(event) => handleProfileChange("email", event.target.value)}
                placeholder="Enter your email address"
                title="Email address (locked)"
                disabled={isFieldDisabled("email")}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Display name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(event) => handleProfileChange("name", event.target.value)}
                placeholder="Display name"
                title="Display name"
                disabled={isFieldDisabled("name")}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">First name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(event) => handleProfileChange("firstName", event.target.value)}
                placeholder="First name"
                title="First name"
                disabled={isFieldDisabled("firstName")}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Last name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(event) => handleProfileChange("lastName", event.target.value)}
                placeholder="Last name"
                title="Last name"
                disabled={isFieldDisabled("lastName")}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-white/80">Phone number</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(event) => handleProfileChange("phone", event.target.value)}
                placeholder="Phone number"
                title="Phone number"
                disabled={isFieldDisabled("phone")}
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <div>
              <h3 className="text-sm font-medium text-white">Email check-ins</h3>
              <p className="text-xs text-white/60">
                Receive notifications and wellbeing reminders via email.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <span className="text-white/70">Enabled</span>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={profile.allowEmailCheckins}
                onChange={(event) => handleProfileChange("allowEmailCheckins", event.target.checked)}
                title="Enable email check-ins"
                disabled={isFieldDisabled("allowEmailCheckins")}
              />
            </label>
          </div>

          <div className="border-t border-white/10 pt-4 text-sm text-white/60">
            <p>Created: {timestamps.createdAt ? new Date(timestamps.createdAt).toLocaleString() : "--"}</p>
            <p>Last updated: {timestamps.updatedAt ? new Date(timestamps.updatedAt).toLocaleString() : "--"}</p>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
          <FiKey className="h-5 w-5 text-[#FFCA40]" />
          Change password
        </h2>
        <form className="space-y-4" onSubmit={handlePasswordSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">Current password</label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(event) => handlePasswordChange("currentPassword", event.target.value)}
              placeholder="Current password"
              title="Current password"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.newPassword}
                onChange={(event) => handlePasswordChange("newPassword", event.target.value)}
                placeholder="New password"
                title="New password"
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordForm.confirmPassword}
                onChange={(event) => handlePasswordChange("confirmPassword", event.target.value)}
                placeholder="Confirm new password"
                title="Confirm new password"
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
            <p>Passwords must be at least 8 characters and include upper, lower, and numeric characters.</p>
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {passwordSaving ? (
                <>
                  <FiRefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <FiKey className="h-4 w-4" />
                  Update password
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
