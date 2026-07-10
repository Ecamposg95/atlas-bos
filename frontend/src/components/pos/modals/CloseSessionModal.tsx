import { useEffect, useState } from 'react'
import { cashApi } from '../../../api/cash'
import { formatCurrency } from '../../../utils/currency'

interface Props {
  onClose: () => void
  onConfirm: (closingAmount: number, notes: string) => Promise<void>
}

export function CloseSessionModal({ onClose, onConfirm }: Props) {
  const [expectedCash, setExpectedCash] = useState<number | null>(null)
  const [closingAmount, setClosingAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    cashApi.getSummary()
      .then((s) => setExpectedCash(s.expected_cash))
      .catch(() => setExpectedCash(null))
      .finally(() => setLoadingData(false))
  }, [])

  const closingNum = parseFloat(closingAmount) || 0
  const diff = expectedCash !== null ? closingNum - expectedCash : null

  const submit = async () => {
    setLoading(true)
    try { await onConfirm(closingNum, notes) } finally { setLoading(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'var(--dax-modal-backdrop)' }}
      onClick={onClose}
    >
      <div className="dax-card p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <i className="fa-solid fa-lock text-sem-warning text-2xl" />
          </div>
          <h3 className="text-xl font-black text-dax-text">Cerrar Turno</h3>
          <p className="text-dax-muted text-xs mt-1">Registra el efectivo real en caja</p>
        </div>

        {loadingData ? (
          <div className="text-center py-4">
            <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {expectedCash !== null && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-center">
                <p className="text-[10px] font-bold text-dax-muted uppercase tracking-wider mb-1">Efectivo esperado</p>
                <p className="text-2xl font-black text-indigo-400 tabular-nums">{formatCurrency(expectedCash)}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-dax-muted uppercase tracking-wider mb-1">
                Efectivo real en caja
              </label>
              <input
                type="number"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="dax-input text-xl font-black text-center tabular-nums"
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>

            {diff !== null && closingAmount && (
              <div className={`rounded-xl p-3 text-center text-sm font-bold ${
                diff >= 0
                  ? 'bg-emerald-600/10 border border-emerald-600/30 text-sem-success'
                  : 'bg-red-600/10 border border-red-600/30 text-sem-critical'
              }`}>
                {diff >= 0 ? `Sobrante: ${formatCurrency(diff)}` : `Faltante: ${formatCurrency(Math.abs(diff))}`}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-dax-muted uppercase tracking-wider mb-1">
                Notas (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="dax-input text-sm"
                placeholder="Ej: Turno sin novedad..."
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="dax-btn-secondary flex-1">Cancelar</button>
              <button
                onClick={submit}
                disabled={loading || !closingAmount}
                className="flex-1 justify-center bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-xl text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading
                  ? <i className="fa-solid fa-spinner fa-spin" />
                  : <><i className="fa-solid fa-lock" /> Cerrar Turno</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
