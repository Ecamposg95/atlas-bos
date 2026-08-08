from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import app.modules.customers.statement_pdf as statement_pdf_module
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


def test_render_falls_back_to_helvetica_without_ttf(tmp_path, monkeypatch):
    # Sin los TTF de Source Sans 3, el renderer cae a la core font
    # "helvetica" (latin-1 only). _ctx() usa "Ñoño Pérez & Cía." — dentro
    # de latin-1 — así que debe renderizar sin lanzar
    # FPDFUnicodeEncodingException (regresión del placeholder em-dash).
    monkeypatch.setattr(statement_pdf_module, "_FONTS_DIR", tmp_path / "no-fonts")
    out = generate_account_statement_pdf(_ctx())
    assert out.startswith(b"%PDF")
