import { Link } from 'react-router-dom'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { ui, fmtMoney } from './branchUI'
import type { DashboardAlert, AlertKind } from '../../types/branchDashboard'

interface Props { alerts: DashboardAlert[] }

const SEVERITY_DOT: Record<AlertKind, string> = {
  cash_variance:   ui.dotRed,
  low_stock:       ui.dotAmber,
  quote_expiring:  ui.dotAmber,
  no_branch_price: 'w-2 h-2 rounded-full bg-slate-400',
}

export function CockpitAlerts({ alerts }: Props) {
  return (
    <div className={`${ui.card} p-6 h-full flex flex-col`}>
      <p className={`${ui.kpiLabel} mb-3`}>{BRANCH_COPY.cockpit.alertsTitle}</p>

      {alerts.length === 0 ? (
        <p className={`text-sm italic ${ui.muted} py-3 text-center flex-1 flex items-center justify-center`}>
          {BRANCH_COPY.cockpit.noPending}
        </p>
      ) : (
        <div className={`${ui.divider} flex-1`}>
          {alerts.slice(0, 5).map((a, i) => (
            <Link
              key={i}
              to={a.deeplink}
              className="
                flex items-center gap-3 py-3
                text-sm text-slate-700 dark:text-dax-muted
                hover:text-slate-900 dark:hover:text-dax-text
                transition-colors duration-150
                group
              "
            >
              <span
                className={`flex-shrink-0 ${SEVERITY_DOT[a.kind]}`}
                aria-hidden="true"
              />
              <span className="flex-1 leading-snug">{describe(a)}</span>
              <span className="text-dax-muted dark:text-dax-faint group-hover:text-dax-muted dark:group-hover:text-dax-muted transition-colors flex-shrink-0">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function describe(a: DashboardAlert): string {
  switch (a.kind) {
    case 'low_stock':       return BRANCH_COPY.alerts.low_stock(a.count ?? 0)
    case 'no_branch_price': return BRANCH_COPY.alerts.no_branch_price(a.count ?? 0)
    case 'quote_expiring':  return BRANCH_COPY.alerts.quote_expiring(a.count ?? 0)
    case 'cash_variance':   return BRANCH_COPY.alerts.cash_variance(fmtMoney(a.amount))
  }
}
