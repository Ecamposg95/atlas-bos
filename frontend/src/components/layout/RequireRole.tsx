import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { Role } from '../../types/auth'

/**
 * Route guard that restricts children to users whose tenant `role` is in
 * `roles`. SUPERADMIN/SUPPORT on the platform side bypass tenant RBAC.
 *
 * Defense in depth: this is a UX guard only — the backend still enforces
 * authorization on every API call. Do not rely on this to hide sensitive
 * data; rely on it to prevent confusing redirects and unreachable UI.
 *
 * Unauthorized users are redirected to `/dataxpos` (the default home).
 */
export function RequireRole({
  roles,
  children,
  redirectTo = '/dataxpos',
}: {
  roles: Role[]
  children: React.ReactNode
  redirectTo?: string
}) {
  const user = useAuthStore((s) => s.user)
  const hydrated = useAuthStore((s) => s.hydrated)

  // Wait for auth hydration before deciding — avoid flashing redirect for valid users.
  if (!hydrated) return null

  // Platform staff (SUPERADMIN/SUPPORT) bypass tenant-role checks.
  if (user?.platform_role === 'SUPERADMIN' || user?.platform_role === 'SUPPORT') {
    return <>{children}</>
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
