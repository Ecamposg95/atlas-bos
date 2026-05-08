# Audit — Outage 2026-05-01 (mapper Payment corrupto, cortes no cuadran)

## Resumen ejecutivo

Beta tuvo un outage parcial el **2026-05-01** que **rompió create_sale, print-ticket y reprint-ticket** durante una ventana aproximada de **una hora** (los workers Railway se "infectaban" individualmente al primer call al dashboard). Los cajeros reportaron que no podían vender ni imprimir; los cortes de caja del día **no cuadran**. Este audit traza la causa, las anomalías esperadas y un procedimiento de reconciliación.

## Causa raíz

PR2 del Dashboard rework (commit `dc97662`, 2026-05-01) introdujo el endpoint `/api/platform/stats/payment-methods` con el import:

```python
from app.models.payments import Payment   # ← BAD
```

`app/models/payments.py` es un módulo **legacy** que define duplicados de `CashSession` y `Payment` con `relationship("Branch")` que no se puede resolver (Branch no se importa allí). Una vez que Python carga ese módulo, SQLAlchemy registra mappers rotos. **Cualquier query subsiguiente que toque `Payment` revienta** al inicializar mappers con:

```
sqlalchemy.exc.InvalidRequestError: One or more mappers failed to initialize.
Triggering mapper: 'Mapper[CashSession(cash_sessions)]'.
Original exception was: When initializing mapper Mapper[CashSession(cash_sessions)],
expression 'Branch' failed to locate a name ('Branch').
```

Eso tumbó:

- `create_sale` (`POST /api/sales`) — falla en `db.flush()` cuando agrega `Payment`
- `print-ticket` y `reprint-ticket` — fallan al cargar `sale.payments`
- `payment-methods`, `cash close`, todo lo que toca el modelo

**Hotfix**: commit `fc667ef` cambia el import a `app.models.sales` (la clase Payment viva). Los workers de Railway recuperan funcionalidad al recibir el deploy.

## Ventana del outage

| Hito | Commit | UTC | CST aprox |
|---|---|---|---|
| Push PR2 a beta (introducción del bug) | `dc97662` | ~22:30 UTC 2026-04-30 (TBC) | ~16:30 |
| Primer log de error | — | 2026-05-02 01:22:15 UTC | 19:22 CST 2026-05-01 |
| Push hotfix a beta | `fc667ef` | ~02:00 UTC 2026-05-02 (aprox) | ~20:00 CST |

**Ventana de impacto sospechosa (UTC):** `2026-05-01 16:30` → `2026-05-02 01:30`. Cada worker de Railway pudo "infectarse" en momento distinto, así que la ventana real por sucursal puede ser menor.

## Anomalías esperadas

### A. Sesiones cerradas con `difference != 0`
El cajero contó dinero físico. Si el sistema no registró todos los Payments (la transacción se rolleó pero el cajero ya tenía el efectivo del cliente, o nunca se cobró pero el cajero asumió que sí), hay desalineación:

- **Sobrante físico** (diff > 0): el cajero tiene más dinero del que el sistema espera → posibles cobros no registrados.
- **Faltante físico** (diff < 0): el sistema espera más dinero del que el cajero tiene → posibles cobros duplicados o devoluciones no registradas.

### B. SalesDocument PAID sin Payments
Improbable porque `create_sale` tiene try/except con rollback en el commit, pero **si** el flush parcial pasó algunos rows antes de explotar el mapper, queda inconsistente.

### C. SalesDocument PENDING creados durante la ventana
El cajero podría haber cobrado al cliente pero la venta quedó como crédito porque el flujo de Payment falló.

### D. Duplicados (mismo monto, mismo cajero, <60s)
Frente al error 500, los cajeros suelen reintentar — si una segunda petición pasó después del fix, hay doble venta.

## Procedimiento

### 1. Correr el script de audit en beta DB

```bash
# Desde Railway dashboard: Settings → Connect → CLI
railway login
railway link <project>
railway run psql $DATABASE_URL -f scripts/audit_outage_2026_05_01.sql
```

O desde tu máquina si tenés `DATABASE_URL` exportado:

```bash
psql $DATABASE_URL -f scripts/audit_outage_2026_05_01.sql
```

### 2. Interpretar la salida

| Sección | Acción |
|---|---|
| **#1** Sesiones cerradas con diff != 0 | Lista corta. Cada caja necesita reconciliación manual con el cajero. |
| **#2** Sesiones aún OPEN | Verificar si el cajero abandonó por el error. Si la sesión es vieja, cerrar manualmente. |
| **#3** SalesDocument PAID sin Payment | **CRÍTICO**: ventas registradas como pagadas pero sin payments. Hay que decidir si fueron pagadas en realidad o anular. |
| **#4** SalesDocument PENDING en la ventana | Llamar al cliente o consultar al cajero — ¿cobró o no cobró? |
| **#5** Posibles duplicados | Verificar con el cajero. Si es duplicado real, anular el segundo. |
| **#6** Desglose por sesión afectada | Confirma matemáticamente el diff: opening + cash_db − change_given_db − outflows ≟ closing. |
| **#7** Resumen totals | Sanity check: ¿el total de PAID en la ventana es razonable vs un día normal? |

### 3. Reconciliación

Para cada sesión con diff != 0, recomiendo:

1. **Diff es exactamente igual al monto de un ticket** (sec #5 o #4): probablemente ese ticket es el problema. Decidir registrar pago manual o anular.
2. **Diff coincide con un ticket del sec #3** (PAID sin payments): registrar los Payment manualmente (con `created_at` aproximado), o anular el documento.
3. **Diff no coincide con ninguno y es chico**: dejar como sobrante/faltante normal y documentar.
4. **Diff grande sin patrón**: pedir al cajero recuento físico actualizado, contrastar con resumen de tickets de su sesión.

### 4. Acción técnica de fondo

`app/models/payments.py` tiene que **eliminarse del repo** — es código legacy peligroso. Tracking en el commit del hotfix; abrir PR aparte con:

- Verificar que NADIE más importa `app.models.payments` (`grep -r "from app.models.payments"`)
- Borrar `app/models/payments.py`
- Confirmar que `app/models/sales.py:Payment` y `app/models/cash.py:CashSession` son los únicos.

## Lecciones

1. **Siempre importar modelos desde `app/models/__init__.py`** o desde el módulo "vivo" (sales/cash). El módulo `payments.py` aparece como tentación natural por su nombre y nadie había caído en él porque nada lo importaba — hasta este PR.
2. **Smoke test post-deploy de endpoints críticos**: después de un push a beta, automatizar un curl a `/api/sales/my-last` o similar para detectar mappers rotos en <30s en lugar de descubrirlos cuando un cajero no puede vender.
3. **Modelos duplicados son tech debt activamente peligroso**: borrar `payments.py` es prioridad alta, no opcional.

## Referencias

- Commit del bug: `dc97662 feat(platform): payment methods donut + leaderboard drill-down (PR2/6)`
- Commit del hotfix: `fc667ef fix(platform): URGENT — import Payment from sales (not legacy payments.py)`
- Stack del primer error: log en Railway 2026-05-02 01:22:15 UTC
- Memoria relacionada: `feedback_payments_columns_unmigrated.md` (que mal-diagnosticamos pensando que era schema drift en vez de mapper drift)
