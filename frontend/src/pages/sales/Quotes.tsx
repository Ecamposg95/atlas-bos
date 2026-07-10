import { useEffect, useState, useCallback } from 'react'
import { quotesApi, type Quote, type QuoteStats } from '../../api/quotes'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/currency'

const statusVariant = (s: string) =>
  s === 'PAID' ? 'green' : s === 'CANCELLED' ? 'red' : s === 'PENDING' ? 'blue' : 'yellow'

const quoteLabel = (q: Quote) =>
  q.series && q.folio ? `${q.series}-${String(q.folio).padStart(4, '0')}` : q.id.slice(0, 8)

export function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [stats, setStats] = useState<QuoteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Quote | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        quotesApi.list({ limit: 100 }),
        quotesApi.getStats().catch(() => null),
      ])
      setQuotes(listRes?.items ?? [])
      if (statsRes) setStats(statsRes)
    } catch { setQuotes([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [])

  const handleConvert = async (q: Quote) => {
    if (!confirm(`¿Convertir cotización ${quoteLabel(q)} a venta con pago en efectivo?`)) return
    setConverting(q.id)
    try {
      const res = await quotesApi.convertToSale(q.id, 'CASH')
      alert(`Venta creada: ${res.new_folio}`)
      load(); setSelected(null)
    } catch { alert('Error al convertir') } finally { setConverting(null) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cotización?')) return
    try {
      await quotesApi.delete(id); load(); setSelected(null)
    } catch { alert('Error al eliminar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-file-invoice text-indigo-400 text-xl" />
          <h1 className="text-2xl font-black text-dax-text">Cotizaciones</h1>
        </div>
        <Link to="/quotes/new" className="dax-btn-primary text-xs">
          <i className="fa-solid fa-plus" /> Nueva Cotización
        </Link>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total cotizaciones', value: String(stats.total_count), icon: 'fa-file-invoice', color: 'text-dax-text' },
            { label: 'Monto total', value: formatCurrency(stats.total_amount), icon: 'fa-coins', color: 'text-indigo-400' },
            { label: 'Pendientes', value: String(stats.pending_count), icon: 'fa-clock', color: 'text-sem-warning' },
            { label: 'Monto pendiente', value: formatCurrency(stats.pending_amount), icon: 'fa-chart-bar', color: 'text-sem-warning' },
          ].map((k) => (
            <DaxCard key={k.label}>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fa-solid ${k.icon} text-dax-muted text-xs`} />
                <p className="text-[10px] font-bold text-dax-muted uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-xl font-black tabular-nums ${k.color}`}>{k.value}</p>
            </DaxCard>
          ))}
        </div>
      )}

      {/* Tabla */}
      <DaxCard padding={false}>
        {loading ? <Spinner text="Cargando cotizaciones..." /> : quotes.length === 0 ? (
          <div className="p-12 text-center text-dax-faint">Sin cotizaciones</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dax-table w-full">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="font-mono text-indigo-400 text-xs">{quoteLabel(q)}</td>
                    <td className="text-xs text-dax-muted">
                      {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="text-sm text-dax-muted">{q.customer_name ?? <span className="text-dax-faint italic">Sin cliente</span>}</td>
                    <td className="text-right font-semibold text-indigo-400 tabular-nums">{formatCurrency(q.total_amount)}</td>
                    <td><Badge variant={statusVariant(q.status) as 'green' | 'red' | 'blue' | 'yellow'}>{q.status}</Badge></td>
                    <td>
                      <button onClick={() => setSelected(q)} className="text-dax-muted hover:text-dax-text text-xs">
                        <i className="fa-solid fa-eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DaxCard>

      {/* Modal detalle */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="dax-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-dax-muted uppercase tracking-widest">Cotización</p>
                <p className="text-xl font-black text-indigo-400 font-mono">{quoteLabel(selected)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-dax-muted hover:text-dax-text"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-dax-muted">Cliente</span><span>{selected.customer_name ?? 'Sin cliente'}</span></div>
              <div className="flex justify-between"><span className="text-dax-muted">Fecha</span><span>{new Date(selected.created_at).toLocaleString('es-MX')}</span></div>
              <div className="flex justify-between"><span className="text-dax-muted">Estado</span><Badge variant={statusVariant(selected.status) as 'green' | 'red' | 'blue' | 'yellow'}>{selected.status}</Badge></div>
            </div>

            <table className="dax-table w-full text-xs mb-4">
              <thead><tr><th>Producto</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {(selected.lines ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.description ?? item.sku ?? '—'}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right font-semibold">{formatCurrency(item.total_line)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-sm border-t border-dax-border pt-3 mb-4">
              <div className="flex justify-between text-dax-muted"><span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span></div>
              {selected.tax_amount > 0 && <div className="flex justify-between text-dax-muted"><span>IVA</span><span>{formatCurrency(selected.tax_amount)}</span></div>}
              <div className="flex justify-between font-black text-dax-text text-base"><span>Total</span><span>{formatCurrency(selected.total_amount)}</span></div>
            </div>

            {selected.status === 'PENDING' && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleConvert(selected)}
                  disabled={converting === selected.id}
                  className="dax-btn-primary flex-1 justify-center disabled:opacity-40">
                  {converting === selected.id ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-cash-register" /> Convertir a Venta</>}
                </button>
                <button onClick={() => handleDelete(selected.id)} className="dax-btn-danger text-xs">
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
