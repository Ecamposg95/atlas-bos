"""Reverse an inflated/duplicated refund safely.

Given a `cash_movements.id` (the OUT row produced by an erroneous
SaleReturn approval), this script:

1. Locates the source SaleReturn via reason prefix.
2. Reverts the SaleReturn to REJECTED with admin override.
3. Reverts inventory: subtracts the qty it added back to stock
   (only for items with is_inventory_reentry=True).
4. Restores sale.status / sale.total_amount / subtotal / tax to
   pre-refund values (recomputed from current sale + this refund's
   prior contribution).
5. Deletes the cash_movements OUT row.
6. Inserts a CashAuditLog row REFUND_REJECTED with payload
   {reason: '[ADMIN-FIX]', original_amount, operator_id}.

Dry-run by default. --apply to persist.

Usage:
    python scripts/repair_inflated_refund.py --movement-id 7849
    python scripts/repair_inflated_refund.py --movement-id 7849 --apply \\
        --operator-id 12 --note "fat-finger reportado por kimberly"
"""
from __future__ import annotations

import argparse
import re
import sys
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.cash import CashMovement
from app.models.returns import SaleReturn, SaleReturnItem
from app.models.sales import SalesDocument, DocumentStatus
from app.models.inventory import StockOnHand, InventoryMovement, MovementType
from app.models.cash_audit import CashAuditEvent
from app.services.cash_audit import audit_cash_event


REASON_RE = re.compile(r"Devolución\s+#([A-F0-9]+)", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--movement-id", type=int, required=True,
                   help="cash_movements.id of the OUT row to reverse")
    p.add_argument("--operator-id", type=int, default=None,
                   help="user_id of the admin running this fix (for audit)")
    p.add_argument("--note", default=None,
                   help="Free-text note added to audit payload")
    p.add_argument("--apply", action="store_true",
                   help="Actually persist. Otherwise dry-run.")
    return p.parse_args()


def find_sale_return(db: Session, cm: CashMovement) -> SaleReturn | None:
    if not cm.reason:
        return None
    m = REASON_RE.search(cm.reason)
    if not m:
        return None
    short_id = m.group(1).lower()
    # SaleReturn.id is full UUID; the cm.reason carries the first 8 hex
    # uppercased. Match by prefix.
    return db.query(SaleReturn).filter(
        SaleReturn.id.like(f"{short_id}%"),
    ).first()


def main() -> int:
    args = parse_args()
    db = SessionLocal()
    try:
        cm = db.query(CashMovement).filter(CashMovement.id == args.movement_id).first()
        if not cm:
            print(f"ERROR: cash_movements.id={args.movement_id} not found")
            return 2
        if cm.type != "OUT":
            print(f"ERROR: movement is type={cm.type}, expected OUT")
            return 2

        sr = find_sale_return(db, cm)
        if not sr:
            print(f"ERROR: could not match a SaleReturn from reason={cm.reason!r}")
            return 2

        sale = db.query(SalesDocument).filter(SalesDocument.id == sr.sale_id).first()
        if not sale:
            print(f"ERROR: sale {sr.sale_id} for refund {sr.id} not found")
            return 2

        print(f"=== {'APPLY' if args.apply else 'DRY-RUN'} ===")
        print(f"CashMovement #{cm.id}: amount={cm.amount} reason={cm.reason!r}")
        print(f"SaleReturn   #{sr.id} status={sr.status} total_refunded={sr.total_refunded}")
        print(f"Sale         #{sale.id} status={sale.status} total_amount={sale.total_amount}")
        items = db.query(SaleReturnItem).filter(SaleReturnItem.return_id == sr.id).all()
        print(f"Items        {len(items)} item(s)")
        for it in items:
            print(f"  - variant={it.variant_id} qty={it.quantity} refund_amount={it.refund_amount} reentry={it.is_inventory_reentry}")

        if not args.apply:
            print("\nDry-run only. Re-run with --apply to persist.")
            return 0

        if sr.status != "APPROVED":
            print(f"WARN: SaleReturn is {sr.status}, not APPROVED — refusing to reverse")
            return 2

        # 1. Reverse inventory for inventory_reentry items
        for it in items:
            if not it.is_inventory_reentry:
                continue
            stock = db.query(StockOnHand).filter(
                StockOnHand.branch_id == sr.branch_id,
                StockOnHand.variant_id == it.variant_id,
            ).first()
            if stock:
                qty_before = Decimal(str(stock.qty_on_hand))
                qty_change = -Decimal(str(it.quantity))
                stock.qty_on_hand = qty_before + qty_change
                db.add(InventoryMovement(
                    branch_id=sr.branch_id,
                    variant_id=it.variant_id,
                    user_id=args.operator_id or sr.user_id,
                    movement_type=MovementType.ADJUSTMENT,
                    qty_change=qty_change,
                    qty_before=qty_before,
                    qty_after=qty_before + qty_change,
                    reference=f"REPAIR_REFUND:{sr.id}",
                    notes=f"[ADMIN-FIX] Reversión de refund inflado #{sr.id}",
                    organization_id=sr.organization_id,
                ))

        # 2. Restore sale.status / total_amount
        # Recompute remaining refund total excluding this one
        from sqlalchemy import func as sql_func
        prior_refunded = db.query(
            sql_func.coalesce(sql_func.sum(SaleReturnItem.refund_amount), Decimal("0"))
        ).join(SaleReturn).filter(
            SaleReturn.sale_id == sale.id,
            SaleReturn.status == "APPROVED",
            SaleReturn.id != sr.id,
        ).scalar() or Decimal("0")

        # Original total = current + this refund's pretax sum
        this_refund_pretax = sum(
            (Decimal(str(it.refund_amount)) for it in items),
            Decimal("0"),
        )
        restored_total = Decimal(str(sale.total_amount or 0)) + this_refund_pretax

        if prior_refunded == 0:
            sale.status = DocumentStatus.PAID
        else:
            # Other refunds still apply
            sale.status = DocumentStatus.REFUNDED_PARTIAL
        sale.total_amount = restored_total
        # Subtotal/tax: best-effort restore (proportional)
        if sale.subtotal is not None:
            sale.subtotal = Decimal(str(sale.subtotal)) + this_refund_pretax

        # 3. Mark refund as REJECTED
        original_amount = Decimal(str(sr.total_refunded))
        sr.status = "REJECTED"

        # 4. Audit row BEFORE deleting cm
        audit_cash_event(
            db,
            event_type=CashAuditEvent.REFUND_REJECTED,
            organization_id=sr.organization_id,
            session_id=cm.session_id,
            branch_id=sr.branch_id,
            user_id=args.operator_id or sr.user_id,
            amount=original_amount,
            related_table="sale_returns",
            related_id=sr.id,
            payload={
                "tag": "[ADMIN-FIX] repair_inflated_refund.py",
                "operator_note": args.note,
                "original_cash_movement_id": cm.id,
                "original_amount": float(original_amount),
                "original_reason": cm.reason,
                "sale_id": sale.id,
            },
        )

        # 5. Delete the OUT cash movement
        db.delete(cm)

        db.commit()
        print("\nCOMMITTED.")
        print("Run scripts/recompute_session_differences.py --session-id "
              f"{cm.session_id} --apply to refresh the persisted difference.")
        return 0
    except Exception as e:
        db.rollback()
        print(f"\nFAILED: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
