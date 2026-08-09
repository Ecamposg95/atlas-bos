# Clientes POS — CRUD frontend, PDF premium y WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el módulo de clientes de Atlas POS: UI de alta/edición/baja, estado de cuenta PDF con branding del tenant (fpdf2 + fuente unicode), y envío manual por WhatsApp (share sheet móvil / wa.me escritorio).

**Architecture:** El backend CRUD ya existe (`app/modules/customers/`). Se migra `fpdf==1.7.2 → fpdf2`, el generador del estado de cuenta se muda al módulo (`statement_pdf.py`) con un builder de contexto puro (testeable) y un renderer fpdf2; el endpoint gana auth y branding. El frontend completa `Customers.tsx` con modal de formulario, corrección de la semántica del saldo, y botones PDF/WhatsApp.

**Tech Stack:** FastAPI + SQLAlchemy + pytest (SQLite in-memory vía conftest), fpdf2, React + TS + Vite (sin infra de tests frontend; gate = `npm run build`, que corre `tsc && vite build`).

**Spec:** `docs/superpowers/specs/2026-08-08-clientes-pos-crud-estado-cuenta-design.md`

## Global Constraints

- Rama de trabajo: `feat/clientes-estado-cuenta` (ya existe, base `staging`). PR a `staging`.
- Tests backend: `python3 -m pytest tests/ -q` desde la raíz del repo. Si faltan deps: `pip install --user --break-system-packages -r requirements.txt`.
- Gate frontend: `cd frontend && npm run build` (incluye `tsc`).
- Rutas montadas bajo `/api/customers` (`app/main.py:149`).
- Convención de saldo: **positivo = deuda del cliente** (`Customer.current_balance` — "cuánto nos debe").
- Estilo frontend: clases `dax-*` existentes (`dax-card`, `dax-input`, `dax-btn-primary`, `dax-btn-secondary`), FontAwesome `fa-solid`, español.
- No se toca el esquema de BD. Sin migraciones.
- Los mensajes de commit terminan con:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01GTqUCkxRkbBHinVv7gdyAE`

---

### Task 1: Migrar fpdf → fpdf2 con tests de humo de los tres generadores

La librería `fpdf==1.7.2` (PyFPDF, latin-1) se reemplaza por `fpdf2` (mismo API
base, unicode, mantenida). Los tres generadores existentes terminan con
`pdf.output(dest='S').encode('latin-1')` o `pdf.output()`; en fpdf2 `output()`
devuelve `bytearray` (sin `.encode`), así que esas líneas DEBEN cambiar a
`bytes(pdf.output())`. Primero los tests de humo (que hoy no existen), luego la
migración.

**Files:**
- Modify: `requirements.txt` (línea `fpdf==1.7.2`)
- Modify: `app/utils/pdf_generator.py:135,344,346,459` (las salidas `output`)
- Test: `tests/test_pdf_generators_smoke.py` (nuevo)

**Interfaces:**
- Produces: los tres generadores devuelven `bytes` que empiezan con `%PDF`.
  `generate_account_statement_pdf` conserva su firma actual en esta task
  (cambia en Task 3).

- [ ] **Step 1: Escribir los tests de humo (fallarán tras el cambio de lib si algo se rompe)**

```python
# tests/test_pdf_generators_smoke.py
"""Humo de los generadores fpdf2: producen %PDF válido con datos mínimos.

Los fixtures son SimpleNamespace/dicts con exactamente los atributos que cada
generador lee — no tocan BD.
"""
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.utils.pdf_generator import generate_quote_pdf, generate_cash_cut_pdf


def _quote():
    customer = SimpleNamespace(name="Ñoño Pérez & Cía.", tax_id="XAXX010101000")
    line = SimpleNamespace(
        description="SKU-1 - Café de olla 500g",
        quantity=2,
        unit_price=Decimal("120.50"),
        total_line=Decimal("241.00"),
    )
    return SimpleNamespace(
        series="COT", folio=42, created_at=datetime(2026, 8, 1, 10, 30),
        customer=customer, lines=[line], total_amount=Decimal("241.00"),
    )


def _audit_data():
    return {
        "session": {
            "id": 7, "branch_name": "Sucursal Centro", "user_name": "Cajero Uno",
            "opened_at": datetime(2026, 8, 1, 9, 0), "closed_at": datetime(2026, 8, 1, 21, 0),
            "opening_balance": 500.0,
        },
        "payments": {
            "cash": {"total": 1500.0, "count": 10},
            "card": {"total": 800.0, "count": 4},
            "transfer": {"total": 0, "count": 0},
        },
        "movements": {"inflows": 100.0, "outflows": 50.0, "list": [
            {"time": "12:30", "type": "OUT", "reason": "Compra de hielo", "amount": 50.0},
        ]},
        "kpis": {"total_sales": 2300.0, "total_tickets": 14, "avg_ticket": 164.29, "total_taxes": 0},
        "reconciliation": {"reported": 2050.0, "difference": 0.0},
        "expected": {"cash_physical": 2050.0},
        "returns": {"cash_refunds": 0, "count": 0},
    }


def test_quote_pdf_is_valid_pdf_bytes():
    out = generate_quote_pdf(_quote())
    assert isinstance(out, bytes)
    assert out.startswith(b"%PDF")


def test_cash_cut_pdf_is_valid_pdf_bytes():
    out = generate_cash_cut_pdf(_audit_data())
    assert isinstance(out, bytes)
    assert out.startswith(b"%PDF")
