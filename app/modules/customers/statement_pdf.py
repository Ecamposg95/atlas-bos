"""Estado de cuenta del cliente — contexto puro + render fpdf2.

El emisor del documento es la Organization del tenant (Atlas POS es
multi-tenant): nada de marca Atlas hardcodeada.
"""
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from fpdf import FPDF


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
