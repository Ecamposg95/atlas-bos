import { useMemo } from 'react'
import { ui, fmtMoney } from './branchUI'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface SessionLike {
  closed_at: string | null
  total_cash_sales: string
}

interface Props {
  sessions: SessionLike[]
  todayCashSales?: number
}

function parseNum(v: string | null | undefined): number {
  if (v == null || v === '') return 0
  return Number(v)
}

const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

export function WeekSalesChart({ sessions, todayCashSales = 0 }: Props) {
  const COPY = BRANCH_COPY.pages.weekSalesChart

  const slots = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dayStart = d.getTime()
      const dayTotal = sessions.reduce((acc, s) => {
        if (!s.closed_at) return acc
        const sd = new Date(s.closed_at)
        sd.setHours(0, 0, 0, 0)
        return sd.getTime() === dayStart ? acc + parseNum(s.total_cash_sales) : acc
      }, 0)
      const total = i === 0 ? dayTotal + todayCashSales : dayTotal
      return { date: d, total }
    }).reverse()
  }, [sessions, todayCashSales])

  const maxTotal = useMemo(() => {
    const vals = slots.map((s) => s.total)
    return Math.max(...vals, 1)
  }, [slots])

  return (
    <div className={`${ui.card} p-5 h-full`}>
      <p className={`${ui.sectionTitle} mb-3`}>{COPY.title}</p>
      <div className="flex items-end gap-1.5 h-28">
        {slots.map((slot, i) => {
          const isToday = i === slots.length - 1
          const hasData = slot.total > 0
          const pct = hasData ? Math.max(slot.total / maxTotal, 0.06) : 0
          const barColor = !hasData
            ? 'bg-stone-200 dark:bg-dax-surface'
            : isToday
              ? 'bg-purple-500 dark:bg-purple-400'
              : 'bg-purple-500/70 dark:bg-purple-400/70'
          const dayName = DAY_LABELS[slot.date.getDay()]
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`w-full rounded-t-sm transition-all ${barColor}`}
                  style={{ height: hasData ? `${pct * 100}%` : '8%' }}
                  title={hasData ? fmtMoney(slot.total) : COPY.noSession}
                />
              </div>
              <span
                className={`text-[10px] font-semibold ${
                  isToday
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-dax-muted dark:text-dax-muted'
                }`}
              >
                {dayName}
              </span>
            </div>
          )
        })}
      </div>
      <p className={`text-xs ${ui.muted} mt-2`}>{COPY.legend}</p>
    </div>
  )
}