```

(Nota: el humo del estado de cuenta llega en Task 3 contra el generador nuevo;
el viejo desaparece ahí mismo.)

- [ ] **Step 2: Correr los tests contra fpdf 1.7.2 para tener línea base**

Run: `python3 -m pytest tests/test_pdf_generators_smoke.py -q`
Expected: los 2 tests PASAN (si `Ñoño` truena en 1.7.2 por latin-1, anotar y seguir: es exactamente lo que fpdf2 arregla).

- [ ] **Step 3: Migrar la librería**

En `requirements.txt` reemplazar `fpdf==1.7.2` por `fpdf2==2.8.3`.
Instalar: `pip install --user --break-system-packages "fpdf2==2.8.3"` (y
desinstalar el viejo si estorba: `pip uninstall -y fpdf`).

En `app/utils/pdf_generator.py` cambiar las tres salidas:
- Línea 135 (`generate_quote_pdf`): `return pdf.output(dest='S').encode('latin-1')` → `return bytes(pdf.output())`
- Línea 344 (`generate_cash_cut_pdf`): igual → `return bytes(pdf.output())`
- Línea 346: es un `return` duplicado muerto — borrarlo.
- Línea 459 (`generate_account_statement_pdf`): `return pdf.output()` → `return bytes(pdf.output())`

- [ ] **Step 4: Correr los tests de humo con fpdf2**

Run: `python3 -m pytest tests/test_pdf_generators_smoke.py -q`
Expected: 2 PASS (fpdf2 acepta "Arial" como alias de Helvetica con DeprecationWarning — es aceptable aquí; los generadores viejos no se rediseñan).

- [ ] **Step 5: Correr la suite completa para descartar regresiones**

Run: `python3 -m pytest tests/ -q`
Expected: verde (mismo conteo que antes de tocar nada + 2 nuevos).

- [ ] **Step 6: Commit**

```bash
git add requirements.txt app/utils/pdf_generator.py tests/test_pdf_generators_smoke.py
git commit -m "feat(pdf): migra fpdf 1.7.2 a fpdf2 con tests de humo de los tres generadores"
```

---

### Task 2: Builder de contexto puro del estado de cuenta (branding + totales), con TDD

El contenido del PDF (líneas de branding del tenant, filas cargo/abono con
saldo corrido, totales) se calcula en una función pura, testeable sin renderizar
nada. El renderer de Task 3 solo dibuja este contexto.

**Files:**
- Create: `app/modules/customers/statement_pdf.py`
- Test: `tests/test_statement_context.py` (nuevo)

**Interfaces:**
- Consumes: `Customer`, `CustomerLedgerEntry` (solo lectura de atributos), `Organization` (de `app.modules.tenants.models`).
- Produces: `build_statement_context(customer, entries, organization=None, start_date=None, end_date=None, previous_balance=None) -> dict` con llaves: `org_lines: list[str]`, `customer: dict(name, tax_id, phone, email)`, `periodo: str`, `emitido: str`, `previous_balance: Decimal`, `rows: list[dict(fecha, descripcion, cargo, abono, saldo)]`, `total_cargos: Decimal`, `total_abonos: Decimal`, `saldo_final: Decimal`. Task 3 y Task 4 dependen de esta firma exacta.

- [ ] **Step 1: Escribir los tests**

```python
# tests/test_statement_context.py
"""build_statement_context: puro, sin BD ni PDF."""
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.modules.customers.statement_pdf import build_statement_context


def _customer(**kw):
    base = dict(name="Ñoño Pérez", tax_id="PEPN800101ABC", phone="4491234567", email="nono@x.mx")
    base.update(kw)
    return SimpleNamespace(**base)


def _entry(amount, desc="Venta", when=datetime(2026, 8, 2, 12, 0)):
    return SimpleNamespace(amount=Decimal(str(amount)), description=desc, created_at=when)


def _org(**kw):
    base = dict(name="Abarrotes La Luz", legal_name="Abarrotes La Luz SA de CV",
                tax_id="ALL010101XYZ", address="Av. Centro 1, Ags.",
                phone="4499876543", email="hola@laluz.mx")
    base.update(kw)
    return SimpleNamespace(**base)


def test_org_branding_lines_full():
    ctx = build_statement_context(_customer(), [], organization=_org())
    assert ctx["org_lines"][0] == "Abarrotes La Luz"
    assert "Abarrotes La Luz SA de CV" in ctx["org_lines"]
    assert "RFC: ALL010101XYZ" in ctx["org_lines"]
    assert any("Av. Centro 1" in l for l in ctx["org_lines"])


def test_org_branding_omits_empty_and_duplicate_lines():
    org = _org(legal_name="Abarrotes La Luz", tax_id=None, address=None, phone=None, email=None)
    ctx = build_statement_context(_customer(), [], organization=org)
    # legal_name igual al name no se repite; campos vacíos no generan línea
    assert ctx["org_lines"] == ["Abarrotes La Luz"]


def test_no_org_no_lines():
    ctx = build_statement_context(_customer(), [], organization=None)
    assert ctx["org_lines"] == []


def test_rows_cargo_abono_and_running_balance():
    entries = [_entry("150.00", "Venta a crédito"), _entry("-50.00", "Abono")]
    ctx = build_statement_context(_customer(), entries, previous_balance=Decimal("10.00"))
    assert ctx["rows"][0]["cargo"] == Decimal("150.00")
    assert ctx["rows"][0]["abono"] == Decimal("0")
    assert ctx["rows"][0]["saldo"] == Decimal("160.00")   # 10 + 150
    assert ctx["rows"][1]["abono"] == Decimal("50.00")
    assert ctx["rows"][1]["saldo"] == Decimal("110.00")   # 160 - 50


def test_totals_math():
    entries = [_entry("150.00"), _entry("-50.00"), _entry("30.00")]
    ctx = build_statement_context(_customer(), entries, previous_balance=Decimal("20.00"))
    assert ctx["total_cargos"] == Decimal("180.00")
    assert ctx["total_abonos"] == Decimal("50.00")
    assert ctx["saldo_final"] == Decimal("150.00")  # 20 + 180 - 50


