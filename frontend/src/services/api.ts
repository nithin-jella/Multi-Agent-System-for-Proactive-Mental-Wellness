// frontend/src/services/api.ts

import axios from 'axios';
import type {
  JournalAnalyticsResponse,
  JournalPromptResponse,
  JournalEntryItem,
  JournalReflectionPointResponse,
  JournalEntryCreate,
  Psychologist,
  AppointmentType,
  AppointmentCreate,
  Appointment
} from '@/types/api';
import toast from 'react-hot-toast';
import type { AIMemoryFact, UserProfileOverviewResponse, UserProfileOverviewUpdate } from '@/types/profile';
import { signOut } from 'next-auth/react';

// Define the base URL for your backend API
// Use NEXT_PUBLIC_API_URL for client-side requests (browser)
// INTERNAL_API_URL is only for server-side requests (SSR/API routes)
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
// If NEXT_PUBLIC_API_URL is not set, use relative URLs so Next.js can proxy via rewrites.
const API_BASE_URL = apiOrigin ? `${apiOrigin}/api/v1` : "/api/v1";


const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', },
});

let hasTriggeredSignOut = false;
const AUTH_ROUTE_PREFIXES = ["/signin", "/signup", "/auth"];

// Token management for performance optimization
let accessToken: string | undefined = undefined;

export const setAccessToken = (token: string | undefined) => {
  accessToken = token;
};

// Add request interceptor to attach JWT token to every request
// This will be called before every request to the backend
apiClient.interceptors.request.use(
  async (config) => {
    // Use the cached token instead of calling getSession() which triggers a network request
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Optional: Add response interceptor for global error handling (e.g., 401 redirect)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("API request Unauthorized (401):", error.response.data?.detail);
      if (typeof window !== "undefined") {
        const pathname = window.location.pathname;
        const onAuthRoute = AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
        if (onAuthRoute) {
          return Promise.reject(error);
        }
      }
      if (!hasTriggeredSignOut) {
        hasTriggeredSignOut = true;
        signOut({ callbackUrl: '/signin' }).finally(() => {
          hasTriggeredSignOut = false;
        });
      }
    }
     // Log other errors
     if (axios.isAxiosError(error)) {
       console.error(`API Error (${error.response?.status}):`, error.response?.data || error.message);
     } else {
       console.error("API Error:", error);
     }
    return Promise.reject(error); // Propagate the error
  }
);

export default apiClient; // Export the configured client if needed elsewhere

// --- Profile: AI Memory Facts ---
export const fetchUserAIMemoryFacts = async (): Promise<AIMemoryFact[]> => {
  const response = await apiClient.get<AIMemoryFact[]>("/profile/ai-memory/facts");
  return response.data;
};

export const deleteUserAIMemoryFact = async (factId: number): Promise<void> => {
  await apiClient.delete(`/profile/ai-memory/facts/${factId}`);
};

