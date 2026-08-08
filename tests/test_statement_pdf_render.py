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
