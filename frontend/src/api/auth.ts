import axios from 'axios'
import client from './client'
import type { User, Organization, Branch } from '../types/auth'

interface LoginResponse {
  access_token: string
  token_type: string
  user: User
  organization: Organization
  branch: Branch | null
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    // El endpoint de auth usa form data, no JSON
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)

    const { data } = await axios.post<LoginResponse>('/api/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return data
  },

  me: async (): Promise<User> => {
    const { data } = await client.get<User>('/auth/me')
    return data
  },

  logout: async (): Promise<void> => {
    await client.post('/auth/logout').catch(() => {})
  },
}
