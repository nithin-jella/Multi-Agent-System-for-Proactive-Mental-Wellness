export interface User {
    id: number;
    email: string | null;
    google_sub: string;
    wallet_address: string | null;
    sentiment_score: number;
    current_streak: number;
    longest_streak: number;
    last_activity_date: string | null;
    allow_email_checkins: boolean;
    role?: string;
    is_active?: boolean;
    created_at: string | null;
    updated_at?: string | null;
    total_journal_entries: number;
    total_conversations: number;
    total_badges: number;
    total_appointments: number;
    last_login: string | null;
    name?: string; // Added for counselor/admin
    phone?: string; // Added for counselor/admin
    date_of_birth?: string; // Added for counselor/admin
    specialization?: string; // Added for counselor
    avatar_url?: string | null;
}

export interface UserLog {
    timestamp: string;
    activity: string;
}

export interface UserStats {
    total_users: number;
    active_users_30d: number;
    active_users_7d: number;
    new_users_today: number;
    avg_sentiment_score: number;
    total_journal_entries: number;
    total_conversations: number;
    total_badges_awarded: number;
    new_7d?: number;
}

export interface UsersResponse {
    users: User[];
    total_count: number;
    stats: UserStats;
}
