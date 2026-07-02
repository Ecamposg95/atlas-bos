# Gastro — Mesas premium + Vista móvil de comandas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar Mesas (plano) con cards premium + KPIs y agregar una vista móvil donde el mesero (rol VENDEDOR) levanta comandas y las envía a cocina (KDS), sincronizando la cuenta de la mesa.

**Architecture:** El backend ya soporta mesas (open/free/assign-server), cocina (fire a KDS) y parked tickets (la cuenta de la mesa). El único faltante backend es `PATCH /sales/parked/{id}` para acumular ítems en la cuenta. En frontend se rediseña `FloorPlan.tsx` (desktop/tablet) y se agregan dos pantallas móviles bajo `/mobile/comanda`. El menú de la comanda usa el catálogo de productos existente.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic (backend, pytest). React 18 + TypeScript + Vite + Tailwind + Zustand (frontend). Playwright para verificación visual.

## Global Constraints

- **NUNCA tocar `main`.** Todo el trabajo va en la rama `staging`. Nada de PRs/deploys a main.
- Copy de UI en **español**.
- Reusar componentes existentes: `Button` (`variant`/`size`/`icon`/`loading`), `DaxCard`, `Spinner` de `frontend/src/components/ui/`.
- Estética dark existente: clases `dax-card`, `dax-btn-primary/secondary/danger`, tokens `text-slate-*`, acentos por estado. Tipografía IBM Plex (global).
- Rol que levanta comandas: **`VENDEDOR`** (mapea a "mesero").
- Todos los endpoints backend van con prefijo `/api` (los routers ya lo montan).
- Los parked tickets requieren `current_user.branch_id`; scoping siempre por `organization_id` + `branch_id`.
- Shape de ítem del carrito (`cart_json.items[]`), consistente entre POS, comanda y cuenta:
  `{ product_id, sku, name, price, quantity, discount, subtotal }`.

---

## File Structure

**Backend:**
- `app/schemas/sales.py` — agregar `ParkedTicketUpdate`.
- `app/routers/sales.py` — agregar endpoint `PATCH /parked/{parked_id}`.
- `tests/test_parked_update.py` — nuevo test del endpoint.

**Frontend — API:**
- `frontend/src/api/sales.ts` — agregar `parkedTicketsApi.update`.

**Frontend — Mesas premium:**
- `frontend/src/pages/tables/FloorPlan.tsx` — rediseño completo.
- `frontend/src/pages/tables/tableUtils.ts` — helpers (total de cuenta, minutos abierta).
- `frontend/src/components/tables/TableFormModal.tsx` — modal crear área/mesa.

**Frontend — Comanda móvil:**
- `frontend/src/pages/mobile/ComandaTables.tsx` — pantalla "Mis mesas".
- `frontend/src/pages/mobile/ComandaOrder.tsx` — pantalla de comanda por mesa.
- `frontend/src/api/comanda.ts` — helpers `toFireItem` / `toCartItem`.
- `frontend/src/App.tsx` — registrar rutas `/mobile/comanda` y `/mobile/comanda/:tableId`.
- `frontend/src/pages/mobile/MobileDashboard.tsx` — agregar acceso "Comanda".

---

## Task 1: Backend — `PATCH /sales/parked/{id}` para actualizar la cuenta

**Files:**
- Modify: `app/schemas/sales.py` (agregar `ParkedTicketUpdate` tras `ParkedTicketCreate`, ~línea 122)
- Modify: `app/routers/sales.py` (import línea 838; endpoint nuevo tras `resume_parked_ticket`, ~línea 947)
- Test: `tests/test_parked_update.py`

**Interfaces:**
- Consumes: modelo `ParkedTicket`, `_parked_to_read`, `get_current_active_organization` (ya presentes en `app/routers/sales.py`).
- Produces: `PATCH /api/sales/parked/{parked_id}` con body `{ cart_json: dict, notes?: str }` → `ParkedTicketRead`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_parked_update.py
"""PATCH /sales/parked/{id} — acumular ítems en la cuenta de una mesa."""


