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
