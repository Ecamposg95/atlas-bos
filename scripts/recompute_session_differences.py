"""Recompute `cash_sessions.difference` for closed sessions using the current
`compute_expected_cash` formula.

Sessions closed before commit 640fbe9 (2026-05-01) had `difference` persisted
with the old PAID-only filter that excluded REFUNDED_* sales — producing
inflated diffs (positive or negative) on any session with refunds.

This script re-runs the canonical formula on each affected session and updates
the persisted `difference`. The original value is preserved in `notes` with a
`[RECALCULADO 2026-05-01]` prefix for audit trail. `closing_balance` is never
touched.

Usage:
    # Show what would change (default — safe)
    python scripts/recompute_session_differences.py --since 2026-04-01

    # Actually apply
    python scripts/recompute_session_differences.py --since 2026-04-01 --apply

    # Single session
    python scripts/recompute_session_differences.py --session-id 65 --apply

    # Restrict by org
    python scripts/recompute_session_differences.py --since 2026-04-01 \\
        --org-id 3 --apply
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.cash import CashSession, CashSessionStatus
from app.services.cash_reconciliation import compute_expected_cash


RECALC_TAG = "[RECALCULADO 2026-05-01]"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--since", type=str, default=None,
                   help="ISO date (YYYY-MM-DD). Recompute sessions closed >= this date.")
    p.add_argument("--until", type=str, default=None,
                   help="ISO date (YYYY-MM-DD). Recompute sessions closed < this date.")
    p.add_argument("--session-id", type=int, default=None,
                   help="Single session id (overrides date filters).")
    p.add_argument("--org-id", type=int, default=None,
                   help="Restrict to one organization.")
    p.add_argument("--branch-id", type=int, default=None,
                   help="Restrict to one branch.")
    p.add_argument("--apply", action="store_true",
                   help="Actually persist changes. Without this, dry-run.")
    p.add_argument("--threshold", type=float, default=0.01,
                   help="Only report/apply if abs(new_diff - old_diff) > threshold (default 0.01).")
    return p.parse_args()


def select_sessions(db: Session, args: argparse.Namespace):
    q = db.query(CashSession).filter(CashSession.status == CashSessionStatus.CLOSED)
    if args.session_id is not None:
        q = q.filter(CashSession.id == args.session_id)
    else:
        if args.since:
            since_dt = datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc)
            q = q.filter(CashSession.closed_at >= since_dt)
        if args.until:
            until_dt = datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc)
            q = q.filter(CashSession.closed_at < until_dt)
        if args.org_id is not None:
            q = q.filter(CashSession.organization_id == args.org_id)
        if args.branch_id is not None:
            q = q.filter(CashSession.branch_id == args.branch_id)
    return q.order_by(CashSession.closed_at.asc()).all()


def fmt_money(d: Decimal | float | None) -> str:
    if d is None:
        return "—"
    return f"{float(d):>+12,.2f}"


def main() -> int:
    args = parse_args()
    threshold = Decimal(str(args.threshold))

    db = SessionLocal()
    try:
        sessions = select_sessions(db, args)
        if not sessions:
            print("No sessions matched the filter.")
            return 0

        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"=== {mode} — {len(sessions)} session(s) ===")
        print(f"{'session_id':>10} {'closed_at':>20} {'closing':>13} "
              f"{'diff_old':>13} {'diff_new':>13} {'delta':>13}  notes")
        print("-" * 110)

        changed = 0
        skipped = 0
        for s in sessions:
            breakdown = compute_expected_cash(db, s)
            new_diff = Decimal(str(s.closing_balance or 0)) - breakdown.expected
            old_diff = Decimal(str(s.difference or 0))
            delta = new_diff - old_diff

            if abs(delta) <= threshold:
                skipped += 1
                continue

            print(
                f"{s.id:>10} "
                f"{(s.closed_at.strftime('%Y-%m-%d %H:%M') if s.closed_at else '—'):>20} "
                f"{fmt_money(s.closing_balance)} "
                f"{fmt_money(old_diff)} "
                f"{fmt_money(new_diff)} "
                f"{fmt_money(delta)}  "
                f"{(s.notes or '')[:40]}"
            )

            if args.apply:
                s.difference = new_diff
                tag_line = (
                    f"{RECALC_TAG} old_diff={old_diff:.2f} new_diff={new_diff:.2f}"
                )
                if s.notes:
                    if RECALC_TAG not in s.notes:
                        s.notes = f"{s.notes}\n{tag_line}"
                else:
                    s.notes = tag_line
            changed += 1

        if args.apply and changed > 0:
            db.commit()
            print(f"\nCOMMITTED {changed} updates ({skipped} unchanged within threshold).")
        else:
            print(f"\n{'Would update' if not args.apply else 'Updated'}: {changed} "
                  f"({skipped} unchanged within threshold).")
            if not args.apply and changed > 0:
                print("Run again with --apply to persist.")

        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
