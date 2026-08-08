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
