# Cash Reconciliation Hardening — Plan

**Status**: Draft, pre-execution
**Owner**: Atlas Tech
**Created**: 2026-05-01
**Goal**: Garantizar que el corte de caja **siempre** coincide con la realidad física, manejando correctamente todos los métodos (cash/tarjeta/transferencia/mixto), cambio, entradas/salidas manuales y devoluciones. Producir un audit trail robusto que permita debugger cualquier discrepancia en minutos, no horas.

---

## Estado actual (diagnóstico)

✅ Tenemos:
- `app/services/cash_reconciliation.py` — `compute_expected_cash` como single source of truth para el matemático del expected
- `_apply_close_to_session` persiste el `difference` al cerrar
- `get_session_audit_data` recalcula vivo y muestra desglose en UI/ticket
- Hotfixes recientes: incluir REFUNDED_* en cash sum, recalcular `difference` en reimpresión

❌ Falta:
- **Test suite exhaustivo** — hoy hay 0 tests automáticos sobre el flujo completo
- **Invariantes runtime** — nada bloquea un cierre con valores físicamente imposibles
- **Audit log estructurado** — solo `logger.info` plano; reconstruir un caso requiere SQL ad-hoc
- **Detección fat-finger** — un refund de $104,400 se aprobó sin cuestionamiento
- **Vista admin de reconciliación** — para inspeccionar una sesión componente por componente sin abrir psql
- **Documentación canónica** — la fórmula y reglas viven en docstrings dispersos

---

## Fases (independientes, ejecutables en orden o paralelas según dependencia)

### F0 — Cleanup post-outage 2026-05-01 _(low risk)_

**Objetivo**: cerrar deuda inmediata.

- Borrar `app/models/payments.py` (módulo legacy con mappers rotos que causó el outage). Verificado: nadie más lo importa.
- Backfill `session.difference` de sesiones cerradas en la ventana 2026-04-30 → 2026-05-01 con la fórmula nueva. Marcar `notes` con `[RECALCULADO 2026-05-01]` para trazabilidad.
- Script `scripts/recompute_session_differences.py` con `--dry-run` por defecto.

**Skills**: ninguna especial.
**Subagent**: `Plan` para un dry-run de impacto antes de correr.

---

### F1 — Test suite exhaustivo _(la base de todo lo demás)_

**Objetivo**: que cada cambio futuro a código de caja corra contra una matriz de casos conocidos.

**Estructura**:
- `tests/cash/conftest.py` — fixtures para construir sesiones, ventas, refunds, movimientos sin tocar la app
- `tests/cash/test_compute_expected_cash.py` — todos los casos atómicos
- `tests/cash/test_close_session.py` — flujo end-to-end del endpoint de cierre
- `tests/cash/test_invariants.py` — property-based con `hypothesis` (random sales/refunds, expected siempre coherente)

**Matriz de casos cubierta** (mínimo):

| # | Caso | Métodos | Expected |
|---|---|---|---|
| 1 | Cash exacto, sin cambio | CASH | opening + amount |
| 2 | Cash con cambio | CASH | opening + (amount − change) |
| 3 | Tarjeta exclusivo | CARD | opening |
| 4 | Transferencia exclusiva | TRANSFER | opening |
| 5 | Mixto cash + tarjeta | CASH+CARD | opening + cash_part |
| 6 | Mixto cash + tarjeta + transfer | mixto | opening + cash_part |
| 7 | Sobrepago cash en mixto (cambio sale por encima del card) | mixto | opening + (cash − change) |
| 8 | Refund total mismo día cash | CASH | opening (entró y salió) |
| 9 | Refund parcial mismo día cash | CASH | opening + (sale_total − refund) |
| 10 | Refund total cross-day cash | CASH | opening − refund (sale en otra sesión) |
| 11 | Refund de venta MIXTA (el cash refund no es todo) | mixto | balance correcto |
| 12 | Múltiples refunds parciales sobre la misma venta | CASH | suma neta correcta |
| 13 | Entrada manual (`CashMovement IN`) | — | opening + inflow |
| 14 | Salida manual (`CashMovement OUT` no-refund) | — | opening − outflow |
| 15 | Refund de método NO-cash (tarjeta) — no afecta cash | CARD | opening (sin cambio) |
| 16 | Sale `cash_session_id` NULL legacy + filtro fallback | CASH | suma vía session_sales_filter |
| 17 | Closing balance > expected | — | difference > 0 (sobrante) |
| 18 | Closing balance < expected | — | difference < 0 (faltante) |
| 19 | Sesión sin actividad | — | opening |
| 20 | Sesión con N PCs compartiendo cajero | mixto | suma todas las ventas |

