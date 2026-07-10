import { useState } from 'react'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { ui } from './branchUI'
import { closeShiftGuided } from '../../api/branchDashboard'

interface Props { sessionId: number; onClosed: () => void }

const STEPS = [
  { key: 'cash',    label: BRANCH_COPY.cockpit.closingStep_cash },
  { key: 'card',    label: BRANCH_COPY.cockpit.closingStep_card },
  { key: 'z',       label: BRANCH_COPY.cockpit.closingStep_z },
  { key: 'expense', label: BRANCH_COPY.cockpit.closingStep_expense },
] as const

export function CockpitClosingWizard({ sessionId, onClosed }: Props) {
  const [counted, setCounted]       = useState('')
  const [done, setDone]             = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const allChecked = STEPS.every((s) => done[s.key])

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      await closeShiftGuided(sessionId, {
        counted_cash: Number(counted) || 0,
        cash_total_per_method: {},
        day_expenses_total: 0,
      })
      onClosed()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? BRANCH_COPY.cockpit.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="
      rounded-3xl
      bg-amber-50/80 dark:bg-slate-900
      border border-amber-200/60 dark:border-amber-900/40
      shadow-lg shadow-amber-900/5 dark:shadow-black/20
      p-6
    ">
      <div className="flex items-center gap-2 mb-5">
        <i className="fa-solid fa-moon text-amber-500 dark:text-amber-400 text-sm" aria-hidden="true" />
        <h2 className="font-bold text-base text-slate-800 dark:text-slate-200">
          {BRANCH_COPY.cockpit.closingChecklistTitle}
        </h2>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        {/* Left — checklist */}
        <ul className="space-y-3 mb-6 lg:mb-0">
          {STEPS.map((s) => (
            <li key={s.key}>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!done[s.key]}
                  onChange={(e) => setDone((d) => ({ ...d, [s.key]: e.target.checked }))}
                  className="
                    w-4 h-4 rounded
                    border-stone-300 dark:border-slate-600
                    text-purple-600
                    focus:ring-purple-500
                    transition-all duration-150
                  "
                />
                <span className={`
                  text-sm transition-colors duration-150
                  ${done[s.key]
                    ? 'text-slate-400 dark:text-slate-600 line-through'
                    : 'text-slate-700 dark:text-slate-300'
                  }
                `}>
                  {s.label}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {/* Right — cash input + submit */}
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className={`${ui.kpiLabel}`}>
              {BRANCH_COPY.cockpit.closingCashLabel}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className={`${ui.input} mt-2 text-base`}
              placeholder="0.00"
            />
          </label>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button
            type="button"
            disabled={!allChecked || !counted || submitting}
            onClick={submit}
            className={`${ui.btnPrimary} w-full py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {submitting ? BRANCH_COPY.states.loading : BRANCH_COPY.cockpit.closeShift}
          </button>
        </div>
      </div>
    </div>
  )
}
