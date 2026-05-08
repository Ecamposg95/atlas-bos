# POS Cajero — Task Pack Implementation Plan

**Goal:** Aplicar el task pack completo de UX/UI del POS para cajeras: fix bug de sobrepago, reforzar contraste en tema blanco, agrandar ticket/carrito, rediseñar cards de producto, modal de cobro más grande, sort por más vendidos, CRUD de producto en modal (vista + edición) reutilizable entre card y header, y reubicar devoluciones al header.

**Architecture:**
- **Backend:** relajar guard de sobrepago en `app/routers/sales.py`; añadir `order_by=best_sellers` a `/api/products/pos/search` calculando ranking vía agregación de `SaleLine` (últimos 30 días).
- **Frontend:** cambios aislados en `frontend/src/pages/pos/POS.tsx`, `frontend/src/components/pos/ProductSearch.tsx`, `frontend/src/components/pos/CartPanel.tsx`, `frontend/src/components/pos/modals/CashPaymentModal.tsx`, y nuevo `frontend/src/components/pos/modals/ProductEditModal.tsx` (view/edit/create en un solo componente, gated por rol).
- **Tokens de tema blanco:** override `--dax-bg: #F5F5F5`, `--dax-card: #FFFFFF`, borders más opacos en `frontend/src/index.css`.

**Tech Stack:** FastAPI 0.127 + SQLAlchemy 2.0 / React 18 + TS + Tailwind + Zustand.

**PR strategy:** 1 PR contra `release/qa` (respetando branching strategy). Rama actual `feat/print-agent-wizard-and-mgmt` — crear commits en orden del plan.

**Verificación:** cada commit dejará `npm run build` y `python -m py_compile app/routers/sales.py` pasando. Test manual del flujo completo al final en dev server.

---

## File Structure

**Modificar:**
- `app/routers/sales.py:386-395` — guard de sobrepago (BUG-01)
- `app/routers/products.py` (pos_search endpoint ~L1492) — añadir `order_by` param
- `frontend/src/index.css:22-40` — tokens del tema blanco con más contraste
- `frontend/src/pages/pos/POS.tsx` — header con botones `+ Producto` y `Devoluciones`; quitar `onReturn` de CartPanel
- `frontend/src/components/pos/ProductSearch.tsx` — selector de sort; cards con precio grande + botón detalles visible; abrir `ProductEditModal` desde detalles
- `frontend/src/components/pos/CartPanel.tsx` — aumentar tamaños, quitar prop `onReturn`/botón devolución, ampliar qty input
- `frontend/src/components/pos/modals/CashPaymentModal.tsx` — modal ancho (≥520px), tipografía XL, botones denominación cuadrícula
- `frontend/src/api/products.ts` — extender `posSearch` con param `order_by`

**Crear:**
- `frontend/src/components/pos/modals/ProductEditModal.tsx` — modal unificado con modos `view | edit | create`

**No tocar:** templates Jinja legacy, admin routes.

---

## Task 1: BUG-01 — Relajar guard de sobrepago (backend)

**Files:** Modify `app/routers/sales.py:386-395`

- [ ] **Step 1:** Leer el bloque actual para confirmar formato.

- [ ] **Step 2:** Reemplazar la validación por umbral dinámico con piso de $500 MXN.

```python
    # --- 2. Análisis Financiero ---
    total_paid = sum(Decimal(str(p.amount)) for p in sale_in.payments)

    # --- Guard 1: Overpayment sanity check ---
    # Ventas pequeñas (p.ej. $80) con billetes altos ($500, $1000) son válidas.
    # Solo bloqueamos excedentes realmente anómalos: excedente > max(total, 500) * 2.
    if sale_in.payments:
        excedente = total_paid - total_sale
        umbral = max(total_sale, Decimal("500"))
        if excedente > umbral * Decimal("2"):
            raise HTTPException(
                status_code=400,
                detail=f"El excedente ({float(excedente):.2f}) es anómalo respecto al total ({float(total_sale):.2f}). Verifique los montos."
            )
```

- [ ] **Step 3:** `python -m py_compile app/routers/sales.py` → exit 0.

- [ ] **Step 4:** Commit.

```
git add app/routers/sales.py
git commit -m "fix(pos): relax overpayment guard to allow small sales with high-denom bills"
```

---

## Task 2: VIS-01 — Tokens del tema blanco (fondo off-white, bordes visibles)

**Files:** Modify `frontend/src/index.css:22-40`

