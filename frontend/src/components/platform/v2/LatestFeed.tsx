import { useNavigate } from 'react-router-dom'
import { industryIconV2 } from './industryIcon'
import { StatusBadgeV2 } from './StatusBadgeV2'
import { formatDate } from '../../../utils/dates'

export interface LatestOrg {
  id: number | string
  name: string
  industry_type?: string | null
  created_at?: string | null
  is_active?: boolean
  status?: string | null
}

interface Props {
  data: LatestOrg[]
}

function derivedStatus(o: LatestOrg): 'active' | 'archived' | 'inactive' {
  if (o.is_active === false) return 'inactive'
  if (o.status === 'ARCHIVED') return 'archived'
  return 'active'
}

export function LatestFeed({ data }: Props) {
  const navigate = useNavigate()
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '24px 18px', color: 'var(--p-muted)', fontSize: 13 }}>
        Sin organizaciones recientes.
      </div>
    )
  }
  return (
    <div className="feed">
      {data.map(o => (
        <div className="item" key={o.id} onClick={() => navigate(`/platform/organizations/${o.id}`)}>
          <div className="ico">
            <i className={'fa-solid ' + industryIconV2(o.industry_type)} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="nm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {o.name}
            </div>
            <div className="meta">
              <span>{o.industry_type || 'Sin industria'}</span>
              <span className="dot" />
              <span>{o.created_at ? formatDate(o.created_at, 'relative') : 'sin fecha'}</span>
            </div>
          </div>
          <StatusBadgeV2 status={derivedStatus(o)} />
        </div>
      ))}
    </div>
  )
}
