import { useEffect, useState, FormEvent } from 'react'
import { barApi, BarBottle } from '../../api/bar'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { Card, N, ATLAS_MONO, ATLAS_FONT } from '../../components/atlas-one'

const ACCENT = '#7c3aed' // Bar (violeta)
const LOW = 15 // % bajo → resaltar reposición

function volColor(pct: number): string {
  if (pct <= LOW) return '#dc2626'
  if (pct <= 40) return '#f59e0b'
  return ACCENT
}

export function Botellas() {
  const { branch } = useAuthStore()
  const [bottles, setBottles] = useState<BarBottle[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', full_volume_ml: 750, pour_size_ml: 45 })

  const load = () => {
    setLoading(true)
    barApi.list({ branch_id: branch?.id })
      .then(setBottles)
      .catch(() => toast.error('No se pudieron cargar las botellas'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [branch?.id])

  const act = async (id: number, fn: () => Promise<BarBottle>) => {
    setBusy(id)
    try {
      const updated = await fn()
      setBottles((bs) => bs.map((b) => (b.id === id ? updated : b)))
    } catch {
      toast.error('Acción no disponible')
    } finally {
      setBusy(null)
    }
  }

  const openBottle = async (e: FormEvent) => {
    e.preventDefault()
    if (!branch?.id) { toast.error('Selecciona una sucursal'); return }
    if (!form.name.trim()) return
    try {
      await barApi.open({ branch_id: branch.id, name: form.name.trim(), full_volume_ml: form.full_volume_ml, pour_size_ml: form.pour_size_ml })
      setForm({ name: '', full_volume_ml: 750, pour_size_ml: 45 })
      setShowForm(false)
      toast.success('Botella abierta')
      load()
    } catch {
      toast.error('No se pudo abrir la botella')
    }
  }

  const active = bottles.filter((b) => b.status !== 'ARCHIVED')
  const lowCount = active.filter((b) => b.pct_remaining <= LOW).length

  return (
    <div style={{ background: N.page, minHeight: '100%', fontFamily: ATLAS_FONT }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1.75rem 3rem' }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Bar · Inventario líquido</p>
            <h1 style={{ margin: '6px 0 4px', fontSize: '1.7rem', fontWeight: 600, color: N.ink, letterSpacing: -0.6 }}>Botellas</h1>
            <p style={{ margin: 0, color: N.muted, fontSize: 14 }}>
              {active.length} abiertas{lowCount > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}> · {lowCount} por reponer</span>}
            </p>
          </div>
          <button onClick={() => setShowForm((s) => !s)}
            style={{ border: 'none', cursor: 'pointer', padding: '10px 18px', borderRadius: 10, background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 14, fontFamily: ATLAS_FONT }}>
            {showForm ? 'Cancelar' : '+ Abrir botella'}
          </button>
        </header>

        {showForm && (
          <Card pad={18} style={{ marginBottom: 18 }}>
            <form onSubmit={openBottle} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: '2 1 240px', fontSize: 12, color: N.muted }}>
                Nombre
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tequila Don Julio 70" required
                  style={inp} />
              </label>
              <label style={{ flex: '1 1 120px', fontSize: 12, color: N.muted }}>
                Volumen (ml)
                <input type="number" value={form.full_volume_ml} min={50} onChange={(e) => setForm({ ...form, full_volume_ml: Number(e.target.value) })} style={inp} />
              </label>
              <label style={{ flex: '1 1 120px', fontSize: 12, color: N.muted }}>
                Servida (ml)
                <input type="number" value={form.pour_size_ml} min={5} onChange={(e) => setForm({ ...form, pour_size_ml: Number(e.target.value) })} style={inp} />
              </label>
              <button type="submit" style={{ border: 'none', cursor: 'pointer', padding: '9px 16px', borderRadius: 10, background: N.ink, color: '#fff', fontWeight: 600, fontSize: 13.5 }}>Abrir</button>
            </form>
          </Card>
        )}

        {loading ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>Cargando…</Card>
        ) : active.length === 0 ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>No hay botellas abiertas. Abre una para empezar.</Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {active.map((b) => {
              const pct = b.pct_remaining
              const color = volColor(pct)
              const empty = b.status === 'EMPTY'
              return (
                <Card key={b.id} pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: empty ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 14.5, color: N.ink, lineHeight: 1.25 }}>{b.name}</strong>
                    <span style={{ fontSize: 12, fontFamily: ATLAS_MONO, fontWeight: 700, color }}>{Math.round(pct)}%</span>
                  </div>
                  {/* barra de volumen */}
                  <div style={{ height: 10, borderRadius: 999, background: N.chip, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 11.5, fontFamily: ATLAS_MONO, color: N.muted }}>
                    {Math.round(Number(b.remaining_ml))} / {Math.round(Number(b.full_volume_ml))} ml · servida {Math.round(Number(b.pour_size_ml))} ml
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button disabled={busy === b.id || empty} onClick={() => act(b.id, () => barApi.pour(b.id, {}))}
                      style={{ ...btn, background: ACCENT, color: '#fff', opacity: empty ? 0.5 : 1 }}>Servir</button>
                    <button disabled={busy === b.id} onClick={() => {
                      const ml = Number(prompt('Merma (ml):', '30'))
                      if (ml > 0) act(b.id, () => barApi.waste(b.id, { ml }))
                    }} style={{ ...btn, background: N.chip, color: N.body }}>Merma</button>
                    <button disabled={busy === b.id} onClick={() => {
                      const ml = Number(prompt('Restante real (ml):', String(Math.round(Number(b.remaining_ml)))))
                      if (ml >= 0) act(b.id, () => barApi.refill(b.id, ml))
                    }} style={{ ...btn, background: N.chip, color: N.body }} title="Ajustar por conteo">Ajustar</button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 5, padding: '9px 11px', fontSize: 14,
  border: `1px solid ${N.line}`, borderRadius: 10, background: '#fff', color: N.ink, fontFamily: ATLAS_FONT,
}
const btn: React.CSSProperties = {
  flex: 1, border: 'none', cursor: 'pointer', padding: '8px 0', borderRadius: 9, fontWeight: 600, fontSize: 13, fontFamily: ATLAS_FONT,
}
