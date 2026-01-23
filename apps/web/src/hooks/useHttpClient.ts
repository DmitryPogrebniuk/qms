import { useMemo } from 'react'
import axios, { AxiosInstance } from 'axios'

// Use relative URL - nginx/vite will proxy to API
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

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

/**
 * React hook for HTTP client with automatic token handling
 */
export function useHttpClient(): AxiosInstance {
  return useMemo(() => {
    const client = axios.create({
      baseURL: API_BASE_URL || '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add JWT token to requests
    client.interceptors.request.use((config) => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    return client
  }, [])
}
