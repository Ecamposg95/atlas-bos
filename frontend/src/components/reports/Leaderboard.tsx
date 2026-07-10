import { useEffect, useState } from 'react'
import { formatCurrency } from '../../utils/currency'

/**
 * BranchLeaderboard — podium (top 3) + ranked list with animated bars.
 *
 * Top 3 get big cards with gold/silver/bronze borders and a stagger-in
 * entry animation via `opacity`/`translate`/`scale`. Positions 4+ render
 * as a compact list with a progressive bar relative to the #1 total.
 */

export interface LeaderboardEntry {
  id: number | string
  name: string
  total_sales: number
}

interface Props {
  branches: LeaderboardEntry[]
}

const PODIUM_STYLES = [
  {
    border: 'border-amber-300/60',
    glow: 'shadow-amber-300/20',
    text: 'text-amber-300',
    bg: 'from-amber-500/15 via-amber-500/5 to-transparent',
    medal: 'gold',
    icon: 'fa-trophy',
  },
  {
    border: 'border-slate-300/50',
    glow: 'shadow-slate-300/15',
    text: 'text-slate-200',
    bg: 'from-slate-400/15 via-slate-400/5 to-transparent',
    medal: 'silver',
    icon: 'fa-medal',
  },
  {
    border: 'border-orange-400/50',
    glow: 'shadow-orange-400/15',
    text: 'text-orange-300',
    bg: 'from-orange-500/15 via-orange-500/5 to-transparent',
    medal: 'bronze',
    icon: 'fa-medal',
  },
] as const

const MEDAL_EMOJI: Record<string, string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
}

export function BranchLeaderboard({ branches }: Props) {
  const sorted = [...branches].sort((a, b) => b.total_sales - a.total_sales)
  const podium = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const maxSales = sorted[0]?.total_sales ?? 1

  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    setRevealed(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    podium.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), 120 * (i + 1)))
    })
    return () => { timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.length])

  if (sorted.length === 0) {
    return <p className="text-xs text-slate-500 italic">Sin datos de sucursales.</p>
  }

  return (
    <div className="space-y-4">
      <div className={`grid ${podium.length >= 3 ? 'grid-cols-3' : podium.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        {podium.map((b, i) => {
          const st = PODIUM_STYLES[i]
          const pct = maxSales > 0 ? (b.total_sales / maxSales) * 100 : 0
          const shown = i < revealed
          return (
            <div
              key={b.id}
              className={`relative overflow-hidden rounded-xl border ${st.border} bg-gradient-to-br ${st.bg} p-3 shadow-lg ${st.glow} transition-all duration-500 ease-out ${shown ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl leading-none" aria-hidden>{MEDAL_EMOJI[st.medal]}</span>
                <i className={`fa-solid ${st.icon} ${st.text} text-sm`} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">#{i + 1}</p>
              <p className={`text-sm font-black ${st.text} truncate`} title={b.name}>{b.name}</p>
              <p className="text-xs font-mono font-bold text-white tabular-nums mt-1">
                {formatCurrency(b.total_sales)}
              </p>
              <div className="mt-2 h-1 bg-slate-800/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: shown ? `${pct}%` : '0%' }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {rest.length > 0 && (
        <div className="space-y-1.5">
          {rest.map((b, i) => {
            const pct = maxSales > 0 ? (b.total_sales / maxSales) * 100 : 0
            return (
              <div key={b.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-slate-800/30 transition-colors">
                <span className="text-[10px] font-mono font-bold text-slate-500 w-6 text-right">#{i + 4}</span>
                <span className="text-xs font-bold text-slate-300 flex-1 truncate">{b.name}</span>
                <div className="w-24 sm:w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500/70 to-violet-500/80 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold text-emerald-400 tabular-nums w-20 text-right">
                  {formatCurrency(b.total_sales)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
