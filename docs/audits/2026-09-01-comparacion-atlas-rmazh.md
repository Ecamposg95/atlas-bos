# Atlas ONE frente a Atlas-Rmazh — qué falta traer

- **Fecha:** 2026-09-01
- **Origen analizado:** `git@github.com:Ecamposg95/Atlas-Rmazh.git`, rama `release/beta` (`c0cef4f`, 29-ago-2026)
- **Comparado contra:** `atlas-one`, rama `main` (`349f58b`)

## Punto de partida

Los dos repositorios **no comparten historia de git**: cero commits en común. Atlas ONE
nació como copia limpia, así que ningún arreglo del origen llega solo por un merge —
cada uno hay que portarlo a mano y verificarlo aquí.

| | Atlas-Rmazh | Atlas ONE |
|---|---|---|
| Commits | 1,884 | 212 |
| Rango | dic-2025 → 29-ago-2026 | jul-2026 → hoy |
| Archivos de prueba | 101 | 49 |
| Revisiones de Alembic | 2 | 0 |

El origen siguió recibiendo correcciones **después** de la copia: 76 `fix(pos)`,
41 `fix(printer)`, 37 `fix(platform)`, 30 `fix(products)`, 23 `fix(returns)`,
20 `fix(sales)`, 18 `fix(cash)`, 16 `fix(security)` solo en los últimos seis meses.

Atlas ONE no es una versión atrasada: divergió. Tiene cosas que el origen no
—la reorganización en `app/modules/`, la Gastro Suite, el sistema de diseño, los
avisos de plataforma, el portal móvil— y le faltan correcciones que allá ya se
pagaron con incidentes reales de producción.

---

## P0 — Pérdida de dinero, confirmado en el código de Atlas ONE

### 1. Doble reembolso: la fórmula R-2 está mal

`app/crud/returns.py:166-177` reconstruye el total original en vez de comparar
contra lo que queda por devolver:

```python
# atlas-one — versión defectuosa
prior_refunded = ...  # suma de devoluciones aprobadas
original_sale_total = Decimal(str(sale.total_amount or 0)) + prior_refunded
```

`sale.total_amount` **ya viene neteado** por cada aprobación previa. Al sumarle otra
vez lo ya devuelto se reconstruye el original, así que una segunda devolución por el
total también pasa la validación: **sale el dinero dos veces**.

El guard "Ya existe una devolución pendiente" no protege: es *check-then-insert* sin
bloqueo ni restricción única, así que dos peticiones concurrentes crean dos
devoluciones PENDING por el total.

En el origen esto es el **crítico #3 de su auditoría del 12-ago-2026**, con prueba
dedicada (`tests/test_critico_doble_reembolso.py`). Su corrección:

```python
# Atlas-Rmazh — corregido
remaining = Decimal(str(sale.total_amount or 0))   # esto YA es el restante
if refund_amount > remaining + Decimal("0.01"):
    raise ValueError(...)
```

más un índice único parcial sobre `sale_id` cuando `status='PENDING'`.

**Falta también** el guard de venta cancelada: el origen rechaza aprobar la devolución
de una venta `CANCELLED` porque sobrescribiría su estado y sacaría efectivo real.
Atlas ONE no menciona `CANCELLED` en `crud/returns.py`.

**Propuesta:** portar la fórmula, el índice único parcial, el guard de `CANCELLED` y
las tres pruebas críticas. Es el arreglo más urgente de esta lista.

### 2. Sin ninguna deduplicación de ventas

Atlas ONE no tiene `client_uuid`, ni clave de idempotencia, ni detección por
contenido. El detonante sí está: `frontend/src/pages/pos/POS.tsx:747` ofrece
**"Reintentar ahora"** al cajero.

El origen documenta el desenlace en `app/services/sales_dedup.py`:

> *65 tickets duplicados / $919 mil en 35 días, todos entre 13 y 36 segundos después del original.*

Y describe la trampa: el POS reintentaba **con un `client_uuid` nuevo**, así que la
restricción única `uq_sales_org_client_uuid` no bastaba. Por eso su módulo detecta
ventas de igual contenido, mismo cajero y misma sucursal dentro de una ventana corta,
con ventanas configurables por entorno y **modo solo-registro por omisión**, para medir
falsos positivos antes de bloquear nada.