**Skills usadas**: `superpowers:test-driven-development` para cada test escrito ANTES de cualquier cambio downstream.

**Subagent**: `feature-dev:code-explorer` para mapear todos los call sites actuales primero, luego `feature-dev:code-architect` para diseño de fixtures.

**Done when**:
- 20+ tests pasan
- Coverage report sobre `cash_reconciliation.py` y `routers/cash.py:close_session` ≥ 95%
- CI bloquea PR si algún test falla

---

### F2 — Invariantes runtime _(network-of-trust al cierre)_

**Objetivo**: bloquear cierres físicamente imposibles antes de que se persistan.

Invariantes a validar en `_apply_close_to_session` (raise 409 con mensaje claro si falla):

| # | Invariante | Razón |
|---|---|---|
| I-1 | `breakdown.expected ≥ −(opening + manual_inflows)` | Refunds no pueden exceder lo razonablemente sacable del cajón |
| I-2 | `breakdown.refund_cash_outflows ≤ breakdown.gross_cash + opening + manual_inflows` | El cajón no pudo entregar más cash del que tuvo |
| I-3 | `breakdown.change_given ≤ breakdown.gross_cash` | Imposible dar más cambio que cash recibido |
| I-4 | `closing_balance ≥ 0` (ya existe) | — |
| I-5 | `abs(difference) / max(expected, 1) ≤ 50%` | Discrepancia >50% del esperado requiere supervisión (configurable) |

Invariantes en `approve_return`:

| # | Invariante |
|---|---|
| R-1 | `refund.total_refunded > 0` |
| R-2 | `refund.total_refunded ≤ sale.total_amount_original` (sumando refunds previos) |
| R-3 | Si `refund_method = CASH` y `refund.total_refunded > 5000`: requerir `supervisor_pin` extra (fat-finger detection, threshold configurable por org) |
| R-4 | Si `sale.id` ya tiene refund APPROVED del mismo `total_refunded` en últimos 5 min → 409 (idempotencia / doble click) |

**Skills usadas**: `superpowers:systematic-debugging` para cada invariante (qué hipótesis valida, qué bug histórico previene).

**Subagent**: `feature-dev:code-architect` para el diseño de los thresholds y errors API-friendly.

**Done when**:
- Todos los invariantes tienen test específico (usa F1 como base)
- Documentado en `docs/superpowers/specs/cash-reconciliation-spec.md` con el "por qué" de cada uno

---

### F3 — Audit log estructurado _(la caja negra)_

**Objetivo**: cada movimiento de dinero queda registrado con full context. Debuggear una sesión = un solo `SELECT * FROM cash_audit_log WHERE session_id = X ORDER BY ts`.

**Tabla nueva**:

