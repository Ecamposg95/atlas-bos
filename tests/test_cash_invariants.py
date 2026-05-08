"""
Tests: Cash invariants (F2 of cash hardening plan).

Two surfaces under test:
1. compute_closure_warnings(breakdown) — non-blocking signals at close time
2. approve_return pre-checks — hard blocks for impossible/dangerous refunds
"""
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta

import pytest

from app.models.cash import CashSession, CashSessionStatus, CashMovement
from app.models.sales import SalesDocument, DocumentStatus, Payment, PaymentMethod
from app.models.returns import SaleReturn, SaleReturnItem
from app.services.cash_reconciliation import (
    compute_expected_cash,
    compute_closure_warnings,
)


# ── Helpers (subset from test_cash_math.py) ──────────────────────────────────


def _open_session(db, user, branch, opening=Decimal("0"), opened_at=None):
    s = CashSession(
        branch_id=branch.id, user_id=user.id,
        status=CashSessionStatus.OPEN,
        opening_balance=Decimal(str(opening)),
        opened_at=opened_at or (datetime.now(timezone.utc) - timedelta(hours=1)),
        organization_id=branch.organization_id,
    )
    db.add(s)
    db.flush()
    return s


def _create_sale(db, user, branch, total, payments, *, session=None,
                 change_given=None, status=DocumentStatus.PAID):
    sale = SalesDocument(
        seller_id=user.id, branch_id=branch.id,
        organization_id=branch.organization_id,
        total_amount=Decimal(str(total)), subtotal=Decimal(str(total)),
        tax_amount=Decimal("0"), status=status,
        cash_session_id=session.id if session else None,
        change_given=Decimal(str(change_given)) if change_given is not None else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(sale)
    db.flush()
    for method, amount in payments:
        db.add(Payment(
            sales_document_id=sale.id, method=method,
            amount=Decimal(str(amount)),
            organization_id=branch.organization_id,
            created_at=datetime.now(timezone.utc),
        ))
    db.flush()
    return sale


def _add_refund_movement(db, session, amount, reason_suffix=""):
    short = uuid.uuid4().hex[:8].upper()
    cm = CashMovement(
        session_id=session.id, type="OUT",
        amount=Decimal(str(amount)),
        reason=f"Devolución #{short} - {reason_suffix or 'test'}",
    )
    db.add(cm)
    db.flush()
    return cm


# ── Section A: closure warnings (non-blocking) ───────────────────────────────


class TestClosureWarnings:
    """compute_closure_warnings returns structured warnings without blocking."""

    def test_no_warnings_when_balanced(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=100)
        _create_sale(db, cajero_a, branch_a, total=50,
                     payments=[(PaymentMethod.CASH, 50)],
                     session=s, change_given=0)
        breakdown = compute_expected_cash(db, s)
        warnings = compute_closure_warnings(breakdown,
                                            closing_balance=Decimal("150"))
        assert warnings == []

    # W1: refunds exceed today's gross_cash (cross-day refund signature)
    def test_warns_when_refunds_exceed_gross_cash(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=200)
        # Only $50 cash sale today, but $150 in refunds (cross-day)
        _create_sale(db, cajero_a, branch_a, total=50,
                     payments=[(PaymentMethod.CASH, 50)],
                     session=s, change_given=0)
        _add_refund_movement(db, s, 150)
        breakdown = compute_expected_cash(db, s)
        warnings = compute_closure_warnings(breakdown,
                                            closing_balance=Decimal("100"))
        codes = {w["code"] for w in warnings}
        assert "REFUNDS_EXCEED_TODAY_CASH" in codes

    # W2: change_given exceeds gross_cash — mathematically impossible
    def test_warns_when_change_exceeds_gross_cash(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=100)
        # Force impossible state via direct insert (bug simulation)
        sale = _create_sale(db, cajero_a, branch_a, total=50,
                            payments=[(PaymentMethod.CASH, 50)],
                            session=s, change_given=200)  # > gross_cash 50
        breakdown = compute_expected_cash(db, s)
        warnings = compute_closure_warnings(breakdown,
                                            closing_balance=Decimal("0"))
        codes = {w["code"] for w in warnings}
        assert "CHANGE_EXCEEDS_GROSS_CASH" in codes

    # W3: |difference| > 50% of expected → big discrepancy
    def test_warns_on_large_relative_difference(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=100)
        _create_sale(db, cajero_a, branch_a, total=100,
                     payments=[(PaymentMethod.CASH, 100)],
                     session=s, change_given=0)
        # expected = 200; cashier reports 50 → diff -150 (>50% of expected)
        breakdown = compute_expected_cash(db, s)
        warnings = compute_closure_warnings(breakdown,
                                            closing_balance=Decimal("50"))
        codes = {w["code"] for w in warnings}
        assert "LARGE_DIFFERENCE_RATIO" in codes

    # W4: no warning for small relative difference (5%)
    def test_no_warning_for_small_difference(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=100)
        _create_sale(db, cajero_a, branch_a, total=100,
                     payments=[(PaymentMethod.CASH, 100)],
                     session=s, change_given=0)
        # expected = 200; closing = 195 → diff -5 (2.5%)
        breakdown = compute_expected_cash(db, s)
        warnings = compute_closure_warnings(breakdown,
                                            closing_balance=Decimal("195"))
        codes = {w["code"] for w in warnings}
        assert "LARGE_DIFFERENCE_RATIO" not in codes


# ── Section B: refund hard invariants ────────────────────────────────────────


@pytest.fixture()
def variant(db, branch_a):
    """Minimal product+variant for refund items (variant_id is NOT NULL FK)."""
    from app.models.products import Product, ProductVariant
    p = Product(name="Test Prod", organization_id=branch_a.organization_id)
    db.add(p); db.flush()
    v = ProductVariant(
        product_id=p.id, variant_name="default",
        organization_id=branch_a.organization_id,
    )
    db.add(v); db.flush()
    return v


def _create_pending_return(db, sale, refund_amount, *, refund_method=PaymentMethod.CASH,
                           cash_session_id=None, variant_id=None):
    """Build a SaleReturn in PENDING status mimicking what the POS creates."""
    sr = SaleReturn(
        sale_id=sale.id,
        user_id=sale.seller_id,
        branch_id=sale.branch_id,
        organization_id=sale.organization_id,
        total_refunded=Decimal(str(refund_amount)),
        refund_method=refund_method,
        cash_session_id=cash_session_id,
        status="PENDING",
        reason="test",
    )
    db.add(sr)
    db.flush()
    # Add 1 item that sums to the refund amount
    sri = SaleReturnItem(
        return_id=sr.id,
        variant_id=variant_id,
        quantity=Decimal("1"),
        refund_amount=Decimal(str(refund_amount)),
        is_inventory_reentry=False,
        organization_id=sale.organization_id,
    )
    db.add(sri)
    db.flush()
    return sr


class TestRefundInvariants:
    """approve_return pre-checks — hard blocks."""

    # R1: refund $0 is rejected
    def test_zero_refund_rejected(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=100)
        sale = _create_sale(db, cajero_a, branch_a, total=100,
                            payments=[(PaymentMethod.CASH, 100)],
                            session=s, change_given=0)
        sr = _create_pending_return(db, sale, 0, cash_session_id=s.id, variant_id=variant.id)
        with pytest.raises(ValueError, match=r"(?i)mayor a cero|positivo|zero"):
            crud_returns.approve_return(db, sr.id, cajero_a.id,
                                        organization_id=branch_a.organization_id)

    # R2: refund > original sale total (sumando previos) is rejected
    def test_refund_exceeds_sale_total_rejected(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=100)
        sale = _create_sale(db, cajero_a, branch_a, total=100,
                            payments=[(PaymentMethod.CASH, 100)],
                            session=s, change_given=0)
        sr = _create_pending_return(db, sale, 200, cash_session_id=s.id, variant_id=variant.id)
        with pytest.raises(ValueError, match=r"(?i)excede|mayor|supera"):
            crud_returns.approve_return(db, sr.id, cajero_a.id,
                                        organization_id=branch_a.organization_id)

    # R3a: large CASH refund without force is rejected (fat-finger)
    def test_large_cash_refund_without_force_rejected(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=200_000)
        sale = _create_sale(db, cajero_a, branch_a, total=200_000,
                            payments=[(PaymentMethod.CASH, 200_000)],
                            session=s, change_given=0)
        sr = _create_pending_return(db, sale, 100_000, cash_session_id=s.id,
                                    refund_method=PaymentMethod.CASH,
                                    variant_id=variant.id)
        with pytest.raises(ValueError, match=r"(?i)confirma|force|monto.*alto"):
            crud_returns.approve_return(db, sr.id, cajero_a.id,
                                        organization_id=branch_a.organization_id)

    # R3b: large CASH refund WITH force=True is allowed
    def test_large_cash_refund_with_force_allowed(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=200_000)
        sale = _create_sale(db, cajero_a, branch_a, total=200_000,
                            payments=[(PaymentMethod.CASH, 200_000)],
                            session=s, change_given=0)
        sr = _create_pending_return(db, sale, 100_000, cash_session_id=s.id,
                                    refund_method=PaymentMethod.CASH,
                                    variant_id=variant.id)
        result = crud_returns.approve_return(
            db, sr.id, cajero_a.id,
            organization_id=branch_a.organization_id,
            force=True,
        )
        assert result.status == "APPROVED"

    # R3c: large NON-CASH refund (card) does NOT require force
    def test_large_card_refund_no_force_required(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=0)
        sale = _create_sale(db, cajero_a, branch_a, total=200_000,
                            payments=[(PaymentMethod.CARD, 200_000)],
                            session=s, change_given=0)
        sr = _create_pending_return(db, sale, 100_000, cash_session_id=s.id,
                                    refund_method=PaymentMethod.CARD,
                                    variant_id=variant.id)
        result = crud_returns.approve_return(
            db, sr.id, cajero_a.id,
            organization_id=branch_a.organization_id,
        )
        assert result.status == "APPROVED"