- [ ] **Step 1:** Cambiar `--dax-bg` light-mode a `#F5F5F5`, `--dax-card` a `#FFFFFF` opaco, y engrosar borders.

Reemplazar el bloque `:root[data-theme="light"]` (o equivalente ligero) aumentando contraste:
- `--dax-bg: #F5F5F5`
- `--dax-card: #FFFFFF`
- `--dax-surface: #FAFAFA`
- `--dax-border-dim: rgba(30, 27, 75, 0.18)` (antes ~0.08)
- `--dax-border: rgba(30, 27, 75, 0.28)`
- `--dax-text-muted: #475569` (slate-600, era más claro)
- `--dax-text-faint: #64748b` (slate-500)

Añadir al final de `.dax-card`: `border-width: 1px;` si no está, para que el border sea visible siempre, no solo sombra.

- [ ] **Step 2:** `cd frontend && npm run build` → ok.

- [ ] **Step 3:** Commit.

```
git add frontend/src/index.css
git commit -m "feat(pos): stronger contrast on white theme (off-white bg, opaque cards, visible borders)"
```

---

## Task 3: TICKET-01/03 — Carrito con tipografía y controles más grandes

**Files:** Modify `frontend/src/components/pos/CartPanel.tsx`

- [ ] **Step 1:** Agrandar el nombre del producto en cart line (`text-sm` → `text-base`, min 15px), precio por línea `font-bold text-base`, filas con más `py-4`, SKU `text-xs`, total piezas `text-sm font-semibold`.

En el `QtyRow`:
- Input de qty: `w-10` → `w-20`, `text-base` → `text-xl`, `py-2`.
- Span display del qty: mismo `w-20`, `text-xl`.
- Botones ±: `w-7 h-7` → `w-11 h-11` (44px táctil), iconos `text-sm`.

En el footer del panel, asegurar que el **Total general** sea el elemento más grande: `text-3xl font-black`, siempre visible fuera del scroll (ya vive en `px-3 pb-3 space-y-2`).

- [ ] **Step 2:** Verificar overflow con `npm run build`.

- [ ] **Step 3:** Commit.

```
git add frontend/src/components/pos/CartPanel.tsx
git commit -m "feat(pos): larger cart typography + wider qty input (touch-friendly)"
```

---

## Task 4: TICKET-02 + HEADER-02 — Mover "Devoluciones" al header

**Files:** Modify `frontend/src/components/pos/CartPanel.tsx`, `frontend/src/pages/pos/POS.tsx`

- [ ] **Step 1:** En `CartPanel.tsx` eliminar el botón "Devolución" de las líneas 748-753. Quitar la prop `onReturn` de la interface y todas sus usages internas. Mantener la prop en firma sólo si otro archivo depende de ella — si nada la usa tras el borrado, eliminarla.

- [ ] **Step 2:** En `POS.tsx`, dentro del header (bloque `Session bar`, ~L277-309), añadir un botón `Devoluciones` agrupado junto a `Entrada`/`Salida` (mismo estilo ghost, ícono `fa-undo`).

```tsx
<button
  onClick={() => setReturnModal(true)}
  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
  title="Devoluciones"
>
  <i className="fa-solid fa-undo text-[10px]" /> Devoluciones
</button>
```

- [ ] **Step 3:** En `POS.tsx` quitar `onReturn={() => setReturnModal(true)}` del JSX de `<CartPanel>`.

- [ ] **Step 4:** `npm run build` ok.

- [ ] **Step 5:** Commit.

```
git add frontend/src/components/pos/CartPanel.tsx frontend/src/pages/pos/POS.tsx
git commit -m "feat(pos): move Devoluciones from cart to header group (next to Entrada/Salida)"
```

---

## Task 5: PROD-02/03 — Cards con énfasis en precio + botón detalles grande

**Files:** Modify `frontend/src/components/pos/ProductSearch.tsx`

- [ ] **Step 1:** En la card (lines 155-213):
  - Precio pasa de `text-sm` a `text-xl font-black text-emerald-600` (en light theme mejor `text-emerald-700`) — elemento más visible.
  - Nombre: `text-sm font-bold leading-snug` (antes xs font-semibold).
  - SKU: `text-[11px] font-mono`.
  - Badge "Variantes" si `p.prices?.length > 1`: `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Variantes</span>`.
  - Stock: sin cambios de tamaño pero asegurar colores con contraste AA.