**Propuesta:** portar en dos etapas — primero `client_uuid` con índice único
(`scripts/migrate_add_sales_client_uuid.py` del origen), después `sales_dedup.py` en
modo solo-registro. Con Novedades Ginebra recién arrancando y Kaory en 12,625 ventas,
conviene hacerlo antes de sumar más clientes.

---

## P1 — Corrección y operación

### 3. El IVA se calcula en línea, sin fuente única

Atlas ONE resuelve el impuesto dentro de `app/routers/sales.py:561-562`:

```python
if sale_in.requires_invoice and variant.has_iva:
    rate = variant.tax_rate / Decimal("100.0")
```

El origen tiene `app/services/tax.py`, declarado *fuente ÚNICA de verdad*, consumido
por ventas, devoluciones, impresión y reportes, y **espejado en
`frontend/src/utils/tax.ts`**. Además soporta `price_includes_tax` (precio con IVA
incluido), que Atlas ONE no contempla en ninguna parte.

Con la fórmula duplicada en cada consumidor, el ticket, el reporte y la devolución
pueden discrepar en centavos — y con IVA incluido, en mucho más. El origen lo cubre
con seis pruebas (`test_iva_calc`, `test_iva_pos_force`, `test_iva_quote_convert`,
`test_iva_returns_proration`, `test_iva_sale_integration`, `test_iva_sale_preview`);
Atlas ONE tiene **cero**.

### 4. El total mostrado puede diverger del cobrado

El origen extrajo `app/services/sale_pricing.py` como autoridad única de precios
—variantes, overrides por sucursal, escalones, descuento, techo de descuento e IVA—
usada tanto por `create_sale` como por `/api/sales/preview`, de modo que lo que el
cajero ve nunca puede diferir de lo que el backend cobra. Atlas ONE resuelve el
precio dentro del endpoint, sin esa garantía.

### 5. Carrera al abrir caja

El origen serializa la apertura de caja (`test_cash_open_race.py`). Atlas ONE no tiene
`advisory lock` ni `with_for_update` en el flujo de caja: dos aperturas concurrentes
pueden crear dos sesiones abiertas para el mismo cajero, y a partir de ahí el corte
cuadra mal.

### 6. Reimpresión sin autorización

El origen exige **PIN de un administrador** para reimprimir un ticket
(`app/services/reprint_auth.py`), con límite de tres intentos por 15 minutos. Es un
control anti-fraude clásico: sin él, un cajero reimprime un ticket y lo entrega como
comprobante de una venta que no ocurrió. Atlas ONE no tiene nada equivalente.

### 7. `node_modules` está versionado

`origin/main` de Atlas ONE trae **9,106 archivos bajo `frontend/node_modules/`**. Están
en `.gitignore` (líneas 54-55), pero se commitearon antes de la regla y `.gitignore` no
destraquea lo ya versionado. Infla el repositorio, ensucia todo diff y mete
dependencias de terceros en la historia. El origen no los versiona.

**Propuesta:** `git rm -r --cached frontend/node_modules` en un commit propio.

### 8. Sin migraciones versionadas

Atlas ONE tiene `alembic/` con **cero revisiones**: el esquema depende de
`create_all` más 21 scripts sueltos. El origen tiene un baseline real
(`09a3427d2a07_baseline_schema_f1.py`) y una revisión que reconcilia la deriva que
`railway_init` había dejado (`477d108967be_reconcile_railway_init_drift`).

Con dos clientes en la misma base y más por entrar, no poder decir en qué versión de
esquema está cada entorno se vuelve caro rápido.

---

## P2 — Red de seguridad y herramientas

### 9. Faltan 84 archivos de prueba

Atlas ONE tiene 49; el origen, 101. Las ausentes no son relleno: codifican incidentes
ya vividos.

