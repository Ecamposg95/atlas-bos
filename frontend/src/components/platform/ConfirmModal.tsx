import { useState, useEffect } from 'react'

interface Props {
  open: boolean
  title: string
  message: string
  resourceName: string
  destructive?: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  busy?: boolean
}

export function ConfirmModal({
  open,
  title,
  message,
  resourceName,
  destructive,
  onClose,
  onConfirm,
  busy,
}: Props) {
  const [typed, setTyped] = useState('')

  useEffect(() => { if (open) setTyped('') }, [open])

  if (!open) return null

  const confirmed = typed === resourceName
  const accent = destructive ? 'var(--p-danger)' : 'var(--p-accent)'
  const iconName = destructive ? 'fa-triangle-exclamation' : 'fa-circle-question'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          borderRadius: 14,
          padding: '22px 24px 20px',
          width: 440,
          maxWidth: '92vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          color: 'var(--p-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: destructive ? 'rgba(239,68,68,0.12)' : 'var(--p-accent-soft)',
            color: accent,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            <i className={'fa-solid ' + iconName} />
          </div>
          <h3 style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            letterSpacing: '-0.02em',
            fontWeight: 600,
            color: 'var(--p-text)',
          }}>
            {title}
          </h3>
        </div>

        <p style={{
          color: 'var(--p-muted)',
          fontSize: 13,
          margin: '0 0 16px',
          lineHeight: 1.5,
        }}>
          {message}
        </p>

        <p style={{ color: 'var(--p-text)', fontSize: 12, marginBottom: 8 }}>
          Para confirmar, escribe{' '}
          <code style={{
            color: accent,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            background: destructive ? 'rgba(239,68,68,0.08)' : 'var(--p-accent-soft)',
            padding: '1px 6px',
            borderRadius: 4,
            border: `1px solid ${destructive ? 'rgba(239,68,68,0.25)' : 'var(--p-accent-line)'}`,
          }}>{resourceName}</code>:
        </p>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--p-surface-2)',
            color: 'var(--p-text)',
            border: '1px solid var(--p-border)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            boxSizing: 'border-box',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
          autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              background: 'var(--p-surface-2)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={!confirmed || busy}
            style={{
              background: accent,
              color: '#fff',
              fontWeight: 600,
              border: `1px solid ${accent}`,
              padding: '8px 18px',
              borderRadius: 8,
              cursor: confirmed && !busy ? 'pointer' : 'not-allowed',
              opacity: confirmed && !busy ? 1 : 0.45,
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {busy && <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 11 }} />}
            {busy ? 'Procesando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
