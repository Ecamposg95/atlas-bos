import { useRef, useState } from 'react'
import { ui } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { cashApi } from '../../api/cash'
import { toast } from '../../store/toastStore'

interface Props {
  onOpened: () => void
  onCancel: () => void
}

export function OpenShiftModal({ onOpened, onCancel }: Props) {
  const COPY = BRANCH_COPY.openShiftModal
  const [opening, setOpening] = useState('0.00')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  async function submit() {
    if (submittingRef.current) return
    const amt = parseFloat(opening)
    if (isNaN(amt) || amt < 0) {
      toast.error('Monto inválido')
      return
    }
    submittingRef.current = true
    setLoading(true)
    try {
      await cashApi.open(amt, notes.trim() || undefined)
      toast.success(COPY.success)
      onOpened()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? COPY.error)
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className={`${ui.card} w-full max-w-sm p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{COPY.title}</h3>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            aria-label="Cancelar"
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.openingLabel}</span>
            <input
              type="number"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              className={ui.input}
              step="0.01"
              min="0"
              autoFocus
            />
          </label>
          <label className="block">
            <span className={`block ${ui.kpiLabel} mb-1`}>{COPY.notesLabel}</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={ui.input}
              placeholder="Apertura matutina, etc."
            />
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className={`${ui.btnSecondary} flex-1`} disabled={loading}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`${ui.btnPrimary} flex-1`}
          >
            {loading
              ? <i className="fa-solid fa-spinner fa-spin" />
              : <><i className="fa-solid fa-check" /> {COPY.submit}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
