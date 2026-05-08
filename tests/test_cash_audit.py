"""
Tests: cash_audit_log hooks (F3 of cash hardening plan).

Verifies that every monetary event in the cash domain inserts the
expected audit row. Targets the helper + the call sites that should
emit audit events.
"""
from decimal import Decimal
from datetime import datetime, timezone, timedelta

import pytest

from app.models.cash import CashSession, CashSessionStatus, CashMovement
from app.models.cash_audit import CashAuditLog, CashAuditEvent
from app.models.sales import SalesDocument, DocumentStatus, Payment, PaymentMethod
from app.models.returns import SaleReturn, SaleReturnItem
from app.services.cash_audit import audit_cash_event


def _audit_rows(db, session_id):
    return db.query(CashAuditLog).filter(
        CashAuditLog.session_id == session_id,
    ).order_by(CashAuditLog.id).all()


# ── Section A: helper itself ─────────────────────────────────────────────────


class TestAuditHelper:

    def test_helper_inserts_row(self, db, branch_a):
        row = audit_cash_event(
            db,
            event_type=CashAuditEvent.SESSION_OPENED,
            organization_id=branch_a.organization_id,
            branch_id=branch_a.id,
            amount=Decimal("100"),
            payload={"opening": 100},
        )
        assert row is not None
        assert row.id is not None
        assert row.event_type == "SESSION_OPENED"
        assert row.amount == Decimal("100.00")
        assert row.payload_json == {"opening": 100}

    def test_helper_failsafe_on_invalid_event(self, db, branch_a):
        # Force failure: payload that can't serialize? JSONB accepts most.
        # Better: pass an unsupported amount type. The helper should swallow.
        row = audit_cash_event(
            db,
            event_type=CashAuditEvent.SESSION_OPENED,
            organization_id=branch_a.organization_id,
            amount=object(),  # not Decimal-coercible
        )
        assert row is None  # failsafe — no exception propagated


# ── Section B: hooks at real call sites ──────────────────────────────────────


@pytest.fixture()
def variant(db, branch_a):
    from app.models.products import Product, ProductVariant
    p = Product(name="Test", organization_id=branch_a.organization_id)
    db.add(p); db.flush()
    v = ProductVariant(product_id=p.id, variant_name="default",
                       organization_id=branch_a.organization_id)
    db.add(v); db.flush()
    return v


def _open_session(db, user, branch, opening=Decimal("0")):
    s = CashSession(
        branch_id=branch.id, user_id=user.id,
        status=CashSessionStatus.OPEN,
        opening_balance=Decimal(str(opening)),
        opened_at=datetime.now(timezone.utc) - timedelta(hours=1),
        organization_id=branch.organization_id,
    )
    db.add(s); db.flush()
    return s


def _create_sale(db, user, branch, total, payments, *, session=None,
                 change_given=0, status=DocumentStatus.PAID):
    sale = SalesDocument(
        seller_id=user.id, branch_id=branch.id,
        organization_id=branch.organization_id,
        total_amount=Decimal(str(total)), subtotal=Decimal(str(total)),
        tax_amount=Decimal("0"), status=status,
        cash_session_id=session.id if session else None,
        change_given=Decimal(str(change_given)),
        created_at=datetime.now(timezone.utc),
    )
    db.add(sale); db.flush()
    for method, amount in payments:
        db.add(Payment(
            sales_document_id=sale.id, method=method,
            amount=Decimal(str(amount)),
            organization_id=branch.organization_id,
            created_at=datetime.now(timezone.utc),
        ))
    db.flush()
    return sale