def test_empty_statement_is_zero():
    ctx = build_statement_context(_customer(), [])
    assert ctx["rows"] == []
    assert ctx["saldo_final"] == Decimal("0")


def test_missing_description_gets_placeholder():
    ctx = build_statement_context(_customer(), [_entry("10.00", desc=None)])
    assert ctx["rows"][0]["descripcion"] == "Sin descripción"
```

- [ ] **Step 2: Verificar que fallan**

Run: `python3 -m pytest tests/test_statement_context.py -q`
Expected: FAIL — `ModuleNotFoundError: app.modules.customers.statement_pdf`.

- [ ] **Step 3: Implementar el builder**

```python
# app/modules/customers/statement_pdf.py
"""Estado de cuenta del cliente — contexto puro + render fpdf2.

El emisor del documento es la Organization del tenant (Atlas POS es
multi-tenant): nada de marca Atlas hardcodeada.
"""
from datetime import datetime
from decimal import Decimal


def build_statement_context(customer, entries, organization=None,
                            start_date=None, end_date=None,
                            previous_balance=None):
    org_lines = []
    if organization is not None:
        name = (organization.name or "").strip()
        if name:
            org_lines.append(name)
        legal = (organization.legal_name or "").strip()
        if legal and legal != name:
            org_lines.append(legal)
        if organization.tax_id:
            org_lines.append(f"RFC: {organization.tax_id}")
        if organization.address:
            org_lines.append(organization.address)
        contact = "  ·  ".join(x for x in (organization.phone, organization.email) if x)
        if contact:
            org_lines.append(contact)

    prev = Decimal(previous_balance) if previous_balance is not None else Decimal("0")
    rows = []
    total_cargos = Decimal("0")
    total_abonos = Decimal("0")
    saldo = prev
    for e in entries:
        amount = Decimal(e.amount)
        cargo = amount if amount > 0 else Decimal("0")
        abono = -amount if amount < 0 else Decimal("0")
        total_cargos += cargo
        total_abonos += abono
        saldo += amount
        rows.append({
            "fecha": e.created_at.strftime("%d/%m/%Y"),
            "descripcion": e.description or "Sin descripción",
            "cargo": cargo,
            "abono": abono,
            "saldo": saldo,
        })

    return {
        "org_lines": org_lines,
        "customer": {
            "name": customer.name,
            "tax_id": customer.tax_id,
            "phone": customer.phone,
            "email": customer.email,
        },
        "periodo": f"{start_date or 'Inicio'} al {end_date or 'Hoy'}",
        "emitido": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "previous_balance": prev,
        "rows": rows,
        "total_cargos": total_cargos,
        "total_abonos": total_abonos,
        "saldo_final": prev + total_cargos - total_abonos,
    }
```

- [ ] **Step 4: Verificar que pasan**

Run: `python3 -m pytest tests/test_statement_context.py -q`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/modules/customers/statement_pdf.py tests/test_statement_context.py
git commit -m "feat(customers): builder puro del contexto del estado de cuenta con branding del tenant"
```

---

### Task 3: Renderer fpdf2 premium con fuente unicode; retirar el generador viejo

El render A4 del estado de cuenta: encabezado del tenant, ficha del cliente,
tabla de movimientos con saldo corrido, resumen. Source Sans 3 (OFL) embebida;
fallback a Helvetica si los TTF no están. El `generate_account_statement_pdf`
viejo de `app/utils/pdf_generator.py` se elimina (su único consumidor es el
router de customers, que se recablea en Task 4 — en esta task el router se
recablea mínimamente para no dejar el repo roto).

**Files:**
- Create: `app/static/fonts/SourceSans3-Regular.ttf` y `SourceSans3-Bold.ttf` (copiados de atlas-cortex)
- Modify: `app/modules/customers/statement_pdf.py` (agregar renderer)
- Modify: `app/utils/pdf_generator.py` (borrar `generate_account_statement_pdf`, líneas 348-459)
- Modify: `app/modules/customers/router.py:493-543` (import + llamada nuevos)
- Test: `tests/test_statement_pdf_render.py` (nuevo)

**Interfaces:**
- Consumes: `build_statement_context()` de Task 2.
- Produces: `generate_account_statement_pdf(context) -> bytes` en `app.modules.customers.statement_pdf` — recibe el dict del builder, NO el customer. Task 4 depende de esta firma.

- [ ] **Step 1: Copiar las fuentes**

```bash
mkdir -p app/static/fonts
cp /mnt/c/Users/ecamp/Devs/atlas-cortex/app/static/fonts/SourceSans3-Regular.ttf app/static/fonts/
cp /mnt/c/Users/ecamp/Devs/atlas-cortex/app/static/fonts/SourceSans3-Bold.ttf app/static/fonts/
```

- [ ] **Step 2: Escribir los tests del renderer**

```python
# tests/test_statement_pdf_render.py
from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.modules.customers.statement_pdf import (
    build_statement_context,
    generate_account_statement_pdf,
)


def _ctx(**kw):
    customer = SimpleNamespace(name="Ñoño Pérez & Cía.", tax_id="PEPN800101ABC",
                               phone="4491234567", email=None)
    org = SimpleNamespace(name="Abarrotes La Luz", legal_name=None,
                          tax_id="ALL010101XYZ", address="Av. Centro 1",
                          phone=None, email=None)
    entries = [
        SimpleNamespace(amount=Decimal("150.00"), description="Venta a crédito",
                        created_at=datetime(2026, 8, 2, 12, 0)),
        SimpleNamespace(amount=Decimal("-50.00"), description="Abono",
                        created_at=datetime(2026, 8, 3, 12, 0)),
    ]
    args = dict(organization=org, previous_balance=Decimal("10.00"))
    args.update(kw)
    return build_statement_context(customer, entries, **args)


def test_render_returns_valid_pdf_bytes():
    out = generate_account_statement_pdf(_ctx())
    assert isinstance(out, bytes)
    assert out.startswith(b"%PDF")
    assert len(out) > 1500  # un A4 con tabla no puede pesar menos


def test_render_unicode_does_not_raise():
    # Ñ, acentos y & en nombres — el motivo de migrar a fpdf2
    out = generate_account_statement_pdf(_ctx())
    assert out.startswith(b"%PDF")


def test_render_empty_statement():
    customer = SimpleNamespace(name="Nuevo", tax_id=None, phone=None, email=None)
    ctx = build_statement_context(customer, [])
    out = generate_account_statement_pdf(ctx)
    assert out.startswith(b"%PDF")
```

