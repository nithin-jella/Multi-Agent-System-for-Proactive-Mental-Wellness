export interface SystemSettingItem {
  key: string;
  label: string;
  value: unknown;
  value_preview?: string | null;
  type: string;
  editable: boolean;
  pending: boolean;
  help_text?: string | null;
}

export interface SystemSettingsCategory {
  id: string;
  title: string;
  description: string;
  settings: SystemSettingItem[];
}

export interface SystemSettingsResponse {
  generated_at: string;
  categories: SystemSettingsCategory[];
}
