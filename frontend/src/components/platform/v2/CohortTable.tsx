import type { CohortRow } from '../../../api/platform'

import { TablaDesplazable } from '../../ui/TablaDesplazable'

interface CohortTableProps {
  rows: CohortRow[]
}

const PERIODS: Array<{ key: 'ret_30d' | 'ret_60d' | 'ret_90d' | 'ret_180d'; label: string }> = [
  { key: 'ret_30d', label: '30d' },
  { key: 'ret_60d', label: '60d' },
  { key: 'ret_90d', label: '90d' },
  { key: 'ret_180d', label: '180d' },
]

function CohortCell({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <td className="muted">—</td>
  }
  // 0..100 → opacity 0..0.6
  const opacity = Math.max(0, Math.min(value, 100)) / 100 * 0.6
  return (
    <td
      style={{
        backgroundColor: 'var(--p-accent)',
        opacity: opacity > 0 ? opacity + 0.15 : 0.15,
        color: 'var(--p-text)',
      }}
    >
      {value.toFixed(0)}%
    </td>
  )
}

export function CohortTable({ rows }: CohortTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
        Sin datos de retención.
      </div>
    )
  }
  return (
    <TablaDesplazable>
      <table className="cohort-table">
        <thead>
          <tr>
            <th>Cohort</th>
            {PERIODS.map(p => <th key={p.key}>{p.label}</th>)}
            <th>n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.cohort}>
              <th scope="row">{r.cohort_label}</th>
              {PERIODS.map(p => <CohortCell key={p.key} value={r[p.key]} />)}
              <td className="size mono">{r.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TablaDesplazable>
  )
}