- [ ] **Step 3: Verificar que fallan**

Run: `python3 -m pytest tests/test_statement_pdf_render.py -q`
Expected: FAIL — `ImportError: generate_account_statement_pdf`.

- [ ] **Step 4: Implementar el renderer**

Agregar a `app/modules/customers/statement_pdf.py`:

```python
from pathlib import Path

from fpdf import FPDF

_FONTS_DIR = Path(__file__).resolve().parents[2] / "static" / "fonts"

_INK = (24, 32, 44)         # texto principal
_MUTED = (100, 116, 139)    # slate 500
_HEADER_BG = (24, 32, 44)   # banda de tabla
_ROW_ALT = (248, 250, 252)  # cebra
_DEBT = (190, 40, 40)       # saldo deudor
_FAVOR = (20, 130, 90)      # saldo a favor


def _register_fonts(pdf):
    """Source Sans 3 si está; Helvetica si no. Devuelve el nombre de familia."""
    regular = _FONTS_DIR / "SourceSans3-Regular.ttf"
    bold = _FONTS_DIR / "SourceSans3-Bold.ttf"
    if regular.exists() and bold.exists():
        pdf.add_font("Brand", "", str(regular))
        pdf.add_font("Brand", "B", str(bold))
        return "Brand"
    return "helvetica"


def _money(v):
    return f"${v:,.2f}"


def generate_account_statement_pdf(context) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    font = _register_fonts(pdf)

    # --- Encabezado del emisor (tenant) ---
    pdf.set_text_color(*_INK)
    if context["org_lines"]:
        pdf.set_font(font, "B", 16)
        pdf.cell(120, 8, context["org_lines"][0], new_x="LMARGIN", new_y="NEXT")
        pdf.set_font(font, "", 9)
        pdf.set_text_color(*_MUTED)
        for line in context["org_lines"][1:]:
            pdf.cell(120, 4.5, line, new_x="LMARGIN", new_y="NEXT")

    # Título a la derecha, alineado con el bloque del emisor
    pdf.set_xy(130, 18)
    pdf.set_font(font, "B", 14)
    pdf.set_text_color(*_INK)
    pdf.cell(62, 7, "ESTADO DE CUENTA", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(130)
    pdf.set_font(font, "", 8.5)
    pdf.set_text_color(*_MUTED)
    pdf.cell(62, 4.5, f"Periodo: {context['periodo']}", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(130)
    pdf.cell(62, 4.5, f"Emitido: {context['emitido']}", align="R", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(max(pdf.get_y(), 46))
    pdf.set_draw_color(226, 232, 240)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)

    # --- Ficha del cliente ---
    c = context["customer"]
    pdf.set_font(font, "", 8)
    pdf.set_text_color(*_MUTED)
    pdf.cell(0, 4, "CLIENTE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font(font, "B", 12)
    pdf.set_text_color(*_INK)
    pdf.cell(0, 6, c["name"], new_x="LMARGIN", new_y="NEXT")
    detail = "   ".join(x for x in (
        f"RFC: {c['tax_id']}" if c["tax_id"] else None,
        f"Tel: {c['phone']}" if c["phone"] else None,
        c["email"],
    ) if x)
    if detail:
        pdf.set_font(font, "", 9)
        pdf.set_text_color(*_MUTED)
        pdf.cell(0, 5, detail, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # --- Tabla de movimientos ---
    cols = ((24, "Fecha", "L"), (86, "Concepto", "L"),
            (26, "Cargo", "R"), (26, "Abono", "R"), (28, "Saldo", "R"))
    pdf.set_font(font, "B", 8.5)
    pdf.set_fill_color(*_HEADER_BG)
    pdf.set_text_color(255, 255, 255)
    for w, label, align in cols:
        pdf.cell(w, 7, f" {label} ", align=align, fill=True)
    pdf.ln()

    pdf.set_text_color(*_INK)
    fill = False
    if context["previous_balance"] != 0:
        pdf.set_font(font, "B", 8.5)
        pdf.set_fill_color(*_ROW_ALT)
        pdf.cell(24, 6, "", fill=True)
        pdf.cell(86, 6, " Saldo anterior", fill=True)
        pdf.cell(26, 6, "", fill=True)
        pdf.cell(26, 6, "", fill=True)
        pdf.cell(28, 6, f"{_money(context['previous_balance'])} ", align="R", fill=True)
        pdf.ln()
        fill = True

    pdf.set_font(font, "", 8.5)
    for row in context["rows"]:
        pdf.set_fill_color(*(_ROW_ALT if fill else (255, 255, 255)))
        pdf.cell(24, 6, f" {row['fecha']}", fill=True)
        pdf.cell(86, 6, f" {row['descripcion'][:52]}", fill=True)
        pdf.cell(26, 6, f"{_money(row['cargo'])} " if row["cargo"] else "—  ", align="R", fill=True)
        pdf.cell(26, 6, f"{_money(row['abono'])} " if row["abono"] else "—  ", align="R", fill=True)
        pdf.cell(28, 6, f"{_money(row['saldo'])} ", align="R", fill=True)
        pdf.ln()
        fill = not fill
    if not context["rows"]:
        pdf.set_font(font, "", 9)
        pdf.set_text_color(*_MUTED)
        pdf.cell(190, 8, "Sin movimientos en el periodo", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*_INK)

    # --- Resumen ---
    pdf.ln(6)
    x = 118
    pdf.set_font(font, "", 9)

    def _summary(label, value, bold=False, color=None):
        pdf.set_x(x)
        pdf.set_font(font, "B" if bold else "", 10 if bold else 9)
        pdf.set_text_color(*_INK)
        pdf.cell(46, 6.5, label, align="R")
        if color:
            pdf.set_text_color(*color)
        pdf.cell(36, 6.5, _money(value), align="R", new_x="LMARGIN", new_y="NEXT")

    _summary("Saldo anterior:", context["previous_balance"])
    _summary("(+) Cargos del periodo:", context["total_cargos"])
    _summary("(-) Abonos del periodo:", context["total_abonos"])
    final = context["saldo_final"]
    _summary("SALDO AL CORTE:", final, bold=True,
             color=_DEBT if final > 0 else _FAVOR)

    # --- Pie ---
    pdf.set_y(-24)
    pdf.set_font(font, "", 7.5)
    pdf.set_text_color(*_MUTED)
    footer = context["org_lines"][0] if context["org_lines"] else ""
    pdf.cell(0, 4, f"{footer}  ·  Documento informativo, no es comprobante fiscal.", align="C")

    return bytes(pdf.output())
```