```sql
CREATE TABLE cash_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id      INT REFERENCES cash_sessions(id),
  organization_id INT NOT NULL,
  branch_id       INT NOT NULL,
  user_id         INT,
  event_type      VARCHAR(40) NOT NULL,  -- SALE_CREATED, PAYMENT_RECORDED, REFUND_APPROVED, MANUAL_INFLOW, MANUAL_OUTFLOW, SESSION_OPENED, SESSION_CLOSED, INVARIANT_FAILED
  amount          NUMERIC(12,2),
  related_table   VARCHAR(40),           -- 'payments', 'cash_movements', 'sale_returns'
  related_id      VARCHAR(64),
  payload_json    JSONB,                 -- before/after state, reason, supervisor_id, etc.
  expected_running_total NUMERIC(12,2),  -- snapshot de breakdown.expected al momento del evento
  CONSTRAINT cash_audit_log_session_idx UNIQUE (session_id, ts, id)
);
CREATE INDEX cash_audit_log_session ON cash_audit_log(session_id, ts);
CREATE INDEX cash_audit_log_event_type ON cash_audit_log(event_type, ts);
```

**Hooks** (donde se inserta):
- `create_sale` → `SALE_CREATED` + `PAYMENT_RECORDED` por cada Payment row
- `approve_return` → `REFUND_APPROVED` con `payload.cash_session_assignment_strategy` ('open_supervisor' | 'original_session' | 'post_close_fallback')
- `register_inflow` / `register_outflow` → `MANUAL_INFLOW` / `MANUAL_OUTFLOW`
- `_apply_close_to_session` → `SESSION_CLOSED` con `payload.breakdown_full` (todo el ExpectedCashBreakdown serializado)
- Cualquier invariante de F2 que falla → `INVARIANT_FAILED` con `payload.invariant_id`

**Política**: write-only (append). Nunca UPDATE ni DELETE. Retención indefinida (compactable a 1 año por org si crece).

**Skills usadas**: `superpowers:writing-skills` para estructurar el JSONB schema (tipo evento → shape esperada).

**Subagent**: `feature-dev:code-architect` para el modelo SQLAlchemy + helper único `audit_cash_event(...)` que todos los call sites usen.

**Done when**:
- Tabla creada en migration
- 100% de los hooks emiten audit row (test cubre cada uno)
- Endpoint `GET /api/cash/sessions/{id}/audit-log` devuelve el timeline completo

---

### F4 — Reconciliation report admin _(la vista de inspección)_

**Objetivo**: cualquier admin abre `/platform/cash-audit/{session_id}` y ve TODO en una pantalla. Sin abrir psql jamás.

**Componentes UI**:
1. **Header**: cajero, sucursal, opening, closing, expected (live), difference (live), invariantes (verde/rojo)
2. **Timeline cronológico** del audit_log (icono por event_type, monto, link a Payment/Refund)
3. **Breakdown matemático**:
   ```
   opening                    + 0.00
   gross_cash                 + 115,483.00
   change_given               −  14,707.00
   ───────────────────────
   net_cash                   + 100,776.00
   manual_inflows             +     0.00
   manual_outflows            −   122.00
   refund_cash_outflows       − 104,400.00
   ───────────────────────
   expected                   = −3,646.00
   reported (counted)         =     0.00
   ───────────────────────
   difference                 = +3,646.00 (sobrante físico)
   ```
4. **Refund inspector**: lista de cada refund con drill-down (sale original, items devueltos, supervisor, ts)
5. **Anomaly detector**: chips destacando: refund >50% de la sale original, refund cash >$5k, cross-day refund, etc.
6. **Acciones admin** (con doble confirmación):
   - "Reconciliar manualmente" — agregar `CashMovement IN/OUT` con `reason='Ajuste post-corte'` que reduzca el diff a 0
   - "Marcar refund como erróneo" — workflow de reversión (rejection del SaleReturn + revierte stock + delete CashMovement OUT + audit row)

**Skills usadas**: `superpowers:frontend-design` para el layout.

**Subagent**: `feature-dev:code-architect` (backend) + `feature-dev:code-architect` (frontend, paralelo).

**Done when**:
- Pantalla deployable, accesible solo a `ADMINISTRADOR`/`DUEÑO`/`SUPERADMIN`
- Caso real "sesión 65" se puede inspeccionar y resolver desde la UI sin SQL