| Área | Pruebas que faltan |
|---|---|
| Dinero | `test_critico_doble_reembolso`, `test_critico_cancel_sale`, `test_critico_update_pending`, `test_folios_lock`, `test_cash_open_race`, `test_incomplete_payment_rejected`, `test_negative_stock`, `test_money_guards_2026_08`, `test_global_discount_persist` |
| Duplicados | `test_sales_dedup`, `test_sales_content_dedup`, `test_sales_idempotency_active`, `test_returns_lineas_duplicadas` |
| IVA | los seis `test_iva_*`, `test_ticket_reissue_tax` |
| Permisos | `test_catalog_rbac`, `test_customers_rbac`, `test_users_rbac`, `test_sales_branch_gate`, `test_returns_branch_access`, `test_wave4_module_gating`, `test_prod_hardening` |
| Impresión | `test_ticket_golden`, `test_ticket_encoding`, `test_line_width_overflow`, `test_payment_block_width`, `test_print_agent_cors` |

`test_print_agent_cors` merece una nota: el origen ya tenía prueba de los orígenes del
agente de impresión. Aquí ese fallo se descubrió hoy en producción, con Novedades
Ginebra sin poder imprimir tickets.

### 10. Autorización por rol como dependencia explícita

El origen tiene `app/security/` con `require_role`, `require_module` y `api_keys`,
aplicables por ruta o por router completo, con la advertencia correcta: *"esto es una
frontera real; que el frontend esconda un botón no lo es"*. Atlas ONE dispersa el
control entre `app/core/permissions.py` y las dependencias de plataforma, sin un
factory uniforme.

### 11. Herramientas que el origen ya tiene

- `scripts/audit/` — detección de código muerto, matriz de consumo, agregación de logs HTTP.
- `scripts/report_duplicate_sales.py` — reporte de ventas duplicadas.
- `scripts/backup_db.sh`.
- `scripts/migrate_add_perf_indexes.py` — índices de rendimiento.
- `Dockerfile.ionos` — imagen específica para este servidor. Aquí el `Dockerfile` está sin commitear a propósito para no romper el build de Railway; un archivo con nombre propio resuelve el conflicto de raíz.
- `.env.example` y `requirements-dev.txt`.

---

## Lo que Atlas ONE tiene y el origen no

No es una relación de una sola dirección. Conviene no perderlo al portar:

- Reorganización en `app/modules/` (69 archivos) frente a `app/routers/` del origen.
- Gastro Suite: mesas, comandas, cocina/KDS, recetas.
- Sistema de diseño y rediseño de la interfaz.
- Avisos de plataforma con segmentación por organización.
- Portal y shell móvil.
- Clientes POS con estado de cuenta en PDF y envío por WhatsApp.

**Consecuencia práctica:** portar archivos completos del origen romperá cosas. Cada
arreglo hay que traerlo como cambio dirigido sobre la estructura de Atlas ONE, con su
prueba, no copiando el archivo.

---

## Orden propuesto

| # | Trabajo | Por qué en ese lugar |
|---|---|---|
| 1 | Fórmula R-2, índice único parcial, guard de `CANCELLED` + 3 pruebas | Saca dinero dos veces, confirmado en el código actual |
| 2 | `client_uuid` con índice único | Precedente de $919 mil; el botón de reintento ya está en el POS |
| 3 | `git rm -r --cached frontend/node_modules` | Barato y hace legible todo diff posterior |
| 4 | `app/services/tax.py` + `price_includes_tax` + las seis pruebas de IVA | Fórmula duplicada entre ticket, reporte y devolución |
| 5 | `sales_dedup.py` en modo solo-registro | Medir antes de bloquear |
| 6 | Serializar la apertura de caja | Corte descuadrado |
| 7 | PIN de reimpresión | Control anti-fraude |
| 8 | Pruebas de permisos y de ticket | Red de seguridad para lo demás |
| 9 | Baseline de Alembic | Ordena el esquema antes de sumar clientes |

Los puntos 1 a 3 valen una sesión y quitan el riesgo de dinero. Del 4 en adelante es
trabajo por fases, cada uno con su plan.

## Cómo se verificó

Cada ausencia se comprobó leyendo el código de Atlas ONE, no suponiendo. Lo que ya
estaba cubierto aquí quedó fuera de la lista: el bloqueo de folios contra carrera
(`app/utils/folios.py`, advisory lock por sucursal y serie) existe en ambos y resuelve
lo mismo, y el guard de stock insuficiente está presente
(`app/routers/sales.py:520-521`).
