import { useState } from 'react'
import { cashApi } from '../../../api/cash'
import type { CashSession } from '../../../types/cash'
import { formatCurrency } from '../../../utils/currency'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000]

interface Props {
  onOpened: (session: CashSession) => void
}

export function SessionModal({ onOpened }: Props) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt < 0) { setError('Ingresa un monto válido'); return }
    setLoading(true)
    setError(null)
    try {
      const session = await cashApi.open(amt, notes || undefined)
      onOpened(session)
    } catch {
      setError('Error al abrir turno. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      style={{ background: 'var(--dax-modal-backdrop)' }}
    >
      <div className="dax-card p-6 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center mx-auto mb-3">
            <i className="fa-solid fa-vault text-indigo-400 text-2xl" />
          </div>
          <h2 className="text-xl font-black text-white">Abrir Turno</h2>
          <p className="text-slate-500 text-sm mt-1">Ingresa el fondo inicial de caja</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fondo inicial
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="dax-input text-xl font-bold text-center"
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  parseFloat(amount) === a
                    ? 'border-indigo-500 bg-indigo-600/20 text-white'
                    : 'border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {formatCurrency(a)}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="dax-input text-sm"
              placeholder="Ej: Turno matutino..."
            />
          </div>

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <button
            onClick={open}
            disabled={loading || amount === ''}
            className="dax-btn-primary w-full justify-center py-3 text-base font-black disabled:opacity-50"
          >
            {loading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Abriendo...</>
              : <><i className="fa-solid fa-lock-open" /> Abrir Turno</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
