export interface AdminProfileResponse {
  id: number;
  email: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  allow_email_checkins?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminProfileUpdatePayload {
  email: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  allow_email_checkins?: boolean | null;
}

export interface AdminPasswordChangePayload {
  current_password: string;
  new_password: string;
}

export interface AdminPasswordChangeResponse {
  message: string;
}
