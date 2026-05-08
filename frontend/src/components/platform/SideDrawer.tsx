import { useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onSave?: () => void
  saveLabel?: string
  saving?: boolean
  children: React.ReactNode
  width?: number
}

export function SideDrawer({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = 'Guardar',
  saving = false,
  children,
  width = 480,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 999,
          backdropFilter: 'blur(2px)',
        }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, height: '100vh', width,
        background: 'var(--p-surface)',
        borderLeft: '1px solid var(--p-border)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        color: 'var(--p-text)',
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--p-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              letterSpacing: '-0.02em',
              fontWeight: 600,
              color: 'var(--p-text)',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{
                margin: '4px 0 0',
                fontSize: 12,
                color: 'var(--p-muted)',
              }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'var(--p-surface-2)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-muted)',
              width: 28,
              height: 28,
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', color: 'var(--p-text)' }}>
          {children}
        </div>
        {onSave && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--p-border)',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            background: 'var(--p-sidebar)',
          }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'var(--p-surface)',
                color: 'var(--p-text)',
                border: '1px solid var(--p-border)',
                padding: '8px 16px',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                opacity: saving ? 0.6 : 1,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: 'var(--p-accent)',
                color: '#fff',
                fontWeight: 600,
                padding: '8px 20px',
                border: '1px solid var(--p-accent)',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {saving && <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />}
              {saving ? 'Guardando…' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
