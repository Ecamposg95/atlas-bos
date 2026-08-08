# Clientes POS — CRUD completo, estado de cuenta PDF premium y envío por WhatsApp

**Fecha:** 2026-08-08
**Estado:** Aprobado por Emmanuel en sesión de brainstorming (alcance "frontend
completo + PDF premium" y mecánica de WhatsApp "share sheet móvil + wa.me"
elegidos por él).
**Repo:** `atlas-bos`. Producto: **Atlas POS** (preset ligero de Atlas One).
**Rama base:** `staging` (la estrategia `release/beta` de
`docs/branching-strategy.md` está obsoleta; el trabajo real fluye
`staging → main`).

## 1. Problema

Emmanuel quiere que un negocio que opera Atlas POS pueda administrar su cartera
de clientes de punta a punta: darlos de alta, editarlos, darlos de baja,
generar su estado de cuenta en PDF y mandárselo por WhatsApp a mano.

El backend ya lo tiene casi todo (`app/modules/customers/`): CRUD con
validaciones de unicidad (RFC/email/teléfono por org), soft-delete con guard de
deuda, ledger financiero (kardex), abonos con vínculo a documento, y un
endpoint de PDF (`GET /customers/{id}/pdf-statement`). Los huecos, verificados
en el código:

1. **El frontend solo lee.** `Customers.tsx` (236 líneas) tiene lista, KPIs,
   búsqueda, detalle con movimientos y modal de abono. No hay UI de crear,
   editar ni eliminar — `customersApi.create/update/delete` existen en
   `frontend/src/api/customers.ts:71-86` y nadie los llama.
2. **No hay botón de PDF ni de WhatsApp** en ninguna vista.
3. **La semántica del saldo está invertida en el frontend.** El modelo define
   positivo = deuda (`current_balance` — "Cuánto nos debe",
   `models.py:40`) y el endpoint `/stats` cuenta deuda como `> 0`. Pero
   `Customers.tsx:68` pinta saldo positivo en verde y `:134,183` ofrecen
   "Registrar pago" solo cuando el saldo es **negativo** — exactamente al
   revés. Hoy el botón de cobrar aparece en los clientes con saldo a favor y
   desaparece en los que deben.
4. **El PDF no es del tenant.** `pdf_generator.py` imprime "ATLAS ERP —
   Soluciones Tecnológicas y Suministros" hardcodeado. Atlas POS es
   multi-tenant: el estado de cuenta debe salir a nombre del negocio que lo
   emite (`Organization.name/legal_name/tax_id/address/phone/email`, que ya
   existen en `app/modules/tenants/models.py:160-170`).
5. **El endpoint del PDF no exige usuario.** `get_customer_statement_pdf`
   (`router.py:496`) depende de `get_current_active_organization` pero no de
   `get_current_user`, a diferencia de todos sus vecinos.
6. **fpdf 1.7.2 es latin-1.** Sin fuentes TTF unicode; acentos y "ñ" dependen
   de transliteración frágil.

## 2. Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Alcance | Frontend completo + PDF premium | El backend CRUD ya existe; el hueco es UI y presentación |
| Motor PDF | **Migrar `fpdf==1.7.2` → `fpdf2`** | Fork moderno API-compatible, puro Python → cero riesgo de deploy en Railway/nixpacks (la lección WeasyPrint de atlas-cortex costó 2 deploys), fuentes TTF unicode reales |
| WeasyPrint | Descartado | Deps nativas en nixpacks + segunda pila de PDF conviviendo con fpdf |
| WhatsApp | **Share sheet móvil + wa.me escritorio** | En móvil `navigator.share` con el PDF como `File` adjunta el documento directo en WhatsApp; en escritorio no existe ese camino: descarga + `wa.me` con mensaje |
| Branding | Del tenant, no de Atlas | El emisor del documento es el negocio del cliente de Atlas POS |
| Saldo | Positivo = deuda = rojo | Alinear frontend con el modelo; es la convención ya escrita en el backend |

### Fuera de alcance

Envío automático (WhatsApp Cloud API / SMTP), enlaces públicos firmados al
estilo atlas-cortex, corrida masiva de estados de cuenta, antigüedad de saldos
por tramos (el ledger POS es un kardex simple cargo/abono, no facturas con
vencimiento), y el portal de cliente (ya existe aparte).

## 3. Arquitectura

### 3.1 Backend — PDF premium con branding del tenant

- `requirements.txt`: `fpdf==1.7.2` → `fpdf2` (pineado a la versión estable
  vigente). fpdf2 mantiene el API de PyFPDF; los tres generadores existentes
  (`generate_quote_pdf`, `generate_cash_cut_pdf`,
  `generate_account_statement_pdf`) deben seguir produciendo PDF válido —
  se cubren con tests de humo que hoy no existen.
- `generate_account_statement_pdf` se rediseña y **gana el parámetro
  `organization`**: encabezado con nombre comercial, razón social, RFC,
  dirección y contacto del tenant; datos del cliente (nombre, RFC, teléfono);
  periodo; saldo anterior; tabla de movimientos con saldo corrido; resumen
  final (total cargos, total abonos, saldo a la fecha). Tipografía TTF unicode
  embebida (una fuente open-source, p. ej. las Source Sans 3 que atlas-cortex
  ya redistribuye) con fallback a core fonts si el archivo no está.
