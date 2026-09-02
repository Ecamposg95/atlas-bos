# Por qué el corte de caja de Novedades Ginebra no puede cuadrar

- **Fecha:** 2026-09-01
- **Organización auditada:** 15 · Novedades Ginebra (base multicliente del VPS)
- **Método:** cuatro auditorías paralelas sobre dominios independientes, cada hallazgo verificado contra el código y contra los datos reales de producción.

## Lo que sí está bien

Antes de la lista de problemas, lo que no hay que tocar:

- **La fórmula del esperado es correcta y tiene una sola fuente.**
  `app/services/cash_reconciliation.py:204-210`:
  `esperado = apertura + efectivo_neto + entradas − salidas − reembolsos_efectivo`.
  La consumen el cierre, el tablero, el ticket, el PDF y el corte de sucursal, sin
  fórmulas duplicadas.
- **Descuenta el cambio entregado, no el efectivo bruto.** El folio 6 (pago 500,
  cambio 381, venta 119) aporta 119, no 500.
- **Excluye tarjeta del cajón** y maneja bien los pagos mixtos.
- **Recalculé las dos sesiones cerradas de Ginebra y coinciden al peso:**
  sesión 94 → `10,000 + 13 − 9,000 = 1,013`; sesión 95 → `1 + 153 + 1,376 = 1,530`.
- El ticket y el PDF **recalculan** la diferencia en vez de leer el campo persistido.
- Existe un `cash_audit_log` inmutable y bien diseñado.

**La aritmética no es el problema.** El problema es qué dinero llega a esa fórmula,
quién puede moverlo sin permiso, y qué le muestra la pantalla al dueño.

---

## P0 · Dinero que entra al cajón y ningún corte puede ver

### 1. Un ADMINISTRADOR o DUEÑO cobra en efectivo sin caja abierta

`app/routers/sales.py:419-438` — el guard se salta si `_is_hq_role(current_user)`
(`sales.py:78-92`: ADMINISTRADOR, DUEÑO o SUPERADMIN).

El discriminador es **el rol**, cuando debería ser **si la venta mueve efectivo
físico**. La exención se escribió para back-office sin sucursal; un dueño que
atiende su propia tienda —el caso normal de Ginebra— cae en ella mientras opera
el cajón.

**Verificado en producción:** de 8 ventas de Ginebra, **4 tienen
`cash_session_id = NULL`**, y una de ellas (folio 5) fue en efectivo: 15 pesos
netos que entraron al cajón y no pertenecen a ningún corte.

El `Payment(CASH)` se graba, el stock se descuenta y **se consume un folio fiscal
real**. Todo cuadra salvo el dinero.

### 2. La conversión de cotización es un bypass abierto a todos los roles

`app/routers/quotes.py:412-487` — `convert_quote_to_sale` **no comprueba sesión de
caja**, su `payment_method` por omisión es **`"CASH"`**, y nunca asigna
`cash_session_id`. No es una exención de roles HQ: **un cajero también puede
saltarse el control por aquí.**

### 3. El síntoma que verá el dueño: dos verdades

Los reportes de **ventas** sí incluyen esas ventas (`/sales/stats`,
`/reports/daily-summary`, `/reports/dashboard`, historial, CSV). Los reportes de
**caja** no pueden verlas (los nueve enumerados en la auditoría, incluido el
tablero de sucursal, que además muestra **cero** si nadie abrió caja hoy).

El dueño ve 8 ventas con efectivo en el desglose de métodos de pago, y un corte
que como mucho explica 4. Ninguna pantalla del producto expone `cash_session_id`,
así que **no tiene forma de detectarlo**.

### 4. Y una asimetría que el sistema crea activamente