// --- Journal Prompts API ---
export const getActiveJournalPrompts = async (): Promise<JournalPromptResponse[]> => {
  try {
    const response = await apiClient.get<JournalPromptResponse[]>('/journal-prompts/');
    return response.data;
  } catch (error) {
    console.error('Error fetching journal prompts:', error);
    let errorMessage = 'Failed to load journal prompts.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// --- Journal Entries API ---
export interface JournalEntryPayload {
  entry_date: string; // YYYY-MM-DD
  content: string;
  prompt_id?: number | null;
  valence?: number | null;
  arousal?: number | null;
  tags: string[];
}

export const saveJournalEntry = async (payload: JournalEntryPayload): Promise<JournalEntryItem> => {
  try {
    const response = await apiClient.post<JournalEntryItem>('/journal/', payload);
    return response.data;
  } catch (error) {
    console.error('Error saving journal entry:', error);
    let errorMessage = 'Failed to save journal entry.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const searchJournalEntries = async (filters: {
  search_query?: string;
  valence_min?: number;
  valence_max?: number;
  arousal_min?: number;
  arousal_max?: number;
  inferred_dominance_min?: number;
  inferred_dominance_max?: number;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}): Promise<JournalEntryItem[]> => {
  try {
    const response = await apiClient.post<JournalEntryItem[]>('/journal/search', filters);
    return response.data;
  } catch (error) {
    console.error('Error searching journal entries:', error);
    let errorMessage = 'Failed to search journal entries.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const getJournalAnalytics = async (days: number = 30): Promise<JournalAnalyticsResponse> => {
  try {
    const response = await apiClient.get<JournalAnalyticsResponse>('/journal/analytics/overview', { params: { days } });
    return response.data;
  } catch (error) {
    console.error('Error fetching journal analytics:', error);
    let errorMessage = 'Failed to load analytics.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const exportJournalEntries = async (format: 'csv' | 'pdf'): Promise<Blob> => {
  try {
    const response = await apiClient.get(`/journal/export/${format}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting journal entries:', error);
    let errorMessage = 'Failed to export journal entries.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const getAllUserTags = async (): Promise<string[]> => {
  try {
    const response = await apiClient.get<string[]>('/journal/tags/all');
    return response.data;
  } catch (error) {
    console.error('Error fetching user tags:', error);
    let errorMessage = 'Failed to load tags.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// --- Journal Reflection Points API ---
export const getMyJournalReflections = async (limit: number = 5): Promise<JournalReflectionPointResponse[]> => {
  try {
    const response = await apiClient.get<JournalReflectionPointResponse[]>(`/journal-prompts/reflections/me`, {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching journal reflections:', error);
    let errorMessage = 'Failed to load personalized reflections.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    // Don't throw an error that stops the modal, just log and return empty or show a subtle message in UI
    // throw new Error(errorMessage); 
    console.warn(errorMessage); // Log the error for debugging
    toast.error(errorMessage); // Show a toast notification for user feedback
    return []; // Return empty array on error so UI doesn't break
  }
};

// --- Psychologist Appointments API ---
export const getPsychologists = async (): Promise<Psychologist[]> => {
  try {
    const response = await apiClient.get<Psychologist[]>('/psychologists');
    return response.data;
  } catch (error) {
    console.error('Error fetching psychologists:', error);
    let errorMessage = 'Failed to load psychologists.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const getAppointmentTypes = async (): Promise<AppointmentType[]> => {
  try {
    const response = await apiClient.get<AppointmentType[]>('/appointment-types');
    return response.data;
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    let errorMessage = 'Failed to load appointment types.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export const createAppointment = async (payload: AppointmentCreate): Promise<Appointment> => {
  try {
    const response = await apiClient.post<Appointment>('/appointments', payload);
    return response.data;
  } catch (error) {
    console.error('Error creating appointment:', error);
    let errorMessage = 'Failed to create appointment.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// --- User Registration ---
export interface RegisterUserPayload {
  name: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  city?: string;
  university?: string;
  major?: string;
  yearOfStudy?: string;
  allowEmailCheckins?: boolean;
}

export interface RegisterUserResponse {
  message: string;
  user_id: number;
}

export const registerUser = async (payload: RegisterUserPayload): Promise<RegisterUserResponse> => {
  try {
    const response = await apiClient.post('/auth/register', payload);
    return response.data;
  } catch (error) {
    console.error('Error registering user:', error);
    let errorMessage = 'Failed to register user.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

// --- User Login ---
export interface LoginUserPayload {
  email: string;
  password: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginUserResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export const loginUser = async (payload: LoginUserPayload): Promise<LoginUserResponse> => {
  try {
    const response = await apiClient.post('/auth/token', payload);
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    let errorMessage = 'Failed to log in.';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.detail || `API Error (${error.response.status}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export async function fetchUserProfileOverview(): Promise<UserProfileOverviewResponse> {
  const response = await apiClient.get<UserProfileOverviewResponse>('/profile/overview');
  return response.data;
}

export async function updateUserProfileOverview(payload: UserProfileOverviewUpdate): Promise<UserProfileOverviewResponse> {
  const response = await apiClient.put<UserProfileOverviewResponse>('/profile/overview', payload);
  return response.data;
}
