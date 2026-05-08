import { formatCurrency } from '../../../utils/currency'

export interface LeaderboardColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: (v: any) => string
}

interface LeaderboardProps {
  title: string
  rows: Record<string, any>[]
  columns: LeaderboardColumn[]
  loading?: boolean
  onRowClick?: (row: Record<string, any>, idx: number) => void
}

export function Leaderboard({ title, rows, columns, loading, onRowClick }: LeaderboardProps) {
  return (
    <div className="card">
      <div className="head">
        <div className="title">{title}</div>
      </div>
      <div className="body flush">
        {loading ? (
          <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
            <div className="skel" style={{ height: 12, width: '60%', marginBottom: 8 }} />
            <div className="skel" style={{ height: 12, width: '80%', marginBottom: 8 }} />
            <div className="skel" style={{ height: 12, width: '50%' }} />
          </div>
        ) : !rows || rows.length === 0 ? (
          <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
            Sin datos.
          </div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th style={{ width: 28, textAlign: 'right' }}>#</th>
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    style={{
                      textAlign: c.align ?? (i === 0 ? 'left' : 'right'),
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={idx}
                  onClick={onRowClick ? () => onRowClick(r, idx) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                  className={onRowClick ? 'lb-row-clickable' : undefined}
                >
                  <td className="rank mono">{idx + 1}</td>
                  {columns.map((c, ci) => {
                    const v = r[c.key]
                    const align = c.align ?? (ci === 0 ? 'left' : 'right')
                    let display: string
                    if (c.format) display = c.format(v)
                    else if (v === null || v === undefined) display = '—'
                    else display = String(v)
                    return (
                      <td
                        key={c.key}
                        style={{ textAlign: align }}
                        className={ci === 0 ? 'first' : align === 'right' ? 'mono' : undefined}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Re-export the helper so call sites don't have to import it separately
export { formatCurrency }
