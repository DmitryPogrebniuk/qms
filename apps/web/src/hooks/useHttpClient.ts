import { useMemo } from 'react'
import axios, { AxiosInstance } from 'axios'

// Use relative URL - nginx/vite will proxy to API
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000 // 10 min

function clearSessionAndRedirect() {
  localStorage.removeItem('jwt_token')
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/**
 * Standalone HTTP client for use outside React components
 * Useful for API service files
 */
export const httpClient = axios.create({
  baseURL: API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add JWT token to standalone client requests
httpClient.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 = session expired or invalid - clear token and redirect to login
httpClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearSessionAndRedirect()
    }
    return Promise.reject(err)
  },
)

/**
 * React hook for HTTP client with automatic token handling and 401 redirect
 */
export function useHttpClient(): AxiosInstance {
  return useMemo(() => {
    const client = axios.create({
      baseURL: API_BASE_URL || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    client.interceptors.request.use((config) => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    client.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          clearSessionAndRedirect()
        }
        return Promise.reject(err)
      },
    )

    return client
  }, [])
}

/**
 * Hook for inactivity timeout - clears session after 10 min of no activity
 */
export function useInactivityTimeout() {
  return useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        clearSessionAndRedirect()
      }, INACTIVITY_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    events.forEach((ev) => window.addEventListener(ev, resetTimer))
    resetTimer()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      events.forEach((ev) => window.removeEventListener(ev, resetTimer))
    }
  }, [])
}
