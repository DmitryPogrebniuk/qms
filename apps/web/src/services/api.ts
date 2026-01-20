import axios, { AxiosInstance } from 'axios'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add JWT token to requests
    this.client.interceptors.request.use((config) => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
  }

  async search(filters: any) {
    const response = await this.client.get('/recordings/search', { params: filters })
    return response.data
  }

  async getRecording(id: string) {
    const response = await this.client.get(`/recordings/${id}`)
    return response.data
  }

  async streamRecording(id: string) {
    return `${this.client.defaults.baseURL}/recordings/${id}/stream`
  }

  async createEvaluation(data: any) {
    const response = await this.client.post('/evaluations', data)
    return response.data
  }

  async getEvaluations(agentId: string, page: number, pageSize: number) {
    const response = await this.client.get(`/evaluations/agent/${agentId}`, {
      params: { page, pageSize },
    })
    return response.data
  }
}

export default new ApiClient()
