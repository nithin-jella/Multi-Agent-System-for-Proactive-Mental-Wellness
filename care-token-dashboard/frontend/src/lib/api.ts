import axios, { AxiosError } from 'axios'
import { config } from '../config'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - logout
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// API functions
export const authApi = {
  login: (email: string, password: string) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refresh_token: refreshToken }),
}

export const revenueApi = {
  getCurrent: () => api.get('/revenue/current'),
  getMonth: (year: number, month: number) => api.get(`/revenue/month/${year}/${month}`),
  submit: (year: number, month: number) => api.post('/revenue/submit', { year, month }),
  getDashboard: () => api.get('/revenue/dashboard'),
  getReports: (params?: { year?: number; status?: string }) => api.get('/revenue/reports', { params }),
}

export const stakingApi = {
  getOverview: () => api.get('/staking/overview'),
  getHistory: () => api.get('/staking/history'),
}

export const approvalsApi = {
  approve: (reportId: number, comment?: string) =>
    api.post(`/approvals/approve/${reportId}`, { comment }),
  challenge: (reportId: number, reason: string) =>
    api.post(`/approvals/challenge/${reportId}`, { reason }),
  getPending: () => api.get('/approvals/pending'),
}

export const healthApi = {
  check: () => api.get('/health'),
}
