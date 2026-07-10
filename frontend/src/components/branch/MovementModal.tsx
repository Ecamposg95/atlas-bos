import { useState } from 'react'
import { ui } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface Props {
  type: 'IN' | 'OUT'
  onClose: () => void
  onConfirm: (amount: number, concept: string) => Promise<void>
  onMovementSuccess?: () => void
}

export function MovementModal({ type, onClose, onConfirm, onMovementSuccess }: Props) {
  const COPY = BRANCH_COPY.pages.cashMovements
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !concept.trim()) return
    setLoading(true)
    try {
      await onConfirm(amt, concept.trim())
      onMovementSuccess?.()
    } finally {
      setLoading(false)
    }
  }

  const title = type === 'IN' ? COPY.modalTitleIn : COPY.modalTitleOut
  const submitLabel = type === 'IN' ? COPY.submitIn : COPY.submitOut

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`${ui.card} w-full max-w-sm p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-dax-text">{title}</h3>
          <button
            onClick={onClose}
            className="text-dax-muted hover:text-slate-700 dark:hover:text-dax-text p-1"
            aria-label="Cerrar"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.amount}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={ui.input}
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
            />
          </label>
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.concept}</span>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={ui.input}
              placeholder={type === 'IN' ? 'Ej. Fondo de cambio' : 'Ej. Refresco, papelería'}
            />
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className={`${ui.btnSecondary} flex-1`} disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading || !amount || !concept.trim()}
            className={`${ui.btnPrimary} flex-1 disabled:opacity-50`}
          >
            {loading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-check" /> {submitLabel}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
