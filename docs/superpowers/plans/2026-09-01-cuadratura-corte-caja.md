# Cuadratura del corte de caja — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo el efectivo que entra o sale del cajón quede dentro de un corte, que sacarlo exija autorización, y que el dueño vea cifras que corresponden a la realidad.

**Architecture:** La fórmula del esperado ya es correcta y tiene una sola fuente (`app/services/cash_reconciliation.py`); no se toca. El trabajo es cerrar las puertas por las que el efectivo entra o sale sin quedar asociado a una sesión, aplicar a las salidas de caja los mismos controles que ya existen para las devoluciones, convertir el saldo inicial en un dato corregible, y hacer visible lo que hoy es invisible.

**Tech Stack:** FastAPI · SQLAlchemy · pytest · React 18 + TypeScript · PostgreSQL 18

**Spec:** `docs/audits/2026-09-01-cuadratura-corte-caja.md`

## Global Constraints

- **La fórmula del esperado NO se toca.** `cash_reconciliation.py:204-210` está verificada contra dos cortes reales y coincide al peso. Cualquier tarea que la modifique está mal planteada.
- **Nada de reescribir cortes cerrados.** Las sesiones 94 y 95 de la organización 15 quedan como están. El `cash_audit_log` conserva su breakdown.
- **Esta base es MULTICLIENTE** (organizaciones 14 Kaory y 15 Ginebra, y vendrán más). Toda consulta nueva filtra por `organization_id`.
- **Producción está viva en dos entornos.** Cada tarea se despliega al VPS (`app.atlasone.com.mx`) y a Railway. La suite completa (`python3 -m pytest -q`) debe quedar verde antes de cada commit; hoy son 308 pruebas.
- El frontend **no tiene corredor de pruebas**. Se verifica con `npx tsc --noEmit` y `npm run build`. Montar vitest es un trabajo aparte (Task 8).
- Roles de la casa: `ADMINISTRADOR`, `DUEÑO`, `GERENTE`, `CAJERO`. `_is_hq_role` (`app/routers/sales.py:78-92`) cubre los dos primeros más `SUPERADMIN` de plataforma.

---

### Task 1: Exigir caja abierta para cobrar en EFECTIVO, sin excepción de rol

El guard actual discrimina por rol; debe discriminar por si la venta mueve efectivo físico.

**Files:**
- Modify: `app/routers/sales.py:419-438`
- Test: `tests/test_sales_cash_requires_session.py` (crear)

