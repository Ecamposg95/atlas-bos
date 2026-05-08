import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

interface KPICardV2Props {
  label: string
  value: string | number
  unit?: string
  icon?: string
  delta?: number | null
  deltaLabel?: string
  deltaAsPercent?: boolean
  spark?: { v: number }[] | boolean
}

export function KPICardV2({
  label, value, unit, icon,
  delta, deltaLabel, deltaAsPercent = true,
  spark,
}: KPICardV2Props) {
  const sparkData = Array.isArray(spark) ? spark : undefined
  return (
    <div className="kpi">
      <div className="row">
        <span className="label">{label}</span>
        {icon && <span className="icon"><i className={'fa-solid ' + icon} /></span>}
      </div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="foot">
        {delta != null
          ? <Delta value={delta} label={deltaLabel} asPercent={deltaAsPercent} />
          : <span className="hint mono">—</span>}
        {sparkData && sparkData.length > 0 && <Sparkline data={sparkData} />}
      </div>
    </div>
  )
}