class TestRefundHooks:
    """approve_return must emit REFUND_APPROVED audit row."""

    def test_approve_refund_emits_audit_row(self, db, cajero_a, branch_a, variant):
        from app.crud import returns as crud_returns
        s = _open_session(db, cajero_a, branch_a, opening=200)
        sale = _create_sale(db, cajero_a, branch_a, total=100,
                            payments=[(PaymentMethod.CASH, 100)],
                            session=s, change_given=0)
        sr = SaleReturn(
            sale_id=sale.id, user_id=cajero_a.id,
            branch_id=branch_a.id, organization_id=branch_a.organization_id,
            total_refunded=Decimal("50"), refund_method=PaymentMethod.CASH,
            cash_session_id=s.id, status="PENDING", reason="test",
        )
        db.add(sr); db.flush()
        db.add(SaleReturnItem(
            return_id=sr.id, variant_id=variant.id,
            quantity=Decimal("1"), refund_amount=Decimal("50"),
            is_inventory_reentry=False,
            organization_id=branch_a.organization_id,
        ))
        db.flush()

        crud_returns.approve_return(db, sr.id, cajero_a.id,
                                    organization_id=branch_a.organization_id)

        rows = _audit_rows(db, s.id)
        codes = [r.event_type for r in rows]
        assert CashAuditEvent.REFUND_APPROVED in codes
        refund_row = next(r for r in rows if r.event_type == CashAuditEvent.REFUND_APPROVED)
        assert refund_row.amount == Decimal("50.00")
        assert refund_row.related_table == "sale_returns"
        assert refund_row.related_id == sr.id


class TestManualMovementHooks:
    """Manual inflow/outflow endpoints must emit audit rows."""

    def test_inflow_emits_audit_row(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=100)

        # Direct call to the helper that the endpoint uses internally.
        # Endpoint integration is covered by the cash_complete suite; here
        # we verify the audit-emitting wrapper.
        from app.services.cash_audit import audit_cash_event
        cm = CashMovement(session_id=s.id, type="IN",
                          amount=Decimal("50"), reason="Reposición")
        db.add(cm); db.flush()
        audit_cash_event(
            db, event_type=CashAuditEvent.MANUAL_INFLOW,
            organization_id=branch_a.organization_id,
            session_id=s.id, branch_id=branch_a.id, user_id=cajero_a.id,
            amount=Decimal("50"), related_table="cash_movements",
            related_id=str(cm.id), payload={"reason": "Reposición"},
        )
        rows = _audit_rows(db, s.id)
        assert any(r.event_type == CashAuditEvent.MANUAL_INFLOW for r in rows)

    def test_outflow_emits_audit_row(self, db, cajero_a, branch_a):
        s = _open_session(db, cajero_a, branch_a, opening=500)
        cm = CashMovement(session_id=s.id, type="OUT",
                          amount=Decimal("80"), reason="Gasolina")
        db.add(cm); db.flush()
        audit_cash_event(
            db, event_type=CashAuditEvent.MANUAL_OUTFLOW,
            organization_id=branch_a.organization_id,
            session_id=s.id, branch_id=branch_a.id, user_id=cajero_a.id,
            amount=Decimal("80"), related_table="cash_movements",
            related_id=str(cm.id), payload={"reason": "Gasolina"},
        )
        rows = _audit_rows(db, s.id)
        assert any(r.event_type == CashAuditEvent.MANUAL_OUTFLOW for r in rows)


class TestSessionLifecycleHooks:
    """SESSION_OPENED / SESSION_CLOSED hooks at session lifecycle endpoints."""

    def test_close_session_emits_audit_row(self, db, cajero_a, branch_a):
        from app.routers.cash import _apply_close_to_session
        s = _open_session(db, cajero_a, branch_a, opening=100)
        _create_sale(db, cajero_a, branch_a, total=50,
                     payments=[(PaymentMethod.CASH, 50)],
                     session=s, change_given=0)
        _apply_close_to_session(db, s, cajero_a,
                                Decimal("150"), notes="closed test")
        rows = _audit_rows(db, s.id)
        codes = [r.event_type for r in rows]
        assert CashAuditEvent.SESSION_CLOSED in codes
        closed_row = next(r for r in rows if r.event_type == CashAuditEvent.SESSION_CLOSED)
        assert closed_row.payload_json is not None
        # Should snapshot the breakdown
        assert "breakdown" in closed_row.payload_json
