/**
 * Device identity utilities (Track 4 — POS bug-fix).
 *
 * `deviceId` es un UUID per-PC persistido en localStorage. Se genera una
 * sola vez al primer acceso y sirve para que el backend distinga cuál PC
 * imprimió cada ticket (relevante porque 1 cajero opera N PCs simultáneas
 * con N impresoras locales).
 *
 * `deviceFingerprint` es un hash de userAgent + screen + timezone que
 * detecta si dos PCs comparten el mismo localStorage clonado por accidente.
 */

const LS_DEVICE_ID = 'atlas_device_id'

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback simple para entornos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'no-storage'
  let id = localStorage.getItem(LS_DEVICE_ID)
  if (!id) {
    id = uuidV4()
    localStorage.setItem(LS_DEVICE_ID, id)
  }
  return id
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unknown'
  try {
    const ua = navigator.userAgent || ''
    const lang = navigator.language || ''
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const screen = `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`
    const raw = `${ua}|${lang}|${tz}|${screen}`
    // Hash simple djb2 — no necesitamos crypto para esto, solo identificar
    // duplicados de localStorage clonados.
    let hash = 5381
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) + hash) + raw.charCodeAt(i)
      hash = hash | 0
    }
    return Math.abs(hash).toString(36)
  } catch {
    return 'unknown'
  }
}

/** Versión truncada para mostrar en UI ("ID de esta PC: ...a3f9c1"). */
export function getDeviceIdShort(): string {
  const id = getDeviceId()
  return id.length > 8 ? id.slice(-6) : id
}
