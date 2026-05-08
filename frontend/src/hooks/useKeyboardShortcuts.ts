/**
 * useKeyboardShortcuts — registra atajos de teclado globales o por componente.
 *
 * Soporta teclas simples (`"Escape"`, `"a"`) y combos
 * (`"ctrl+r"`, `"cmd+shift+e"`, `"meta+k"`). Por defecto normaliza
 * `cmd` ↔ `ctrl` entre plataformas (`platform: "auto"`), así el mismo
 * atajo funciona en macOS (cmd) y Windows/Linux (ctrl).
 *
 * Cleanup automático al desmontar. Por default NO dispara cuando
 * el foco está en un `<input>`/`<textarea>`/`contentEditable` para
 * no interferir con el typing del usuario.
 *
 * @example
 *   useKeyboardShortcuts([
 *     { keys: 'Escape', handler: () => closeModal() },
 *     { keys: 'ctrl+s', handler: (e) => save(), preventDefault: true },
 *     { keys: ['ctrl+e', 'cmd+e'], handler: () => exportData() },
 *   ])
 */

import { useEffect } from 'react'

export interface ShortcutDefinition {
  /** Tecla o combo (string) o lista de combos aceptados. */
  keys: string | string[]
  /** Callback a ejecutar cuando el combo se dispara. */
  handler: (e: KeyboardEvent) => void
  /**
   * Si `true`, el listener escucha en `document` (funciona incluso si
   * el componente no tiene foco). Default: `true`.
   */
  global?: boolean
  /**
   * Etiqueta opcional para agrupar atajos (`"pos"`, `"platform"`).
   * No afecta el matching; útil para debug y documentación.
   */
  scope?: string
  /**
   * Si `true` (default), el atajo NO dispara cuando el foco está en un
   * input/textarea/contentEditable. Útil para no pisar `Ctrl+R` que
   * está escribiendo.
   */
  skipInInput?: boolean
  /** Si `true` (default), llama `e.preventDefault()` cuando dispara. */
  preventDefault?: boolean
  /**
   * `"auto"` (default): `ctrl+X` y `cmd+X` se tratan como equivalentes
   *   — el atajo dispara con cualquiera de los dos modificadores.
   * `"strict"`: respeta exactamente lo declarado.
   */
  platform?: 'auto' | 'strict'
}

interface ParsedCombo {
  ctrl: boolean
  meta: boolean
  shift: boolean
  alt: boolean
  /** Nombre de tecla normalizado en minúsculas (ej. "escape", "r", "enter"). */
  key: string
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim())
  const out: ParsedCombo = { ctrl: false, meta: false, shift: false, alt: false, key: '' }
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') out.ctrl = true
    else if (p === 'cmd' || p === 'meta') out.meta = true
    else if (p === 'shift') out.shift = true
    else if (p === 'alt' || p === 'option') out.alt = true
    else out.key = p
  }
  return out
}

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

function matches(event: KeyboardEvent, combo: ParsedCombo, platform: 'auto' | 'strict'): boolean {
  if (!event.key) return false
  const eventKey = event.key.toLowerCase()
  if (eventKey !== combo.key) return false
  if (platform === 'auto') {
    // ctrl y cmd se tratan como equivalentes
    const wantsModifier = combo.ctrl || combo.meta
    const hasModifier = event.ctrlKey || event.metaKey
    if (wantsModifier !== hasModifier) return false
  } else {
    if (combo.ctrl !== event.ctrlKey) return false
    if (combo.meta !== event.metaKey) return false
  }
  if (combo.shift !== event.shiftKey) return false
  if (combo.alt !== event.altKey) return false
  return true
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  useEffect(() => {
    const parsed = shortcuts.map((s) => ({
      def: s,
      combos: (Array.isArray(s.keys) ? s.keys : [s.keys]).map(parseCombo),
    }))

    function handle(e: KeyboardEvent) {
      for (const { def, combos } of parsed) {
        const skipInInput = def.skipInInput ?? true
        if (skipInInput && isEditableElement(e.target)) continue
        const platform = def.platform ?? 'auto'
        for (const combo of combos) {
          if (matches(e, combo, platform)) {
            if (def.preventDefault ?? true) e.preventDefault()
            def.handler(e)
            return
          }
        }
      }
    }

    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
    // El array de shortcuts se regenera cada render en el caller; si el caller
    // lo memoiza correctamente, solo re-registramos cuando cambia de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts])
}

export default useKeyboardShortcuts