**Interfaces:**
- Consumes: `_is_hq_role` (`sales.py:78-92`), `CashSession`, `PaymentMethod`.
- Produces: `create_sale` responde **409** con detalle `"Debes abrir caja antes de cobrar en efectivo"` cuando el usuario tiene `branch_id` y la venta trae al menos un pago `CASH`, para cualquier rol.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_sales_cash_requires_session.py`:

```python
"""Un cobro en EFECTIVO siempre debe pertenecer a una caja abierta.

El guard usaba el rol como discriminador, asi que un ADMINISTRADOR con sucursal
—el dueño que atiende su propia tienda— cobraba en efectivo sin caja y esos
pesos no entraban en ningun corte. Verificado en produccion: 4 de 8 ventas de
Novedades Ginebra sin cash_session_id, una de ellas en efectivo.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashSession
from app.models.modules import Module, OrganizationModule
from app.models.sales import SalesDocument


def _habilitar_pos(db, org):
    if db.query(Module).filter(Module.key == "pos").first() is None:
        db.add(Module(key="pos", name="Punto de venta")); db.flush()
    if db.query(OrganizationModule).filter(
        OrganizationModule.organization_id == org.id,
        OrganizationModule.module_key == "pos").first() is None:
        db.add(OrganizationModule(organization_id=org.id, module_key="pos", is_enabled=True))
    db.commit()


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("0"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def _venta(sku, metodo):
    return {
        "doc_type": "ORDER",
        "items": [{"sku": sku, "quantity": 1}],
        "payments": [{"method": metodo, "amount": "100.00"}],
    }


class TestEfectivoExigeCaja:
    def test_admin_no_puede_cobrar_efectivo_sin_caja(
        self, client, db, org, hq_branch, admin_user, auth_admin, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = hq_branch.id
        db.commit()

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 409, (
            f"un cobro en efectivo sin caja debe rechazarse, respondio {resp.status_code}: {resp.text[:300]}"
        )
        assert "efectivo" in resp.json()["detail"].lower()
        assert db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).count() == 0

    def test_admin_si_puede_cobrar_con_TARJETA_sin_caja(
        self, client, db, org, hq_branch, admin_user, auth_admin, products_setup
    ):
        """La tarjeta no toca el cajon: la exencion de back-office sigue viva."""
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = hq_branch.id
        db.commit()

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CARD"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code in (200, 201), resp.text

    def test_con_caja_abierta_el_efectivo_queda_asociado(
        self, client, db, org, hq_branch, admin_user, auth_admin, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        admin_user.branch_id = hq_branch.id
        db.commit()
        sesion = _abrir_caja(db, org, hq_branch, admin_user)

        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_admin, "X-Organization-ID": str(org.id)})
        assert resp.status_code in (200, 201), resp.text
        venta = db.query(SalesDocument).filter(SalesDocument.organization_id == org.id).one()
        assert venta.cash_session_id == sesion.id, (
            "la venta debe quedar asociada a la caja abierta"
        )

    def test_el_cajero_sigue_bloqueado_como_antes(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _habilitar_pos(db, org)
        _, variant = products_setup["product_a"]
        resp = client.post("/api/sales/", json=_venta(variant.sku, "CASH"),
                           headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 409
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_sales_cash_requires_session.py -v
```

Esperado: FALLA en `test_admin_no_puede_cobrar_efectivo_sin_caja` — hoy responde 200 y crea la venta.

- [ ] **Step 3: Cambiar el discriminador**

En `app/routers/sales.py`, sustituir el bloque del guard (líneas 419-438) por:

```python
    # El efectivo es fisico y no admite excepciones de rol: si esta venta mete
    # billetes en un cajon de sucursal, tiene que haber una caja abierta que
    # responda por ellos. La exencion historica para roles HQ se conserva solo
    # para lo que NO toca el cajon (tarjeta, transferencia, credito), que es el
    # caso de back-office/migracion para el que se escribio.
    cobra_efectivo = any(
        str(getattr(p.method, "value", p.method)).upper() == "CASH"
        for p in (sale_in.payments or [])
    )
    requiere_caja = bool(current_user.branch_id) and (
        cobra_efectivo or not _is_hq_role(current_user)
    )
    if requiere_caja:
        active_session = db.query(CashSession).filter(
            CashSession.user_id == current_user.id,
            CashSession.branch_id == current_user.branch_id,
            CashSession.status == CashSessionStatus.OPEN,
        ).first()
        if not active_session:
            logger.warning(
                "BLOCKED_CHECKOUT: user_id=%s branch_id=%s pending_sale_id=%s reason=%s",
                current_user.id, current_user.branch_id, sale_in.id,
                "no_open_cash_session_cash_payment" if cobra_efectivo else "no_open_cash_session",
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    "Debes abrir caja antes de cobrar en efectivo"
                    if cobra_efectivo
                    else "Debes abrir caja antes de registrar ventas"
                ),
            )
```

- [ ] **Step 4: Correr las pruebas**

```bash
python3 -m pytest tests/test_sales_cash_requires_session.py -v
```

Esperado: 4 en PASS.

- [ ] **Step 5: Confirmar que no se rompió el resto de caja y ventas**

```bash
python3 -m pytest tests/test_cash_math.py tests/test_cash_invariants.py tests/test_sales_idempotency.py tests/test_folios.py -q
```

Esperado: todo en PASS.

- [ ] **Step 6: Commit**

```bash
git add app/routers/sales.py tests/test_sales_cash_requires_session.py
git commit -m "fix(caja): cobrar en efectivo exige caja abierta, sin excepcion de rol

El guard discriminaba por rol, asi que un ADMINISTRADOR con sucursal cobraba
en efectivo sin caja y ese dinero no entraba en ningun corte. Ahora
discrimina por si la venta mueve efectivo fisico. La exencion de back-office
sigue viva para tarjeta, transferencia y credito."
```

---

### Task 2: Cerrar el bypass de la conversión de cotizaciones

`convert_quote_to_sale` no comprueba caja, su método por omisión es `CASH` y nunca asigna `cash_session_id`. Es un bypass abierto a **todos** los roles, incluido CAJERO.

**Files:**
- Modify: `app/routers/quotes.py:412-487`
- Test: `tests/test_quote_convert_cash_session.py` (crear)

**Interfaces:**
- Consumes: el mismo criterio de la Task 1.
- Produces: `POST /api/quotes/{id}/convert-to-sale` exige `payment_method` explícito, rechaza con 409 el cobro en efectivo sin caja abierta, y asigna `cash_session_id` a la sesión OPEN del cobrador.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_quote_convert_cash_session.py`:

```python
"""Convertir una cotizacion en venta no puede saltarse el control de caja.

