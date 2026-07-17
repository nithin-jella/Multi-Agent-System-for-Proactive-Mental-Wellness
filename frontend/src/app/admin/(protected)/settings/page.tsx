"use client";

import { useEffect, useState, useCallback } from "react";
import { FiAlertCircle, FiSettings, FiCheck, FiX, FiLoader, FiEye, FiEyeOff } from "react-icons/fi";
import clsx from "clsx";
import toast from "react-hot-toast";

import { apiCall } from "@/utils/adminApi";
import type {
  SystemSettingItem,
  SystemSettingsCategory,
  SystemSettingsResponse,
} from "@/types/admin/system";

export default function AdminSystemSettingsPage() {
  const [data, setData] = useState<SystemSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const response = await apiCall<SystemSettingsResponse>('/api/v1/admin/system/settings');
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load system settings';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings().catch(() => undefined);
  }, [fetchSettings]);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
          <FiSettings className="h-8 w-8 text-[#FFCA40]" /> System Settings
        </h1>
        <p className="max-w-3xl text-base text-white/60">
          Manage core platform configurations. Update your environment variables, feature toggles, and system thresholds. Settings are applied globally across the ecosystem.
        </p>
      </header>

      {loading && !data && (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-white/5 bg-white/5" />
          ))}
        </div>
      )}

      {error && !data && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center">
          <FiAlertCircle className="h-10 w-10 text-red-500" />
          <div>
            <h3 className="text-lg font-medium text-red-100">Failed to load settings</h3>
            <p className="mt-1 text-sm text-red-200/70">{error}</p>
          </div>
          <button 
            type="button"
            onClick={() => fetchSettings(false)}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {data.categories.map((category) => (
            <SettingsCategoryCard 
              key={category.id} 
              category={category} 
              onRefresh={() => fetchSettings(true)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsCategoryCard({ category, onRefresh }: { category: SystemSettingsCategory, onRefresh: () => void }) {
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isSettingEditable = (s: SystemSettingItem) => s.editable && !s.pending && s.type !== "alert" && s.type !== "masked";

  const editableSettings = category.settings.filter(isSettingEditable);
  const readOnlySettings = category.settings.filter(s => !isSettingEditable(s));

  const hasChanges = editableSettings.some(setting => 
    setting.key in editedValues && editedValues[setting.key] !== setting.value
  );

  const handleValueChange = (key: string, value: unknown) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setEditedValues({});
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    
    const payloadSettings: Record<string, unknown> = {};
    for (const key in editedValues) {
      const setting = editableSettings.find(s => s.key === key);
      if (setting && editedValues[key] !== setting.value) {
        payloadSettings[key] = editedValues[key];
      }
    }

    try {
      await apiCall(`/api/v1/admin/system/settings/${category.id}`, {
        method: "PUT",
        body: JSON.stringify({ settings: payloadSettings })
      });
      toast.success(`${category.title} settings saved successfully`);
      setEditedValues({});
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to save ${category.title} settings`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111]/80 p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white">{category.title}</h2>
        <p className="mt-1.5 text-sm text-white/60">{category.description}</p>
      </div>

      {editableSettings.length > 0 && (
        <div className="space-y-4">
          {editableSettings.map((setting) => {
            const isChanged = setting.key in editedValues && editedValues[setting.key] !== setting.value;
            const currentValue = setting.key in editedValues ? editedValues[setting.key] : setting.value;
            return (
              <SettingItemRow 
                key={setting.key} 
                setting={setting} 
                value={currentValue}
                onChange={(val) => handleValueChange(setting.key, val)}
                isChanged={isChanged}
              />
            );
          })}
        </div>
      )}

      {editableSettings.length > 0 && readOnlySettings.length > 0 && (
        <hr className="my-8 border-white/10" />
      )}

      {readOnlySettings.length > 0 && (
        <div className="space-y-4">
          {readOnlySettings.length > 0 && editableSettings.length > 0 && (
            <h3 className="mb-5 text-xs font-bold tracking-widest text-white/40 uppercase">Read-Only Configuration</h3>
          )}
          {readOnlySettings.map((setting) => (
            <SettingItemRow 
              key={setting.key} 
              setting={setting} 
            />
          ))}
        </div>
      )}

      {editableSettings.length > 0 && (
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiX className="h-4 w-4" />
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2 rounded-lg bg-[#FFCA40] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#FFCA40]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      )}
    </section>
  );
}

function SettingItemRow({
  setting,
  value,
  onChange,
  isChanged
}: {
  setting: SystemSettingItem;
  value?: unknown;
  onChange?: (val: unknown) => void;
  isChanged?: boolean;
}) {
  const isEditable = setting.editable && !setting.pending && setting.type !== "alert" && setting.type !== "masked";

  return (
    <div className={clsx(
      "relative flex flex-col gap-5 rounded-xl border p-5 transition-colors sm:flex-row sm:items-start sm:justify-between",
      isChanged ? "border-[#FFCA40]/40 bg-[#FFCA40]/5" : "border-white/5 bg-white/[0.02]"
    )}>
      {isChanged && (
        <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-[#FFCA40] shadow-[0_0_8px_rgba(255,202,64,0.8)]" title="Unsaved changes" />
      )}
      
      <div className="flex-1 space-y-1.5 pr-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white/90">{setting.label}</h3>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
            {setting.type}
          </span>
          {!isEditable && (
            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Read-only
            </span>
          )}
        </div>
        {setting.help_text && (
          <p className="text-sm leading-relaxed text-white/50">{setting.help_text}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center sm:min-w-[220px] sm:justify-end">
        {setting.pending || setting.type === "alert" ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-200">
            <FiAlertCircle className="h-4 w-4" />
            Coming soon
          </div>
        ) : isEditable && onChange ? (
          <SettingControl setting={setting} value={value} onChange={onChange} />
        ) : (
          <SettingReadonlyDisplay setting={setting} />
        )}
      </div>
    </div>
  );
}

function SettingControl({
  setting,
  value,
  onChange
}: {
  setting: SystemSettingItem;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const currentValue = value !== undefined ? value : setting.value;

  if (setting.type === "toggle") {
    const isChecked = Boolean(currentValue);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        onClick={() => onChange(!isChecked)}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFCA40] focus:ring-offset-2 focus:ring-offset-[#111]",
          isChecked ? "bg-green-500" : "bg-white/20"
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
            isChecked ? "translate-x-5 bg-white" : "translate-x-0 bg-white/80"
          )}
        />
      </button>
    );
  }

  if (setting.type === "number") {
    return (
      <input
        type="number"
        value={Number(currentValue) || 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full max-w-[200px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#FFCA40] focus:bg-black focus:outline-none focus:ring-1 focus:ring-[#FFCA40]"
      />
    );
  }

  if (setting.type === "color") {
    return (
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={String(currentValue || "#000000")}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1"
        />
        <span className="text-sm font-mono text-white/70">{String(currentValue || "#000000")}</span>
      </div>
    );
  }

  if (setting.type === "option") {
    const options = 'options' in setting ? (setting as unknown as { options: string[] }).options : [];
    if (options && options.length > 0) {
      return (
        <select
          value={String(currentValue || "")}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full max-w-[200px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white transition-colors focus:border-[#FFCA40] focus:bg-black focus:outline-none focus:ring-1 focus:ring-[#FFCA40]"
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-gray-900">{opt}</option>
          ))}
        </select>
      );
    }
  }

  return (
    <input
      type="text"
      value={String(currentValue || "")}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full max-w-[220px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 transition-colors focus:border-[#FFCA40] focus:bg-black focus:outline-none focus:ring-1 focus:ring-[#FFCA40]"
    />
  );
}

function SettingReadonlyDisplay({ setting }: { setting: SystemSettingItem }) {
  const [showMasked, setShowMasked] = useState(false);

  if (setting.type === "badge") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90">
        {String(setting.value)}
      </div>
    );
  }

  if (setting.type === "masked" || setting.value_preview === "masked") {
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm font-mono text-white/50">
          {showMasked ? String(setting.value) : "••••••••••••••••"}
        </div>
        <button
          type="button"
          onClick={() => setShowMasked(!showMasked)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#FFCA40] transition-colors hover:bg-[#FFCA40]/10 hover:text-white"
        >
          {showMasked ? (
            <><FiEyeOff className="h-3.5 w-3.5" /> Hide</>
          ) : (
            <><FiEye className="h-3.5 w-3.5" /> Show</>
          )}
        </button>
      </div>
    );
  }

  if (setting.type === "toggle") {
     const isChecked = Boolean(setting.value);
     return (
       <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
         <div className={clsx("h-2.5 w-2.5 rounded-full", isChecked ? "bg-green-500" : "bg-gray-600")} />
         <span className="text-sm font-medium text-white/70">{isChecked ? "Enabled" : "Disabled"}</span>
       </div>
     )
  }

  if (setting.type === "color") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
        <div 
          className="h-5 w-5 rounded shadow-sm ring-1 ring-white/20" 
          style={{ backgroundColor: String(setting.value || "#000") }} 
        />
        <span className="text-sm font-mono text-white/70">{String(setting.value)}</span>
      </div>
    );
  }

  if (Array.isArray(setting.value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {setting.value.map((item) => (
          <span key={String(item)} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80">
            {String(item)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 px-4 py-2 text-sm font-medium text-white/80">
      {String(setting.value ?? "")}
    </div>
  );
}