- El logo (`Organization.logo_url`) **no** se descarga en runtime: es una URL
  externa y el generador no debe hacer red. Si en el futuro se guarda binario,
  se agrega.
- `get_customer_statement_pdf` gana `current_user: User =
  Depends(get_current_user)` y pasa la `Organization` al generador (query por
  `org_id` ya resuelto).

### 3.2 Frontend — completar `Customers.tsx`

Se mantiene la vista única `/customers` con sus modales (patrón existente).
Componentes nuevos dentro de `frontend/src/pages/crm/`:

- **Modal Nuevo/Editar cliente** (uno solo, modo por prop): nombre
  (obligatorio), teléfono, email, RFC (`tax_id`), dirección, CP, notas, y el
  bloque de crédito (`has_credit`, `credit_limit`, `credit_days`). No expone
  portal ni campos de lealtad (YAGNI: el POS minimalista no los usa). Los 400
  del backend (RFC/email/teléfono duplicado) se muestran en el modal, no con
  `alert()`.
- **Eliminar**: acción en el modal de detalle, con confirmación. El backend ya
  responde 400 si hay deuda; ese mensaje se muestra tal cual.
- **Fix de semántica**: `balanceColor` y las condiciones de "Registrar pago"
  se invierten (deuda = `> 0` = rojo = cobrable; `< 0` = saldo a favor =
  verde). El KPI "Con crédito" pasa a leerse "Saldo a favor" para no
  confundirse con la configuración de crédito.
- **Botón PDF** en el modal de detalle: pide
  `GET /customers/{id}/pdf-statement` como blob por el cliente axios (con auth)
  con rango de fechas opcional, y lo abre/descarga.
- **Botón WhatsApp** en el modal de detalle:
  - Móvil (si `navigator.canShare({ files })`): baja el blob, lo envuelve en
    `File` (`EdoCuenta_<cliente>.pdf`) y llama `navigator.share` → el share
    sheet permite elegir WhatsApp con el PDF adjunto.
  - Escritorio (fallback): descarga el PDF y abre
    `https://wa.me/<tel>?text=<mensaje>` con mensaje prellenado ("Hola
    <nombre>, te comparto tu estado de cuenta al <fecha>…").
  - Teléfono normalizado a solo dígitos; si tiene 10 dígitos se antepone `52`
    (MX). Utilidad pura `toWaPhone()` para poder probarla mentalmente y
    reutilizarla.
  - Sin teléfono → botón deshabilitado con tooltip "El cliente no tiene
    teléfono".

### 3.3 Sin cambios de modelo ni migraciones

No se toca el esquema. Todo el trabajo es de presentación, un parámetro nuevo
en el generador de PDF y una dependencia de auth.

## 4. Errores y casos límite

| Caso | Comportamiento |
|---|---|
| RFC/email/teléfono duplicado al crear/editar | Mensaje del backend visible en el modal |
| Eliminar cliente con deuda | 400 del backend mostrado tal cual |
| Cliente sin teléfono | Botón WhatsApp deshabilitado con tooltip |
| Cliente sin movimientos | El PDF sale con tabla vacía y saldo en cero |
| Navegador sin share de archivos (desktop/Firefox) | Fallback: descarga + wa.me |
| Usuario cancela el share sheet | No es error; no se reporta nada |
| Organización sin razón social/RFC | El encabezado omite las líneas vacías |
| Fuente TTF ausente en el deploy | Fallback a core fonts; el PDF sale igual |

## 5. Pruebas

Backend (pytest, la suite ya corre en el repo):

- `pdf-statement` exige auth (401 sin token) y org-scoping (404 cruzando org).
- El PDF devuelto empieza con `%PDF` y contiene el nombre de la organización
  emisora y el del cliente (extracción de texto o búsqueda en bytes).
- Saldo anterior: con `start_date`, los movimientos previos se compactan en el
  saldo inicial.
- Humo post-migración a fpdf2: `generate_quote_pdf` y `generate_cash_cut_pdf`
  siguen produciendo `%PDF` válido.
- Unicode: un cliente "Ñoño Pérez & Cía." no rompe el generador.

Frontend: `tsc` + build limpios (no hay infraestructura de tests de frontend
en este repo; no se introduce en este trabajo).

## 6. Riesgos

- **fpdf2 convive con código escrito para PyFPDF 1.7.2.** API-compatible en lo
  que estos generadores usan (`cell`, `ln`, `set_font`, core fonts), pero el
  humo de cotización y corte de caja es obligatorio antes del PR.
- **`navigator.share` con archivos varía por navegador.** El fallback de
  escritorio cubre el peor caso; en iOS Safari y Android Chrome funciona.
- **La lada `52` es una suposición MX.** Documentada en `toWaPhone()`; si el
  producto sale de México, el país del tenant (`Branch.country` ya existe)
  decidirá la lada — hoy YAGNI.