- [ ] **Step 5: Recablear el router y borrar el generador viejo**

En `app/modules/customers/router.py`:
- Borrar la línea 494 (`from app.utils.pdf_generator import generate_account_statement_pdf`).
- En su lugar (junto al `from fastapi import Response` de la línea 493):

```python
from app.modules.customers.statement_pdf import (
    build_statement_context,
    generate_account_statement_pdf,
)
```

- En `get_customer_statement_pdf`, reemplazar la llamada (líneas 537-543):

```python
    context = build_statement_context(
        customer,
        entries,
        start_date=start_date,
        end_date=end_date,
        previous_balance=previous_balance,
    )
    pdf_content = generate_account_statement_pdf(context)
```

(El branding de la Organization y el `get_current_user` entran en Task 4.)

En `app/utils/pdf_generator.py`: borrar completa la función
`generate_account_statement_pdf` (líneas 348 a fin de archivo tras Task 1).

- [ ] **Step 6: Correr los tests**

Run: `python3 -m pytest tests/test_statement_pdf_render.py tests/test_pdf_generators_smoke.py -q && python3 -m pytest tests/ -q`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add app/modules/customers/statement_pdf.py app/modules/customers/router.py \
  app/utils/pdf_generator.py app/static/fonts/ tests/test_statement_pdf_render.py
git commit -m "feat(customers): renderer A4 premium del estado de cuenta con Source Sans 3 y fpdf2"
```

---

### Task 4: Endpoint del PDF — exigir usuario y emitir con branding del tenant

`get_customer_statement_pdf` es el único endpoint del router sin
`get_current_user`. Se agrega, y se pasa la `Organization` al contexto.

**Files:**
- Modify: `app/modules/customers/router.py` (función `get_customer_statement_pdf`)
- Test: `tests/test_customers_statement_api.py` (nuevo)

**Interfaces:**
- Consumes: `build_statement_context(..., organization=...)` (Task 2), fixtures de `tests/conftest.py` (`client`, `db`, `org`, `admin_user`, `auth_admin`).
- Produces: `GET /api/customers/{id}/pdf-statement` → 401 sin token, 404 cross-org, 200 `application/pdf`.

- [ ] **Step 1: Escribir los tests**

```python
# tests/test_customers_statement_api.py
"""Endpoint /api/customers/{id}/pdf-statement: auth, org-scoping, PDF válido."""
from decimal import Decimal

import pytest

from app.modules.customers.models import Customer, CustomerLedgerEntry
from app.modules.tenants.models import Organization


@pytest.fixture()
def customer_a(db, org):
    c = Customer(name="Cliente Uno", phone="4491112233",
                 organization_id=org.id, current_balance=Decimal("100.00"))
    db.add(c)
    db.commit()
    db.refresh(c)
    db.add(CustomerLedgerEntry(customer_id=c.id, amount=Decimal("100.00"),
                               description="Venta a crédito", organization_id=org.id))
    db.commit()
    return c


