"""Run F2 closure-warning checks across ALL closed sessions and report.

For each closed session, calls compute_expected_cash + compute_closure_warnings
and prints a markdown table of anomalies. Safe (read-only).

Usage:
    python scripts/audit_cash_anomalies.py
    python scripts/audit_cash_anomalies.py --since 2026-04-01
    python scripts/audit_cash_anomalies.py --org-id 3 --severity critical
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from app.core.database import SessionLocal
from app.models.cash import CashSession, CashSessionStatus
from app.services.cash_reconciliation import (
    compute_expected_cash,
    compute_closure_warnings,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--since", default=None, help="ISO date (YYYY-MM-DD)")
    p.add_argument("--until", default=None)
    p.add_argument("--org-id", type=int, default=None)
    p.add_argument("--branch-id", type=int, default=None)
    p.add_argument("--severity", default=None,
                   help="Filter: warning | critical")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    db = SessionLocal()
    try:
        q = db.query(CashSession).filter(CashSession.status == CashSessionStatus.CLOSED)
        if args.since:
            q = q.filter(CashSession.closed_at >= datetime.fromisoformat(args.since).replace(tzinfo=timezone.utc))
        if args.until:
            q = q.filter(CashSession.closed_at < datetime.fromisoformat(args.until).replace(tzinfo=timezone.utc))
        if args.org_id is not None:
            q = q.filter(CashSession.organization_id == args.org_id)
        if args.branch_id is not None:
            q = q.filter(CashSession.branch_id == args.branch_id)
        sessions = q.order_by(CashSession.closed_at.desc()).all()

        print(f"# Cash anomaly audit — {len(sessions)} closed sessions scanned\n")
        flagged = 0
        rows = []
        for s in sessions:
            breakdown = compute_expected_cash(db, s)
            warnings = compute_closure_warnings(breakdown, s.closing_balance or 0)
            if not warnings:
                continue
            if args.severity:
                warnings = [w for w in warnings if w["severity"] == args.severity]
                if not warnings:
                    continue
            flagged += 1
            for w in warnings:
                rows.append({
                    "session_id": s.id,
                    "branch_id": s.branch_id,
                    "user_id": s.user_id,
                    "closed_at": s.closed_at.strftime("%Y-%m-%d %H:%M") if s.closed_at else "—",
                    "severity": w["severity"],
                    "code": w["code"],
                    "actual": w["actual"],
                    "threshold": w["threshold"],
                })

        if not rows:
            print("No anomalies found in the selected window.\n")
            return 0

        print(f"**{flagged} sessions** triggered at least one warning ({len(rows)} warnings total).\n")
        print("| session | branch | user | closed | severity | code | actual | threshold |")
        print("|---|---|---|---|---|---|---|---|")
        for r in rows:
            print(f"| {r['session_id']} | {r['branch_id']} | {r['user_id']} | "
                  f"{r['closed_at']} | {r['severity']} | {r['code']} | "
                  f"{r['actual']:.2f} | {r['threshold']:.2f} |")
        print()
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