Si se devuelve una de esas ventas huérfanas, `app/crud/returns.py:290-333`
**sí** encuentra una caja a la cual cargarle la salida (hasta "la sesión más
reciente de la sucursal, de cualquier cajero"). La entrada es invisible; la salida
aterriza en el cajón de otro. Ese cajero tiene un faltante que no cometió.

---

## P0 · Sacar dinero del cajón no exige nada

`app/routers/cash.py:545-583` (`/outflow`) y `:254-286` (`/movements`):

- **Sin comprobación de rol.** Solo `get_current_user`.
- **Sin autorización de un superior.** Sin PIN, sin `supervisor_id`.
- **Sin límite de monto.**
- **Sin validar saldo disponible** — una salida mayor al efectivo deja el esperado
  en negativo, y el cierre lo convierte en un "sobrante" fantasma.
- **Motivo no obligatorio en el servidor**: `concept` es opcional y el backend
  rellena el literal `"Salida de efectivo"` por su cuenta.

**El contraste dentro del mismo repositorio es la prueba:** devolverle más de
$10,000 a un cliente exige rol GERENTE+, umbral explícito y `force=True`
(`app/crud/returns.py:28,190-196`, `app/routers/returns.py:222`). **Vaciar el
cajón no exige ninguna de las tres.** Los patrones ya existen; no se aplicaron aquí.

**Verificado en producción:** el usuario 31 es **`caja_gin1`, rol CAJERO**. Sacó
**$9,000 de un fondo de $10,000** con el motivo escrito `"error"`.

Sí quedó rastro en `cash_audit_log`, pero por suerte del endpoint usado:
`POST /movements` **no audita nada** y `cash_movements` **no tiene columna de
autor** (`app/models/cash.py:43-49`). Por esa ruta, quién movió el dinero es
irrecuperable.

---

## P0 · El saldo inicial no se puede corregir

`app/routers/cash.py:92` es la **única** escritura de `opening_balance` en todo el
sistema. No existe endpoint de corrección. Y `POST /open` con una caja ya abierta
**devuelve la sesión existente con HTTP 200 y descarta en silencio el saldo
recibido** (`cash.py:70-80`). El esquema tampoco lo acota (`ge=0` ausente,
`app/schemas/cash.py:8-12`).

**La sesión 95 es exactamente esa firma:** fondo `1.00`, seguido de una "entrada"
de `1,376.00`, cierre `1,530.00`, diferencia `0.00`. El cajero tecleó mal, intentó
corregir, el sistema le respondió "listo" sin cambiar nada, y la única salida que
le quedó fue registrar una entrada de efectivo falsa.

**El sistema no permitió el mal uso: lo convirtió en el único camino disponible.**
El costo es que hoy nadie puede decir si esa caja abrió con $1 o con $1,377.

Un saldo inicial es una **declaración de estado**, no una transacción. Colapsar
ambas destruye información y corrompe `total_inflows` en el ticket y en el corte
de sucursal.

---

## P1 · Corregido durante esta auditoría

Cuatro hallazgos de interfaz ya aplicados (commit `2ef8418`):

1. **El conteo ciego solo cubría la mitad de la aplicación.** `CashHistory.tsx:60`
   —la pantalla de cierre de quien no es cajero de sucursal— seguía pre-llenando
   "Efectivo contado" con el esperado.
2. **Un KPI etiquetado "Cierre reportado" mostraba el ESPERADO.** El dueño leía
   como conteo del cajero lo que el sistema esperaba.
3. **`/reports/audit/discrepancies` mostraba `total_cash_sales` bajo la etiqueta
   `expected_cash`**, así que `Contado − Esperado ≠ Diferencia` en la propia
   tabla. Y filtraba por la diferencia **persistida**, de modo que los cortes
   auto-cuadrados en 0.00 quedaban ocultos: la pantalla decía *"sin diferencias
   de caja registradas"* justo cuando nadie había contado nada.
4. **`ADMINISTRADOR` y `DUEÑO` no tenían `/cash-history` en su menú.** El dueño no
   podía llegar a su propio corte.

**Los dos cortes cerrados de Ginebra no son evidencia de nada:** ambos cerraron
con diferencia exactamente `0.00` con el campo pre-llenado.

---

## P1 · Dinero acreditado al turno equivocado

- **Ventas a crédito (PENDING):** `cash_reconciliation.py:60-64` excluye `PENDING`
  de los estados que suman efectivo, pero un abono parcial en efectivo sí crea su
  `Payment`. Ese dinero está en el cajón y el esperado lo ignora → sobrante.
- **Abonos de clientes:** `app/modules/customers/router.py:474-481` cuelga el pago
  del documento **original**, así que se acredita a la sesión de la venta, no a
  aquella donde se recibió el dinero. Si el abono es a cuenta global
  (`sales_document_id` NULL), el `JOIN` lo elimina de **todas** las sesiones.
- **Completar un PENDING en otro turno:** `sales.py:730-742` no reasigna
  `cash_session_id`.
- **Cancelar una venta en efectivo** baja el esperado sin registrar ninguna salida
  (`sales.py:1281`).
- **Propinas:** entran correctamente al esperado, pero no existe ningún movimiento
  que registre su reparto al final del turno → faltante idéntico a un robo.

**Estado en producción:** ninguno de estos está activo hoy — ni Ginebra ni Kaory
tienen ventas PENDING ni canceladas, y no hay pagos sin venta. Son riesgos
latentes que se activan en cuanto se use crédito a clientes.

---

## P2 · Etiquetas que confunden y huecos de auditoría

- `"Ventas"` significa dos cosas en la misma pantalla: el KPI incluye todos los
  métodos; la columna del historial solo efectivo.
- `"Ventas efectivo"` ya viene **neta de cambio**, y el cambio entregado no se
  muestra en ninguna pantalla ni ticket pese a persistirse.
- `"Esperado por método de pago"` son montos ya cobrados, no un esperado.
- El ticket usa dos convenciones de signo distintas en el mismo bloque.
- Las alertas de cierre que el backend calcula (`cash.py:144-152`) **nunca llegan
  al usuario**: el `response_model` las descarta.
- Tras cerrar, el cajero **no ve nunca su faltante o sobrante** si no hay
  impresora configurada.
- `SESSION_OPENED` nunca se emite al log de auditoría; `audit_cash_event` se traga
  las excepciones.
- El asistente de cierre guiado (`CockpitClosingWizard.tsx`) **no está importado
  en ningún archivo**: código muerto con endpoint vivo.

---

## Qué hacer con los cortes existentes

Los dos cortes de Ginebra están cerrados con diferencia 0.00 y no son confiables.
**No hay que reescribirlos.** Los 15 pesos del folio 5 no pertenecen a ninguna de
esas cajas; lo honesto es registrarlos como entrada explícita en la próxima
sesión, con motivo, y dejar la historia como está. El `cash_audit_log` ya conserva
el breakdown completo de ambos cierres si alguna vez hace falta reconstruirlos.