- [ ] **Step 2:** Reemplazar el botón info pequeño (hover-only) por un botón visible fijo debajo del CTA principal:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); setDetailProduct(p) }}
  className="w-full mt-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
  style={{ borderColor: 'var(--dax-border)', color: 'var(--dax-text-muted)' }}
>
  <i className="fa-solid fa-circle-info mr-1" /> Ver detalles
</button>
```

Eliminar el botón absoluto-hover (`group-hover/card:opacity-100`) que estaba en top-right.

- [ ] **Step 3:** `npm run build` ok.

- [ ] **Step 4:** Commit.

```
git add frontend/src/components/pos/ProductSearch.tsx
git commit -m "feat(pos): product cards emphasize price, add visible 'Ver detalles' button, variants badge"
```

---

## Task 6: MODAL-01 — Modal de cobro en efectivo más grande

**Files:** Modify `frontend/src/components/pos/modals/CashPaymentModal.tsx`

- [ ] **Step 1:** Cambiar contenedor `max-w-sm` → `max-w-[560px]`. Agrandar título y total:
  - `h3` pasa a `text-xl`.
  - "Total" debajo pasa a `text-3xl font-black text-emerald-600` en su propio bloque centrado.
  - Input de monto recibido: `text-4xl font-black text-center py-3`.
  - Bloque de Cambio: `text-4xl font-black`, padding `p-4`, border 2px.

- [ ] **Step 2:** Añadir fila superior de denominaciones rápidas $50/$100/$200/$500/$1000 (ya existe `BILLS` con `[1000, 500, 200, 100, 50, 20]`, añadir un grid de 5 columnas más grande al principio antes del grid pequeño actual de 3 cols). Las piezas actuales (billetes/monedas grid) se mantienen pero debajo.

Nuevo bloque arriba de la sección "Billetes":
```tsx
<div className="mb-3">
  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--dax-text-muted)' }}>Pago rápido</p>
  <div className="grid grid-cols-5 gap-1.5">
    {[50,100,200,500,1000].map(d => (
      <button key={d} onClick={() => addDenomination(d)}
        className="py-3 rounded-xl text-sm font-black border-2 transition-colors active:scale-95 hover:bg-emerald-50"
        style={{ borderColor: 'var(--dax-border)', color: 'var(--dax-text)' }}>
        ${d}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3:** Botón "Cobrar": `min-h-[52px]`, ancho completo ya está (flex-1 en flex-2). Forzar `py-4 text-base font-black`.

- [ ] **Step 4:** `npm run build` ok.

- [ ] **Step 5:** Commit.

```
git add frontend/src/components/pos/modals/CashPaymentModal.tsx
git commit -m "feat(pos): bigger cash payment modal (560px, XL typography, quick-denom row, 52px CTA)"
```

---

## Task 7: PROD-01 — Sort "Más vendidos / A-Z / Precio" (backend + frontend)

**Files:** Modify `app/routers/products.py` (posSearch endpoint), `frontend/src/api/products.ts`, `frontend/src/components/pos/ProductSearch.tsx`

- [ ] **Step 1:** En `app/routers/products.py`, en el endpoint `GET /products/pos/search`, aceptar `order_by: Literal["best_sellers","name_asc","price_asc","price_desc"] = "best_sellers"` y `days: int = 30`.

Lógica:
- `best_sellers`: subquery sobre `SaleLine` sumando `quantity` últimos `days` días, `LEFT JOIN` sobre products, `ORDER BY coalesce(sum_qty,0) DESC, name`.
- `name_asc`: `ORDER BY Product.name ASC`.
- `price_asc` / `price_desc`: por `price`.

Mantener el filtro actual por `search`, `organization_id`, `branch_id` (PBS) y el `.limit(20)`.

- [ ] **Step 2:** `python -m py_compile app/routers/products.py` → ok.

- [ ] **Step 3:** En `frontend/src/api/products.ts`, extender `posSearch(q, order_by?)`:
```ts
async posSearch(q: string, order_by: 'best_sellers'|'name_asc'|'price_asc'|'price_desc' = 'best_sellers'): Promise<Product[]> {
  const { data } = await api.get('/products/pos/search', { params: { q, order_by } })
  return data
}
```

- [ ] **Step 4:** En `ProductSearch.tsx`, añadir state `sortBy` con default leído de `localStorage.getItem('pos.sortBy') || 'best_sellers'`. Renderizar un `<select>` en el header del panel (junto al search input) con las opciones. `useEffect` persiste en localStorage y re-ejecuta `posSearch`.

- [ ] **Step 5:** `npm run build` ok.

- [ ] **Step 6:** Commit.

```
git add app/routers/products.py frontend/src/api/products.ts frontend/src/components/pos/ProductSearch.tsx
git commit -m "feat(pos): sort products by best-sellers/name/price (backend ranking + localStorage pref)"
```

---

## Task 8: PROD-04 + HEADER-01 — ProductEditModal (view/edit/create) reutilizable

**Files:** Create `frontend/src/components/pos/modals/ProductEditModal.tsx`, Modify `frontend/src/components/pos/ProductSearch.tsx` (integrar), `frontend/src/pages/pos/POS.tsx` (botón `+ Producto`)

El `ProductDetailModal` existente se mantiene como vista read-only rápida. El nuevo modal es el CRUD completo — se invoca desde un botón "Editar producto" dentro del detail modal (gated por rol) y desde `+ Producto` en header (modo create).

- [ ] **Step 1:** Crear `frontend/src/components/pos/modals/ProductEditModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { productsApi } from '../../../api/products'
import type { Product } from '../../../types/products'
import { useAuthStore } from '../../../store/authStore'

type Mode = 'create' | 'edit'
interface Props {
  mode: Mode
  product?: Product | null
  onClose: () => void
  onSaved: (p: Product) => void
}

const EDIT_ROLES = ['ADMINISTRADOR', 'DUEÑO', 'GERENTE']

export function ProductEditModal({ mode, product, onClose, onSaved }: Props) {
  const { user } = useAuthStore()
  const canEdit = !!user?.role && EDIT_ROLES.includes(user.role)
  const [name, setName]           = useState(product?.name ?? '')
  const [price, setPrice]         = useState(String(product?.price ?? ''))
  const [sku, setSku]             = useState(product?.sku ?? '')
  const [description, setDesc]    = useState(product?.description ?? '')
  const [stock, setStock]         = useState(String(product?.stock_total ?? product?.stock ?? 0))
  const [imageUrl, setImageUrl]   = useState(product?.image_url ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setName(product.name); setPrice(String(product.price)); setSku(product.sku ?? '')
      setDesc(product.description ?? ''); setStock(String(product.stock_total ?? product.stock ?? 0))
      setImageUrl(product.image_url ?? '')
    }
  }, [product])

  if (!canEdit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
           style={{ background: 'var(--dax-modal-backdrop)' }} onClick={onClose}>
        <div className="dax-card p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <i className="fa-solid fa-lock text-3xl text-slate-400 mb-3 block" />
          <p className="text-sm font-semibold">No tienes permiso para editar productos.</p>
          <button className="dax-btn-secondary mt-4" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    setError(null)
    const priceNum = Number(price)
    if (!name.trim()) { setError('Nombre requerido'); return }
    if (!(priceNum > 0)) { setError('Precio debe ser > 0'); return }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), price: priceNum, sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        stock_total: Number(stock) || 0,
      }
      const saved = mode === 'create'
        ? await productsApi.create(payload as any)
        : await productsApi.update(product!.id, payload as any)
      onSaved(saved as Product)
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
         style={{ background: 'var(--dax-modal-backdrop)' }} onClick={onClose}>
      <div className="dax-card p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black mb-4">{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h3>
        <div className="space-y-3">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wider">Nombre</span>
            <input className="dax-input w-full mt-1" value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-bold uppercase tracking-wider">Precio</span>
              <input type="number" min="0" step="0.01" className="dax-input w-full mt-1" value={price} onChange={e => setPrice(e.target.value)} /></label>
            <label className="block"><span className="text-xs font-bold uppercase tracking-wider">SKU</span>
              <input className="dax-input w-full mt-1" value={sku} onChange={e => setSku(e.target.value)} /></label>
          </div>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wider">Stock</span>
            <input type="number" min="0" step="1" className="dax-input w-full mt-1" value={stock} onChange={e => setStock(e.target.value)} /></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wider">Imagen (URL)</span>
            <input className="dax-input w-full mt-1" value={imageUrl} onChange={e => setImageUrl(e.target.value)} /></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wider">Descripción</span>
            <textarea className="dax-input w-full mt-1" rows={3} value={description} onChange={e => setDesc(e.target.value)} /></label>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <div className="flex gap-2 pt-4">
          <button className="dax-btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="dax-btn-primary flex-1 justify-center" onClick={submit} disabled={saving}>
            {saving ? <i className="fa-solid fa-spinner fa-spin" /> : (mode === 'create' ? 'Crear' : 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** En `ProductSearch.tsx`:
  - Importar `ProductEditModal` y `useAuthStore`.
  - Estado: `editProduct: Product | null`, `createMode: boolean`.
  - En `ProductDetailModal` render añadir (si onEdit callback o pass un botón dentro del detail modal flag): **simplificación** → pasar una prop `onEdit` al ProductDetailModal y mostrar botón "Editar producto" solo si `user.role in EDIT_ROLES`. Opens ProductEditModal.

- [ ] **Step 3:** Modificar `ProductDetailModal.tsx` para aceptar prop opcional `onEdit?: () => void` y renderizar botón "Editar" junto a "Cerrar"/"Agregar" sólo si `onEdit` está presente.

- [ ] **Step 4:** En `POS.tsx` añadir al header (junto a Devoluciones) un botón `+ Producto` gated por rol:

```tsx
{user?.role && ['ADMINISTRADOR','DUEÑO','GERENTE'].includes(user.role) && (
  <button onClick={() => setCreateProductOpen(true)}
          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
    <i className="fa-solid fa-plus text-[10px]" /> Producto
  </button>
)}
```

Y al final del return, renderizar `{createProductOpen && <ProductEditModal mode="create" onClose={...} onSaved={() => { setCreateProductOpen(false); /* refresh pos search */ }} />}`.

- [ ] **Step 5:** Refrescar la grilla del POS tras create/edit: exponer un `refresh()` en `ProductSearch` vía `forwardRef` o mover state al POS. **Alternativa simple:** usar un `key` forzado — pasar `refreshKey` state desde POS a ProductSearch como prop; cada save increments key → ProductSearch reejecuta su `useEffect` de carga inicial. Implementar esta alternativa.

- [ ] **Step 6:** `npm run build` → ok.

- [ ] **Step 7:** Commit.

```
git add frontend/src/components/pos/modals/ProductEditModal.tsx \
        frontend/src/components/pos/modals/ProductDetailModal.tsx \
        frontend/src/components/pos/ProductSearch.tsx \
        frontend/src/pages/pos/POS.tsx
git commit -m "feat(pos): unified ProductEditModal (view/edit/create) + header '+Producto' gated by role"
```

---

## Task 9: Verificación final manual

- [ ] **Step 1:** Arrancar backend: `uvicorn app.main:app --reload`.

- [ ] **Step 2:** Arrancar frontend: `cd frontend && npm run dev`.

- [ ] **Step 3:** Login como CAJERO. Verificar:
  - POS abre; cards tienen precio grande, botón "Ver detalles" visible, badge Variantes cuando aplica.
  - Sort por "Más vendidos" default; cambiar a A-Z persiste tras recarga.
  - Carrito: fuentes legibles, qty input ancho de 4 dígitos, total general grande.
  - Botón Devolución vive en header, no en carrito.
  - Modal de cobro: ancho ~560px, botones denominación rápida $50-$1000 visibles, botón Cobrar grande.
  - Cajera NO ve botón `+ Producto` ni "Editar producto" en detail modal.
  - Venta pequeña ($80) pagada con $700 NO lanza error.

- [ ] **Step 4:** Login como GERENTE/ADMIN. Verificar:
  - `+ Producto` visible en header; abre modal create.
  - "Editar producto" aparece en detail modal; guarda y refresca grilla.

- [ ] **Step 5:** Si todo ok → push branch y abrir PR contra `release/qa`.

```
git push -u origin feat/print-agent-wizard-and-mgmt
gh pr create --base release/qa --title "feat(pos): cashier UX pack — contrast, pricing emphasis, modal CRUD, overpayment fix" --body "$(cat docs/superpowers/plans/2026-04-21-pos-cajero-pack.md | head -40)"
```

---

## Execution notes

- No usar TDD — el repo no tiene tests unitarios para frontend y la suite backend es integración manual. Verificación = `npm run build` + `py_compile` + test manual Task 9.
- Commits en orden del plan → un solo PR.
- Si `npm run build` falla por tipos en `Product` (p.ej. campos opcionales `stock_total` vs `stock`), normalizar con `??` y castings estrechos, no relajar tipos globalmente.
- Respetar merge freeze sólo si se ataca `release/beta` o `release/production`; PR contra `release/qa` es libre.
