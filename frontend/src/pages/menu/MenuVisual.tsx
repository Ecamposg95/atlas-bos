import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { productsApi } from '../../api/products'
import type { Product } from '../../types/products'
import { Card, N, ATLAS_MONO, ATLAS_FONT } from '../../components/atlas-one'

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0)

const ACCENT = '#8b4a2b' // café/gastro

export function MenuVisual() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [cat, setCat] = useState<string>('__all__')

  useEffect(() => {
    let alive = true
    setLoading(true)
    productsApi.list({ limit: 300, is_active: true })
      .then((r) => { if (alive) setProducts(r.items) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => set.add(p.department_name || p.department?.name || 'Sin categoría'))
    return Array.from(set).sort()
  }, [products])

  const visible = useMemo(() => {
    if (cat === '__all__') return products
    return products.filter((p) => (p.department_name || p.department?.name || 'Sin categoría') === cat)
  }, [products, cat])

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>()
    visible.forEach((p) => {
      const k = p.department_name || p.department?.name || 'Sin categoría'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(p)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [visible])

  return (
    <div style={{ background: N.page, minHeight: '100%', fontFamily: ATLAS_FONT }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '2rem 1.75rem 3rem' }}>
        <header style={{ marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Gastro · Menú</p>
          <h1 style={{ margin: '6px 0 4px', fontSize: '1.7rem', fontWeight: 600, color: N.ink, letterSpacing: -0.6 }}>Menú visual</h1>
          <p style={{ margin: 0, color: N.muted, fontSize: 14 }}>El catálogo del negocio, listo para la barra. {products.length} productos.</p>
        </header>

        {/* Categorías */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['__all__', ...categories].map((c) => (
            <button key={c} onClick={() => setCat(c)}
              style={{
                border: `1px solid ${cat === c ? ACCENT : N.line}`, cursor: 'pointer',
                padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: ATLAS_FONT,
                background: cat === c ? ACCENT : '#fff', color: cat === c ? '#fff' : N.body,
              }}>
              {c === '__all__' ? 'Todo' : c}
            </button>
          ))}
        </div>

        {failed ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>No se pudo cargar el menú.</Card>
        ) : loading ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>Cargando menú…</Card>
        ) : products.length === 0 ? (
          <Card pad={40} style={{ textAlign: 'center', color: N.faint, fontFamily: ATLAS_MONO, fontSize: 13 }}>
            No hay productos. <Link to="/admin/catalog" style={{ color: ACCENT }}>Agrega productos al catálogo →</Link>
          </Card>
        ) : (
          grouped.map(([category, items]) => (
            <section key={category} style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 12, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                {category} <span style={{ color: N.faint }}>· {items.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {items.map((p) => (
                  <Card key={p.id} pad={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 96, background: p.image_url ? `center/cover no-repeat url(${p.image_url})` : N.chip, position: 'relative' }}>
                      {!p.image_url && (
                        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: N.faint, fontSize: 22 }}>
                          <i className="fa-solid fa-utensils" />
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: N.ink, lineHeight: 1.25 }}>{p.name}</span>
                      <span style={{ marginTop: 'auto', fontSize: 15, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{money(p.price)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
