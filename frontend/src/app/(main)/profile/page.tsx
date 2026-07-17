"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Switch } from "@headlessui/react";
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiGlobe,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiSliders,
  FiTrendingUp,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { format } from "date-fns";

import GlobalSkeleton from "@/components/ui/GlobalSkeleton";
import ParticleBackground from "@/components/ui/ParticleBackground";
import EarnedBadgesDisplay from "@/components/ui/EarnedBadgesDisplay";
import WalletLinkButton from "@/components/ui/WalletLinkButton";
import ProfileQuickSummary from "@/components/ui/profile/ProfileQuickSummary";
import SafeAvatar from "@/components/ui/profile/SafeAvatar";
import { useWellnessState } from "@/hooks/useQuests";
import { sanitizeProfilePhotoInput } from "@/lib/imageUrl";
import apiClient, {
  deleteUserAIMemoryFact,
  fetchUserAIMemoryFacts,
  fetchUserProfileOverview,
  updateUserProfileOverview,
} from "@/services/api";
import type { AIMemoryFact, TimelineEntry, UserProfileOverviewResponse, UserProfileOverviewUpdate } from "@/types/profile";



type TimelineFilter = "all" | "journal" | "conversation" | "appointment" | "badge";

type ProfileFormState = {
  preferred_name: string;
  pronouns: string;
  profile_photo_url: string;
  city: string;
  university: string;
  major: string;
  year_of_study: string;
  phone: string;
  alternate_phone: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
  risk_level: string;
  clinical_summary: string;
  primary_concerns: string;
  safety_plan_notes: string;
  current_therapist_name: string;
  current_therapist_contact: string;
  therapy_modality: string;
  therapy_frequency: string;
  therapy_notes: string;
  aicare_team_notes: string;
  preferred_language: string;
  preferred_timezone: string;
  accessibility_needs: string;
  communication_preferences: string;
  interface_preferences: string;
  consent_data_sharing: boolean;
  consent_research: boolean;
  consent_emergency_contact: boolean;
  consent_marketing: boolean;
  consent_ai_memory: boolean;
};

const timelineIcons: Record<string, React.JSX.Element> = {
  journal: <FiBookOpen className="h-4 w-4" />,
  conversation: <FiMessageCircle className="h-4 w-4" />,
  appointment: <FiCalendar className="h-4 w-4" />,
  badge: <FiAward className="h-4 w-4" />,
};
const timelineLabels: Record<string, string> = {
  journal: "Journal entry",
  conversation: "Conversation",
  appointment: "Appointment",
  badge: "Badge achieved",
};

const TIMELINE_FILTER_OPTIONS: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "journal", label: "Journal" },
  { value: "conversation", label: "Conversations" },
  { value: "appointment", label: "Appointments" },
  { value: "badge", label: "Badges" },
];
const inputBaseClass =
  "w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40";
const textareaBaseClass =
  "w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-[#FFCA40] focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/40";

const TIMELINE_PREVIEW_COUNT = 5;
const AICARE_TEAM_NOTES_MAX_LENGTH = 600;

