import { useMemo } from 'react'
import axios, { AxiosInstance } from 'axios'

export function useHttpClient(): AxiosInstance {
  return useMemo(() => {
    const client = axios.create({
      baseURL: 'http://localhost:3000',
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
