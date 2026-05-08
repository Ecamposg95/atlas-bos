import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BRANCH_COPY, ROLE_LABELS } from '../../copy/branchCopy'
import { ui } from './branchUI'
import { OpenShiftModal } from './OpenShiftModal'
import type { DashboardShift, DashboardUser } from '../../types/branchDashboard'

interface Props {
  user: DashboardUser
  shift: DashboardShift
  onShiftOpened?: () => void
}

function getInitials(fullName?: string | null): string {
  const src = (fullName ?? '').trim()
  if (!src) return '?'
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return BRANCH_COPY.cockpit.greetingMorning
  if (h < 19) return BRANCH_COPY.cockpit.greetingAfternoon
  return BRANCH_COPY.cockpit.greetingEvening
}

function formatElapsed(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function CockpitGreeting({ user, shift, onShiftOpened }: Props) {
  const [showOpenModal, setShowOpenModal] = useState(false)

  const heroClass = shift.is_open ? ui.heroEmerald : ui.heroOrange
  const ctaTextColor = shift.is_open ? 'text-emerald-700' : 'text-orange-700'
  const firstName = (user.name ?? '').split(/\s+/)[0] || user.name || ''
  const roleLabel = user.role ? (ROLE_LABELS[user.role] ?? user.role) : null

  return (
    <>
      <header className={`${heroClass} px-6 py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}>
        {/* Left — avatar + greeting + subtitle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20 text-white text-xl font-bold flex-shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
              {timeGreeting()}, {firstName}.
            </h1>
            <p className="text-base text-white/85 font-medium">
              {user.branch_name}
              {roleLabel && <span className="opacity-70"> · {roleLabel}</span>}
            </p>
          </div>
        </div>

        {/* Right — status pill + contextual CTA */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-semibold px-2.5 py-1">
            <i className="fa-solid fa-circle text-[8px]" />
            {shift.is_open
              ? `${BRANCH_COPY.cockpit.shiftOpenPill} · ${formatElapsed(shift.duration_minutes ?? 0)}`
              : BRANCH_COPY.cockpit.shiftClosedPill}
          </span>

          {shift.is_open ? (
            <Link
              to="/pos"
              className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white ${ctaTextColor} hover:bg-white/95 active:bg-white/90 font-bold text-base py-3 px-6 transition-colors shadow-lg shadow-black/20`}
              aria-label={BRANCH_COPY.cockpit.cobrarAhora}
            >
              <i className="fa-solid fa-cash-register" />
              {BRANCH_COPY.cockpit.cobrarAhora}
            </Link>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-white ${ctaTextColor} hover:bg-white/95 active:bg-white/90 font-bold text-base py-3 px-6 transition-colors shadow-lg shadow-black/20`}
            >
              <i className="fa-solid fa-play" />
              {BRANCH_COPY.cockpit.abrirTurno}
            </button>
          )}
        </div>
      </header>

      {showOpenModal && (
        <OpenShiftModal
          onOpened={() => { setShowOpenModal(false); onShiftOpened?.() }}
          onCancel={() => setShowOpenModal(false)}
        />
      )}
    </>
  )
}
