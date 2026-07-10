import { useState, useRef, useCallback } from 'react'
import { customersApi, type Customer } from '../../api/customers'
import { usePOSStore } from '../../store/posStore'

export function CustomerSelector() {
  const { setCustomer } = usePOSStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const data = await customersApi.search(q)
      setResults(data)
      setOpen(true)
    } catch { setResults([]) } finally { setLoading(false) }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const selectCustomer = (c: Customer) => {
    setCustomer(c.id, c.name)
    setQuery(c.name)
    setOpen(false)
    setResults([])
  }

  const quickCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const c = await customersApi.create({ name: newName, phone: newPhone || undefined })
      selectCustomer(c)
      setCreating(false)
      setNewName('')
      setNewPhone('')
    } catch { } finally { setLoading(false) }
  }

  return (
    <div className="relative">
      <div className="flex gap-2 items-center px-4 py-2" style={{ borderBottom: '1px solid var(--dax-row-border)' }}>
        <i className="fa-solid fa-user-plus text-slate-500 text-xs" />
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-600 outline-none"
            placeholder="Buscar cliente..."
          />
          {loading && <i className="fa-solid fa-spinner fa-spin absolute right-0 top-0.5 text-slate-500 text-xs" />}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-indigo-400 hover:text-indigo-300 text-xs flex-shrink-0"
          title="Crear cliente rápido"
        >
          <i className="fa-solid fa-plus" />
        </button>
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 rounded-b-xl max-h-40 overflow-y-auto"
             style={{ background: 'var(--dax-card-solid)', border: '1px solid var(--dax-border)', boxShadow: 'var(--dax-shadow-lg)' }}>
          {results.map((c) => (
            <button
              key={c.id}
              onMouseDown={() => selectCustomer(c)}
              className="w-full text-left px-4 py-2 transition-colors"
              style={{ color: 'var(--dax-text-muted)' }}
            >
              <p className="text-sm text-white">{c.name}</p>
              {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
            </button>
          ))}
        </div>
      )}

      {/* Quick create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="dax-card p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-base font-black text-white mb-3">Nuevo cliente</h4>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="dax-input"
                placeholder="Nombre *"
                autoFocus
              />
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="dax-input"
                placeholder="Teléfono"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="dax-btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={quickCreate} disabled={loading || !newName.trim()} className="dax-btn-primary flex-1 text-sm justify-center">
                {loading ? <i className="fa-solid fa-spinner fa-spin" /> : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