---

### F5 — Documentación canónica _(la verdad escrita)_

**Objetivo**: cualquier nuevo dev entiende la fórmula, las reglas y los corner cases sin leer 10 archivos.

**Docs a crear**:
- `docs/superpowers/specs/cash-reconciliation-spec.md` — la fórmula oficial, cada componente, semánticas, invariantes, edge cases (cross-day, multi-PC, post-close)
- `docs/superpowers/runbooks/cash-discrepancy-debugging.md` — pasos para diagnosticar un corte que no cuadra, qué queries correr, cuándo es operacional vs bug
- `docs/superpowers/runbooks/cash-session-repair.md` — cómo reparar una sesión mal cerrada usando el reconciliation report (F4) o el script (F0)
- `CLAUDE.md` (project): sección nueva "Cash Reconciliation — golden rules" enlazando lo anterior

**Skills usadas**: `superpowers:writing-skills`.

**Subagent**: dispatchar `Plan` para que arme el outline de cada doc y `feature-dev:code-explorer` para listar todos los lugares del código que cada doc debe referenciar.

**Done when**:
- 3 docs publicados
- CLAUDE.md actualizado
- Linkeado desde MEMORY.md (memoria persistente)

---

### F6 — Tools de reparación _(legacy cleanup)_

**Objetivo**: scripts batch para reconciliar sesiones existentes con datos malos (pre-fix outage 2026-05-01 + cualquier futuro).

**Scripts**:
- `scripts/recompute_session_differences.py` (de F0 expandido) — recalcula `difference` con la fórmula actual para sesiones cerradas en rango de fechas
- `scripts/audit_cash_anomalies.py` — corre invariantes (F2) sobre TODAS las sesiones cerradas, devuelve report markdown con anomalías
- `scripts/repair_inflated_refund.py` — para casos como sesión 65: dado un `cash_movement_id` y un `correct_amount` ($0 o el monto correcto), revierte el SaleReturn, ajusta CashMovement, recompute difference, deja audit row

Todos con `--dry-run` por defecto y `--apply` explícito.

**Skills usadas**: `superpowers:systematic-debugging` para cada herramienta (qué hipótesis valida).

**Subagent**: `feature-dev:code-architect` con review obligatorio por `feature-dev:code-reviewer` antes de merge.

---

## Orden sugerido de ejecución

```
F0 (cleanup, 1 día)
 ↓
F1 (tests, 2-3 días) ← bloquea todo lo demás
 ↓
F2 (invariantes, 1 día) ──┐
F3 (audit log, 2 días) ───┼─ paralelos, ambos consumen F1
F5 (docs spec, 1 día) ────┘
 ↓
F4 (reconciliation UI, 3 días) ← consume F3
 ↓
F6 (tools reparación, 2 días) ← consume F2 + F3
```

**Total estimado**: ~10-12 días de trabajo enfocado, distribuible en sprints.

## Cómo lo ejecutamos

Cuando me digas "arranca F1" (o el que sea), invoco:
- La skill correspondiente (`test-driven-development`, `systematic-debugging`, etc.)
- Subagentes en paralelo donde el plan los marque (`code-explorer` + `code-architect` simultáneo)
- Cada fase termina con un PR a `release/qa`, tests verdes, y entrada en `MEMORY.md`

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Los invariantes F2 bloquean cierres legítimos en producción | Roll-out con `feature_flag` por org; modo "warn-only" primero, "block" después de 1 semana sin falsos positivos |
| Audit log F3 satura DB en sucursales con alto volumen | Particionado por mes desde día 1; retención política de compactación |
| Reconciliation UI F4 expone info sensible | RBAC duro: solo ADMIN/DUEÑO/SUPERADMIN; logged en audit log |
| Tests F1 nunca terminan de cubrir todo | Property-based con hypothesis genera casos no cubiertos automáticamente |
