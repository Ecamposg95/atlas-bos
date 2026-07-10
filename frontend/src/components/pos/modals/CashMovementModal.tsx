import { useState } from 'react'
import { cashApi } from '../../../api/cash'
import { formatCurrency } from '../../../utils/currency'

const QUICK = [50, 100, 200, 500, 1000]

interface Props {
  type: 'IN' | 'OUT'
  onClose: () => void
  onSuccess: (msg: string) => void
}

export function CashMovementModal({ type, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isIn = type === 'IN'
  const amtNum = parseFloat(amount) || 0
  const isValid = amtNum > 0 && concept.trim().length > 0

  const submit = async () => {
    if (!isValid) return
    setLoading(true)
    setError(null)
    try {
      if (isIn) await cashApi.inflow(amtNum, concept.trim())
      else await cashApi.outflow(amtNum, concept.trim())
      onSuccess(`${isIn ? 'Entrada' : 'Salida'} de ${formatCurrency(amtNum)} registrada`)
      onClose()
    } catch {
      setError('Error al registrar movimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--dax-modal-backdrop)' }}
      onClick={onClose}
    >
      <div className="dax-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isIn ? 'bg-emerald-600/20' : 'bg-red-600/20'
          }`}>
            <i className={`fa-solid ${isIn ? 'fa-plus' : 'fa-minus'} ${isIn ? 'text-sem-success' : 'text-sem-critical'}`} />
          </div>
          <div>
            <h3 className="text-lg font-black text-dax-text">{isIn ? 'Entrada de Efectivo' : 'Salida de Efectivo'}</h3>
            <p className="text-xs text-dax-muted">{isIn ? 'Registrar ingreso a caja' : 'Registrar retiro de caja'}</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[10px] font-bold text-dax-muted uppercase tracking-wider mb-1">Monto</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="dax-input text-2xl font-black text-center tabular-nums"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  amtNum === q
                    ? 'border-indigo-500 bg-indigo-600/20 text-dax-text'
                    : 'border-dax-border text-dax-muted hover:border-dax-border hover:text-dax-text'
                }`}
              >
                ${q}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-dax-muted uppercase tracking-wider mb-1">
              Concepto <span className="text-sem-critical">*</span>
            </label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
              className="dax-input text-sm"
              placeholder={isIn ? 'Ej: Préstamo del dueño...' : 'Ej: Compra de materiales...'}
            />
          </div>
        </div>

        {error && <p className="text-sem-critical text-xs mb-3 text-center">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="dax-btn-secondary flex-1">Cancelar</button>
          <button
            onClick={submit}
            disabled={loading || !isValid}
            className={`flex-1 justify-center font-bold py-2 px-4 rounded-xl text-dax-text text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 ${
              isIn
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {loading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className={`fa-solid ${isIn ? 'fa-arrow-down-to-line' : 'fa-arrow-up-from-line'}`} /> Registrar</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