`convert_quote_to_sale` no comprobaba sesion, su payment_method por omision era
"CASH" y nunca asignaba cash_session_id: un bypass completo del guard, abierto
a cualquier rol.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashSession
from app.models.sales import SalesDocument


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("0"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


def _crear_cotizacion(client, headers, sku):
    resp = client.post("/api/quotes/", json={
        "doc_type": "QUOTE",
        "items": [{"sku": sku, "quantity": 1}],
    }, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


class TestConversionDeCotizacion:
    def test_efectivo_sin_caja_se_rechaza(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        qid = _crear_cotizacion(client, h, variant.sku)

        resp = client.post(f"/api/quotes/{qid}/convert-to-sale?payment_method=CASH", headers=h)
        assert resp.status_code == 409, (
            f"sin caja abierta no se puede convertir cobrando efectivo: {resp.status_code}"
        )

    def test_con_caja_queda_asociada(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion = _abrir_caja(db, org, branch_a, cajero_a)
        qid = _crear_cotizacion(client, h, variant.sku)

        resp = client.post(f"/api/quotes/{qid}/convert-to-sale?payment_method=CASH", headers=h)
        assert resp.status_code in (200, 201), resp.text
        venta = db.query(SalesDocument).filter(SalesDocument.id == qid).one()
        assert venta.cash_session_id == sesion.id

    def test_el_metodo_de_pago_es_obligatorio(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
    ):
        """Un default de CASH convierte en efectivo por accidente."""
        _, variant = products_setup["product_a"]
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        qid = _crear_cotizacion(client, h, variant.sku)

        resp = client.post(f"/api/quotes/{qid}/convert-to-sale", headers=h)
        assert resp.status_code == 422, "sin payment_method explicito debe ser error de validacion"
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_quote_convert_cash_session.py -v
```

Esperado: FALLAN las tres. Si `_crear_cotizacion` falla por un contrato distinto del endpoint de cotizaciones, ajusta el payload leyendo `app/routers/quotes.py` y `app/schemas/quotes.py` — no cambies las aserciones.

- [ ] **Step 3: Implementar**

En `app/routers/quotes.py`, cambiar la firma para que el método sea obligatorio:

```python
def convert_quote_to_sale(
    quote_id: str,
    payment_method: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
```

y agregar, justo después de recuperar y validar la cotización, antes de crear el `Payment`:

```python
    from app.models.cash import CashSession, CashSessionStatus

    # Mismo criterio que create_sale: el efectivo exige una caja que responda.
    sesion_activa = None
    if current_user.branch_id:
        sesion_activa = db.query(CashSession).filter(
            CashSession.user_id == current_user.id,
            CashSession.branch_id == current_user.branch_id,
            CashSession.status == CashSessionStatus.OPEN,
        ).first()
        if payment_method.upper() == "CASH" and sesion_activa is None:
            raise HTTPException(
                status_code=409,
                detail="Debes abrir caja antes de cobrar en efectivo",
            )
```

y al construir la venta, asignar la sesión:

```python
    quote.cash_session_id = sesion_activa.id if sesion_activa else None
    quote.seller_id = current_user.id
```

Reemplazar además `datetime.now()` por `datetime.now(timezone.utc)` en la línea que actualiza `quote.created_at` (`quotes.py:445`); las columnas son `timestamptz` y un `datetime` naive desplaza la venta fuera de la ventana del corte.

- [ ] **Step 4: Correr las pruebas**

```bash
python3 -m pytest tests/test_quote_convert_cash_session.py -v
python3 -m pytest tests/ -q -k "quote"
```

Esperado: todo en PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/quotes.py tests/test_quote_convert_cash_session.py
git commit -m "fix(caja): convertir cotizacion ya no se salta el control de caja

No comprobaba sesion, su payment_method por omision era CASH y nunca asignaba
cash_session_id: un bypass abierto a cualquier rol, incluido CAJERO."
```

---

### Task 3: Proteger las salidas de caja

Sacar efectivo no exige rol, ni autorización, ni límite, ni saldo suficiente, ni motivo real — mientras devolverle $10,001 a un cliente exige las tres primeras.

**Files:**
- Modify: `app/routers/cash.py:254-286` (`/movements`), `:505-543` (`/inflow`), `:545-583` (`/outflow`)
- Modify: `app/schemas/cash.py` (motivo obligatorio)
- Test: `tests/test_cash_outflow_guards.py` (crear)

**Interfaces:**
- Consumes: `CashSession`, `compute_expected_cash` (`app/services/cash_reconciliation.py`).
- Produces: constante `LARGE_CASH_OUTFLOW_THRESHOLD = Decimal("2000")` en `app/routers/cash.py`; `/outflow` responde 409 si deja el esperado en negativo, 403 si supera el umbral sin rol GERENTE+, y 422 si el motivo tiene menos de 10 caracteres.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_cash_outflow_guards.py`:

```python
"""Sacar efectivo del cajon debe estar tan protegido como devolverlo al cliente.

Hoy /outflow solo comprueba que el monto sea > 0. En produccion un CAJERO saco
$9,000 de un fondo de $10,000 escribiendo "error" como motivo, sin que nadie lo
autorizara. En el mismo repositorio, devolver mas de $10,000 exige rol GERENTE+,
umbral explicito y confirmacion forzada.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashMovement, CashSession
from app.services.cash_reconciliation import compute_expected_cash


def _abrir_caja(db, org, branch, user, fondo="100.00"):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal(fondo), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


class TestGuardasDeSalida:
    def test_no_puede_dejar_la_caja_en_negativo(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "100.00")
        resp = client.post(
            "/api/cash/outflow?amount=5000&reason=pago a proveedor de papeleria",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 409, (
            f"una salida mayor al efectivo disponible debe rechazarse: {resp.status_code}"
        )
        assert db.query(CashMovement).count() == 0

    def test_monto_alto_exige_rol_superior(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "10000.00")
        resp = client.post(
            "/api/cash/outflow?amount=9000&reason=deposito bancario del corte",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 403, (
            f"un cajero no debe sacar montos altos sin autorizacion: {resp.status_code}"
        )

    def test_gerente_si_puede_el_monto_alto(
        self, client, db, org, branch_a, gerente_a, auth_gerente_a
    ):
        _abrir_caja(db, org, branch_a, gerente_a, "10000.00")
        resp = client.post(
            "/api/cash/outflow?amount=9000&reason=deposito bancario del corte",
            headers={**auth_gerente_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text

    def test_motivo_vacio_o_trivial_se_rechaza(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        for motivo in ["", "error", "x"]:
            resp = client.post(
                f"/api/cash/outflow?amount=50&reason={motivo}",
                headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
            )
            assert resp.status_code == 422, (
                f"el motivo {motivo!r} no deberia aceptarse: {resp.status_code}"
            )

    def test_salida_valida_pasa_y_baja_el_esperado(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        sesion = _abrir_caja(db, org, branch_a, cajero_a, "1000.00")
        resp = client.post(
            "/api/cash/outflow?amount=200&reason=compra de bolsas para la tienda",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        db.refresh(sesion)
        assert Decimal(str(compute_expected_cash(db, sesion).expected)) == Decimal("800.00")
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_cash_outflow_guards.py -v
```

Esperado: fallan las cuatro primeras (hoy todas responden 200); la última pasa.

- [ ] **Step 3: Implementar las guardas**

En `app/routers/cash.py`, junto a las constantes del módulo:

```python
# Umbral por encima del cual una salida de efectivo exige rol GERENTE+.
# Espeja el patron que ya existe para reembolsos en efectivo
# (app/crud/returns.py:28, LARGE_CASH_REFUND_THRESHOLD).
LARGE_CASH_OUTFLOW_THRESHOLD = Decimal("2000")
MIN_REASON_LENGTH = 10
ROLES_SALIDA_ALTA = {"ADMINISTRADOR", "DUEÑO", "GERENTE"}
```

y un helper compartido por los tres endpoints de escritura:

```python
def _validar_salida(db, session, current_user, amount: Decimal, reason: str) -> None:
    """Guardas de una salida de efectivo. Lanza HTTPException si no procede."""
    motivo = (reason or "").strip()
    if len(motivo) < MIN_REASON_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Describe el motivo de la salida (al menos {MIN_REASON_LENGTH} caracteres).",
        )
    if amount > LARGE_CASH_OUTFLOW_THRESHOLD:
        rol = str(getattr(current_user.role, "value", current_user.role))
        if rol not in ROLES_SALIDA_ALTA:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Una salida mayor a {LARGE_CASH_OUTFLOW_THRESHOLD} requiere "
                    f"autorizacion de un gerente o el dueño."
                ),
            )
    from app.services.cash_reconciliation import compute_expected_cash
    disponible = Decimal(str(compute_expected_cash(db, session).expected))
    if amount > disponible:
        raise HTTPException(
            status_code=409,
            detail=(
                f"La caja tiene {disponible} disponible; no se puede sacar {amount}."
            ),
        )
```

Llamarlo en `/outflow` y en `/movements` (rama OUT) justo después de resolver la sesión y antes de insertar el `CashMovement`. En `/inflow` aplicar solo la validación de motivo.

- [ ] **Step 4: Correr las pruebas**

```bash
python3 -m pytest tests/test_cash_outflow_guards.py -v
python3 -m pytest tests/test_cash_math.py tests/test_cash_audit.py tests/test_cash_invariants.py -q
```

Esperado: todo en PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/cash.py tests/test_cash_outflow_guards.py
git commit -m "fix(caja): las salidas de efectivo ahora exigen motivo, saldo y autorizacion

Sacar dinero del cajon solo comprobaba que el monto fuera > 0: sin rol, sin
supervisor, sin limite y sin validar saldo disponible — mientras devolver mas
de 10k a un cliente exige las tres. En produccion un CAJERO saco 9,000 de un
fondo de 10,000 con el motivo 'error'."
```

---

### Task 4: Registrar quién movió el dinero

`cash_movements` no tiene columna de autor y `POST /movements` no escribe auditoría.

**Files:**
- Modify: `app/models/cash.py:40-51`
- Modify: `app/routers/cash.py:254-286`, `:505-543`, `:545-583`
- Create: `scripts/migrate_add_cash_movement_author.py`
- Test: `tests/test_cash_movement_author.py` (crear)

**Interfaces:**
- Consumes: `audit_cash_event` (`app/services/cash_audit.py`), `CashAuditEvent`.
- Produces: columna `cash_movements.created_by_user_id` (FK a `users.id`, nullable para las filas históricas), poblada en las tres rutas de escritura.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_cash_movement_author.py`:

```python
"""Todo movimiento de caja debe saber quien lo creo.

`cash_movements` no tenia columna de autor y POST /movements no escribia
auditoria: por esa ruta, quien saco el dinero era irrecuperable.
"""
from decimal import Decimal

from app.models.cash import CashMovement, CashSession
from app.models.cash_audit import CashAuditLog


def _abrir_caja(db, org, branch, user):
    s = CashSession(user_id=user.id, branch_id=branch.id, organization_id=org.id,
                    opening_balance=Decimal("1000"), status="OPEN")
    db.add(s); db.commit(); db.refresh(s)
    return s


class TestAutoriaDeMovimientos:
    def test_la_salida_guarda_el_autor(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/outflow?amount=100&reason=compra de material de limpieza",
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code == 200, resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id

    def test_movements_tambien_audita(self, client, db, org, branch_a, cajero_a, auth_cajero_a):
        sesion = _abrir_caja(db, org, branch_a, cajero_a)
        resp = client.post(
            "/api/cash/movements",
            json={"type": "OUT", "amount": "100.00", "concept": "compra de material de limpieza"},
            headers={**auth_cajero_a, "X-Organization-ID": str(org.id)},
        )
        assert resp.status_code in (200, 201), resp.text
        mv = db.query(CashMovement).one()
        assert mv.created_by_user_id == cajero_a.id
        assert db.query(CashAuditLog).filter(CashAuditLog.session_id == sesion.id).count() >= 1
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_cash_movement_author.py -v
```

Esperado: FALLA con `AttributeError` — la columna no existe.

- [ ] **Step 3: Agregar la columna al modelo**

En `app/models/cash.py`, dentro de `CashMovement`:

```python
    # Autoria del hecho, no del log: un movimiento sin autor no es auditable.
    # Nullable porque las filas creadas antes de esta columna no lo tienen.
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
```

- [ ] **Step 4: Poblarla en las tres rutas y auditar `/movements`**

En cada `CashMovement(...)` de `app/routers/cash.py` agregar `created_by_user_id=current_user.id`. En `/movements`, añadir tras el `db.add(...)` la misma llamada que ya usan `/inflow` y `/outflow`:

```python
    from app.services.cash_audit import audit_cash_event
    from app.models.cash_audit import CashAuditEvent
    audit_cash_event(
        db,
        event_type=CashAuditEvent.MANUAL_OUTFLOW if tipo == "OUT" else CashAuditEvent.MANUAL_INFLOW,
        session_id=session.id, user_id=current_user.id, amount=monto,
    )
```

- [ ] **Step 5: Escribir la migración**

Crear `scripts/migrate_add_cash_movement_author.py`:

```python
"""Columna `created_by_user_id` en cash_movements.

Los movimientos no registraban quien los creaba. Las filas historicas quedan
en NULL a proposito: inventarles un autor seria peor que reconocer que no se
sabe.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.core.database import engine


def main() -> None:
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"
        ))
        if engine.dialect.name == "postgresql":
            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE cash_movements
                        ADD CONSTRAINT cash_movements_created_by_user_id_fkey
                        FOREIGN KEY (created_by_user_id) REFERENCES users(id);
                EXCEPTION WHEN duplicate_object THEN NULL; END $$;
            """))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_cash_movements_created_by "
                "ON cash_movements (created_by_user_id)"
            ))
    print("[migrate] OK — cash_movements.created_by_user_id listo.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Correr pruebas y aplicar la migración**

```bash
python3 -m pytest tests/test_cash_movement_author.py tests/test_cash_audit.py -v
```

Esperado: PASS. Después, en el VPS:

```bash
ssh ionos 'docker exec -e PYTHONPATH=/app atlas-one-prod python scripts/migrate_add_cash_movement_author.py'
```

- [ ] **Step 7: Commit**

```bash
git add app/models/cash.py app/routers/cash.py scripts/migrate_add_cash_movement_author.py tests/test_cash_movement_author.py
git commit -m "fix(caja): los movimientos ahora registran quien los creo

cash_movements no tenia columna de autor y POST /movements no escribia
auditoria: por esa ruta era imposible saber quien saco el dinero."
```

---

### Task 5: Corregir el saldo inicial sin inventar una entrada

Hoy `opening_balance` se escribe una sola vez y no hay forma de corregirlo; `POST /open` con caja abierta descarta el valor en silencio. Eso convierte la "entrada de efectivo" en el único camino, que es lo que produjo la sesión 95.

**Files:**
- Modify: `app/routers/cash.py:56-105` (`open_session`)
- Modify: `app/schemas/cash.py:8-12`
- Test: `tests/test_cash_opening_balance.py` (crear)

**Interfaces:**
- Produces: `PATCH /api/cash/sessions/{id}/opening-balance` con cuerpo `{"opening_balance": Decimal, "reason": str}`; responde 409 si la sesión ya tiene ventas o movimientos, o si está cerrada. `POST /open` con sesión abierta responde **409** con el saldo actual en el detalle.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_cash_opening_balance.py`:

```python
"""El saldo inicial es una declaracion de estado, no una transaccion.

No existia forma de corregirlo y POST /open con caja abierta devolvia 200
descartando el valor recibido en silencio. El unico camino que le quedaba al
cajero era registrar una "entrada de efectivo" falsa — que es exactamente lo
que ocurrio en produccion: fondo 1.00 seguido de una entrada de 1,376.00.
"""
from decimal import Decimal

import pytest

from app.models.cash import CashMovement, CashSession


class TestSaldoInicial:
    def test_abrir_con_caja_abierta_avisa_en_vez_de_ignorar(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        r1 = client.post("/api/cash/open", json={"opening_balance": "1.00"}, headers=h)
        assert r1.status_code in (200, 201), r1.text

        r2 = client.post("/api/cash/open", json={"opening_balance": "1377.00"}, headers=h)
        assert r2.status_code == 409, (
            "reabrir con otro saldo no puede responder exito y descartar el valor"
        )
        assert "1.00" in r2.json()["detail"]

    def test_se_puede_corregir_antes_de_la_primera_venta(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion_id = client.post("/api/cash/open", json={"opening_balance": "1.00"},
                                headers=h).json()["id"]

        resp = client.patch(
            f"/api/cash/sessions/{sesion_id}/opening-balance",
            json={"opening_balance": "1377.00", "reason": "fondo capturado mal al abrir"},
            headers=h,
        )
        assert resp.status_code == 200, resp.text
        sesion = db.query(CashSession).filter(CashSession.id == sesion_id).one()
        assert Decimal(str(sesion.opening_balance)) == Decimal("1377.00")
        assert db.query(CashMovement).count() == 0, (
            "corregir el fondo no debe inventar un movimiento de efectivo"
        )

    def test_no_se_puede_corregir_con_movimientos_ya_registrados(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        h = {**auth_cajero_a, "X-Organization-ID": str(org.id)}
        sesion_id = client.post("/api/cash/open", json={"opening_balance": "1000.00"},
                                headers=h).json()["id"]
        client.post("/api/cash/outflow?amount=50&reason=compra de bolsas para la tienda",
                    headers=h)

        resp = client.patch(
            f"/api/cash/sessions/{sesion_id}/opening-balance",
            json={"opening_balance": "2000.00", "reason": "quiero cambiarlo"},
            headers=h,
        )
        assert resp.status_code == 409, (
            "con movimientos ya registrados, cambiar el fondo reescribe la historia"
        )

    def test_el_saldo_inicial_no_puede_ser_negativo(
        self, client, db, org, branch_a, cajero_a, auth_cajero_a
    ):
        resp = client.post("/api/cash/open", json={"opening_balance": "-5.00"},
                           headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
        assert resp.status_code == 422
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_cash_opening_balance.py -v
```

Esperado: fallan las cuatro.

- [ ] **Step 3: Acotar el esquema**

En `app/schemas/cash.py`:

```python
from pydantic import BaseModel, Field


class CashSessionBase(BaseModel):
    opening_balance: Decimal = Field(ge=0)


class OpeningBalanceCorrection(BaseModel):
    """Correccion del fondo declarado al abrir. No es un movimiento de efectivo."""
    opening_balance: Decimal = Field(ge=0)
    reason: str = Field(min_length=10)
```

- [ ] **Step 4: Que `POST /open` avise en vez de ignorar**

En `app/routers/cash.py`, en `open_session`, sustituir el `return active` por:

```python
    if active:
        # Antes esto devolvia 200 con la sesion existente y descartaba en
        # silencio el opening_balance recibido. El cajero que corregia un fondo
        # mal capturado veia "listo" sin que nada cambiara, y su unico recurso
        # era registrar una entrada de efectivo falsa.
        raise HTTPException(
            status_code=409,
            detail=(
                f"Ya tienes una caja abierta con fondo {active.opening_balance}. "
                f"Para corregirlo usa PATCH /cash/sessions/{active.id}/opening-balance."
            ),
        )
```

- [ ] **Step 5: Agregar el endpoint de corrección**

```python
@router.patch("/sessions/{session_id}/opening-balance", response_model=CashSessionRead)
def corregir_saldo_inicial(
    session_id: int,
    payload: OpeningBalanceCorrection,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
    """Corrige el fondo declarado al abrir, mientras la caja siga limpia.

    Es un cambio de estado declarado y auditado, no una transaccion: si ya hay
    ventas o movimientos, cambiar el fondo reescribiria la historia y la
    correccion deja de ser correccion.
    """
    session = db.query(CashSession).filter(
        CashSession.id == session_id,
        CashSession.organization_id == org_id,
    ).with_for_update().first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    if session.status != CashSessionStatus.OPEN:
        raise HTTPException(status_code=409, detail="La caja ya está cerrada.")

    tiene_movimientos = db.query(CashMovement).filter(
        CashMovement.session_id == session.id).count() > 0
    tiene_ventas = db.query(SalesDocument).filter(
        SalesDocument.cash_session_id == session.id).count() > 0
    if tiene_movimientos or tiene_ventas:
        raise HTTPException(
            status_code=409,
            detail=(
                "La caja ya tiene movimientos o ventas: el fondo no se puede "
                "corregir. Registra un ajuste con autorización."
            ),
        )

    anterior = session.opening_balance
    session.opening_balance = payload.opening_balance

    from app.services.cash_audit import audit_cash_event
    from app.models.cash_audit import CashAuditEvent
    audit_cash_event(
        db,
        event_type=CashAuditEvent.SESSION_OPENED,
        session_id=session.id,
        user_id=current_user.id,
        amount=payload.opening_balance,
        payload={"correccion": True, "antes": str(anterior),
                 "despues": str(payload.opening_balance), "motivo": payload.reason},
    )
    db.commit()
    db.refresh(session)
    return session
```

Si la firma de `audit_cash_event` no acepta `payload`, léela en `app/services/cash_audit.py` y adapta la llamada a los parámetros reales; no cambies el resto.

- [ ] **Step 6: Correr las pruebas**

```bash
python3 -m pytest tests/test_cash_opening_balance.py -v
python3 -m pytest tests/test_cash_math.py tests/test_cash_audit.py -q
```

Esperado: todo en PASS.

- [ ] **Step 7: Commit**

```bash
git add app/routers/cash.py app/schemas/cash.py tests/test_cash_opening_balance.py
git commit -m "feat(caja): el fondo inicial se puede corregir mientras la caja este limpia

No existia forma de corregirlo y POST /open con caja abierta descartaba el
valor en silencio, asi que el unico camino era una entrada de efectivo falsa."
```

---

### Task 6: Hacer visible el efectivo que hoy nadie ve

Cerradas las puertas nuevas, quedan las ventas huérfanas ya existentes y las que produzca cualquier camino no previsto. El sistema debe gritarlo, no callarlo.

**Files:**
- Modify: `app/services/cash_reconciliation.py` (función `compute_closure_warnings`, ~línea 230)
- Modify: `app/routers/cash.py:106-206` (devolver las alertas en la respuesta de cierre)
- Modify: `app/schemas/cash.py` (`CashSessionRead` con `warnings`)
- Test: `tests/test_cash_warning_ventas_sin_corte.py` (crear)

**Interfaces:**
- Consumes: `compute_closure_warnings`.
- Produces: alerta con código `SALES_WITHOUT_SESSION` en la lista de `warnings` del cierre, y esa lista expuesta en la respuesta HTTP.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/test_cash_warning_ventas_sin_corte.py`:

```python
"""El cierre debe avisar si hay ventas en efectivo fuera de todo corte.

Ninguna pantalla exponia `cash_session_id`, asi que el dueño no tenia forma de
detectar el efectivo huerfano. La deteccion vivia solo en SQL manual de los
runbooks.
"""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.sales import DocumentStatus, PaymentMethod, Payment, SalesDocument


def _venta_huerfana_en_efectivo(db, org, branch, user, monto="15.00"):
    s = SalesDocument(
        organization_id=org.id, branch_id=branch.id, seller_id=user.id,
        folio=999, series="A", subtotal=Decimal(monto), tax_amount=Decimal("0"),
        total_amount=Decimal(monto), status=DocumentStatus.PAID, doc_type="ORDER",
        cash_session_id=None,
    )
    db.add(s); db.flush()
    db.add(Payment(sales_document_id=s.id, amount=Decimal(monto),
                   method=PaymentMethod.CASH, organization_id=org.id))
    db.commit()
    return s


def test_el_cierre_avisa_de_ventas_sin_corte(client, db, org, branch_a, cajero_a, auth_cajero_a):
    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"), status="OPEN")
    db.add(sesion); db.commit(); db.refresh(sesion)
    _venta_huerfana_en_efectivo(db, org, branch_a, cajero_a)

    resp = client.post("/api/cash/close", json={"closing_balance": "0.00"},
                       headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text
    codigos = [w.get("code") for w in resp.json().get("warnings", [])]
    assert "SALES_WITHOUT_SESSION" in codigos, (
        f"el cierre debe avisar del efectivo fuera de corte; alertas: {codigos}"
    )
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_cash_warning_ventas_sin_corte.py -v
```

Esperado: FALLA — hoy la respuesta de cierre no incluye `warnings`.

- [ ] **Step 3: Agregar la alerta**

En `compute_closure_warnings` de `app/services/cash_reconciliation.py`, añadir:

```python
    # Efectivo cobrado hoy en esta sucursal que no pertenece a ninguna caja.
    # Antes esto era invisible: ninguna pantalla expone cash_session_id.
    huerfanas = db.query(
        func.count(SalesDocument.id), func.coalesce(func.sum(Payment.amount), 0)
    ).join(Payment, Payment.sales_document_id == SalesDocument.id).filter(
        SalesDocument.organization_id == session.organization_id,
        SalesDocument.branch_id == session.branch_id,
        SalesDocument.cash_session_id.is_(None),
        SalesDocument.deleted_at.is_(None),
        Payment.method == PaymentMethod.CASH,
        SalesDocument.created_at >= session.opened_at,
    ).first()
    n_huerfanas, monto_huerfano = (huerfanas or (0, 0))
    if n_huerfanas:
        warnings.append({
            "code": "SALES_WITHOUT_SESSION",
            "severity": "high",
            "message": (
                f"{n_huerfanas} venta(s) en efectivo por {monto_huerfano} no pertenecen "
                f"a ningún corte. Ese dinero está en el cajón pero no en el esperado."
            ),
        })
```

- [ ] **Step 4: Devolver las alertas en la respuesta de cierre**

En `app/schemas/cash.py`, agregar a `CashSessionRead`:

```python
    warnings: list[dict] = []
```

y en `close_session` (`app/routers/cash.py`), adjuntar `closure_warnings` al objeto devuelto en vez de descartarlas. El comentario del propio código ya declara esa intención.

- [ ] **Step 5: Correr las pruebas**

```bash
python3 -m pytest tests/test_cash_warning_ventas_sin_corte.py tests/test_cash_math.py -v
```

Esperado: PASS.

- [ ] **Step 6: Mostrarlas al cerrar**

En `frontend/src/components/branch/CashBranchView.tsx`, tras un cierre exitoso, renderizar las alertas devueltas en vez de solo `toast.success('Turno cerrado')`. Mostrar también Esperado / Contado / Diferencia, que hoy el cajero **nunca ve en pantalla** si no hay impresora.

Verificar con `npx tsc --noEmit && npm run build`.

- [ ] **Step 7: Commit**

```bash
git add app/services/cash_reconciliation.py app/routers/cash.py app/schemas/cash.py frontend/src/components/branch/CashBranchView.tsx tests/test_cash_warning_ventas_sin_corte.py
git commit -m "feat(caja): el cierre avisa del efectivo que quedo fuera de corte

Y ademas muestra en pantalla esperado/contado/diferencia: hasta ahora el
cajero no veia nunca su faltante si no habia impresora configurada."
```

---

### Task 7: Dinero acreditado al turno equivocado

Riesgos latentes hoy (ni Ginebra ni Kaory tienen ventas PENDING, canceladas ni abonos), que se activan en cuanto se use crédito a clientes.

**Files:**
- Modify: `app/services/cash_reconciliation.py:60-64` (incluir `PENDING`)
- Modify: `app/routers/sales.py:730-742` (reasignar `cash_session_id` al completar)
- Modify: `app/modules/customers/router.py:474-481` (abonos)
- Test: `tests/test_cash_credito_y_abonos.py` (crear)

**Interfaces:**
- Produces: el efectivo de una venta a crédito y el de un abono posterior entran al esperado de la caja **donde se recibió el dinero**.

- [ ] **Step 1: Escribir la prueba que falla**

```python
"""El efectivo entra al corte donde se recibio, no al de la venta original."""
from decimal import Decimal

from app.models.cash import CashSession
from app.models.sales import DocumentStatus
from app.services.cash_reconciliation import compute_expected_cash


def test_abono_parcial_en_efectivo_entra_al_esperado(
    client, db, org, branch_a, cajero_a, auth_cajero_a, products_setup
):
    """Venta a credito con abono en efectivo: los pesos estan en el cajon."""
    _, variant = products_setup["product_a"]
    sesion = CashSession(user_id=cajero_a.id, branch_id=branch_a.id,
                         organization_id=org.id, opening_balance=Decimal("0"), status="OPEN")
    db.add(sesion); db.commit(); db.refresh(sesion)

    resp = client.post("/api/sales/", json={
        "doc_type": "ORDER",
        "customer_id": None,
        "items": [{"sku": variant.sku, "quantity": 1}],
        "payments": [{"method": "CASH", "amount": "40.00"}],
    }, headers={**auth_cajero_a, "X-Organization-ID": str(org.id)})
    assert resp.status_code in (200, 201), resp.text

    esperado = Decimal(str(compute_expected_cash(db, sesion).expected))
    assert esperado == Decimal("40.00"), (
        f"los 40 pesos del abono estan en el cajon; el esperado dice {esperado}"
    )
```

- [ ] **Step 2: Correrla y confirmar que falla**

```bash
python3 -m pytest tests/test_cash_credito_y_abonos.py -v
```

Esperado: FALLA con `esperado == 0` — `PENDING` está fuera de `CASH_INCLUDED_STATUSES`.

- [ ] **Step 3: Incluir PENDING**

En `app/services/cash_reconciliation.py`:

```python
CASH_INCLUDED_STATUSES = (
    DocumentStatus.PAID,
    DocumentStatus.REFUNDED_PARTIAL,
    DocumentStatus.REFUNDED_TOTAL,
    # Una venta a credito con abono parcial en efectivo tiene ese dinero en el
    # cajon. El esperado se construye desde las filas Payment (lo realmente
    # cobrado), no desde total_amount, asi que incluir PENDING no infla nada.
    DocumentStatus.PENDING,
)
```

- [ ] **Step 4: Reasignar la sesión al completar un PENDING**

En `app/routers/sales.py`, rama `if existing_sale:`, junto a la actualización de `status`:

```python
        # El dinero entra al cajon de HOY, no al del dia en que se abrio la venta.
        if doc_status == DocumentStatus.PAID and active_cash:
            existing_sale.cash_session_id = active_cash[0]
```

- [ ] **Step 5: Correr las pruebas**

```bash
python3 -m pytest tests/test_cash_credito_y_abonos.py tests/test_cash_math.py -v
```

Esperado: PASS. Si `test_cash_math.py` falla, revisa si alguna prueba asumía que `PENDING` no contaba — ese supuesto es justo el defecto.

- [ ] **Step 6: Commit**

```bash
git add app/services/cash_reconciliation.py app/routers/sales.py tests/test_cash_credito_y_abonos.py
git commit -m "fix(caja): el efectivo de ventas a credito entra al corte donde se recibio"
```

---

### Task 8: Pruebas del frontend para lo que maneja dinero

Las tareas anteriores cambian pantallas de efectivo verificadas solo con `tsc` y `build`. El conteo ciego, que es un control anti-fraude, hoy no tiene ni una prueba.

**Files:**
- Modify: `frontend/package.json` (script `test`, dependencias de desarrollo)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/utils/blindCash.test.ts`

**Interfaces:**
- Consumes: `isValidCount`, `shouldRevealExpected`, `shouldShowExpectedKpi` (`frontend/src/utils/blindCash.ts`).
- Produces: `npm test` en `frontend/`.

- [ ] **Step 1: Instalar vitest**

```bash
cd frontend && npm install --save-dev vitest@^2
```

- [ ] **Step 2: Configurar**

Crear `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

y agregar a `frontend/package.json` en `scripts`: `"test": "vitest run"`.

- [ ] **Step 3: Escribir las pruebas del conteo ciego**

Crear `frontend/src/utils/blindCash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isValidCount, shouldRevealExpected, shouldShowExpectedKpi } from './blindCash'

describe('isValidCount', () => {
  it('rechaza vacio y basura', () => {
    for (const v of ['', '   ', 'abc', '-5']) expect(isValidCount(v)).toBe(false)
  })
  it('acepta un conteo numerico, incluido el cero', () => {
    for (const v of ['0', '0.00', '1530.50']) expect(isValidCount(v)).toBe(true)
  })
})

describe('shouldRevealExpected', () => {
  it('oculta el esperado hasta que hay conteo', () => {
    expect(shouldRevealExpected('')).toBe(false)
    expect(shouldRevealExpected('1530.00')).toBe(true)
  })
})

describe('shouldShowExpectedKpi', () => {
  it('enmascara mientras el turno esta abierto', () => {
    expect(shouldShowExpectedKpi(true)).toBe(false)
    expect(shouldShowExpectedKpi(false)).toBe(true)
  })
})
```

- [ ] **Step 4: Correrlas**

```bash
cd frontend && npm test
```

Esperado: todas en PASS. Si `isValidCount('-5')` pasa, corrige `blindCash.ts` — un conteo negativo no existe.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts frontend/src/utils/blindCash.test.ts
git commit -m "test(frontend): vitest y pruebas del conteo ciego

Se cambio logica de manejo de efectivo verificandola solo con tsc y build."
```

---

## Orden de ejecución y despliegue

| Fase | Tareas | Por qué en ese lugar |
|---|---|---|
| 1 | 1, 2 | Cierran las puertas por las que entra efectivo fuera de corte. Sin esto, todo lo demás mide mal. |
| 2 | 3, 4 | Sacar dinero deja de ser libre y pasa a ser atribuible. |
| 3 | 5 | El fondo inicial deja de forzar entradas falsas. |
| 4 | 6 | Lo que ya se escapó se vuelve visible. |
| 5 | 7, 8 | Riesgos latentes y red de seguridad del frontend. |

Cada fase se despliega y verifica antes de la siguiente:

```bash
ssh ionos 'rm -rf /srv/apps/atlas-one-prod/src && mkdir -p /srv/apps/atlas-one-prod/src'
git archive --format=tar HEAD | ssh ionos 'tar -x -C /srv/apps/atlas-one-prod/src'
scp Dockerfile .dockerignore ionos:/srv/apps/atlas-one-prod/src/
ssh ionos 'cd /srv/apps/atlas-one-prod && docker compose build && docker compose up -d'
git push origin main   # Railway despliega solo
```

## Qué NO hace este plan

- **No reescribe los cortes cerrados** de Ginebra. Quedan como están; el `cash_audit_log` conserva su breakdown si alguna vez hace falta reconstruirlos.
- **No decide qué hacer con los 15 pesos del folio 5.** Esa es una conversación con el dueño: lo honesto es registrarlos como entrada explícita en la próxima sesión, con motivo, no reasignar la venta a una caja que nunca los recibió.
- **No toca la fórmula del esperado.** Está verificada y es correcta.
- **No arregla las etiquetas confusas de P2** (`"Ventas"` con dos significados, el cambio entregado que no se muestra, los signos del ticket, el asistente de cierre muerto). Son reales pero no mueven dinero; merecen su propio plan.