@pytest.fixture()
def other_org_customer(db):
    other = Organization(name="Otra Org")
    db.add(other)
    db.commit()
    c = Customer(name="Ajeno", organization_id=other.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_pdf_statement_requires_auth(client, customer_a):
    r = client.get(f"/api/customers/{customer_a.id}/pdf-statement")
    assert r.status_code == 401


def test_pdf_statement_cross_org_is_404(client, auth_admin, other_org_customer):
    r = client.get(f"/api/customers/{other_org_customer.id}/pdf-statement",
                   headers=auth_admin)
    assert r.status_code == 404


def test_pdf_statement_returns_pdf(client, auth_admin, customer_a):
    r = client.get(f"/api/customers/{customer_a.id}/pdf-statement", headers=auth_admin)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
```

- [ ] **Step 2: Verificar que fallan**

Run: `python3 -m pytest tests/test_customers_statement_api.py -q`
Expected: `test_pdf_statement_requires_auth` FALLA (hoy no exige usuario; si
fallara distinto — p. ej. la falta de org context ya da 401 por otra vía —
verificar que el 401 provenga de auth de usuario tras el cambio, no asumirlo).

- [ ] **Step 3: Implementar**

En `get_customer_statement_pdf` (router.py):

```python
@router.get("/{customer_id}/pdf-statement")
def get_customer_statement_pdf(
    customer_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    org_id: int = Depends(get_current_active_organization),
):
```

y antes de construir el contexto:

```python
    from app.modules.tenants.models import Organization
    organization = db.query(Organization).filter(Organization.id == org_id).first()
```

pasándola al builder:

```python
    context = build_statement_context(
        customer,
        entries,
        organization=organization,
        start_date=start_date,
        end_date=end_date,
        previous_balance=previous_balance,
    )
```

- [ ] **Step 4: Verificar que pasan + suite completa**

Run: `python3 -m pytest tests/test_customers_statement_api.py -q && python3 -m pytest tests/ -q`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add app/modules/customers/router.py tests/test_customers_statement_api.py
git commit -m "fix(customers): pdf-statement exige usuario autenticado y emite con branding del tenant"
```

---

### Task 5: Frontend — corregir la semántica invertida del saldo

Backend: `current_balance > 0` = el cliente debe. `Customers.tsx` lo pinta al
revés (verde deuda, botón de cobro en saldo a favor). Fix quirúrgico.

**Files:**
- Modify: `frontend/src/pages/crm/Customers.tsx:68,81-84,134,183`

**Interfaces:**
- Consumes: `Customer.current_balance` (número; positivo = deuda).
- Produces: nada nuevo — corrige presentación. Tasks 6-7 editan este mismo archivo después.

- [ ] **Step 1: Invertir colores y condiciones**

Línea 68 — de:
```tsx
const balanceColor = (b: number) => b < 0 ? 'text-red-400' : b > 0 ? 'text-emerald-400' : 'text-slate-400'
```
a:
```tsx
const balanceColor = (b: number) => b > 0 ? 'text-red-400' : b < 0 ? 'text-emerald-400' : 'text-slate-400'
```

Línea 134 (tabla) y 183 (modal detalle) — el botón "Registrar pago" aparece
cuando hay deuda: `c.current_balance > 0` y `selected.current_balance > 0`.

Líneas 81-84 (KPIs) — el KPI de saldo a favor deja de llamarse "Con crédito"
(choca con la configuración de crédito del cliente):
```tsx
{ label: 'Saldo a favor', value: String(stats.with_credit), icon: 'fa-circle-check', color: 'text-emerald-400' },
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: `tsc` y build sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/crm/Customers.tsx
git commit -m "fix(customers): semántica del saldo — positivo es deuda, rojo y cobrable"
```

---

### Task 6: Frontend — modal Nuevo/Editar cliente y eliminación

`customersApi.create/update/delete` existen sin consumidor. Se agrega un modal
de formulario (un componente, modo alta/edición) y la baja con confirmación.

**Files:**
- Create: `frontend/src/pages/crm/CustomerFormModal.tsx`
- Modify: `frontend/src/api/customers.ts` (tipos del payload)
- Modify: `frontend/src/pages/crm/Customers.tsx` (botón Nuevo, editar/eliminar en detalle)

**Interfaces:**
- Consumes: `customersApi.create/update/delete` (ya existen), clases `dax-*`.
- Produces: `<CustomerFormModal customer={Customer | null} onClose={() => void} onSaved={(c: Customer) => void} />` — `customer === null` es alta; con objeto es edición.

- [ ] **Step 1: Ampliar tipos del API client**

En `frontend/src/api/customers.ts`, ampliar `Customer` y el payload:

```ts
export interface Customer {
  id: number
  name: string
  phone: string | null
  email: string | null
  tax_id: string | null
  address: string | null
  zip_code?: string | null
  notes?: string | null
  has_credit?: boolean
  credit_days?: number | null
  current_balance: number
  credit_limit: number | null
  portal_active?: boolean
}

export interface CustomerPayload {
  name: string
  phone?: string | null
  email?: string | null
  tax_id?: string | null
  address?: string | null
  zip_code?: string | null
  notes?: string | null
  has_credit?: boolean
  credit_limit?: number
  credit_days?: number
}
```

y las firmas: `create: async (payload: CustomerPayload)`, `update: async (id: number, payload: Partial<CustomerPayload>)`.

- [ ] **Step 2: Crear el modal**

```tsx
// frontend/src/pages/crm/CustomerFormModal.tsx
import { useState } from 'react'
import { customersApi, type Customer, type CustomerPayload } from '../../api/customers'

interface Props {
  customer: Customer | null // null = alta
  onClose: () => void
  onSaved: (c: Customer) => void
}

export function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const isEdit = customer !== null
  const [form, setForm] = useState<CustomerPayload>({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    tax_id: customer?.tax_id ?? '',
    address: customer?.address ?? '',
    zip_code: customer?.zip_code ?? '',
    notes: customer?.notes ?? '',
    has_credit: customer?.has_credit ?? false,
    credit_limit: customer?.credit_limit ?? 0,
    credit_days: customer?.credit_days ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof CustomerPayload, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError(null)
    // Strings vacíos → null para no chocar con validaciones de unicidad/EmailStr
    const payload: CustomerPayload = {
      ...form,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      tax_id: form.tax_id || null,
      address: form.address || null,
      zip_code: form.zip_code || null,
      notes: form.notes || null,
    }
    try {
      const saved = isEdit
        ? await customersApi.update(customer.id, payload)
        : await customersApi.create(payload)
      onSaved(saved)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al guardar el cliente')
    } finally { setSaving(false) }
  }

  const field = (label: string, key: keyof CustomerPayload, type = 'text', placeholder = '') => (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      <input type={type} value={String(form[key] ?? '')} placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)} className="dax-input w-full text-sm" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="dax-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-black text-white mb-4">
          <i className={`fa-solid ${isEdit ? 'fa-pen' : 'fa-user-plus'} mr-2 text-indigo-400`} />
          {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        </h3>

        <div className="space-y-3">
          {field('Nombre *', 'name', 'text', 'Nombre o razón social')}
          <div className="grid grid-cols-2 gap-3">
            {field('Teléfono', 'phone', 'tel', '10 dígitos')}
            {field('Email', 'email', 'email')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('RFC', 'tax_id', 'text', 'XAXX010101000')}
            {field('C.P.', 'zip_code')}
          </div>
          {field('Dirección', 'address')}
          {field('Notas', 'notes')}

          <div className="dax-card p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={!!form.has_credit}
                onChange={(e) => set('has_credit', e.target.checked)} />
              Venta a crédito habilitada
            </label>
            {form.has_credit && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Límite de crédito</label>
                  <input type="number" step="0.01" min="0" value={form.credit_limit ?? 0}
                    onChange={(e) => set('credit_limit', parseFloat(e.target.value) || 0)}
                    className="dax-input w-full text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Días de crédito</label>
                  <input type="number" min="0" value={form.credit_days ?? 0}
                    onChange={(e) => set('credit_days', parseInt(e.target.value) || 0)}
                    className="dax-input w-full text-sm" />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              <i className="fa-solid fa-circle-exclamation mr-1" /> {error}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="dax-btn-secondary flex-1">Cancelar</button>
          <button onClick={submit} disabled={saving || !form.name.trim()}
            className="dax-btn-primary flex-1 justify-center disabled:opacity-40">
            {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-check" /> Guardar</>}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Cablear en `Customers.tsx`**

- Import: `import { CustomerFormModal } from './CustomerFormModal'`.
- Estado: `const [formModal, setFormModal] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null })` y `const [deleting, setDeleting] = useState(false)`.
- Botón junto a la búsqueda (dentro del `div.flex.gap-2` existente):

```tsx
<button onClick={() => setFormModal({ open: true, customer: null })} className="dax-btn-primary text-sm whitespace-nowrap">
  <i className="fa-solid fa-user-plus" /> Nuevo cliente
