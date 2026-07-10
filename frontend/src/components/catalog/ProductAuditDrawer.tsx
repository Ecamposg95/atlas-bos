import { useCallback, useEffect, useState } from 'react'
import { productsApi } from '../../api/products'
import { Spinner } from '../ui/Spinner'
import { toast } from '../../store/toastStore'
import type { Product } from '../../types/products'

interface Props {
  product: Product
  onClose: () => void
}

interface AuditEntry {
  id: number
  action: string
  entity_type: string
  entity_id: string
  actor_username: string | null
  actor_user_id: number | null
  created_at: string | null
  payload: Record<string, unknown>
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  PBS_UPDATE:       { icon: 'fa-pen-to-square', color: 'text-indigo-300',  label: 'Editado' },
  PBS_BULK_TOGGLE:  { icon: 'fa-toggle-on',     color: 'text-sem-success', label: 'Toggle bulk' },
  PBS_BULK_CREATE:  { icon: 'fa-plus',          color: 'text-cyan-300',    label: 'Creado' },
}

export function ProductAuditDrawer({ product, onClose }: Props) {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsApi.getAuditLog(product.id, 100)
      setItems(res.items ?? [])
    } catch (e: any) {
      const detail = e?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'No se pudo cargar el historial.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [product.id])

  useEffect(() => { load() }, [load])

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto"
        style={{ background: 'var(--dax-surface)', borderLeft: '1px solid var(--dax-border)' }}
      >
        <div className="sticky top-0 z-10 px-5 py-4 border-b" style={{
          background: 'var(--dax-surface)', borderColor: 'var(--dax-border-dim)',
        }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-indigo-400" />
                <h2 className="text-lg font-bold text-dax-text">Historial de cambios</h2>
              </div>
              <p className="text-xs text-dax-muted mt-1 truncate max-w-[420px]">
                {product.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-dax-muted hover:text-dax-text hover:bg-dax-card"
              title="Cerrar"
            >
              <i className="fa-solid fa-xmark text-xl" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <Spinner text="Cargando historial..." />
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-dax-muted">
              <i className="fa-solid fa-clock-rotate-left text-3xl mb-3 text-slate-700" />
              <p>Sin movimientos registrados.</p>
              <p className="text-[11px] mt-1">El audit log captura cambios PBS desde PR #44.</p>
            </div>
          ) : (
            items.map((entry) => <AuditRow key={entry.id} entry={entry} />)
          )}
        </div>
      </aside>
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const cfg = ACTION_CONFIG[entry.action] || { icon: 'fa-circle-info', color: 'text-dax-muted', label: entry.action }
  const ts = entry.created_at ? new Date(entry.created_at) : null

  const payload = entry.payload as {
    variant_id?: string
    branch_id?: number
    before?: Record<string, string | null>
    after?: Record<string, string | null>
    [k: string]: unknown
  }

  const diffFields: string[] = []
  if (payload.after) {
    for (const [k, v] of Object.entries(payload.after)) {
      const prev = payload.before?.[k]
      diffFields.push(`${k}: ${fmt(prev)} → ${fmt(v)}`)
    }
  }

  return (
    <div className="rounded-lg border border-dax-border bg-dax-bg p-3">
      <div className="flex items-start gap-3">
        <i className={`fa-solid ${cfg.icon} ${cfg.color} text-sm mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
              <span className="text-[10px] font-mono text-dax-faint">
                {entry.action}
              </span>
            </div>
            <span className="text-[11px] text-dax-muted tabular-nums">
              {ts ? ts.toLocaleString('es-MX') : '—'}
            </span>
          </div>
          <p className="text-[11px] text-dax-muted mt-1">
            Por <span className="text-dax-muted font-semibold">{entry.actor_username || `user#${entry.actor_user_id}`}</span>
            {payload.branch_id != null && (
              <> · Sucursal <span className="text-dax-muted">#{payload.branch_id}</span></>
            )}
          </p>
          {diffFields.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {diffFields.map((f, i) => (
                <p key={i} className="text-[11px] font-mono text-dax-muted">{f}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}
