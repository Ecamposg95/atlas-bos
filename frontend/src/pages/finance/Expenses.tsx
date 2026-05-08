import { useEffect, useState, useCallback } from 'react'
import { expensesApi, type Expense, type ExpenseStats, type ExpenseCreate } from '../../api/expenses'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/currency'
import { todayStr, daysAgoStr } from '../../utils/dates'

const EMPTY_FORM: ExpenseCreate = { amount: 0, category: '', description: '' }

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [stats, setStats] = useState<ExpenseStats | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(daysAgoStr(30))
  const [endDate, setEndDate] = useState(todayStr())
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<ExpenseCreate>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (start: string, end: string, cat: string) => {
    setLoading(true)
    try {
      const res = await expensesApi.list({ date_start: start, date_end: end, category: cat || undefined, limit: 100 })
      setExpenses(res.items ?? [])
    } catch { setExpenses([]) } finally { setLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    expensesApi.getStats().then(setStats).catch(() => {})
    expensesApi.getCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    loadStats()
    load(startDate, endDate, '')
  }, [])

  const handleCreate = async () => {
    if (!form.amount || !form.category) return
    setSaving(true)
    try {
      await expensesApi.create(form)
      setModal(false); setForm(EMPTY_FORM)
      loadStats(); load(startDate, endDate, filterCat)
    } catch { alert('Error al registrar gasto') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este gasto?')) return
    try {
      await expensesApi.delete(id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      loadStats()
    } catch { alert('Error al eliminar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-money-bill-wave text-indigo-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Gastos</h1>
        </div>
        <button onClick={() => setModal(true)} className="dax-btn-primary text-xs">
          <i className="fa-solid fa-plus" /> Registrar Gasto
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Este mes', value: formatCurrency(stats.total_month), icon: 'fa-calendar', color: 'text-red-400' },
            { label: 'Esta semana', value: formatCurrency(stats.total_week), icon: 'fa-calendar-week', color: 'text-amber-400' },
            { label: 'Registros mes', value: String(stats.count_month), icon: 'fa-receipt', color: 'text-white' },
            { label: 'Promedio diario', value: formatCurrency(stats.avg_daily), icon: 'fa-chart-bar', color: 'text-indigo-400' },
          ].map((k) => (
            <DaxCard key={k.label}>
              <div className="flex items-center gap-2 mb-1">
                <i className={`fa-solid ${k.icon} text-slate-500 text-xs`} />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-xl font-black tabular-nums ${k.color}`}>{k.value}</p>
            </DaxCard>
          ))}
        </div>
      )}

      {/* Categorías breakdown */}
      {stats?.by_category && stats.by_category.length > 0 && (
        <DaxCard>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Por Categoría (Mes)</p>
          <div className="space-y-2">
            {stats.by_category.map((c) => {
              const pct = stats.total_month > 0 ? (c.total / stats.total_month) * 100 : 0
              return (
                <div key={c.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{c.category}</span>
                    <span className="text-white font-semibold">{formatCurrency(c.total)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full">
                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </DaxCard>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="dax-input text-xs max-w-[160px]">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dax-input w-36 text-xs" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="dax-input w-36 text-xs" />
        <button onClick={() => load(startDate, endDate, filterCat)} className="dax-btn-primary text-xs">
          <i className="fa-solid fa-search" /> Filtrar
        </button>
      </div>

      {/* Tabla */}
      <DaxCard padding={false}>
        {loading ? <Spinner text="Cargando gastos..." /> : expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-600">Sin gastos en este período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dax-table w-full">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Sucursal</th>
                  <th>Registró</th>
                  <th className="text-right">Monto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-slate-400">
                      {new Date(e.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </td>
                    <td>
                      <span className="dax-badge dax-badge-slate">{e.category}</span>
                    </td>
                    <td className="text-slate-300 text-sm max-w-[200px] truncate">{e.description ?? '—'}</td>
                    <td className="text-slate-400 text-xs">{e.branch_name ?? '—'}</td>
                    <td className="text-slate-500 text-xs">{e.user_name ?? '—'}</td>
                    <td className="text-right font-semibold text-red-400 tabular-nums">{formatCurrency(e.amount)}</td>
                    <td>
                      <button onClick={() => handleDelete(e.id)} className="text-slate-600 hover:text-red-400 text-xs">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DaxCard>

      {/* Modal nuevo gasto */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)}>
          <div className="dax-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-white">Nuevo Gasto</h3>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-lg" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="dax-label">Monto</label>
                <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  className="dax-input w-full text-lg font-bold" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="dax-label">Categoría</label>
                <select value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="dax-input w-full">
                  <option value="">Seleccionar...</option>
                  {categories.length > 0
                    ? categories.map((c) => <option key={c} value={c}>{c}</option>)
                    : ['ALQUILER', 'SERVICIOS', 'SUMINISTROS', 'NÓMINA', 'MANTENIMIENTO', 'MARKETING', 'LOGÍSTICA', 'OTRO'].map((c) => <option key={c} value={c}>{c}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="dax-label">Descripción (opcional)</label>
                <input value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="dax-input w-full" placeholder="Detalle del gasto" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)} className="dax-btn-secondary flex-1">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.amount || !form.category} className="dax-btn-primary flex-1 justify-center disabled:opacity-40">
                {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" /> Registrar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
