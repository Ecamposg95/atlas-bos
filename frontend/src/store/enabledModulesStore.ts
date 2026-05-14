import { create } from 'zustand'
import client from '../api/client'

/**
 * Apply or clear the `data-preset` attribute on <html>.
 * Drives CSS variable theming defined in src/index.css (per-preset accent
 * colors). No-op when running outside the browser (SSR-safe).
 */
function applyPresetAttribute(preset: string | null) {
  if (typeof document === 'undefined') return
  if (preset) {
    document.documentElement.setAttribute('data-preset', preset)
  } else {
    document.documentElement.removeAttribute('data-preset')
  }
}

interface ContextResponse {
  enabled_modules?: string[]
  preset?: string | null
  // (other fields present in /me/context but not needed here)
}

interface EnabledModulesStore {
  enabledModules: string[]
  preset: string | null
  loaded: boolean
  loading: boolean
  load: () => Promise<void>
  reset: () => void
}

/**
 * Cache of enabled modules + active preset for the current user/org.
 * Sourced from GET /api/users/me/context.
 *
 * Use to drive Sidebar gating, dashboard routing, and any UI that
 * depends on which Atlas One modules are active.
 */
export const useEnabledModulesStore = create<EnabledModulesStore>((set, get) => ({
  enabledModules: [],
  preset: null,
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const r = await client.get<ContextResponse>('/users/me/context')
      const mods = Array.isArray(r.data?.enabled_modules) ? r.data!.enabled_modules! : []
      const preset = r.data?.preset ?? null
      set({
        enabledModules: mods,
        preset,
        loaded: true,
        loading: false,
      })
      applyPresetAttribute(preset)
    } catch {
      // Fail open: if context fetch fails, leave the sidebar showing all
      // items. Better than locking the user out of navigation.
      set({ enabledModules: [], preset: null, loaded: true, loading: false })
      applyPresetAttribute(null)
    }
  },

  reset: () => {
    set({ enabledModules: [], preset: null, loaded: false, loading: false })
    applyPresetAttribute(null)
  },
}))
