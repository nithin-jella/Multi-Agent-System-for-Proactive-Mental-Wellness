import type { AdminPasswordChangePayload, AdminPasswordChangeResponse, AdminProfileResponse, AdminProfileUpdatePayload } from '@/types/admin/profile';

// Helper utility for making authenticated API requests to the admin endpoints
import { getSession, signOut } from 'next-auth/react';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Makes an authenticated API request using the current NextAuth session
 * Automatically handles session expiry and redirects to login
 */
export async function authenticatedFetch(url: string, options: RequestOptions = {}): Promise<Response> {
  const session = await getSession();
  
  if (!session?.accessToken) {
    console.warn('[authenticatedFetch] No access token in session, signing out...');
    // Session is invalid - sign out properly through NextAuth
    if (typeof window !== 'undefined') {
      await signOut({ 
        callbackUrl: '/admin?sessionExpired=true',
        redirect: true,
      });
    }
    throw new Error('No valid session found. Please log in again.');
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${session.accessToken}`,
    ...options.headers,
  };

  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - backend token expired
  if (response.status === 401) {
    console.warn('[authenticatedFetch] Received 401 Unauthorized - backend token expired');
    
    if (typeof window !== 'undefined') {
      // Sign out properly through NextAuth to clear all cookies/tokens
      await signOut({ 
        callbackUrl: '/admin?sessionExpired=true',
        redirect: true,
      });
    }
    
    throw new Error('Session expired. Please log in again.');
  }

  return response;
}

/**
 * Helper to handle API responses and throw appropriate errors
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication failed. Please log in again.');
    } else if (response.status === 403) {
      throw new Error('Access denied. Admin privileges required.');
    } else if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    } else {
      const errorData = await response.text();
      throw new Error(errorData || `Request failed with status ${response.status}`);
    }
  }

  return response.json();
}

/**
 * Combined function for authenticated API calls with error handling
 */
export async function apiCall<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const isServer = typeof window === 'undefined';
  const apiUrl = isServer 
    ? process.env.INTERNAL_API_URL // Use internal URL for server-side
    : process.env.NEXT_PUBLIC_API_URL; // Use public URL for client-side
    
  const response = await authenticatedFetch(`${apiUrl}${url}`, options);
  return handleApiResponse<T>(response);
}

export async function fetchAdminProfile(): Promise<AdminProfileResponse> {
  return apiCall<AdminProfileResponse>('/api/v1/admin/profile/me');
}

export async function updateAdminProfile(payload: AdminProfileUpdatePayload): Promise<AdminProfileResponse> {
  return apiCall<AdminProfileResponse>('/api/v1/admin/profile/me', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function changeAdminPassword(payload: AdminPasswordChangePayload): Promise<AdminPasswordChangeResponse> {
  return apiCall<AdminPasswordChangeResponse>('/api/v1/admin/profile/password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
