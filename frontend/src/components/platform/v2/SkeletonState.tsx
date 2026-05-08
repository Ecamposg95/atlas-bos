interface SkProps {
  w?: number | string
  h?: number | string
  r?: number | string
  style?: React.CSSProperties
}

function Sk({ w = '100%', h = 12, r = 6, style }: SkProps) {
  return <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function SkeletonState() {
  return (
    <div className="pv2-main">
      <div className="crumb"><Sk w={160} h={10} /></div>
      <div className="page-head">
        <div>
          <Sk w={260} h={26} />
          <div style={{ marginTop: 10 }}><Sk w={340} h={12} /></div>
        </div>
        <Sk w={240} h={32} r={8} />
      </div>

      {/* Hero + 4 KPI mini */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
        <div className="kpi kpi-hero">
          <div className="row"><Sk w={180} h={11} /><Sk w={84} h={22} r={8} /></div>
          <Sk w={260} h={60} style={{ marginTop: 6 }} />
          <div className="foot" style={{ marginTop: 8 }}><Sk w={140} h={12} /><Sk w={180} h={36} /></div>
          <div style={{ marginTop: 8 }}><Sk w="100%" h={180} r={10} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kpi">
              <div className="row"><Sk w={80} h={10} /><Sk w={28} h={28} r={8} /></div>
              <Sk w={140} h={34} />
              <div className="foot"><Sk w={70} h={10} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="row-split">
        <div className="card" style={{ padding: 18 }}>
          <Sk w={180} h={12} />
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <Sk key={i} w="100%" h={14} />)}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <Sk w={180} h={12} />
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'center' }}>
                <Sk w={28} h={28} r={8} />
                <Sk w="100%" h={12} />
                <Sk w={60} h={12} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