</button>
```

- En el modal de detalle, junto al botón de cerrar, acciones de editar/eliminar:

```tsx
<div className="flex items-center gap-3">
  <button onClick={() => setFormModal({ open: true, customer: selected })}
    className="text-slate-500 hover:text-white" title="Editar">
    <i className="fa-solid fa-pen" />
  </button>
  <button
    onClick={async () => {
      if (!confirm(`¿Eliminar a ${selected.name}? El historial se conserva.`)) return
      setDeleting(true)
      try {
        await customersApi.delete(selected.id)
        setSelected(null)
        customersApi.getStats().then(setStats).catch(() => {})
        load(search, page)
      } catch (e: any) {
        alert(e?.response?.data?.detail ?? 'No se pudo eliminar')
      } finally { setDeleting(false) }
    }}
    className="text-slate-500 hover:text-red-400 disabled:opacity-40" title="Eliminar" disabled={deleting}>
    <i className="fa-solid fa-trash" />
  </button>
  <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-lg" /></button>
</div>
```

- Render del modal al final del JSX raíz:

```tsx
{formModal.open && (
  <CustomerFormModal
    customer={formModal.customer}
    onClose={() => setFormModal({ open: false, customer: null })}
    onSaved={(saved) => {
      setFormModal({ open: false, customer: null })
      customersApi.getStats().then(setStats).catch(() => {})
      load(search, page)
      if (selected && selected.id === saved.id) setSelected(saved)
    }}
  />
)}
```

(El `alert()` del delete es aceptable aquí: es el patrón vigente del archivo en
`handlePay`; el del formulario sí muestra el error inline como pide el spec.)

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/crm/CustomerFormModal.tsx frontend/src/pages/crm/Customers.tsx frontend/src/api/customers.ts
git commit -m "feat(customers): alta, edición y baja de clientes desde la vista de Clientes"
```

---

### Task 7: Frontend — botón PDF y envío manual por WhatsApp

Descarga del estado de cuenta como blob autenticado, y compartir: en móvil
`navigator.share` con el PDF como archivo (share sheet → WhatsApp con
adjunto); en escritorio descarga + `wa.me` con mensaje prellenado.

**Files:**
- Create: `frontend/src/utils/phone.ts`
- Modify: `frontend/src/api/customers.ts` (método blob)
- Modify: `frontend/src/pages/crm/Customers.tsx` (botones en el modal de detalle)

**Interfaces:**
- Consumes: `GET /api/customers/{id}/pdf-statement` (Task 4), axios `client` (inyecta token/org).
- Produces: `customersApi.getStatementPdf(id) -> Promise<Blob>`; `toWaPhone(phone: string | null) -> string | null` (dígitos con lada, o null si no sirve).

- [ ] **Step 1: Utilidad de teléfono**

```ts
// frontend/src/utils/phone.ts
/**
 * Normaliza un teléfono para wa.me: solo dígitos, con lada de país.
 * Suposición MX: a 10 dígitos se antepone 52. Si ya trae 52/521 (12-13
 * dígitos) se respeta. Cualquier otra longitud no es marcable → null.
 */
export function toWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 12 && digits.startsWith('52')) return digits
  if (digits.length === 13 && digits.startsWith('521')) return digits
  return null
}
```

- [ ] **Step 2: Método blob en el API client**

En `frontend/src/api/customers.ts`, dentro de `customersApi`:

```ts
  getStatementPdf: async (id: number, params?: { start_date?: string; end_date?: string }): Promise<Blob> => {
    const { data } = await client.get(`/customers/${id}/pdf-statement`, {
      params,
      responseType: 'blob',
    })
    return data
  },
```

- [ ] **Step 3: Botones en el modal de detalle de `Customers.tsx`**

Imports nuevos: `import { toWaPhone } from '../../utils/phone'`.