def _park(client, headers):
    r = client.post(
        "/api/sales/parked",
        json={"cart_json": {"items": [{"name": "Taco", "quantity": 1}]}},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_update_parked_replaces_cart(client, auth_cajero_a):
    pid = _park(client, auth_cajero_a)
    new_cart = {"items": [
        {"name": "Taco", "quantity": 1},
        {"name": "Agua", "quantity": 2},
    ]}
    r = client.patch(f"/api/sales/parked/{pid}", json={"cart_json": new_cart}, headers=auth_cajero_a)
    assert r.status_code == 200, r.text
    assert len(r.json()["cart_json"]["items"]) == 2


def test_update_parked_empty_cart_rejected(client, auth_cajero_a):
    pid = _park(client, auth_cajero_a)
    r = client.patch(f"/api/sales/parked/{pid}", json={"cart_json": {}}, headers=auth_cajero_a)
    assert r.status_code == 422


def test_update_parked_not_found(client, auth_cajero_a):
    r = client.patch(
        "/api/sales/parked/does-not-exist",
        json={"cart_json": {"items": [{"name": "X"}]}},
        headers=auth_cajero_a,
    )
    assert r.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_parked_update.py -v`
Expected: FAIL (405 Method Not Allowed o 404 de ruta — el endpoint aún no existe).

- [ ] **Step 3: Add the schema**

En `app/schemas/sales.py`, justo después de `class ParkedTicketCreate(BaseModel):` (que termina en `expires_in_hours: Optional[int] = 24`):

```python
class ParkedTicketUpdate(BaseModel):
    """Reemplaza el cart_json de una cuenta abierta (mesa). El merge de
    'ítems existentes + comanda nueva' lo hace el cliente antes de mandar."""
    cart_json: dict
    notes: Optional[str] = None
```

- [ ] **Step 4: Add the endpoint**

En `app/routers/sales.py`, cambiar el import de la línea 838 a:

```python
from app.schemas.sales import ParkedTicketCreate, ParkedTicketRead, ParkedTicketUpdate
```

Y agregar el endpoint justo después de `resume_parked_ticket` (antes de `delete_parked_ticket`):

```python
@router.patch("/parked/{parked_id}", response_model=ParkedTicketRead)
def update_parked_ticket(
    parked_id: str,
    payload: ParkedTicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """Actualiza el carrito de una cuenta abierta (usado por la comanda para
    acumular platillos enviados a cocina). No consume folio ni descuenta stock."""
    if not payload.cart_json:
        raise HTTPException(status_code=422, detail="cart_json no puede estar vacío.")
    pt = db.query(ParkedTicket).filter(
        ParkedTicket.id == parked_id,
        ParkedTicket.organization_id == org_id,
        ParkedTicket.branch_id == current_user.branch_id,
        ParkedTicket.deleted_at == None,
    ).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Ticket pausado no encontrado.")
    pt_status = getattr(pt, 'status', None) or 'ACTIVE'
    if pt_status != 'ACTIVE':
        raise HTTPException(
            status_code=410,
            detail=f"Ticket pausado en estado {pt_status}; no se puede modificar."
        )
    pt.cart_json = payload.cart_json
    if payload.notes is not None:
        pt.notes = payload.notes
    db.commit()
    db.refresh(pt)
    return _parked_to_read(pt)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_parked_update.py -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add app/schemas/sales.py app/routers/sales.py tests/test_parked_update.py
git commit -m "feat(sales): PATCH /parked/{id} para acumular comandas en la cuenta"
```

---

## Task 2: Frontend API — `parkedTicketsApi.update`

**Files:**
- Modify: `frontend/src/api/sales.ts` (dentro de `parkedTicketsApi`, tras `resume`, ~línea 115)

**Interfaces:**
- Consumes: `client` (axios), tipo `ParkedTicket`.
- Produces: `parkedTicketsApi.update(id: string, cartJson: Record<string, unknown>, notes?: string): Promise<ParkedTicket>`.

- [ ] **Step 1: Add the method**

En `frontend/src/api/sales.ts`, dentro del objeto `parkedTicketsApi`, después de `resume`:

```typescript
  update: async (
    id: string,
    cartJson: Record<string, unknown>,
    notes?: string,
  ): Promise<ParkedTicket> => {
    const { data } = await client.patch<ParkedTicket>(`/sales/parked/${id}`, {
      cart_json: cartJson,
      notes: notes ?? null,
    })
    return data
  },
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos en `src/api/sales.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/sales.ts
git commit -m "feat(api): parkedTicketsApi.update — PATCH cart de la cuenta"
```

---

## Task 3: Frontend — helpers de mesa (`tableUtils.ts`)

**Files:**
- Create: `frontend/src/pages/tables/tableUtils.ts`

**Interfaces:**
- Consumes: tipos `DiningTable`, `CartItem` (via `cart_json`).
- Produces:
  - `ticketTotal(cartJson: unknown): number` — suma de subtotales de `items`.
  - `minutesOpen(openedAt: string | null, now: number): number` — minutos desde apertura.
  - `cartItemCount(cartJson: unknown): number` — # de ítems.

- [ ] **Step 1: Create the helpers**

```typescript
// frontend/src/pages/tables/tableUtils.ts

interface RawCartItem {
  quantity?: number
  price?: number
  subtotal?: number
}

function items(cartJson: unknown): RawCartItem[] {
  if (cartJson && typeof cartJson === 'object' && Array.isArray((cartJson as any).items)) {
    return (cartJson as any).items as RawCartItem[]
  }
  return []
}

/** Suma de subtotales de la cuenta. Usa `subtotal` si viene; si no, price*qty. */
export function ticketTotal(cartJson: unknown): number {
  return items(cartJson).reduce((sum, it) => {
    const line = it.subtotal ?? (it.price ?? 0) * (it.quantity ?? 0)
    return sum + (Number.isFinite(line) ? line : 0)
  }, 0)
}

/** Minutos que la mesa lleva abierta. `now` en ms (Date.now()). */
export function minutesOpen(openedAt: string | null, now: number): number {
  if (!openedAt) return 0
  const start = new Date(openedAt).getTime()
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((now - start) / 60000))
}

/** Número de ítems en la cuenta. */
export function cartItemCount(cartJson: unknown): number {
  return items(cartJson).reduce((n, it) => n + (it.quantity ?? 1), 0)
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores en `tableUtils.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tables/tableUtils.ts
git commit -m "feat(tables): helpers de total de cuenta y tiempo abierto"
```

---

## Task 4: Frontend — modal de creación de área/mesa

**Files:**
- Create: `frontend/src/components/tables/TableFormModal.tsx`

**Interfaces:**
- Consumes: `Button` de `components/ui/Button`.
- Produces: componente `<TableFormModal open onClose onSubmitArea onSubmitTable mode areaId />`.
  - Props:
    ```typescript
    interface Props {
      open: boolean
      mode: 'area' | 'table'
      onClose: () => void
      onSubmitArea: (name: string) => Promise<void>
      onSubmitTable: (code: string, seats: number) => Promise<void>
    }
    ```

- [ ] **Step 1: Create the modal**

```tsx
// frontend/src/components/tables/TableFormModal.tsx
import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'

interface Props {
  open: boolean
  mode: 'area' | 'table'
  onClose: () => void
  onSubmitArea: (name: string) => Promise<void>
  onSubmitTable: (code: string, seats: number) => Promise<void>
}

export function TableFormModal({ open, mode, onClose, onSubmitArea, onSubmitTable }: Props) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [seats, setSeats] = useState(4)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setCode(''); setSeats(4) }
  }, [open, mode])

  if (!open) return null

  const submit = async () => {
    setBusy(true)
    try {
      if (mode === 'area') { if (!name.trim()) return; await onSubmitArea(name.trim()) }
      else { if (!code.trim()) return; await onSubmitTable(code.trim(), seats) }
      onClose()
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
         onClick={onClose}>
      <div className="dax-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-white mb-4">
          {mode === 'area' ? 'Nueva área' : 'Nueva mesa'}
        </h3>
        {mode === 'area' ? (
          <label className="block text-sm text-slate-300 mb-4">
            Nombre del área
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Salón, Terraza, Barra…"
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
          </label>
        ) : (
          <>
            <label className="block text-sm text-slate-300 mb-3">
              Código de la mesa
              <input autoFocus value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="M1, T4, Barra-2…"
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-slate-300 mb-4">
              Asientos
              <input type="number" min={1} value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white" />
            </label>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={submit}>Crear</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores en `TableFormModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tables/TableFormModal.tsx
git commit -m "feat(tables): modal de creación de área/mesa (reemplaza window.prompt)"
```

---

## Task 5: Frontend — `FloorPlan.tsx` premium (cards + KPIs)

**Files:**
- Modify (rewrite): `frontend/src/pages/tables/FloorPlan.tsx`

**Interfaces:**
- Consumes: `tablesApi`, `parkedTicketsApi.get`, `kitchenApi.feed`, `ticketTotal`/`minutesOpen`/`cartItemCount`, `TableFormModal`.
- Produces: pantalla `/tables` rediseñada.

- [ ] **Step 1: Rewrite the component**

```tsx
// frontend/src/pages/tables/FloorPlan.tsx
import { useCallback, useEffect, useState } from 'react'
import { tablesApi } from '../../api/tables'
import { parkedTicketsApi } from '../../api/sales'
import { kitchenApi } from '../../api/kitchen'
import { Button } from '../../components/ui/Button'
import { DaxCard } from '../../components/ui/DaxCard'
import { Spinner } from '../../components/ui/Spinner'
import { TableFormModal } from '../../components/tables/TableFormModal'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { formatCurrency } from '../../utils/currency'
import { ticketTotal, minutesOpen, cartItemCount } from './tableUtils'
import type { DiningArea, DiningTable, TableStatus } from '../../types/tables'

const STATUS_STYLE: Record<TableStatus, { label: string; ring: string; dot: string; text: string }> = {
  AVAILABLE:      { label: 'Libre',        ring: 'border-emerald-500/40 bg-emerald-500/5',  dot: 'bg-emerald-400', text: 'text-emerald-300' },
  OCCUPIED:       { label: 'Ocupada',      ring: 'border-amber-500/50 bg-amber-500/10',     dot: 'bg-amber-400',   text: 'text-amber-300' },
  BILL_REQUESTED: { label: 'Pidió cuenta', ring: 'border-sky-500/50 bg-sky-500/10',         dot: 'bg-sky-400',     text: 'text-sky-300' },
  CLEANING:       { label: 'Limpieza',     ring: 'border-slate-500/40 bg-slate-500/10',     dot: 'bg-slate-400',   text: 'text-slate-300' },
  RESERVED:       { label: 'Reservada',    ring: 'border-violet-500/40 bg-violet-500/10',   dot: 'bg-violet-400',  text: 'text-violet-300' },
}

interface Enriched {
  total: number
  items: number
  kitchenCount: number
}

export function FloorPlan() {
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [areas, setAreas] = useState<DiningArea[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [meta, setMeta] = useState<Record<number, Enriched>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState<null | { mode: 'area' | 'table'; areaId: number | null }>(null)

  // Timer vivo para los minutos abiertos.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, t] = await Promise.all([
        tablesApi.listAreas(branchId),
        tablesApi.listTables(branchId),
      ])
      setAreas(a)
      setTables(t)

      // Enriquecer mesas ocupadas: total de cuenta + comandas en cocina.
      const feed = await kitchenApi.feed({ branch_id: branchId }).catch(() => [])
      const kitchenByTable: Record<number, number> = {}
      for (const tk of feed) {
        if (tk.table_id && ['NEW', 'IN_PROGRESS'].includes(tk.status)) {
          kitchenByTable[tk.table_id] = (kitchenByTable[tk.table_id] ?? 0) + 1
        }
      }
      const enriched: Record<number, Enriched> = {}
      await Promise.all(
        t.filter((x) => x.current_ticket_id).map(async (x) => {
          try {
            const pt = await parkedTicketsApi.get(x.current_ticket_id as string)
            enriched[x.id] = {
              total: ticketTotal(pt.cart_json),
              items: cartItemCount(pt.cart_json),
              kitchenCount: kitchenByTable[x.id] ?? 0,
            }
          } catch {
            enriched[x.id] = { total: 0, items: 0, kitchenCount: kitchenByTable[x.id] ?? 0 }
          }
        }),
      )
      setMeta(enriched)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al cargar el salón')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const requireBranch = (): number | null => {
    if (!branchId) { toast.warning('Tu usuario no tiene sucursal asignada para gestionar mesas.'); return null }
    return branchId
  }

  const handleCreateArea = async (name: string) => {
    const b = requireBranch(); if (!b) return
    try { await tablesApi.createArea({ name, branch_id: b }); toast.success('Área creada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo crear el área') }
  }

  const handleCreateTable = async (code: string, seats: number) => {
    const b = requireBranch(); if (!b) return
    const areaId = modal?.areaId ?? null
    try { await tablesApi.createTable({ code, branch_id: b, area_id: areaId, seats }); toast.success('Mesa creada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo crear la mesa') }
  }

  const act = async (id: number, fn: () => Promise<DiningTable>) => {
    setBusy(id)
    try { await fn(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'Acción no permitida') }
    finally { setBusy(null) }
  }

  const tablesByArea = (areaId: number | null) => tables.filter((t) => t.area_id === areaId)
  const unassigned = tablesByArea(null)

  // KPIs
  const occupied = tables.filter((t) => t.status !== 'AVAILABLE').length
  const free = tables.filter((t) => t.status === 'AVAILABLE').length
  const openSales = Object.values(meta).reduce((s, m) => s + m.total, 0)
  const openTables = tables.filter((t) => t.opened_at)
  const avgMin = openTables.length
    ? Math.round(openTables.reduce((s, t) => s + minutesOpen(t.opened_at, now), 0) / openTables.length)
    : 0

  if (loading) return <Spinner size="lg" text="Cargando salón..." />

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-chair text-amber-400 text-xl" />
          <h1 className="text-2xl font-black text-white">Mesas</h1>
        </div>
        <Button variant="secondary" icon="fa-plus" onClick={() => setModal({ mode: 'area', areaId: null })}>
          Nueva área
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Ocupadas', value: occupied, icon: 'fa-users', tint: 'text-amber-300' },
          { label: 'Libres', value: free, icon: 'fa-circle-check', tint: 'text-emerald-300' },
          { label: 'Cuentas abiertas', value: formatCurrency(openSales), icon: 'fa-receipt', tint: 'text-sky-300' },
          { label: 'Tiempo prom.', value: `${avgMin} min`, icon: 'fa-clock', tint: 'text-violet-300' },
        ].map((k) => (
          <DaxCard key={k.label}>
            <div className="flex items-center gap-3">
              <i className={`fa-solid ${k.icon} ${k.tint} text-lg`} />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{k.label}</p>
                <p className="text-lg font-black text-white">{k.value}</p>
              </div>
            </div>
          </DaxCard>
        ))}
      </div>

      {areas.length === 0 && tables.length === 0 && (
        <DaxCard>
          <p className="text-slate-400">Aún no hay mesas. Crea un área (Salón, Terraza…) y agrega mesas para empezar.</p>
        </DaxCard>
      )}

      {[...areas.map((a) => ({ id: a.id as number | null, name: a.name })),
        ...(unassigned.length ? [{ id: null, name: 'Sin área' }] : [])].map((area) => (
        <DaxCard key={area.id ?? 'none'}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">{area.name}</h2>
            <Button variant="ghost" size="sm" icon="fa-plus"
              onClick={() => setModal({ mode: 'table', areaId: area.id })}>
              Mesa
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tablesByArea(area.id).map((t) => {
              const st = STATUS_STYLE[t.status]
              const m = meta[t.id]
              const mins = minutesOpen(t.opened_at, now)
              return (
                <div key={t.id} className={`rounded-xl border p-3 transition-colors ${st.ring}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-lg">{t.code}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${st.text}`}>
                      <span className={`h-2 w-2 rounded-full ${st.dot}`} /> {st.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                    <span><i className="fa-solid fa-user" /> {t.seats}</span>
                    {t.opened_at && <span><i className="fa-solid fa-clock" /> {mins}m</span>}
                  </div>
                  {t.status !== 'AVAILABLE' && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-black text-white">{formatCurrency(m?.total ?? 0)}</p>
                      {m?.kitchenCount ? (
                        <p className="text-[11px] text-orange-300"><i className="fa-solid fa-fire-burner" /> {m.kitchenCount} en cocina</p>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1">
                    {t.status === 'AVAILABLE' ? (
                      <Button variant="primary" size="sm" loading={busy === t.id}
                        onClick={() => act(t.id, () => tablesApi.open(t.id))}>Abrir</Button>
                    ) : (
                      <Button variant="secondary" size="sm" loading={busy === t.id}
                        onClick={() => act(t.id, () => tablesApi.free(t.id))}>Liberar</Button>
                    )}
                  </div>
                </div>
              )
            })}
            {tablesByArea(area.id).length === 0 && (
              <p className="text-xs text-slate-500 col-span-full">Sin mesas en esta área.</p>
            )}
          </div>
        </DaxCard>
      ))}

      <TableFormModal
        open={!!modal}
        mode={modal?.mode ?? 'area'}
        onClose={() => setModal(null)}
        onSubmitArea={handleCreateArea}
        onSubmitTable={handleCreateTable}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks and builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores. (Verificado: `formatCurrency` existe en `utils/currency`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/tables/FloorPlan.tsx
git commit -m "feat(tables): FloorPlan premium — cards ricas + KPIs + modales"
```

---

## Task 6: Frontend — helpers de comanda (`comanda.ts`)

**Files:**
- Create: `frontend/src/api/comanda.ts`

**Interfaces:**
- Consumes: tipo `Product` (`types/products`), `FireItem` (`api/kitchen`).
- Produces:
  - `toFireItem(p: Product, qty: number): FireItem`
  - `toCartItem(p: Product, qty: number): CartLine`
  - tipo `CartLine = { product_id; sku; name; price; quantity; discount; subtotal }`

- [ ] **Step 1: Create the helpers**

```typescript
// frontend/src/api/comanda.ts
import type { Product } from '../types/products'
import type { FireItem } from './kitchen'

export interface CartLine {
  product_id: string
  sku: string
  name: string
  price: number
  quantity: number
  discount: number
  subtotal: number
}

/** Platillo → ítem de comanda para KDS (description obligatorio). */
export function toFireItem(p: Product, qty: number): FireItem {
  const variantId = p.variants && p.variants.length ? p.variants[0].id : null
  return { description: p.name, qty, variant_id: variantId }
}

/** Platillo → línea de cuenta (cart_json.items) para cobrar luego en POS. */
export function toCartItem(p: Product, qty: number): CartLine {
  return {
    product_id: p.id,
    sku: p.sku,
    name: p.name,
    price: p.price,
    quantity: qty,
    discount: 0,
    subtotal: p.price * qty,
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores. (Nota verificada: `ProductVariant` expone `id` — no `variant_id` — por eso `toFireItem` usa `p.variants[0].id`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/comanda.ts
git commit -m "feat(comanda): helpers platillo→KDS y platillo→cuenta"
```

---

## Task 7: Frontend — pantalla móvil "Mis mesas" (`ComandaTables.tsx`)

**Files:**
- Create: `frontend/src/pages/mobile/ComandaTables.tsx`

**Interfaces:**
- Consumes: `tablesApi`, `useAuthStore`, `useNavigate`, `ticketTotal`, `minutesOpen`.
- Produces: componente exportado `ComandaTables` para la ruta `/mobile/comanda`.

- [ ] **Step 1: Create the screen**

```tsx
// frontend/src/pages/mobile/ComandaTables.tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tablesApi } from '../../api/tables'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { minutesOpen } from '../tables/tableUtils'
import type { DiningTable, TableStatus } from '../../types/tables'

const DOT: Record<TableStatus, string> = {
  AVAILABLE: 'bg-emerald-400', OCCUPIED: 'bg-amber-400',
  BILL_REQUESTED: 'bg-sky-400', CLEANING: 'bg-slate-400', RESERVED: 'bg-violet-400',
}

export function ComandaTables() {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [busy, setBusy] = useState<number | null>(null)
  const now = Date.now()

  const load = useCallback(async () => {
    setLoading(true)
    try { setTables(await tablesApi.listTables(branchId)) }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'Error al cargar mesas') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  const visible = tables.filter((t) =>
    scope === 'all' ? true : (t.server_user_id === user?.id || t.status === 'AVAILABLE'))

  const openAndGo = async (t: DiningTable) => {
    if (t.status !== 'AVAILABLE') { nav(`/mobile/comanda/${t.id}`); return }
    setBusy(t.id)
    try { await tablesApi.open(t.id); nav(`/mobile/comanda/${t.id}`) }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo abrir la mesa') }
    finally { setBusy(null) }
  }

  if (loading) return <Spinner size="lg" text="Cargando mesas..." />

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white"><i className="fa-solid fa-utensils text-amber-400 mr-2" />Comanda</h1>
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-xs">
          <button className={`px-3 py-1.5 ${scope === 'mine' ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'}`}
            onClick={() => setScope('mine')}>Mis mesas</button>
          <button className={`px-3 py-1.5 ${scope === 'all' ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'}`}
            onClick={() => setScope('all')}>Todas</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visible.map((t) => (
          <button key={t.id} disabled={busy === t.id} onClick={() => openAndGo(t)}
            className="dax-card text-left active:scale-95 transition-transform disabled:opacity-50">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-white">{t.code}</span>
              <span className={`h-3 w-3 rounded-full ${DOT[t.status]}`} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              <i className="fa-solid fa-user" /> {t.seats}
              {t.opened_at && <span className="ml-2"><i className="fa-solid fa-clock" /> {minutesOpen(t.opened_at, now)}m</span>}
            </p>
            <p className="mt-2 text-xs font-bold text-amber-300">
              {t.status === 'AVAILABLE' ? 'Tocar para abrir' : 'Ver comanda'}
            </p>
          </button>
        ))}
        {visible.length === 0 && <p className="col-span-2 text-sm text-slate-500">No hay mesas para mostrar.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/mobile/ComandaTables.tsx
git commit -m "feat(comanda): pantalla móvil Mis mesas"
```

---

## Task 8: Frontend — pantalla de comanda por mesa (`ComandaOrder.tsx`)

**Files:**
- Create: `frontend/src/pages/mobile/ComandaOrder.tsx`

**Interfaces:**
- Consumes: `tablesApi`, `parkedTicketsApi`, `kitchenApi`, `productsApi`, `toFireItem`, `toCartItem`, `ticketTotal`.
- Produces: componente `ComandaOrder` para la ruta `/mobile/comanda/:tableId`.

- [ ] **Step 1: Create the screen**

```tsx
// frontend/src/pages/mobile/ComandaOrder.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tablesApi } from '../../api/tables'
import { parkedTicketsApi } from '../../api/sales'
import { kitchenApi } from '../../api/kitchen'
import { productsApi } from '../../api/products'
import { toFireItem, toCartItem, type CartLine } from '../../api/comanda'
import { ticketTotal } from '../tables/tableUtils'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'
import { toast } from '../../store/toastStore'
import { formatCurrency } from '../../utils/currency'
import type { DiningTable } from '../../types/tables'
import type { Product } from '../../types/products'

export function ComandaOrder() {
  const { tableId } = useParams<{ tableId: string }>()
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const branchId = user?.branch_id ?? undefined

  const [table, setTable] = useState<DiningTable | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [sent, setSent] = useState<CartLine[]>([])       // ya en la cuenta
  const [draft, setDraft] = useState<Record<string, { p: Product; qty: number }>>({}) // por enviar
  const [loading, setLoading] = useState(true)
  const [firing, setFiring] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await tablesApi.listTables(branchId)
      const t = all.find((x) => String(x.id) === tableId) ?? null
      setTable(t)
      if (t?.current_ticket_id) {
        const pt = await parkedTicketsApi.get(t.current_ticket_id)
        const items = Array.isArray((pt.cart_json as any)?.items) ? (pt.cart_json as any).items : []
        setSent(items as CartLine[])
      }
      const res = await productsApi.list({ limit: 200 })
      setProducts(res.items ?? [])
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'Error al cargar la comanda')
    } finally { setLoading(false) }
  }, [branchId, tableId])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const names = new Set<string>()
    products.forEach((p) => names.add(p.department?.name ?? p.department_name ?? 'General'))
    return ['Todas', ...Array.from(names)]
  }, [products])
  const [cat, setCat] = useState('Todas')
  const menu = products.filter((p) =>
    cat === 'Todas' ? true : (p.department?.name ?? p.department_name ?? 'General') === cat)

  const addDraft = (p: Product) =>
    setDraft((d) => ({ ...d, [p.id]: { p, qty: (d[p.id]?.qty ?? 0) + 1 } }))
  const decDraft = (id: string) =>
    setDraft((d) => {
      const cur = d[id]; if (!cur) return d
      const qty = cur.qty - 1
      const next = { ...d }
      if (qty <= 0) delete next[id]; else next[id] = { ...cur, qty }
      return next
    })

  const draftList = Object.values(draft)
  const draftTotal = draftList.reduce((s, { p, qty }) => s + p.price * qty, 0)
  const accountTotal = ticketTotal({ items: sent }) + draftTotal

  const fire = async () => {
    if (!table?.current_ticket_id || draftList.length === 0 || !branchId) return
    setFiring(true)
    try {
      await kitchenApi.fire({
        branch_id: branchId,
        table_id: table.id,
        parked_ticket_id: table.current_ticket_id,
        items: draftList.map(({ p, qty }) => toFireItem(p, qty)),
      })
      const merged = [...sent, ...draftList.map(({ p, qty }) => toCartItem(p, qty))]
      await parkedTicketsApi.update(table.current_ticket_id, { items: merged })
      setSent(merged)
      setDraft({})
      toast.success('Comanda enviada a cocina')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? 'No se pudo enviar la comanda')
    } finally { setFiring(false) }
  }

  const requestBill = async () => {
    if (!table) return
    try { await tablesApi.setStatus(table.id, 'BILL_REQUESTED'); toast.success('Cuenta solicitada'); load() }
    catch (e: any) { toast.error(e?.response?.data?.detail ?? 'No se pudo pedir la cuenta') }
  }

  if (loading) return <Spinner size="lg" text="Cargando comanda..." />
  if (!table) return <div className="p-6 text-slate-400">Mesa no encontrada.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <button onClick={() => nav('/mobile/comanda')} className="text-slate-400"><i className="fa-solid fa-arrow-left" /></button>
        <h1 className="text-lg font-black text-white">Mesa {table.code}</h1>
        <button onClick={requestBill} className="text-sky-300 text-sm font-bold">Pedir cuenta</button>
      </div>

      {/* Categorías */}
      <div className="px-3 py-2 flex gap-2 overflow-x-auto border-b border-slate-800">
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs ${cat === c ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>{c}</button>
        ))}
      </div>

      {/* Menú */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
        {menu.map((p) => (
          <button key={p.id} onClick={() => addDraft(p)}
            className="dax-card text-left active:scale-95 transition-transform">
            <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
            <p className="mt-1 text-xs text-amber-300 font-black">{formatCurrency(p.price)}</p>
            {draft[p.id] && <p className="mt-1 text-[11px] text-emerald-300">× {draft[p.id].qty}</p>}
          </button>
        ))}
        {menu.length === 0 && <p className="col-span-2 text-sm text-slate-500">Sin platillos en esta categoría.</p>}
      </div>

      {/* Resumen "por enviar" */}
      {draftList.length > 0 && (
        <div className="border-t border-slate-800 p-3 space-y-2 max-h-40 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Por enviar</p>
          {draftList.map(({ p, qty }) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-white">{p.name}</span>
              <span className="flex items-center gap-2">
                <button onClick={() => decDraft(p.id)} className="h-6 w-6 rounded bg-slate-700 text-white">−</button>
                <span className="w-5 text-center text-white">{qty}</span>
                <button onClick={() => addDraft(p)} className="h-6 w-6 rounded bg-slate-700 text-white">+</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer fijo */}
      <div className="border-t border-slate-800 p-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-500">Cuenta</p>
          <p className="text-lg font-black text-white">{formatCurrency(accountTotal)}</p>
        </div>
        <Button variant="primary" size="lg" loading={firing} disabled={draftList.length === 0}
          onClick={fire} icon="fa-fire-burner">
          Enviar a cocina{draftList.length ? ` (${draftList.length})` : ''}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores. (Verificado: `formatCurrency` se exporta desde `utils/currency`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/mobile/ComandaOrder.tsx
git commit -m "feat(comanda): pantalla de comanda por mesa (menú + enviar a cocina)"
```

---

## Task 9: Frontend — rutas y acceso en el dashboard móvil

**Files:**
- Modify: `frontend/src/App.tsx` (lazy imports ~línea 88-90 y bloque `<Route path="mobile">` ~línea 357)
- Modify: `frontend/src/pages/mobile/MobileDashboard.tsx` (array de links ~línea 91)

**Interfaces:**
- Consumes: `ComandaTables`, `ComandaOrder`.
- Produces: rutas `/mobile/comanda` y `/mobile/comanda/:tableId`; enlace en el dashboard.

- [ ] **Step 1: Add lazy imports en App.tsx**

Junto a los otros imports lazy de gastro (tras `const RecipeForm = ...`):

```tsx
const ComandaTables = lazy(() => import('./pages/mobile/ComandaTables').then(m => ({ default: m.ComandaTables })))
const ComandaOrder  = lazy(() => import('./pages/mobile/ComandaOrder').then(m => ({ default: m.ComandaOrder })))
```

- [ ] **Step 2: Add the routes**

Dentro de `<Route path="mobile">`, tras la ruta `profile`:

```tsx
            <Route path="comanda"          element={<Suspense fallback={<PageLoader />}><ComandaTables /></Suspense>} />
            <Route path="comanda/:tableId" element={<Suspense fallback={<PageLoader />}><ComandaOrder /></Suspense>} />
```

- [ ] **Step 3: Add the dashboard link en MobileDashboard.tsx**

En el array de links (donde están 'Consulta', 'Cotización', 'Mi perfil'), agregar como primer elemento:

```tsx
            { label: 'Comanda', icon: 'fa-utensils', to: '/mobile/comanda', color: 'text-amber-400' },
```

- [ ] **Step 4: Verify it typechecks and builds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/mobile/MobileDashboard.tsx
git commit -m "feat(comanda): rutas /mobile/comanda + acceso en dashboard móvil"
```

---

## Task 10: Verificación end-to-end (local, demo restaurante)

**Files:**
- Test: manual/Playwright (no se commitea código nuevo salvo scripts en `/tmp`).

**Objetivo:** Levantar la app localmente con SQLite, sembrar el preset de restaurante, y ejercer mesa→comanda→KDS→cuenta.

- [ ] **Step 1: Levantar backend local (SQLite)**

```bash
cd /mnt/c/Users/ecamp/Devs/atlas-bos
. .venv/bin/activate 2>/dev/null || python -m venv .venv && . .venv/bin/activate
pip install -q -r requirements.txt
python scripts/reset_db.py            # BD limpia SQLite (dev)
python scripts/seed_demo_orgs.py      # crea Demo Atlas One Restaurant + mesas/cocina/recetas
uvicorn app.main:app --reload --port 8000 &
```
Expected: uvicorn escuchando en `:8000`; log muestra el seed del preset restaurante.

- [ ] **Step 2: Sembrar productos-platillo para el menú**

```bash
python scripts/seed_pos_products.py   # da catálogo para la comanda (si no hay platillos, crear 3-4 manuales vía API)
```
Expected: productos disponibles en `GET /api/products/`.

- [ ] **Step 3: Levantar frontend local**

```bash
cd frontend && npm run dev &
```
Expected: Vite en `:5173` con proxy a `:8000`.

- [ ] **Step 4: Correr el driver Playwright (viewport móvil para comanda + desktop para plano)**

Adaptar `/tmp/drive_restaurant.mjs` para apuntar a `http://localhost:5173`, loguear como `demo_restaurant`/`demo1234`, y:
1. Desktop 1440×900: ir a `/tables`, screenshot del plano premium.
2. Móvil 390×844: ir a `/mobile/comanda`, tocar una mesa, agregar 2 platillos, "Enviar a cocina", screenshot.
3. Verificar en `/kitchen` (KDS) que la comanda apareció.

Run: `node /tmp/drive_restaurant.mjs`
Expected: screenshots en `/tmp/shots/`; el KDS muestra el ticket de la mesa; el total de la cuenta refleja los platillos.

- [ ] **Step 5: Verificar con backend que la cuenta se acumuló**

```bash
# tras enviar comanda, la mesa tiene current_ticket_id con items en cart_json
curl -s "http://localhost:8000/api/sales/parked/<parked_id>" -H "Authorization: Bearer <token>" | python3 -m json.tool
```
Expected: `cart_json.items` contiene los platillos enviados.

- [ ] **Step 6: Mirar los screenshots**

Abrir `/tmp/shots/*.png` y confirmar visualmente que el plano se ve premium (cards con estado/timer/total) y la comanda móvil es usable. Si algo se ve roto, es un fallo de la tarea correspondiente (3, 7 u 8), no de esta.

---

## Self-Review

**Spec coverage:**
- Mesas premium (cards + KPIs + modales) → Tasks 3, 4, 5. ✓
- Vista móvil de comanda → Tasks 6, 7, 8, 9. ✓
- `PATCH /sales/parked/{id}` → Task 1. ✓
- Menú = catálogo de productos → Task 8 (`productsApi.list`). ✓
- Default "Mis mesas" con toggle → Task 7. ✓
- Rol VENDEDOR levanta comandas (ruta bajo `/mobile/*`, home de VENDEDOR) → Task 9. ✓
- Flujo mesa→comanda→KDS→cobro→liberar → Tasks 8 + 10 (subscriber `free_table_on_sale` ya existe). ✓
- Pruebas TDD backend + e2e + screenshots → Tasks 1, 10. ✓
- Fase 2 (plano arrastrable) explícitamente fuera de alcance. ✓

**Placeholder scan:** sin TODO/TBD; todo el código está completo. Las únicas notas condicionales ("confirmar nombre de `formatCurrency`") son verificaciones de integración, no placeholders de implementación.

**Type consistency:** `CartLine` (Task 6) = shape usado en `toCartItem`, consumido en Task 8 y por `ticketTotal` (Task 3). `FireItem` proviene de `api/kitchen.ts` (ya existe). `parkedTicketsApi.update` (Task 2) firma usada en Task 8. `TableFormModal` props (Task 4) usadas en Task 5. Consistente.
