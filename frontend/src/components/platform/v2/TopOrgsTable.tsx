import { useNavigate } from 'react-router-dom'
import { industryIconV2 } from './industryIcon'
import { formatCurrency } from '../../../utils/currency'

export interface TopOrgRow {
  id: number | string
  name: string
  industry_type?: string | null
  revenue: number
  transactions: number
}

interface Props {
  data: TopOrgRow[]
  compact?: boolean
}

export function TopOrgsTable({ data, compact = false }: Props) {
  const navigate = useNavigate()
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
        Sin organizaciones con ventas todavía.
      </div>
    )
  }
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Org</th>
          {!compact && <th>Industry</th>}
          <th className="right">Ventas mes</th>
          <th className="right">Ticket prom.</th>
        </tr>
      </thead>
      <tbody>
        {data.map((o, i) => {
          const avg = o.transactions > 0 ? o.revenue / o.transactions : 0
          return (
            <tr key={o.id} onClick={() => navigate(`/platform/organizations/${o.id}`)}>
              <td><span className="rank">{String(i + 1).padStart(2, '0')}</span></td>
              <td>
                <span className="org">
                  <span className="ico">
                    <i className={'fa-solid ' + industryIconV2(o.industry_type)} />
                  </span>
                  <span className="nm">{o.name}</span>
                </span>
              </td>
              {!compact && (
                <td><span className="ind">{o.industry_type || '—'}</span></td>
              )}
              <td className="right num">{formatCurrency(o.revenue)}</td>
              <td className="right num">{formatCurrency(avg)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