Estado: `const [sharing, setSharing] = useState(false)`.

Helpers dentro del componente:

```tsx
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const handlePdf = async (c: Customer) => {
    setSharing(true)
    try {
      const blob = await customersApi.getStatementPdf(c.id)
      downloadBlob(blob, `EdoCuenta_${c.name.replace(/[^\w-]+/g, '_')}.pdf`)
    } catch { alert('No se pudo generar el PDF') } finally { setSharing(false) }
  }

  const handleWhatsApp = async (c: Customer) => {
    setSharing(true)
    try {
      const blob = await customersApi.getStatementPdf(c.id)
      const file = new File([blob], `EdoCuenta_${c.name.replace(/[^\w-]+/g, '_')}.pdf`, { type: 'application/pdf' })
      const shareData = { files: [file], title: 'Estado de cuenta', text: `Estado de cuenta de ${c.name}` }
      if (typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
        // Móvil: share sheet nativo — el usuario elige WhatsApp y el PDF va adjunto
        try { await navigator.share(shareData) } catch { /* usuario canceló: no es error */ }
      } else {
        // Escritorio: descarga + chat de WhatsApp con mensaje; el PDF se adjunta a mano
        downloadBlob(blob, file.name)
        const tel = toWaPhone(c.phone)
        if (tel) {
          const msg = `Hola ${c.name}, te comparto tu estado de cuenta al ${new Date().toLocaleDateString('es-MX')}. Saldo: ${formatCurrency(c.current_balance)}.`
          window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
        }
      }
    } catch { alert('No se pudo generar el PDF') } finally { setSharing(false) }
  }
```

En el modal de detalle (debajo del botón "Registrar Pago", antes del título
"Estado de Cuenta"):

```tsx
<div className="grid grid-cols-2 gap-2 mb-4">
  <button onClick={() => handlePdf(selected)} disabled={sharing}
    className="dax-btn-secondary justify-center text-sm disabled:opacity-40">
    <i className="fa-solid fa-file-pdf text-red-400" /> Descargar PDF
  </button>
  <button onClick={() => handleWhatsApp(selected)} disabled={sharing || !toWaPhone(selected.phone)}
    title={!toWaPhone(selected.phone) ? 'El cliente no tiene teléfono válido' : 'Enviar por WhatsApp'}
    className="dax-btn-secondary justify-center text-sm disabled:opacity-40">
    <i className="fa-brands fa-whatsapp text-emerald-400" /> WhatsApp
  </button>
</div>
```

(Nota: el botón WhatsApp se deshabilita sin teléfono aunque en móvil el share
sheet no lo necesite — regla simple y predecible; FontAwesome `fa-brands` ya
viene en el bundle del repo, verificar con `grep -r "fa-brands" frontend/src` y
si no existe usar `fa-solid fa-share-nodes`.)

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/phone.ts frontend/src/api/customers.ts frontend/src/pages/crm/Customers.tsx
git commit -m "feat(customers): descarga de estado de cuenta PDF y envío manual por WhatsApp"
```

---

### Task 8: Verificación final, push y PR a staging

**Files:**
- Ninguno nuevo — verificación y PR.

- [ ] **Step 1: Suite completa backend**

Run: `python3 -m pytest tests/ -q`
Expected: verde, con los ~15 tests nuevos incluidos.

- [ ] **Step 2: Build frontend limpio**

Run: `cd frontend && npm run build`
Expected: `tsc` y Vite sin errores.

- [ ] **Step 3: Revisión de rama**

Revisar `git diff staging...HEAD` contra el spec: los 6 huecos del §1 quedaron
cubiertos (CRUD UI, PDF/WhatsApp, semántica del saldo, branding, auth, unicode);
sin `console.log` ni código muerto nuevo; el generador viejo no dejó huérfanos
(`grep -rn "generate_account_statement_pdf" app/ | grep -v modules/customers`
debe devolver solo comentarios, y actualizar el comentario de
`app/main.py:152` que aún apunta a `app/utils/pdf_generator`).

- [ ] **Step 4: Push y PR**

```bash
git push -u origin feat/clientes-estado-cuenta
gh pr create --base staging --title "Clientes POS: CRUD completo, estado de cuenta PDF premium y envío por WhatsApp" --body "$(cat <<'EOF'
## Qué hace

- **Migra fpdf 1.7.2 → fpdf2** (unicode real) con tests de humo de los tres generadores.
- **Estado de cuenta A4 premium** emitido a nombre del tenant (Organization: nombre, razón social, RFC, dirección) con Source Sans 3 embebida — nuevo `app/modules/customers/statement_pdf.py` (builder de contexto puro + renderer).
- **Endpoint `pdf-statement` exige usuario autenticado** (antes solo resolvía org).
- **Frontend completa el CRUD**: modal Nuevo/Editar cliente, eliminación con confirmación, errores del backend visibles en el modal.
- **Fix**: la semántica del saldo estaba invertida (positivo = deuda pintaba verde y el botón de cobro salía en saldo a favor).
- **PDF + WhatsApp**: descarga autenticada como blob; en móvil share sheet con el PDF adjunto (`navigator.share`), en escritorio descarga + `wa.me` con mensaje prellenado.

Spec: `docs/superpowers/specs/2026-08-08-clientes-pos-crud-estado-cuenta-design.md`
Plan: `docs/superpowers/plans/2026-08-08-clientes-pos-crud-estado-cuenta.md`

## Pruebas

- `python3 -m pytest tests/ -q` (suite completa + ~15 nuevos)
- `cd frontend && npm run build` (tsc + Vite)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01GTqUCkxRkbBHinVv7gdyAE
EOF
)"
```

Expected: PR abierto contra `staging`. **No se mergea sin autorización de
Emmanuel** (regla del flujo de trabajo).
