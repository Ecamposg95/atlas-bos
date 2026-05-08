import { create } from 'zustand'
import type { User, Organization, Branch } from '../types/auth'

interface AuthStore {
  user: User | null
  token: string | null
  org: Organization | null
  branch: Branch | null
  isAuthenticated: boolean
  hydrated: boolean

  setAuth: (user: User, token: string, org: Organization | null) => void
  setBranch: (branch: Branch | null) => void
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  org: null,
  branch: null,
  isAuthenticated: false,
  hydrated: false,

  setAuth: (user, token, org) => {
    localStorage.setItem('atlas_token', token)
    localStorage.setItem('atlas_user', JSON.stringify(user))
    if (org) {
      localStorage.setItem('atlas_org_id', String(org.id))
      localStorage.setItem('atlas_org', JSON.stringify(org))
    }
    set({ user, token, org, isAuthenticated: true })
  },

  setBranch: (branch) => {
    if (branch) {
      localStorage.setItem('atlas_branch', JSON.stringify(branch))
    } else {
      localStorage.removeItem('atlas_branch')
    }
    set({ branch })
  },

  logout: () => {
    localStorage.removeItem('atlas_token')
    localStorage.removeItem('atlas_org_id')
    localStorage.removeItem('atlas_user')
    localStorage.removeItem('atlas_org')
    localStorage.removeItem('atlas_branch')
    set({ user: null, token: null, org: null, branch: null, isAuthenticated: false })
  },

  // Restaurar sesión desde localStorage al cargar la app
  hydrate: () => {
    const token = localStorage.getItem('atlas_token')
    const userRaw = localStorage.getItem('atlas_user')
    const orgRaw = localStorage.getItem('atlas_org')
    const branchRaw = localStorage.getItem('atlas_branch')

    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User
        const org = orgRaw ? (JSON.parse(orgRaw) as Organization) : null
        const branch = branchRaw ? (JSON.parse(branchRaw) as Branch) : null
        set({ user, token, org, branch, isAuthenticated: true, hydrated: true })
      } catch {
        // localStorage corrupto — limpiar
        localStorage.clear()
        set({ hydrated: true })
      }
    } else {
      set({ hydrated: true })
    }
  },
}))
