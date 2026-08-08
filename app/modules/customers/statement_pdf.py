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