function TimelineList({
  entries,
  isExpanded,
  onToggle,
  initialCount = TIMELINE_PREVIEW_COUNT,
  emptyMessage,
}: {
  entries: TimelineEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  initialCount?: number;
  emptyMessage?: string;
}) {
  if (!entries.length) {
    return (
      <p className="text-white/60">
        {emptyMessage ?? "No activity recorded yet. Your first journal entry or conversation will appear here."}
      </p>
    );
  }

  const hasMore = entries.length > initialCount;
  const displayedEntries = isExpanded || !hasMore ? entries : entries.slice(0, initialCount);

  return (
    <div className="space-y-6">
      <ol className="relative space-y-6 border-l border-white/10 pl-6">
        {displayedEntries.map((entry, index) => {
          const icon = timelineIcons[entry.kind] ?? <FiActivity className="h-4 w-4" />;
          const timestamp = format(new Date(entry.timestamp), "PPpp");
          const label = timelineLabels[entry.kind] ?? entry.kind;

          return (
            <li key={`${entry.kind}-${entry.timestamp}-${index}`} className="relative">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#FFCA40]/90 text-[#001D58]">
                {icon}
              </span>
              <div className="rounded-xl bg-white/5 p-4 shadow-sm ring-1 ring-white/10 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{entry.title}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-white/70">{label}</span>
                </div>
                {entry.description && (
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{entry.description}</p>
                )}
                <p className="mt-3 text-xs uppercase tracking-wide text-white/40">{timestamp}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {hasMore && (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
        >
          {isExpanded ? "Show fewer events" : "Show more events"}
        </button>
      )}
    </div>
  );
}

function mapProfileToForm(profile: UserProfileOverviewResponse): ProfileFormState {
  return {
    preferred_name: profile.header.preferred_name ?? "",
    pronouns: profile.header.pronouns ?? "",
    profile_photo_url: profile.header.profile_photo_url ?? "",
    city: profile.header.city ?? "",
    university: profile.header.university ?? "",
    major: profile.header.major ?? "",
    year_of_study: profile.header.year_of_study ?? "",
    phone: profile.contact.phone ?? "",
    alternate_phone: profile.contact.alternate_phone ?? "",
    emergency_contact_name: profile.contact.emergency_contact?.name ?? "",
    emergency_contact_relationship: profile.contact.emergency_contact?.relationship ?? "",
    emergency_contact_phone: profile.contact.emergency_contact?.phone ?? "",
    emergency_contact_email: profile.contact.emergency_contact?.email ?? "",
    risk_level: profile.safety.risk_level ?? "",
    clinical_summary: profile.safety.clinical_summary ?? "",
    primary_concerns: profile.safety.primary_concerns ?? "",
    safety_plan_notes: profile.safety.safety_plan_notes ?? "",
    current_therapist_name: profile.therapy.current_therapist_name ?? "",
    current_therapist_contact: profile.therapy.current_therapist_contact ?? "",
    therapy_modality: profile.therapy.therapy_modality ?? "",
    therapy_frequency: profile.therapy.therapy_frequency ?? "",
    therapy_notes: profile.therapy.therapy_notes ?? "",
    aicare_team_notes: profile.aicare_team_notes ?? "",
    preferred_language: profile.localization.preferred_language ?? "",
    preferred_timezone: profile.localization.preferred_timezone ?? "",
    accessibility_needs: profile.localization.accessibility_needs ?? "",
    communication_preferences: profile.localization.communication_preferences ?? "",
    interface_preferences: profile.localization.interface_preferences ?? "",
    consent_data_sharing: profile.consent.consent_data_sharing,
    consent_research: profile.consent.consent_research,
    consent_emergency_contact: profile.consent.consent_emergency_contact,
    consent_marketing: profile.consent.consent_marketing,
    consent_ai_memory: profile.consent.consent_ai_memory,
  };
}

const toNullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const buildUpdatePayload = (state: ProfileFormState): UserProfileOverviewUpdate => ({
  preferred_name: toNullableString(state.preferred_name),
  pronouns: toNullableString(state.pronouns),
  profile_photo_url: toNullableString(state.profile_photo_url),
  phone: toNullableString(state.phone),
  alternate_phone: toNullableString(state.alternate_phone),
  emergency_contact_name: toNullableString(state.emergency_contact_name),
  emergency_contact_relationship: toNullableString(state.emergency_contact_relationship),
  emergency_contact_phone: toNullableString(state.emergency_contact_phone),
  emergency_contact_email: toNullableString(state.emergency_contact_email),
  risk_level: toNullableString(state.risk_level),
  clinical_summary: toNullableString(state.clinical_summary),
  primary_concerns: toNullableString(state.primary_concerns),
  safety_plan_notes: toNullableString(state.safety_plan_notes),
  current_therapist_name: toNullableString(state.current_therapist_name),
  current_therapist_contact: toNullableString(state.current_therapist_contact),
  therapy_modality: toNullableString(state.therapy_modality),
  therapy_frequency: toNullableString(state.therapy_frequency),
  therapy_notes: toNullableString(state.therapy_notes),
  aicare_team_notes: toNullableString(state.aicare_team_notes),
  preferred_language: toNullableString(state.preferred_language),
  preferred_timezone: toNullableString(state.preferred_timezone),
  accessibility_needs: toNullableString(state.accessibility_needs),
  communication_preferences: toNullableString(state.communication_preferences),
  interface_preferences: toNullableString(state.interface_preferences),
  city: toNullableString(state.city),
  university: toNullableString(state.university),
  major: toNullableString(state.major),
  year_of_study: toNullableString(state.year_of_study),
  consent_data_sharing: state.consent_data_sharing,
  consent_research: state.consent_research,
  consent_emergency_contact: state.consent_emergency_contact,
  consent_marketing: state.consent_marketing,
  consent_ai_memory: state.consent_ai_memory,
});


export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: wellness } = useWellnessState();

  const [profile, setProfile] = useState<UserProfileOverviewResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [allowCheckins, setAllowCheckins] = useState(true);
  const [isSavingCheckinSetting, setIsSavingCheckinSetting] = useState(false);
  const [checkinSettingError, setCheckinSettingError] = useState<string | null>(null);

  const [showQr, setShowQr] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const filteredTimeline = useMemo(() => {
    const entries = profile?.timeline ?? [];
    return timelineFilter === "all"
      ? entries
      : entries.filter((entry) => entry.kind === timelineFilter);
  }, [profile, timelineFilter]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [showAllTimelineEntries, setShowAllTimelineEntries] = useState(false);

  const [aiMemoryFacts, setAiMemoryFacts] = useState<AIMemoryFact[]>([]);
  const [aiMemoryFactsLoading, setAiMemoryFactsLoading] = useState(false);
  const [aiMemoryFactsError, setAiMemoryFactsError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin?callbackUrl=/profile");
    }
  }, [router, status]);

  useEffect(() => {
    if (!profile) {
      setAllowCheckins(
        (session?.user as { allow_email_checkins?: boolean })?.allow_email_checkins ?? true,
      );
    }
  }, [profile, session?.user]);

  useEffect(() => {
    setShowAllTimelineEntries(false);
  }, [timelineFilter]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      // First, refresh user stats to ensure they're current
      try {
        await apiClient.post("/profile/refresh-stats");
      } catch (error) {
        console.warn("Failed to refresh user stats (non-critical)", error);
        // Continue even if stats refresh fails
      }
      
      const data = await fetchUserProfileOverview();
      setProfile(data);
      setAllowCheckins(data.consent.allow_email_checkins);
      setForm(mapProfileToForm(data));
      setShowAllTimelineEntries(false);

      setAiMemoryFactsLoading(true);
      setAiMemoryFactsError(null);
      try {
        const facts = await fetchUserAIMemoryFacts();
        setAiMemoryFacts(facts);
      } catch (error) {
        console.warn("Failed to load AI memory facts (non-critical)", error);
        setAiMemoryFactsError("We could not load your AI memory facts right now.");
      } finally {
        setAiMemoryFactsLoading(false);
      }
    } catch (error) {
      console.error("Failed to load profile overview", error);
      setProfileError(
        "We could not load your profile information. Please try again shortly.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      void fetchProfile();
    }
  }, [fetchProfile, status]);

  const handleCheckinToggle = async (enabled: boolean) => {
    setAllowCheckins(enabled);
    setIsSavingCheckinSetting(true);
    setCheckinSettingError(null);

    try {
      await apiClient.put("/profile/settings/checkins", { allow_email_checkins: enabled });
      toast.success(enabled ? "Email check-ins enabled" : "Email check-ins disabled");
    } catch (error) {
      console.error("Failed to update check-in preference", error);
      setCheckinSettingError("Could not update your preference. Please try again.");
      setAllowCheckins((prev) => !prev);
    } finally {
      setIsSavingCheckinSetting(false);
    }
  };

  const handleAIMemoryConsentToggle = async (enabled: boolean) => {
    if (!profile || !form) {
      return;
    }

    setForm((prev) => (prev ? { ...prev, consent_ai_memory: enabled } : prev));
    try {
      const updated = await updateUserProfileOverview({ consent_ai_memory: enabled });
      setProfile(updated);
      toast.success(enabled ? "AI memory enabled" : "AI memory disabled");
    } catch (error) {
      console.error("Failed to update AI memory consent", error);
      toast.error("Failed to update AI memory consent");
      // Revert local state
      setForm(mapProfileToForm(profile));
    }
  };

  const handleForgetAIMemoryFact = async (factId: number) => {
    try {
      await deleteUserAIMemoryFact(factId);
      setAiMemoryFacts((prev) => prev.filter((f) => f.id !== factId));
      toast.success("Forgot memory fact");
    } catch (error) {
      console.error("Failed to forget AI memory fact", error);
      toast.error("Failed to forget memory fact");
    }
  };

  const handleCopyCheckInCode = async () => {
    if (!profile?.header.check_in_code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(profile.header.check_in_code);
      toast.success("Check-in code copied to clipboard");
    } catch (error) {
      console.error("Failed to copy check-in code", error);
      toast.error("Unable to copy check-in code");
    }
  };

  const updateFormField = useCallback((field: keyof ProfileFormState, value: ProfileFormState[keyof ProfileFormState]) => {
    setForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      } as ProfileFormState;
    });
  }, []);

  const handleTimelineToggle = () => {
    setShowAllTimelineEntries((prev) => !prev);
  };

  const handleEnterEditMode = () => {
    if (!profile) {
      return;
    }
    setForm(mapProfileToForm(profile));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (profile) {
      setForm(mapProfileToForm(profile));
    }
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!profile || !form) {
      return;
    }

    if (form.profile_photo_url.trim()) {
      const sanitizedPhotoUrl = sanitizeProfilePhotoInput(form.profile_photo_url);
      if (!sanitizedPhotoUrl) {
        toast.error("Please provide a valid http(s) profile photo URL.");
        return;
      }
      if (sanitizedPhotoUrl !== form.profile_photo_url.trim()) {
        setForm((prev) => (prev ? { ...prev, profile_photo_url: sanitizedPhotoUrl } : prev));
      }
    }

    setIsSavingProfile(true);
    try {
      const normalizedForm = {
        ...form,
        profile_photo_url: sanitizeProfilePhotoInput(form.profile_photo_url) ?? "",
      };
      const payload = buildUpdatePayload(normalizedForm);
      const updated = await updateUserProfileOverview(payload);
      setProfile(updated);
      setForm(mapProfileToForm(updated));
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (error) {
      console.error("Failed to update profile", error);
      toast.error("Could not save your profile. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const hasFormChanges = useMemo(() => {
    if (!profile || !form) {
      return false;
    }
    return JSON.stringify(form) !== JSON.stringify(mapProfileToForm(profile));
  }, [form, profile]);

  const headerImageSrc = useMemo(() => {
    if (!profile) {
      return "/default-avatar.png";
    }
    if (isEditing && form) {
      // While editing, show the URL the user is typing; fall back to server-resolved avatar
      return form.profile_photo_url.trim() || profile.header.avatar_url || "/default-avatar.png";
    }
    // avatar_url is always resolved server-side (DB photo OR DiceBear fallback)
    return profile.header.avatar_url || "/default-avatar.png";
  }, [form, isEditing, profile]);

  const academicSummary = useMemo(() => {
    if (!profile) {
      return "Here is your wellbeing journey overview.";
    }
    const source = isEditing && form ? form : null;
    const year = (source ? source.year_of_study : profile.header.year_of_study)?.trim();
    const major = (source ? source.major : profile.header.major)?.trim();
    const parts: string[] = [];
    if (year) {
      parts.push(`Class of ${year}`);
    }
    if (major) {
      parts.push(major);
    }
    return parts.length ? parts.join(' \u2022 ') : 'Here is your wellbeing journey overview.';
  }, [form, isEditing, profile]);

  const headerMetrics = useMemo(() => {
    if (!profile)
      return [] as Array<{ label: string; value: string; icon: React.JSX.Element }>;

    const wellnessMetrics: Array<{ label: string; value: string; icon: React.JSX.Element }> = [
      {
        label: "JOY",
        value: wellness ? `${wellness.joy_balance}` : "—",
        icon: <FiAward className="h-4 w-4" />,
      },
      {
        label: "CARE",
        value: wellness ? `${wellness.care_balance}` : "—",
        icon: <FiUsers className="h-4 w-4" />,
      },
      {
        label: "Harmony",
        value: wellness ? `${wellness.harmony_score}` : "—",
        icon: <FiGlobe className="h-4 w-4" />,
      },
    ];

    return [
      ...wellnessMetrics,
      {
        label: "Current Streak",
        value: `${profile.header.current_streak} days`,
        icon: <FiTrendingUp className="h-4 w-4" />,
      },
      {
        label: "Longest Streak",
        value: `${profile.header.longest_streak} days`,
        icon: <FiActivity className="h-4 w-4" />,
      },
    ];
  }, [profile, wellness]);

  if (status === "loading" || profileLoading) {
    return (
      <div className="relative min-h-screen pt-16">
        <ParticleBackground />
        <div className="relative z-10">
          <GlobalSkeleton />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white shadow-2xl backdrop-blur">
          <FiXCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-white/70">{profileError}</p>
          <button
            onClick={() => fetchProfile()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#FFCA40] px-6 py-2 text-sm font-semibold text-[#001D58] transition hover:bg-[#ffd45c]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!profile || !form) {
    return null;
  }

  const timelineEmptyMessage =
    timelineFilter === "all" ? undefined : "No activity matches this filter yet.";

  const firstName = (isEditing ? form.preferred_name : profile.header.preferred_name) ?? profile.header.full_name ?? "Friend";

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-24">
        <header className="rounded-3xl border border-white/10 bg-linear-to-br from-white/10 to-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">Profile overview</p>
              <h1 className="text-3xl font-semibold text-white">Welcome back, {firstName}</h1>
              <p className="text-sm text-white/70">Manage your personal profile details.</p>
            </div>
            <div className="flex flex-col items-stretch gap-3 text-sm text-white/70 md:items-end">
              {isEditing && (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/80">
                  <FiEdit3 className="h-3 w-3" />
                  Editing mode
                </span>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileDetails((prev) => !prev)}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition",
                    showProfileDetails
                      ? "border-[#FFCA40] text-[#FFCA40]"
                      : "border-white/20 text-white hover:border-[#FFCA40] hover:text-[#FFCA40]"
                  )}
                >
                  {showProfileDetails ? "Hide advanced details" : "Show advanced details"}
                </button>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingProfile}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <FiX className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile || !hasFormChanges}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#FFCA40] px-4 py-2 text-sm font-semibold text-[#001D58] transition hover:bg-[#ffd45c] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingProfile ? (
                        <>
                          <FiRefreshCw className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <FiSave className="h-4 w-4" />
                          Save changes
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnterEditMode}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
                  >
                    <FiEdit3 className="h-4 w-4" />
                    Edit profile
                  </button>
                )}
                {!isEditing && (
                  <Link
                    href="/profile/simaster-import"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
                  >
                    <FiDownload className="h-4 w-4" />
                    Import from SIMASTER
                  </Link>
                )}
              </div>
              <p className="text-xs text-white/50">
                {isEditing
                  ? "Review your updates and save when you're ready."
                  : "Keep your personal details current to tailor AICare to you."}
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5">
              <SafeAvatar src={headerImageSrc} alt={profile.header.full_name || "Profile"} className="h-24 w-24" />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">
                    {profile.header.full_name || firstName}
                  </h1>
                  {(profile.header.pronouns || form.pronouns.trim()) && (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/80">
                      {isEditing ? form.pronouns || profile.header.pronouns : profile.header.pronouns}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-white/70">
                  {academicSummary}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                  {profile.header.age !== null && profile.header.age !== undefined && (
                    <span className="inline-flex items-center gap-1">
                      <FiUsers className="h-3 w-3" /> {profile.header.age} years old
                    </span>
                  )}
                  {(profile.header.city || form.city.trim()) && (
                    <span className="inline-flex items-center gap-1">
                      <FiMapPin className="h-3 w-3" /> {isEditing ? form.city || profile.header.city : profile.header.city}
                    </span>
                  )}
                  {(profile.header.university || form.university.trim()) && (
                    <span className="inline-flex items-center gap-1">
                      <FiGlobe className="h-3 w-3" /> {isEditing ? form.university || profile.header.university : profile.header.university}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-4 grid gap-4 text-sm text-white/80 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Preferred name</p>
                      <input
                        value={form.preferred_name}
                        onChange={(event) => updateFormField("preferred_name", event.target.value)}
                        className={inputBaseClass}
                        placeholder="Preferred name"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Pronouns</p>
                      <input
                        value={form.pronouns}
                        onChange={(event) => updateFormField("pronouns", event.target.value)}
                        className={inputBaseClass}
                        placeholder="e.g. she/her"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Profile photo URL</p>
                      <input
                        value={form.profile_photo_url}
                        onChange={(event) => updateFormField("profile_photo_url", event.target.value)}
                        className={inputBaseClass}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">City / Location</p>
                      <input
                        value={form.city}
                        onChange={(event) => updateFormField("city", event.target.value)}
                        className={inputBaseClass}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">University</p>
                      <input
                        value={form.university}
                        onChange={(event) => updateFormField("university", event.target.value)}
                        className={inputBaseClass}
                        placeholder="University"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Major</p>
                      <input
                        value={form.major}
                        onChange={(event) => updateFormField("major", event.target.value)}
                        className={inputBaseClass}
                        placeholder="Major"
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/50">Year of study</p>
                      <input
                        value={form.year_of_study}
                        onChange={(event) => updateFormField("year_of_study", event.target.value)}
                        className={inputBaseClass}
                        placeholder="2026"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">Live check-in ID</p>
                  <p className="mt-1 text-lg font-semibold">
                    {profile.header.check_in_code.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={handleCopyCheckInCode}
                  className="rounded-full border border-white/20 p-2 text-white/80 transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
                  title="Copy check-in code"
                >
                  <FiCopy className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setShowQr((prev) => !prev)}
                className="mt-4 w-full rounded-full bg-[#FFCA40] py-2 text-sm font-semibold text-[#001D58] transition hover:bg-[#ffd45c]"
              >
                {showQr ? "Hide QR" : "Show QR Code"}
              </button>
              {showQr && (
                <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
                  <QRCode value={profile.header.check_in_code} className="h-28 w-28" />
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="text-white">
              <p className="text-xs uppercase tracking-wide text-white/50">Digital Identity</p>
              <p className="mt-1 text-sm text-white/70">Connect your wallet to secure your decentralized identity</p>
            </div>
            <WalletLinkButton />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {headerMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              >
                <span className="rounded-full bg-[#FFCA40]/10 p-2 text-[#FFCA40]">
                  {metric.icon}
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">{metric.label}</p>
                  <p className="text-lg font-semibold">{metric.value}</p>
                </div>
              </div>
            ))}
          </div>
          {showProfileDetails && (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur md:col-span-2">
              <div className="flex items-center gap-2 text-white">
                <FiPhone className="h-5 w-5 text-[#FFCA40]" />
                <h3 className="text-base font-semibold">Contact information</h3>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/50">Primary email</p>
                  <p>{profile.contact.primary_email ?? "Not provided"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/50">Primary phone</p>
                  {isEditing ? (
                    <input
                      value={form.phone}
                      onChange={(event) => updateFormField("phone", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Primary phone"
                    />
                  ) : (
                    <p>{profile.contact.phone ?? "Not provided"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/50">Alternate phone</p>
                  {isEditing ? (
                    <input
                      value={form.alternate_phone}
                      onChange={(event) => updateFormField("alternate_phone", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Alternate phone"
                    />
                  ) : (
                    <p>{profile.contact.alternate_phone ?? "Not provided"}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/50">Wallet address</p>
                  <p>
                    {profile.header.wallet_address
                      ? `${profile.header.wallet_address.slice(0, 6)}...${profile.header.wallet_address.slice(-4)}`
                      : "Not linked"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-white/50">Digital ID</p>
                  <p>{profile.header.google_sub ?? "Not linked"}</p>
                </div>
                <div className="space-y-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Emergency contact</p>
                  {isEditing ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-white/50">Name</label>
                        <input
                          value={form.emergency_contact_name}
                          onChange={(event) => updateFormField("emergency_contact_name", event.target.value)}
                          className={inputBaseClass}
                          placeholder="Contact name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-white/50">Relationship</label>
                        <input
                          value={form.emergency_contact_relationship}
                          onChange={(event) => updateFormField("emergency_contact_relationship", event.target.value)}
                          className={inputBaseClass}
                          placeholder="Relationship"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-white/50">Phone</label>
                        <input
                          value={form.emergency_contact_phone}
                          onChange={(event) => updateFormField("emergency_contact_phone", event.target.value)}
                          className={inputBaseClass}
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-white/50">Email</label>
                        <input
                          type="email"
                          value={form.emergency_contact_email}
                          onChange={(event) => updateFormField("emergency_contact_email", event.target.value)}
                          className={inputBaseClass}
                          placeholder="Email address"
                        />
                      </div>
                    </div>
                  ) : profile.contact.emergency_contact ? (
                    <ul className="space-y-1 text-sm">
                      <li>{profile.contact.emergency_contact.name}</li>
                      <li className="text-white/60">{profile.contact.emergency_contact.relationship}</li>
                      {profile.contact.emergency_contact.phone && (
                        <li>{profile.contact.emergency_contact.phone}</li>
                      )}
                      {profile.contact.emergency_contact.email && (
                        <li>{profile.contact.emergency_contact.email}</li>
                      )}
                    </ul>
                  ) : (
                    <p>No emergency contact on file.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <FiShield className="h-5 w-5 text-[#FFCA40]" />
                <h3 className="text-base font-semibold">Safety & clinical basics</h3>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Risk level</p>
                  {isEditing ? (
                    <input
                      value={form.risk_level}
                      onChange={(event) => updateFormField("risk_level", event.target.value)}
                      className={inputBaseClass}
                      placeholder="e.g. Moderate"
                    />
                  ) : (
                    <p>{profile.safety.risk_level ?? "Not assessed"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Primary concerns</p>
                  {isEditing ? (
                    <textarea
                      value={form.primary_concerns}
                      onChange={(event) => updateFormField("primary_concerns", event.target.value)}
                      className={textareaBaseClass}
                      rows={3}
                      placeholder="Key focus areas"
                    />
                  ) : (
                    <p>{profile.safety.primary_concerns ?? "Add the areas you want to focus on"}</p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Clinical summary</p>
                  {isEditing ? (
                    <textarea
                      value={form.clinical_summary}
                      onChange={(event) => updateFormField("clinical_summary", event.target.value)}
                      className={textareaBaseClass}
                      rows={4}
                      placeholder="Summary of clinical notes"
                    />
                  ) : (
                    <p>
                      {profile.safety.clinical_summary ??
                        "We will summarise key clinical notes here once available."}
                    </p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Safety plan notes</p>
                  {isEditing ? (
                    <textarea
                      value={form.safety_plan_notes}
                      onChange={(event) => updateFormField("safety_plan_notes", event.target.value)}
                      className={textareaBaseClass}
                      rows={4}
                      placeholder="Capture any safety plans agreed with your support team"
                    />
                  ) : (
                    <p>
                      {profile.safety.safety_plan_notes ??
                        "Use this space to capture any safety plans agreed with your therapist or support team."}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <FiCheckCircle className="h-5 w-5 text-[#FFCA40]" />
                <h3 className="text-base font-semibold">Consent & privacy</h3>
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Email check-ins</span>
                  <Switch
                    checked={allowCheckins}
                    onChange={handleCheckinToggle}
                    disabled={isSavingCheckinSetting}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/80 focus:ring-offset-2 focus:ring-offset-gray-900",
                      allowCheckins ? "bg-[#FFCA40]" : "bg-gray-600",
                      isSavingCheckinSetting && "opacity-70",
                    )}
                  >
                    <span className="sr-only">Toggle email check-ins</span>
                    <span
                      className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition",
                        allowCheckins ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </Switch>
                </div>
                {checkinSettingError && (
                  <p className="text-xs text-red-400">{checkinSettingError}</p>
                )}

                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Allow Aika to remember facts about you</span>
                  <Switch
                    checked={form?.consent_ai_memory ?? profile.consent.consent_ai_memory}
                    onChange={handleAIMemoryConsentToggle}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#FFCA40]/80 focus:ring-offset-2 focus:ring-offset-gray-900",
                      (form?.consent_ai_memory ?? profile.consent.consent_ai_memory) ? "bg-[#FFCA40]" : "bg-gray-600",
                    )}
                  >
                    <span className="sr-only">Toggle AI memory</span>
                    <span
                      className={clsx(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition",
                        (form?.consent_ai_memory ?? profile.consent.consent_ai_memory) ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </Switch>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/50">Remembered facts</p>
                  {aiMemoryFactsLoading ? (
                    <p className="mt-2 text-sm text-white/60">Loading…</p>
                  ) : aiMemoryFactsError ? (
                    <p className="mt-2 text-sm text-red-400">{aiMemoryFactsError}</p>
                  ) : !aiMemoryFacts.length ? (
                    <p className="mt-2 text-sm text-white/60">No facts saved yet.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-white/40">
                          <tr>
                            <th className="py-2 pr-4">Fact</th>
                            <th className="py-2 pr-4">Learned</th>
                            <th className="py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {aiMemoryFacts.map((fact) => (
                            <tr key={fact.id}>
                              <td className="py-3 pr-4 text-white/80">{fact.fact}</td>
                              <td className="py-3 pr-4 text-white/60">{format(new Date(fact.created_at), "PP")}</td>
                              <td className="py-3">
                                <button
                                  type="button"
                                  onClick={() => handleForgetAIMemoryFact(fact.id)}
                                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white transition hover:border-[#FFCA40] hover:text-[#FFCA40]"
                                >
                                  Forget
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    {profile.consent.consent_data_sharing ? (
                      <FiCheckCircle className="text-emerald-400" />
                    ) : (
                      <FiXCircle className="text-red-400" />
                    )}
                    <span>Share anonymised insights to improve AICare</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {profile.consent.consent_research ? (
                      <FiCheckCircle className="text-emerald-400" />
                    ) : (
                      <FiXCircle className="text-red-400" />
                    )}
                    <span>Participate in wellbeing research studies</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {profile.consent.consent_emergency_contact ? (
                      <FiCheckCircle className="text-emerald-400" />
                    ) : (
                      <FiXCircle className="text-red-400" />
                    )}
                    <span>Allow AICare to reach your emergency contact when needed</span>
                  </li>
                  <li className="flex items-center gap-2">
                    {profile.consent.consent_marketing ? (
                      <FiCheckCircle className="text-emerald-400" />
                    ) : (
                      <FiXCircle className="text-red-400" />
                    )}
                    <span>Receive wellbeing updates and programme invitations</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur">
              <div className="flex items-center gap-2 text-white">
                <FiGlobe className="h-5 w-5 text-[#FFCA40]" />
                <h3 className="text-base font-semibold">Personal preferences</h3>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Preferred language</p>
                  {isEditing ? (
                    <input
                      value={form.preferred_language}
                      onChange={(event) => updateFormField("preferred_language", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Preferred language"
                    />
                  ) : (
                    <p>{profile.localization.preferred_language ?? "English"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Timezone</p>
                  {isEditing ? (
                    <input
                      value={form.preferred_timezone}
                      onChange={(event) => updateFormField("preferred_timezone", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Timezone (e.g. Asia/Jakarta)"
                    />
                  ) : (
                    <p>{profile.localization.preferred_timezone ?? "Asia/Jakarta"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Accessibility notes</p>
                  {isEditing ? (
                    <textarea
                      value={form.accessibility_needs}
                      onChange={(event) => updateFormField("accessibility_needs", event.target.value)}
                      className={textareaBaseClass}
                      rows={3}
                      placeholder="Tell us what helps you engage comfortably"
                    />
                  ) : (
                    <p>
                      {profile.localization.accessibility_needs ??
                        "Let us know what helps you engage comfortably."}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Preferred communication</p>
                  {isEditing ? (
                    <textarea
                      value={form.communication_preferences}
                      onChange={(event) => updateFormField("communication_preferences", event.target.value)}
                      className={textareaBaseClass}
                      rows={3}
                      placeholder="How should we reach you?"
                    />
                  ) : (
                    <p>{profile.localization.communication_preferences ?? "Email & in-app messages"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Interface preferences</p>
                  {isEditing ? (
                    <textarea
                      value={form.interface_preferences}
                      onChange={(event) => updateFormField("interface_preferences", event.target.value)}
                      className={textareaBaseClass}
                      rows={3}
                      placeholder="UI adjustments that work best for you"
                    />
                  ) : (
                    <p>{profile.localization.interface_preferences ?? "Standard experience"}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80 backdrop-blur md:col-span-2">
              <div className="flex items-center gap-2 text-white">
                <FiUsers className="h-5 w-5 text-[#FFCA40]" />
                <h3 className="text-base font-semibold">Therapy overview</h3>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Therapist</p>
                  {isEditing ? (
                    <input
                      value={form.current_therapist_name}
                      onChange={(event) => updateFormField("current_therapist_name", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Therapist name"
                    />
                  ) : (
                    <p>{profile.therapy.current_therapist_name ?? "Not assigned"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Therapist contact</p>
                  {isEditing ? (
                    <input
                      value={form.current_therapist_contact}
                      onChange={(event) => updateFormField("current_therapist_contact", event.target.value)}
                      className={inputBaseClass}
                      placeholder="Contact details"
                    />
                  ) : (
                    <p>{profile.therapy.current_therapist_contact ?? "Not available"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Therapy modality</p>
                  {isEditing ? (
                    <input
                      value={form.therapy_modality}
                      onChange={(event) => updateFormField("therapy_modality", event.target.value)}
                      className={inputBaseClass}
                      placeholder="e.g. CBT"
                    />
                  ) : (
                    <p>{profile.therapy.therapy_modality ?? "Pending"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/50">Session cadence</p>
                  {isEditing ? (
                    <input
                      value={form.therapy_frequency}
                      onChange={(event) => updateFormField("therapy_frequency", event.target.value)}
                      className={inputBaseClass}
                      placeholder="e.g. Weekly"
                    />
                  ) : (
                    <p>{profile.therapy.therapy_frequency ?? "Not set"}</p>
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/50">Notes</p>
                  {isEditing ? (
                    <textarea
                      value={form.therapy_notes}
                      onChange={(event) => updateFormField("therapy_notes", event.target.value)}
                      className={textareaBaseClass}
                      rows={4}
                      placeholder="Additional therapy notes"
                    />
                  ) : (
                    <p>
                      {profile.therapy.therapy_notes ??
                        "AICare will highlight helpful therapy notes here once available."}
                    </p>
                  )}
                </div>
              </div>
            </div>
            </div>
          )}
        </header>

        <ProfileQuickSummary
          fullName={profile.header.full_name || firstName}
          primaryEmail={profile.contact.primary_email}
          phone={isEditing ? form.phone : profile.contact.phone}
          city={isEditing ? form.city : profile.header.city}
          university={isEditing ? form.university : profile.header.university}
          major={isEditing ? form.major : profile.header.major}
        />

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <EarnedBadgesDisplay />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                <FiActivity className="h-5 w-5 text-[#FFCA40]" />
                Activity timeline
              </h2>
              <p className="text-sm text-white/60">Review your latest appointments, conversations, and wellbeing milestones.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {TIMELINE_FILTER_OPTIONS.map((option) => {
                const isActive = timelineFilter === option.value;
                const ariaCurrent = isActive ? 'true' : undefined;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-current={ariaCurrent}
                    onClick={() => setTimelineFilter(option.value)}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold uppercase tracking-wide transition",
                      isActive
                        ? "border-[#FFCA40] bg-[#FFCA40] text-[#001D58]"
                        : "border-white/15 text-white/60 hover:border-[#FFCA40] hover:text-[#FFCA40]"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <TimelineList
            entries={filteredTimeline}
            isExpanded={showAllTimelineEntries}
            onToggle={handleTimelineToggle}
            emptyMessage={timelineEmptyMessage}
          />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <FiSliders className="h-5 w-5 text-[#FFCA40]" />
            Notes for the AICare team
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Share context that helps support staff prepare for your next interaction. Useful examples include current stressors, preferred support style, scheduling constraints, and what kind of follow-up you want.
          </p>
          {isEditing ? (
            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/50">Team notes</label>
              <textarea
                value={form.aicare_team_notes}
                onChange={(event) => updateFormField("aicare_team_notes", event.target.value)}
                className={textareaBaseClass}
                rows={5}
                maxLength={AICARE_TEAM_NOTES_MAX_LENGTH}
                placeholder="Example: I feel overwhelmed near exam weeks, prefer short check-ins by chat, and need reminders two days before appointments."
              />
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Keep this practical and specific for your next support session.</span>
                <span>
                  {form.aicare_team_notes.length}/{AICARE_TEAM_NOTES_MAX_LENGTH}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-3 leading-relaxed text-white/80">
              {profile.aicare_team_notes ??
                "No notes added yet. Use Edit profile to share context with the AICare team."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
