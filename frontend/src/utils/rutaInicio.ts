/**
 * A dónde va cada rol al entrar. Vive fuera de App.tsx para poder probarse:
 * vitest está configurado con `include: ['src/**\/*.test.ts']`, solo .ts.
 */
export function rutaInicioPorRol(
  rol?: string | null,
  esMovil = false,
  preset?: string | null,
): string {
  const esOficina = rol === 'ADMINISTRADOR' || rol === 'DUEÑO'
  if (esOficina && esMovil) return '/mobile/owner'
  if (esOficina) {
    if (preset && preset.startsWith('ATLAS_ONE_')) return '/home'
    return '/hq/operations'
  }
  if (rol === 'VENDEDOR' || rol === 'SOPORTE_OPERATIVO') return '/mobile/dashboard'
  if (rol === 'CLIENTE') return '/portal'
  return '/atlas-pos'
}
