# Cashier Cockpit Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Atlas POS as a cashier cockpit, simplify cashier-consumed pages with role-aware variants, reorganise the branch sidebar, and add a single backend aggregator endpoint to power the new home.

**Architecture:** Three layers, no new shell. (1) Cockpit replaces Atlas POS for branch users. (2) Cashier-consumed parent pages internally branch on `role + context` and render `*BranchView` components. (3) Sidebar uses role-aware label overrides. One new endpoint (`GET /api/branch/dashboard`), one new wrapper endpoint (`POST /api/cash/sessions/{id}/close-guided`), one schema change (`Branch.daily_sales_goal`, `Branch.closing_time`).

**Tech Stack:**
- Backend: FastAPI 0.127, SQLAlchemy 2.0, Pydantic v2, PostgreSQL.
- Frontend: React 18 + TS, React Router v6, Zustand, Axios, Tailwind.
- Tests: script-style under `tests/` (no pytest, no Playwright).

**Spec:** `docs/superpowers/specs/2026-04-27-cashier-cockpit-redesign-design.md`.
**Branch:** `feat/cashier-cockpit-redesign` (cut from `release/qa` @ `fb2db5f`). PR target: `release/qa`.
**Spec correction tracked here:** `Branch.closing_time` does not exist; Task 1 migration adds it alongside `daily_sales_goal`.

---

## File Structure

### Backend — new files
- `app/services/branch_dashboard.py` — aggregator service for cockpit data.
- `app/schemas/branch_dashboard.py` — Pydantic v2 response schemas.
- `app/routers/branch.py` — `/api/branch/dashboard` router.
- `scripts/migrate_add_branch_cockpit_fields.py` — adds `daily_sales_goal` and `closing_time` columns.
- `tests/test_branch_dashboard.py` — backend integration test.
- `tests/test_cash_close_guided.py` — backend integration test.

### Backend — modified files
- `app/models/organization.py` — add two columns to `Branch`.
- `app/main.py` — mount `branch.router`.
- `app/routers/cash.py` — add `POST /sessions/{id}/close-guided` endpoint.
- `app/schemas/cash.py` — add `CashSessionCloseGuided` payload schema.
- `app/core/role_permissions.py` — add `TEMPLATE_LABEL_OVERRIDES_BY_ROLE`, update `_NAV_GROUP`, update `nav_for_role()`.

### Frontend — new files
- `frontend/src/types/branchDashboard.ts` — TS interfaces.
- `frontend/src/api/branchDashboard.ts` — Axios calls.
- `frontend/src/copy/branchCopy.ts` — semantic Spanish strings.
- `frontend/src/components/branch/Cockpit.tsx` — cockpit shell.
- `frontend/src/components/branch/CockpitGreeting.tsx` — Zone 1.
- `frontend/src/components/branch/CockpitDayKPIs.tsx` — Zone 2.
- `frontend/src/components/branch/CockpitAlerts.tsx` — Zone 3.
- `frontend/src/components/branch/CockpitClosingWizard.tsx` — Zone 4.
- `frontend/src/components/branch/CockpitQuickAccess.tsx` — Zone 5.
- `frontend/src/components/branch/SalesBranchView.tsx`
- `frontend/src/components/branch/CashBranchView.tsx`
- `frontend/src/components/branch/ReturnsBranchView.tsx`
- `frontend/src/components/branch/ProductsBranchView.tsx`
- `frontend/src/components/branch/useIsBranchUser.ts` — hook to detect role + context.

### Frontend — modified files
- `frontend/src/pages/pos/Atlas POS.tsx` — replace body with `<Cockpit />` for branch users.
- `frontend/src/pages/pos/POS.tsx` — add "Volver a Mi día" button + shift indicator.
- `frontend/src/pages/sales/SalesHistory.tsx` — branch on role.
- `frontend/src/pages/finance/CashHistory.tsx` — branch on role.
- `frontend/src/pages/sales/Returns.tsx` — branch on role.
- `frontend/src/pages/inventory/Products.tsx` — branch on role.
- `frontend/src/components/layout/Sidebar.tsx` — apply role-aware labels and order.

---

## Task 1: Schema migration — `daily_sales_goal` + `closing_time` on Branch

**Files:**
- Create: `scripts/migrate_add_branch_cockpit_fields.py`
- Modify: `app/models/organization.py` (add columns inside `Branch` class, after `paper_width_mm`)

- [ ] **Step 1: Add columns to ORM**

In `app/models/organization.py`, inside `class Branch`, after the `open_drawer_on_print` line, add:

```python
    # Cockpit / day-mode (added 2026-04-27)
    daily_sales_goal = Column(Numeric(12, 2), nullable=True)  # Meta del día en MXN, NULL = sin meta
    closing_time = Column(Time, nullable=True)                # Hora de cierre HH:MM, NULL = sin checklist asistido
```

Add `Time` to the imports from `sqlalchemy` at the top of the file (it already imports `Numeric`).

- [ ] **Step 2: Write the migration script**

Create `scripts/migrate_add_branch_cockpit_fields.py`:

```python
"""
Migration: Add daily_sales_goal and closing_time to branches table.
Run once: python scripts/migrate_add_branch_cockpit_fields.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text


def column_exists(conn, table: str, column: str) -> bool:
    r = conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column})
    return r.fetchone() is not None


def run() -> None:
    with engine.connect() as conn:
        added = []
        if not column_exists(conn, "branches", "daily_sales_goal"):
            conn.execute(text("ALTER TABLE branches ADD COLUMN daily_sales_goal NUMERIC(12,2);"))
            added.append("daily_sales_goal")
        if not column_exists(conn, "branches", "closing_time"):
            conn.execute(text("ALTER TABLE branches ADD COLUMN closing_time TIME;"))
            added.append("closing_time")
        conn.commit()
        if added:
            print(f"Added columns to branches: {', '.join(added)}.")
        else:
            print("No-op: both columns already exist.")


if __name__ == "__main__":
    run()
```

- [ ] **Step 3: Run the migration locally**

Run: `python scripts/migrate_add_branch_cockpit_fields.py`
Expected stdout: `Added columns to branches: daily_sales_goal, closing_time.` (or no-op if rerun).

- [ ] **Step 4: Verify**

Run: `psql "$DATABASE_URL" -c "\d branches" | grep -E "daily_sales_goal|closing_time"`
Expected: two rows showing the new columns.

- [ ] **Step 5: Commit**

```bash
git add app/models/organization.py scripts/migrate_add_branch_cockpit_fields.py
git commit -m "feat(branch): add daily_sales_goal and closing_time columns"
```

---

## Task 2: Pydantic schemas for `/api/branch/dashboard`

**Files:**
- Create: `app/schemas/branch_dashboard.py`

- [ ] **Step 1: Write the schemas**

```python
from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict


class DashboardUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str
    branch_name: str


class DashboardShift(BaseModel):
    is_open: bool
    session_id: Optional[int] = None
    opened_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None


class DashboardToday(BaseModel):
    sales_total: Decimal
    sales_count: int
    avg_ticket: Decimal
    returns_total: Decimal
    returns_count: int
    goal: Optional[Decimal] = None
    goal_progress_pct: Optional[float] = None


AlertKind = Literal["low_stock", "no_branch_price", "quote_expiring", "cash_variance"]


class DashboardAlert(BaseModel):
    kind: AlertKind
    count: Optional[int] = None      # used for low_stock, no_branch_price, quote_expiring
    amount: Optional[Decimal] = None # used for cash_variance
    deeplink: str


class BranchDashboardRead(BaseModel):
    user: DashboardUser
    shift: DashboardShift
    today: DashboardToday
    alerts: List[DashboardAlert]
    closing_visible: bool
```

- [ ] **Step 2: Verify import works**

Run: `python -c "from app.schemas.branch_dashboard import BranchDashboardRead; print(BranchDashboardRead.model_fields.keys())"`
Expected: `dict_keys(['user', 'shift', 'today', 'alerts', 'closing_visible'])`.

- [ ] **Step 3: Commit**

```bash
git add app/schemas/branch_dashboard.py
git commit -m "feat(branch): pydantic schemas for /api/branch/dashboard"
```

---

## Task 3: BranchDashboardService — skeleton + shift block (TDD)

**Files:**
- Create: `app/services/branch_dashboard.py`
- Create: `tests/test_branch_dashboard.py`

This service composes the dashboard payload. Each block (`shift`, `today`, `alerts`, `closing_visible`) is a private method. Tasks 3–6 build them up one by one, each with its own test.

- [ ] **Step 1: Write the failing test**

Create `tests/test_branch_dashboard.py`:

```python
"""
Integration tests for /api/branch/dashboard.
Run with backend up: uvicorn app.main:app --reload
Then: python tests/test_branch_dashboard.py
"""
import requests

BASE = "http://127.0.0.1:8000"


def login(username: str, password: str) -> dict:
    r = requests.post(f"{BASE}/api/auth/login", data={"username": username, "password": password})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_shift_closed_when_no_session():
    headers = login("admin", "123")  # CAJERO with no open session
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["shift"]["is_open"] is False
    assert body["shift"]["session_id"] is None
    assert body["shift"]["duration_minutes"] is None
    print("PASS: shift closed when no session")


def test_shift_open_after_open_call():
    headers = login("admin", "123")
    requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=headers)
    requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=headers)
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert body["shift"]["is_open"] is True
    assert body["shift"]["session_id"] is not None
    assert body["shift"]["duration_minutes"] is not None
    requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 100, "notes": "reset"}, headers=headers)
    print("PASS: shift open after open")


if __name__ == "__main__":
    test_shift_closed_when_no_session()
    test_shift_open_after_open_call()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python tests/test_branch_dashboard.py`
Expected: HTTPError 404 (endpoint not yet wired) — that's the failing state.

- [ ] **Step 3: Implement skeleton service + shift block**

Create `app/services/branch_dashboard.py`:

```python
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.cash import CashSession
from app.models.organization import Branch
from app.models.users import User
from app.schemas.branch_dashboard import (
    BranchDashboardRead,
    DashboardAlert,
    DashboardShift,
    DashboardToday,
    DashboardUser,
)


class BranchDashboardService:
    def __init__(self, db: Session, user: User, organization_id: int, branch_id: int):
        self.db = db
        self.user = user
        self.organization_id = organization_id
        self.branch_id = branch_id

    def build(self) -> BranchDashboardRead:
        return BranchDashboardRead(
            user=self._user_block(),
            shift=self._shift_block(),
            today=self._today_block(),
            alerts=self._alerts_block(),
            closing_visible=self._closing_visible(),
        )

    # ---- blocks ----
    def _user_block(self) -> DashboardUser:
        branch = self.db.query(Branch).filter(Branch.id == self.branch_id).first()
        return DashboardUser(
            name=self.user.full_name or self.user.username,
            branch_name=branch.name if branch else "",
        )

    def _shift_block(self) -> DashboardShift:
        session = (
            self.db.query(CashSession)
            .filter(
                CashSession.user_id == self.user.id,
                CashSession.branch_id == self.branch_id,
                CashSession.closed_at.is_(None),
            )
            .order_by(CashSession.opened_at.desc())
            .first()
        )
        if not session:
            return DashboardShift(is_open=False)
        opened_at = session.opened_at
        if opened_at.tzinfo is None:
            opened_at = opened_at.replace(tzinfo=timezone.utc)
        duration = int((datetime.now(timezone.utc) - opened_at).total_seconds() // 60)
        return DashboardShift(
            is_open=True,
            session_id=session.id,
            opened_at=opened_at,
            duration_minutes=duration,
        )

    # placeholders, implemented in subsequent tasks
    def _today_block(self) -> DashboardToday:
        zero = Decimal("0")
        return DashboardToday(
            sales_total=zero, sales_count=0, avg_ticket=zero,
            returns_total=zero, returns_count=0,
        )

    def _alerts_block(self) -> List[DashboardAlert]:
        return []

    def _closing_visible(self) -> bool:
        return False
```

- [ ] **Step 4: Wire a minimal router so the test can hit it**

Create `app/routers/branch.py` (will be expanded in Task 8 with proper deps):

```python
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_active_organization
from app.security import get_current_user
from app.models.users import User
from app.schemas.branch_dashboard import BranchDashboardRead
from app.services.branch_dashboard import BranchDashboardService

router = APIRouter()


@router.get("/dashboard", response_model=BranchDashboardRead)
def get_dashboard(
    x_branch_id: Optional[int] = Header(None, alias="X-Branch-ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: int = Depends(get_current_active_organization),
) -> BranchDashboardRead:
    branch_id = current_user.branch_id or x_branch_id
    if branch_id is None:
        raise HTTPException(status_code=400, detail="branch context required")
    return BranchDashboardService(db, current_user, organization_id, branch_id).build()
```

In `app/main.py`, after the `cash.router` line (around line 132), add:

```python
from app.routers import branch as branch_router  # near the top with other router imports
app.include_router(branch_router.router, prefix="/api/branch", tags=["Branch"])
```

- [ ] **Step 5: Run test to verify it passes**

Restart uvicorn, then run: `python tests/test_branch_dashboard.py`
Expected stdout:
```
PASS: shift closed when no session
PASS: shift open after open
```

- [ ] **Step 6: Commit**

```bash
git add app/services/branch_dashboard.py app/routers/branch.py app/main.py app/schemas/branch_dashboard.py tests/test_branch_dashboard.py
git commit -m "feat(branch): dashboard service skeleton + shift block"
```

---

## Task 4: BranchDashboardService — `today` block

**Files:**
- Modify: `app/services/branch_dashboard.py` (replace `_today_block`)
- Modify: `tests/test_branch_dashboard.py` (append tests)

- [ ] **Step 1: Append failing tests**

Append to `tests/test_branch_dashboard.py` (after existing tests, before `if __name__`):

```python
def test_today_aggregates_after_a_sale():
    headers = login("admin", "123")
    # ensure clean shift
    requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=headers)
    requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=headers)
    # one sale
    p = requests.get(f"{BASE}/api/products/?limit=1", headers=headers).json()
    if isinstance(p, dict): p = p["items"]
    sku = p[0]["variants"][0]["sku"]
    price = float(p[0]["variants"][0]["price"])
    requests.post(f"{BASE}/api/sales/", json={
        "items": [{"sku": sku, "quantity": 1}],
        "payments": [{"amount": price, "method": "CASH"}],
    }, headers=headers)
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert body["today"]["sales_count"] >= 1
    assert float(body["today"]["sales_total"]) >= price
    assert float(body["today"]["avg_ticket"]) > 0
    requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=headers)
    print("PASS: today aggregates")


def test_goal_progress_omitted_when_no_goal():
    headers = login("admin", "123")
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert body["today"].get("goal") is None
    assert body["today"].get("goal_progress_pct") is None
    print("PASS: goal omitted when null")
```

Update the `if __name__` block:

```python
if __name__ == "__main__":
    test_shift_closed_when_no_session()
    test_shift_open_after_open_call()
    test_today_aggregates_after_a_sale()
    test_goal_progress_omitted_when_no_goal()
```

- [ ] **Step 2: Run tests to verify failure**

Run: `python tests/test_branch_dashboard.py`
Expected: `test_today_aggregates_after_a_sale` fails (sales_count=0, total=0).

- [ ] **Step 3: Implement `_today_block`**

In `app/services/branch_dashboard.py`, add imports:

```python
from datetime import date
from sqlalchemy import func
from app.models.sales import SalesDocument, DocumentStatus, DocumentType
from app.models.returns import ReturnDocument
```

Replace `_today_block`:

```python
    def _today_block(self) -> DashboardToday:
        today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)

        sales_total, sales_count = self._sum_count(
            self.db.query(
                func.coalesce(func.sum(SalesDocument.total), 0),
                func.count(SalesDocument.id),
            ).filter(
                SalesDocument.organization_id == self.organization_id,
                SalesDocument.branch_id == self.branch_id,
                SalesDocument.created_at >= today_start,
                SalesDocument.status == DocumentStatus.PAID,
                SalesDocument.doc_type == DocumentType.SALE,
            )
        )

        returns_total, returns_count = self._sum_count(
            self.db.query(
                func.coalesce(func.sum(ReturnDocument.total), 0),
                func.count(ReturnDocument.id),
            ).filter(
                ReturnDocument.organization_id == self.organization_id,
                ReturnDocument.branch_id == self.branch_id,
                ReturnDocument.created_at >= today_start,
            )
        )

        avg_ticket = (sales_total / sales_count) if sales_count else Decimal("0")

        branch = self.db.query(Branch).filter(Branch.id == self.branch_id).first()
        goal = branch.daily_sales_goal if branch else None
        goal_pct: Optional[float] = None
        if goal and goal > 0:
            goal_pct = float(round((sales_total / goal) * 100, 1))

        return DashboardToday(
            sales_total=sales_total,
            sales_count=sales_count,
            avg_ticket=avg_ticket,
            returns_total=returns_total,
            returns_count=returns_count,
            goal=goal,
            goal_progress_pct=goal_pct,
        )

    @staticmethod
    def _sum_count(query) -> tuple[Decimal, int]:
        row = query.first()
        if row is None:
            return Decimal("0"), 0
        total, count = row
        return Decimal(total or 0), int(count or 0)
```

If `ReturnDocument` does not have `total` or `branch_id`, inspect the model and adjust. If the codebase uses a different name for the sales total column (e.g., `total_amount`), align here.

- [ ] **Step 4: Run tests**

Run: `python tests/test_branch_dashboard.py`
Expected: all four PASS lines printed.

- [ ] **Step 5: Commit**

```bash
git add app/services/branch_dashboard.py tests/test_branch_dashboard.py
git commit -m "feat(branch): today aggregates in dashboard service"
```

---

## Task 5: BranchDashboardService — alerts block

**Files:**
- Modify: `app/services/branch_dashboard.py` (replace `_alerts_block`)
- Modify: `tests/test_branch_dashboard.py` (append tests)

- [ ] **Step 1: Append failing tests**

```python
def test_alerts_empty_state():
    headers = login("admin", "123")
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert isinstance(body["alerts"], list)
    for a in body["alerts"]:
        assert a["kind"] in ("low_stock", "no_branch_price", "quote_expiring", "cash_variance")
        assert a["deeplink"].startswith("/")
    print("PASS: alerts shape")
```

- [ ] **Step 2: Implement `_alerts_block`**

In `app/services/branch_dashboard.py`, add imports:

```python
from datetime import timedelta
from app.models.products import Product, ProductBranchStatus
from app.models.quotes import Quote, QuoteStatus
```

Replace `_alerts_block`:

```python
    def _alerts_block(self) -> List[DashboardAlert]:
        out: List[DashboardAlert] = []

        # 1. Low stock — products with branch stock < min in this branch
        low_stock = (
            self.db.query(func.count(ProductBranchStatus.id))
            .filter(
                ProductBranchStatus.organization_id == self.organization_id,
                ProductBranchStatus.branch_id == self.branch_id,
                ProductBranchStatus.is_active == True,
                ProductBranchStatus.stock_qty < ProductBranchStatus.min_stock,
                ProductBranchStatus.min_stock > 0,
            )
            .scalar()
            or 0
        )
        if low_stock:
            out.append(DashboardAlert(
                kind="low_stock", count=int(low_stock),
                deeplink="/products?filter=low_stock",
            ))

        # 2. Products with no branch-specific price
        no_price = (
            self.db.query(func.count(ProductBranchStatus.id))
            .filter(
                ProductBranchStatus.organization_id == self.organization_id,
                ProductBranchStatus.branch_id == self.branch_id,
                ProductBranchStatus.is_active == True,
                ProductBranchStatus.price.is_(None),
            )
            .scalar()
            or 0
        )
        if no_price:
            out.append(DashboardAlert(
                kind="no_branch_price", count=int(no_price),
                deeplink="/products?filter=no_price",
            ))

        # 3. Quotes expiring today
        today_end = datetime.combine(date.today(), datetime.max.time(), tzinfo=timezone.utc)
        expiring = (
            self.db.query(func.count(Quote.id))
            .filter(
                Quote.organization_id == self.organization_id,
                Quote.branch_id == self.branch_id,
                Quote.status == QuoteStatus.OPEN,
                Quote.expires_at <= today_end,
                Quote.expires_at >= datetime.now(timezone.utc),
            )
            .scalar()
            or 0
        )
        if expiring:
            out.append(DashboardAlert(
                kind="quote_expiring", count=int(expiring),
                deeplink="/quotes?expiring=today",
            ))

        # 4. Cash variance from last closed session
        last_closed = (
            self.db.query(CashSession)
            .filter(
                CashSession.branch_id == self.branch_id,
                CashSession.closed_at.is_not(None),
            )
            .order_by(CashSession.closed_at.desc())
            .first()
        )
        if last_closed and last_closed.variance and abs(last_closed.variance) >= Decimal("1"):
            out.append(DashboardAlert(
                kind="cash_variance",
                amount=Decimal(last_closed.variance),
                deeplink="/cash-history",
            ))

        return out
```

If `Quote` model does not expose `branch_id`, `expires_at`, or `status`, or `CashSession` does not expose `variance`, inspect the model and adjust column names. If a model is missing, skip that alert and add a TODO comment with the model gap — do not block the task.

- [ ] **Step 3: Run tests**

Run: `python tests/test_branch_dashboard.py`
Expected: all PASS lines.

- [ ] **Step 4: Commit**

```bash
git add app/services/branch_dashboard.py tests/test_branch_dashboard.py
git commit -m "feat(branch): alerts block (low stock, no price, quotes, variance)"
```

---

## Task 6: BranchDashboardService — `closing_visible`

**Files:**
- Modify: `app/services/branch_dashboard.py`
- Modify: `tests/test_branch_dashboard.py`

- [ ] **Step 1: Append failing test**

```python
def test_closing_visible_false_when_no_closing_time():
    headers = login("admin", "123")
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert body["closing_visible"] is False
    print("PASS: closing_visible false without config")
```

- [ ] **Step 2: Implement `_closing_visible`**

```python
    def _closing_visible(self) -> bool:
        if not self._shift_block().is_open:
            return False
        branch = self.db.query(Branch).filter(Branch.id == self.branch_id).first()
        if not branch or not branch.closing_time:
            return False
        now = datetime.now()  # local time of server; closing_time is store-local
        closing_dt = datetime.combine(now.date(), branch.closing_time)
        return (closing_dt - now) <= timedelta(hours=1) and (closing_dt - now) >= timedelta(minutes=-30)
```

The `_shift_block()` is called twice on each request. That is acceptable for now — it's a single-row indexed query. If profiling later shows it as a hotspot, memoise on `self`.

- [ ] **Step 3: Run tests**

Run: `python tests/test_branch_dashboard.py`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/services/branch_dashboard.py tests/test_branch_dashboard.py
git commit -m "feat(branch): closing_visible flag based on branch closing_time"
```

---

## Task 7: Multi-tenancy regression test for `/api/branch/dashboard`

**Files:**
- Modify: `tests/test_branch_dashboard.py`

- [ ] **Step 1: Append the test**

```python
def test_branch_scoping_locked_to_user_branch():
    """A CAJERO assigned to branch X must not see data from branch Y even with X-Branch-ID spoofing."""
    headers = login("admin", "123")
    # User has branch_id set; sending X-Branch-ID for a different branch must be ignored
    headers_spoof = {**headers, "X-Branch-ID": "999999"}
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers_spoof).json()
    # branch_name should still be the user's branch, not branch 999999
    assert body["user"]["branch_name"]  # non-empty
    print("PASS: branch scoping locked to user branch")


def test_org_scoping_404_for_foreign_org():
    """Sending an X-Organization-ID the user is not a member of must 403."""
    headers = login("admin", "123")
    headers_spoof = {**headers, "X-Organization-ID": "999999"}
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=headers_spoof)
    assert r.status_code in (403, 404), r.status_code
    print("PASS: org spoofing rejected")
```

- [ ] **Step 2: Harden the router**

In `app/routers/branch.py`, replace the `branch_id` resolution to ignore `X-Branch-ID` when the user already has a `branch_id`:

```python
    if current_user.branch_id is not None:
        branch_id = current_user.branch_id
    elif x_branch_id is not None:
        branch_id = x_branch_id
    else:
        raise HTTPException(status_code=400, detail="branch context required")
```

- [ ] **Step 3: Run tests**

Run: `python tests/test_branch_dashboard.py`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/routers/branch.py tests/test_branch_dashboard.py
git commit -m "test(branch): multi-tenancy and branch-scoping for dashboard"
```

---

## Task 8: Cash close-guided endpoint

**Files:**
- Modify: `app/schemas/cash.py` (add schema)
- Modify: `app/routers/cash.py` (add endpoint)
- Create: `tests/test_cash_close_guided.py`

- [ ] **Step 1: Add the payload schema**

In `app/schemas/cash.py`, add:

```python
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field


class CashSessionCloseGuided(BaseModel):
    counted_cash: Decimal = Field(..., ge=0, description="Efectivo contado en caja")
    cash_total_per_method: dict[str, Decimal] = Field(default_factory=dict, description="Totales por método de pago según el cajero")
    day_expenses_total: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None
```

- [ ] **Step 2: Write the failing test**

Create `tests/test_cash_close_guided.py`:

```python
import requests

BASE = "http://127.0.0.1:8000"


def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", data={"username": u, "password": p})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_guided_close_happy_path():
    h = login("admin", "123")
    requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=h)
    requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=h)
    db = requests.get(f"{BASE}/api/branch/dashboard", headers=h).json()
    sid = db["shift"]["session_id"]
    r = requests.post(f"{BASE}/api/cash/sessions/{sid}/close-guided", json={
        "counted_cash": 100,
        "cash_total_per_method": {"CASH": 100, "CARD": 0},
        "day_expenses_total": 0,
        "notes": "guided test",
    }, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["closed_at"]
    print("PASS: guided close happy path")


def test_guided_close_only_owner():
    """A user who does not own the session cannot close it."""
    print("SKIP: requires second-user fixture, document in spec")  # follow-up


if __name__ == "__main__":
    test_guided_close_happy_path()
    test_guided_close_only_owner()
```

- [ ] **Step 3: Run test — expect 404**

Run: `python tests/test_cash_close_guided.py`
Expected: assertion fails with 404 body (endpoint missing).

- [ ] **Step 4: Implement the endpoint**

In `app/routers/cash.py`, after the existing `close_session` endpoint, add:

```python
from app.schemas.cash import CashSessionCloseGuided  # add to existing imports


@router.post("/sessions/{session_id}/close-guided", response_model=CashSessionRead)
def close_session_guided(
    session_id: int,
    payload: CashSessionCloseGuided,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: int = Depends(get_current_active_organization),
):
    session = (
        db.query(CashSession)
        .join(Branch, Branch.id == CashSession.branch_id)
        .filter(
            CashSession.id == session_id,
            Branch.organization_id == organization_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    if session.closed_at is not None:
        raise HTTPException(status_code=409, detail="session already closed")
    if session.user_id != current_user.id and current_user.role != Role.GERENTE:
        raise HTTPException(status_code=403, detail="only the shift owner or branch GERENTE can close")
    # Delegate to the same logic as POST /api/cash/close, mapped onto this specific session
    return _close_session_impl(
        db=db, session=session, current_user=current_user,
        closing_balance=payload.counted_cash, notes=payload.notes,
    )
```

You will need to refactor the body of the existing `close_session` into a helper `_close_session_impl(db, session, current_user, closing_balance, notes)` that takes the session by reference rather than looking it up from `current_user.branch_id`. The original `close_session` then becomes a thin wrapper that finds the session and calls the helper. Do this as part of this task — it is not optional, otherwise we duplicate logic.

If `Role` is not yet imported in `cash.py`, add it: `from app.models.users import User, Role`.

- [ ] **Step 5: Run test**

Run: `python tests/test_cash_close_guided.py`
Expected:
```
PASS: guided close happy path
SKIP: requires second-user fixture, document in spec
```

- [ ] **Step 6: Commit**

```bash
git add app/schemas/cash.py app/routers/cash.py tests/test_cash_close_guided.py
git commit -m "feat(cash): close-guided endpoint that wraps shared close logic"
```

---

## Task 9: Backend label overrides for branch sidebar

**Files:**
- Modify: `app/core/role_permissions.py`

- [ ] **Step 1: Add the override map**

After `TEMPLATE_METADATA = { ... }` block (around line 190), add:

```python
# Per-role label overrides applied AFTER TEMPLATE_METADATA lookup.
# Used by branch users so cashiers see semantic labels while HQ keeps the canonical names.
TEMPLATE_LABEL_OVERRIDES_BY_ROLE: dict[Role, dict[str, str]] = {
    Role.CAJERO: {
        "atlas-pos.html":      "Mi día",
        "pos.html":           "Cobrar",
        "cash_history.html":  "Mi caja",
        "sales.html":         "Mis ventas",
        "returns.html":       "Devolución",
        "products.html":      "Inventario",
        "reports.html":       "Reportes",
        "printer_config.html":"Impresora",
    },
}
TEMPLATE_LABEL_OVERRIDES_BY_ROLE[Role.GERENTE] = TEMPLATE_LABEL_OVERRIDES_BY_ROLE[Role.CAJERO]


# Validation: every override key must exist in ROLE_TEMPLATE_ACCESS for that role.
for _role, _overrides in TEMPLATE_LABEL_OVERRIDES_BY_ROLE.items():
    _allowed = set(ROLE_TEMPLATE_ACCESS.get(_role, []))
    _missing = set(_overrides) - _allowed
    if _missing:
        raise RuntimeError(
            f"TEMPLATE_LABEL_OVERRIDES_BY_ROLE[{_role}] references templates not in ROLE_TEMPLATE_ACCESS: {_missing}"
        )
```

- [ ] **Step 2: Update `_NAV_GROUP` for the new branch order**

Replace the branch block (currently sorts atlas-pos `-1`, pos `0`, sales/cash `1`, products/reports `3`, printer `4`) with:

```python
    # ── BRANCH — GERENTE / CAJERO ─────────────────────────
    "atlas-pos.html":                 (-2, "Mi día"),
    "pos.html":                      (-1, "Cobrar"),
    "cash_history.html":             (1, "Mi turno"),
    "sales.html":                    (2, "Mi turno"),
    "returns.html":                  (3, "Mi turno"),
    "products.html":                 (4, "Inventario"),
    "reports.html":                  (5, "Inventario"),
    "printer_config.html":           (6, "Configuración"),
```

- [ ] **Step 3: Apply overrides inside `nav_for_role`**

In `nav_for_role()` (around line 287-302), replace the loop body:

```python
    overrides = TEMPLATE_LABEL_OVERRIDES_BY_ROLE.get(lookup_key, {})
    nav = []
    for t_name in templates:
        if t_name in TEMPLATE_METADATA and t_name not in _EXCLUDED_FROM_NAV:
            meta = TEMPLATE_METADATA[t_name]
            label = overrides.get(t_name, meta["label"])
            sort_order, group = _NAV_GROUP.get(t_name, (99, "Otros"))
            nav.append({
                "label": label,
                "icon": meta["icon"],
                "href": meta["url"],
                "group": group,
                "_sort": sort_order,
            })
    nav.sort(key=lambda x: x["_sort"])
    return nav
```

Also remove `"hr_me.html"` from `_EXCLUDED_FROM_NAV` only if you want it discoverable in HQ; otherwise leave as-is (the current code already excludes it, which matches the spec decision to hide it from cashier nav too).

- [ ] **Step 4: Smoke check the importer**

Run: `python -c "from app.core.role_permissions import nav_for_role, Role; import json; print(json.dumps(nav_for_role(Role.CAJERO), indent=2, ensure_ascii=False))"`
Expected: JSON list whose `label` values are the new semantic ones (`Mi día`, `Cobrar`, `Mi caja`, `Mis ventas`, etc.).

- [ ] **Step 5: Commit**

```bash
git add app/core/role_permissions.py
git commit -m "feat(rbac): role-aware label overrides + branch sidebar reorg"
```

---

## Task 10: Frontend — types, API client, copy file, branch-user hook

**Files:**
- Create: `frontend/src/types/branchDashboard.ts`
- Create: `frontend/src/api/branchDashboard.ts`
- Create: `frontend/src/copy/branchCopy.ts`
- Create: `frontend/src/components/branch/useIsBranchUser.ts`

- [ ] **Step 1: Types**

```ts
// frontend/src/types/branchDashboard.ts
export interface DashboardUser { name: string; branch_name: string }

export interface DashboardShift {
  is_open: boolean
  session_id?: number | null
  opened_at?: string | null
  duration_minutes?: number | null
}

export interface DashboardToday {
  sales_total: string
  sales_count: number
  avg_ticket: string
  returns_total: string
  returns_count: number
  goal?: string | null
  goal_progress_pct?: number | null
}

export type AlertKind = 'low_stock' | 'no_branch_price' | 'quote_expiring' | 'cash_variance'

export interface DashboardAlert {
  kind: AlertKind
  count?: number | null
  amount?: string | null
  deeplink: string
}

export interface BranchDashboard {
  user: DashboardUser
  shift: DashboardShift
  today: DashboardToday
  alerts: DashboardAlert[]
  closing_visible: boolean
}
```

- [ ] **Step 2: API client**

```ts
// frontend/src/api/branchDashboard.ts
import client from './client'
import type { BranchDashboard } from '../types/branchDashboard'

export async function getBranchDashboard(): Promise<BranchDashboard> {
  const { data } = await client.get<BranchDashboard>('/branch/dashboard')
  return data
}

export interface CloseGuidedPayload {
  counted_cash: number
  cash_total_per_method: Record<string, number>
  day_expenses_total: number
  notes?: string
}

export async function closeShiftGuided(sessionId: number, payload: CloseGuidedPayload) {
  const { data } = await client.post(`/cash/sessions/${sessionId}/close-guided`, payload)
  return data
}
```

- [ ] **Step 3: Copy constants**

```ts
// frontend/src/copy/branchCopy.ts
export const BRANCH_COPY = {
  cockpit: {
    payNow: 'Cobrar',
    backToHome: 'Volver a Mi día',
    shiftOpen: (mins: number) => `Caja abierta · ${formatDuration(mins)}`,
    shiftClosed: 'Sin caja abierta',
    openShift: 'Abrir turno',
    closeShift: 'Cerrar mi turno',
    today: 'Mi día',
    salesToday: 'Ventas de hoy',
    avgTicket: 'Ticket promedio',
    returnsToday: 'Devoluciones de hoy',
    goalLabel: 'Meta del día',
    noPending: 'Sin pendientes',
    closingChecklistTitle: 'Cierre de turno',
    quickAccess: 'Accesos rápidos',
    error: 'No pude cargar tu día. Reintenta o avisa al admin.',
  },
  alerts: {
    low_stock:       (n: number) => `${n} producto${n === 1 ? '' : 's'} por agotarse`,
    no_branch_price: (n: number) => `${n} producto${n === 1 ? '' : 's'} sin precio en sucursal`,
    quote_expiring:  (n: number) => `${n} cotización${n === 1 ? '' : 'es'} por vencer hoy`,
    cash_variance:   (amt: string) => `Diferencia de caja del último cierre: ${amt}`,
  },
  pages: {
    sales: 'Mis ventas',
    cash: 'Mi caja',
    returns: 'Devoluciones',
    products: 'Buscar producto',
    reports: 'Reportes',
    printer: 'Impresora',
  },
  states: {
    loading: 'Cargando…',
    empty: 'Sin movimientos',
  },
} as const

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}
```

- [ ] **Step 4: Branch-user hook**

```ts
// frontend/src/components/branch/useIsBranchUser.ts
import { useAuthStore } from '../../store/authStore'

const BRANCH_ROLES = new Set(['CAJERO', 'GERENTE'])

export function useIsBranchUser(): boolean {
  const user = useAuthStore((s) => s.user)
  if (!user) return false
  return BRANCH_ROLES.has(user.role) && user.branch_id != null
}
```

- [ ] **Step 5: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero errors related to the new files.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/branchDashboard.ts frontend/src/api/branchDashboard.ts frontend/src/copy/branchCopy.ts frontend/src/components/branch/useIsBranchUser.ts
git commit -m "feat(frontend): branch dashboard types, api client, copy, role hook"
```

---

## Task 11: Cockpit — Zone 1 (greeting + shift badge + Cobrar CTA)

**Files:**
- Create: `frontend/src/components/branch/CockpitGreeting.tsx`

- [ ] **Step 1: Component**

```tsx
import { Link } from 'react-router-dom'
import { BRANCH_COPY } from '../../copy/branchCopy'
import type { DashboardShift, DashboardUser } from '../../types/branchDashboard'

interface Props { user: DashboardUser; shift: DashboardShift }

export function CockpitGreeting({ user, shift }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">Hola, {user.name}.</h1>
        <p className="text-sm text-slate-600">{user.branch_name}</p>
        <ShiftBadge shift={shift} />
      </div>
      <Link
        to="/pos"
        className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 transition"
      >
        {BRANCH_COPY.cockpit.payNow}
      </Link>
    </div>
  )
}

function ShiftBadge({ shift }: { shift: DashboardShift }) {
  if (!shift.is_open) {
    return (
      <Link to="/cash-history" className="inline-flex items-center gap-2 mt-2 text-sm text-amber-700 hover:underline">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        {BRANCH_COPY.cockpit.shiftClosed} · {BRANCH_COPY.cockpit.openShift} →
      </Link>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 mt-2 text-sm text-emerald-700">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      {BRANCH_COPY.cockpit.shiftOpen(shift.duration_minutes ?? 0)}
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/branch/CockpitGreeting.tsx
git commit -m "feat(cockpit): zone 1 greeting + shift badge + Cobrar CTA"
```

---

## Task 12: Cockpit — Zone 2 (Mi día — 4 KPI cards)

**Files:**
- Create: `frontend/src/components/branch/CockpitDayKPIs.tsx`

- [ ] **Step 1: Component**

```tsx
import { BRANCH_COPY } from '../../copy/branchCopy'
import type { DashboardToday } from '../../types/branchDashboard'

const fmtMoney = (s: string | null | undefined) =>
  s == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(s))

interface Props { today: DashboardToday }

export function CockpitDayKPIs({ today }: Props) {
  const goalPct = today.goal_progress_pct ?? null
  const barColor =
    goalPct == null ? 'bg-slate-300' :
    goalPct < 50    ? 'bg-rose-500'  :
    goalPct < 80    ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      <KPI label={BRANCH_COPY.cockpit.salesToday}
           primary={fmtMoney(today.sales_total)}
           secondary={`${today.sales_count} ${today.sales_count === 1 ? 'ticket' : 'tickets'}`} />
      <KPI label={BRANCH_COPY.cockpit.goalLabel}
           primary={today.goal == null ? '—' : `${goalPct ?? 0}%`}
           secondary={today.goal == null ? 'Sin meta configurada' : `de ${fmtMoney(today.goal)}`}>
        {today.goal != null && (
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, goalPct ?? 0)}%` }} />
          </div>
        )}
      </KPI>
      <KPI label={BRANCH_COPY.cockpit.avgTicket} primary={fmtMoney(today.avg_ticket)} />
      <KPI label={BRANCH_COPY.cockpit.returnsToday}
           primary={fmtMoney(today.returns_total)}
           secondary={`${today.returns_count} devolución${today.returns_count === 1 ? '' : 'es'}`} />
    </section>
  )
}

function KPI({ label, primary, secondary, children }: {
  label: string; primary: string; secondary?: string; children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{primary}</p>
      {secondary && <p className="text-xs text-slate-500 mt-1">{secondary}</p>}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/CockpitDayKPIs.tsx
git commit -m "feat(cockpit): zone 2 day KPI cards with goal progress bar"
```

---

## Task 13: Cockpit — Zone 3 (Alertas accionables)

**Files:**
- Create: `frontend/src/components/branch/CockpitAlerts.tsx`

- [ ] **Step 1: Component**

```tsx
import { Link } from 'react-router-dom'
import { BRANCH_COPY } from '../../copy/branchCopy'
import type { DashboardAlert } from '../../types/branchDashboard'

const fmtMoney = (s: string | null | undefined) =>
  s == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(s))

interface Props { alerts: DashboardAlert[] }

export function CockpitAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return <section className="p-4 text-sm text-slate-500">{BRANCH_COPY.cockpit.noPending}</section>
  }
  return (
    <section className="p-4 space-y-2">
      {alerts.slice(0, 5).map((a, i) => (
        <Link
          key={i}
          to={a.deeplink}
          className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 hover:border-slate-400 transition"
        >
          <span className="text-sm">{describe(a)}</span>
          <span className="text-slate-400 text-xl">›</span>
        </Link>
      ))}
    </section>
  )
}

function describe(a: DashboardAlert): string {
  switch (a.kind) {
    case 'low_stock':       return BRANCH_COPY.alerts.low_stock(a.count ?? 0)
    case 'no_branch_price': return BRANCH_COPY.alerts.no_branch_price(a.count ?? 0)
    case 'quote_expiring':  return BRANCH_COPY.alerts.quote_expiring(a.count ?? 0)
    case 'cash_variance':   return BRANCH_COPY.alerts.cash_variance(fmtMoney(a.amount))
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/CockpitAlerts.tsx
git commit -m "feat(cockpit): zone 3 actionable alerts list"
```

---

## Task 14: Cockpit — Zone 4 (Cierre asistido — wizard)

**Files:**
- Create: `frontend/src/components/branch/CockpitClosingWizard.tsx`

- [ ] **Step 1: Component**

```tsx
import { useState } from 'react'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { closeShiftGuided } from '../../api/branchDashboard'

interface Props { sessionId: number; onClosed: () => void }

const STEPS = [
  { key: 'cash',    label: 'Cuenta el efectivo en caja' },
  { key: 'card',    label: 'Concilia totales con la terminal' },
  { key: 'z',       label: 'Imprime el corte Z' },
  { key: 'expense', label: 'Registra los gastos del día' },
] as const

export function CockpitClosingWizard({ sessionId, onClosed }: Props) {
  const [counted, setCounted] = useState('')
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allChecked = STEPS.every((s) => done[s.key])

  async function submit() {
    setSubmitting(true); setError(null)
    try {
      await closeShiftGuided(sessionId, {
        counted_cash: Number(counted) || 0,
        cash_total_per_method: {},
        day_expenses_total: 0,
      })
      onClosed()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? BRANCH_COPY.cockpit.error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="m-4 rounded-xl border bg-amber-50 border-amber-200 p-4">
      <h2 className="font-semibold mb-3">{BRANCH_COPY.cockpit.closingChecklistTitle}</h2>
      <ul className="space-y-2 mb-4">
        {STEPS.map((s) => (
          <li key={s.key}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!done[s.key]}
                onChange={(e) => setDone((d) => ({ ...d, [s.key]: e.target.checked }))}
              />
              {s.label}
            </label>
          </li>
        ))}
      </ul>
      <label className="block text-sm mb-3">
        <span className="text-slate-700">Efectivo contado</span>
        <input
          type="number" inputMode="decimal" min={0} step="0.01"
          value={counted} onChange={(e) => setCounted(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="0.00"
        />
      </label>
      {error && <p className="text-sm text-rose-700 mb-2">{error}</p>}
      <button
        type="button"
        disabled={!allChecked || !counted || submitting}
        onClick={submit}
        className="w-full py-3 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50"
      >
        {submitting ? BRANCH_COPY.states.loading : BRANCH_COPY.cockpit.closeShift}
      </button>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/CockpitClosingWizard.tsx
git commit -m "feat(cockpit): zone 4 guided closing wizard"
```

---

## Task 15: Cockpit — Zone 5 (Accesos rápidos)

**Files:**
- Create: `frontend/src/components/branch/CockpitQuickAccess.tsx`

- [ ] **Step 1: Component**

```tsx
import { Link } from 'react-router-dom'
import { BRANCH_COPY } from '../../copy/branchCopy'

const TILES = [
  { to: '/sales',            label: BRANCH_COPY.pages.sales },
  { to: '/cash-history',     label: BRANCH_COPY.pages.cash },
  { to: '/returns',          label: BRANCH_COPY.pages.returns },
  { to: '/products',         label: BRANCH_COPY.pages.products },
  { to: '/reports',          label: BRANCH_COPY.pages.reports },
  { to: '/printer-settings', label: BRANCH_COPY.pages.printer },
] as const

export function CockpitQuickAccess() {
  return (
    <section className="p-4">
      <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">
        {BRANCH_COPY.cockpit.quickAccess}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="rounded-xl border bg-white p-4 text-center font-medium hover:border-slate-400 transition"
          >
            {t.label}
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/CockpitQuickAccess.tsx
git commit -m "feat(cockpit): zone 5 quick access tiles"
```

---

## Task 16: Cockpit — container that fetches data and assembles zones

**Files:**
- Create: `frontend/src/components/branch/Cockpit.tsx`

- [ ] **Step 1: Component**

```tsx
import { useEffect, useState } from 'react'
import { BRANCH_COPY } from '../../copy/branchCopy'
import { getBranchDashboard } from '../../api/branchDashboard'
import type { BranchDashboard } from '../../types/branchDashboard'
import { CockpitGreeting } from './CockpitGreeting'
import { CockpitDayKPIs } from './CockpitDayKPIs'
import { CockpitAlerts } from './CockpitAlerts'
import { CockpitClosingWizard } from './CockpitClosingWizard'
import { CockpitQuickAccess } from './CockpitQuickAccess'

export function Cockpit() {
  const [data, setData] = useState<BranchDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    getBranchDashboard()
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(BRANCH_COPY.cockpit.error) })
    return () => { cancelled = true }
  }, [reloadTick])

  if (error) return <div className="p-6 text-rose-700">{error}</div>
  if (!data) return <div className="p-6 text-slate-500">{BRANCH_COPY.states.loading}</div>

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <CockpitGreeting user={data.user} shift={data.shift} />
      <CockpitDayKPIs today={data.today} />
      <CockpitAlerts alerts={data.alerts} />
      {data.closing_visible && data.shift.session_id != null && (
        <CockpitClosingWizard
          sessionId={data.shift.session_id}
          onClosed={() => setReloadTick((t) => t + 1)}
        />
      )}
      <CockpitQuickAccess />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/Cockpit.tsx
git commit -m "feat(cockpit): container with data fetch and zone assembly"
```

---

## Task 17: Atlas POS — render Cockpit for branch users, keep legacy for HQ

**Files:**
- Modify: `frontend/src/pages/pos/Atlas POS.tsx`

- [ ] **Step 1: Branch on role**

Read `Atlas POS.tsx` and find the top-level component (around line 1, `export default function Atlas POS()`). Wrap its return so the cockpit replaces the body for branch users. Keep the HQ body intact.

```tsx
// near the top, with other imports:
import { useIsBranchUser } from '../../components/branch/useIsBranchUser'
import { Cockpit } from '../../components/branch/Cockpit'

// inside Atlas POS(), at the very top of the function body:
const isBranch = useIsBranchUser()
if (isBranch) return <Cockpit />
```

- [ ] **Step 2: Manual smoke**

Start backend (`uvicorn app.main:app --reload`) and frontend (`cd frontend && npm run dev`).
Login as `superadmin/admin123` first, switch context to a CAJERO of org "QA". Visit `/atlas-pos`. Expected: cockpit renders with greeting, KPIs, alerts, quick-access. Login as ADMINISTRADOR. Visit `/atlas-pos`. Expected: legacy Atlas POS page is unchanged.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/pos/Atlas POS.tsx
git commit -m "feat(cockpit): wire Cockpit into Atlas POS for branch users"
```

---

## Task 18: SalesBranchView

**Files:**
- Create: `frontend/src/components/branch/SalesBranchView.tsx`
- Modify: `frontend/src/pages/sales/SalesHistory.tsx`

- [ ] **Step 1: Component**

```tsx
// frontend/src/components/branch/SalesBranchView.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface Row {
  id: number; folio: string; created_at: string; customer_name?: string
  total: string; payment_method?: string
}

const fmtMoney = (s: string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(s))
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

export function SalesBranchView() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    client.get('/sales', { params: { from: today.toISOString() } })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : r.data?.items ?? []))
      .catch(() => setError(BRANCH_COPY.cockpit.error))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6">{BRANCH_COPY.states.loading}</div>
  if (error)   return <div className="p-6 text-rose-700">{error}</div>

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">{BRANCH_COPY.pages.sales}</h1>
      {rows.length === 0 ? (
        <p className="text-slate-500">{BRANCH_COPY.states.empty}</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl overflow-hidden border">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Folio</th>
              <th className="text-left p-3">Hora</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Pago</th>
              <th className="text-right p-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono">{r.folio}</td>
                <td className="p-3">{fmtTime(r.created_at)}</td>
                <td className="p-3">{r.customer_name ?? '—'}</td>
                <td className="p-3 text-right">{fmtMoney(r.total)}</td>
                <td className="p-3">{r.payment_method ?? '—'}</td>
                <td className="p-3 text-right">
                  <Link to={`/returns?sale=${r.id}`} className="text-rose-700 hover:underline">Devolver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into SalesHistory**

In `frontend/src/pages/sales/SalesHistory.tsx`, at the top of the default-exported component:

```tsx
import { useIsBranchUser } from '../../components/branch/useIsBranchUser'
import { SalesBranchView } from '../../components/branch/SalesBranchView'

// inside the component:
if (useIsBranchUser()) return <SalesBranchView />
```

- [ ] **Step 3: Typecheck + smoke + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/SalesBranchView.tsx frontend/src/pages/sales/SalesHistory.tsx
git commit -m "feat(branch-view): SalesBranchView for cashiers"
```

---

## Task 19: CashBranchView

**Files:**
- Create: `frontend/src/components/branch/CashBranchView.tsx`
- Modify: `frontend/src/pages/finance/CashHistory.tsx`

- [ ] **Step 1: Component**

```tsx
import { useEffect, useState } from 'react'
import client from '../../api/client'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface CurrentSession {
  id: number; opened_at: string; opening_balance: string
  expected_cash?: string | null; sales_total?: string | null
}

interface PastSession {
  id: number; opened_at: string; closed_at: string
  variance: string | null
}

const fmtMoney = (s: string | null | undefined) =>
  s == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(s))
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-MX')

export function CashBranchView() {
  const [current, setCurrent] = useState<CurrentSession | null>(null)
  const [past, setPast] = useState<PastSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/cash/sessions/current').then((r) => r.data).catch(() => null),
      client.get('/cash/sessions', { params: { limit: 7 } }).then((r) => r.data).catch(() => []),
    ]).then(([cur, list]) => {
      setCurrent(cur ?? null)
      setPast(Array.isArray(list) ? list : list?.items ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6">{BRANCH_COPY.states.loading}</div>

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">{BRANCH_COPY.pages.cash}</h1>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-2">Turno actual</h2>
        {!current ? (
          <p className="text-slate-500">No tienes una caja abierta.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">Abierto</dt>      <dd>{fmtDate(current.opened_at)}</dd>
            <dt className="text-slate-500">Saldo inicial</dt><dd>{fmtMoney(current.opening_balance)}</dd>
            <dt className="text-slate-500">Ventas</dt>       <dd>{fmtMoney(current.sales_total)}</dd>
            <dt className="text-slate-500">Esperado</dt>     <dd>{fmtMoney(current.expected_cash)}</dd>
          </dl>
        )}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-2">Mis turnos pasados (7 días)</h2>
        {past.length === 0 ? (
          <p className="text-slate-500">{BRANCH_COPY.states.empty}</p>
        ) : (
          <ul className="divide-y">
            {past.map((s) => (
              <li key={s.id} className="py-2 flex justify-between text-sm">
                <span>{fmtDate(s.opened_at)} → {fmtDate(s.closed_at)}</span>
                <span className={Number(s.variance) === 0 ? '' : 'text-amber-700'}>
                  Diferencia: {fmtMoney(s.variance)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Wire into CashHistory**

```tsx
// at top of default export
import { useIsBranchUser } from '../../components/branch/useIsBranchUser'
import { CashBranchView } from '../../components/branch/CashBranchView'

// inside component
if (useIsBranchUser()) return <CashBranchView />
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/CashBranchView.tsx frontend/src/pages/finance/CashHistory.tsx
git commit -m "feat(branch-view): CashBranchView for cashiers"
```

---

## Task 20: ReturnsBranchView — 3-step wizard

**Files:**
- Create: `frontend/src/components/branch/ReturnsBranchView.tsx`
- Modify: `frontend/src/pages/sales/Returns.tsx`

- [ ] **Step 1: Component**

```tsx
import { useState } from 'react'
import client from '../../api/client'
import { BRANCH_COPY } from '../../copy/branchCopy'

type Step = 'find' | 'mark' | 'confirm' | 'done'

interface SaleLine { id: number; sku: string; name: string; quantity: number; unit_price: string }
interface Sale { id: number; folio: string; total: string; lines: SaleLine[] }

const REASONS = ['Defecto de fábrica', 'Producto incorrecto', 'Cliente cambió de opinión', 'Otro']

export function ReturnsBranchView() {
  const [step, setStep] = useState<Step>('find')
  const [query, setQuery] = useState('')
  const [sale, setSale] = useState<Sale | null>(null)
  const [picked, setPicked] = useState<Record<number, { qty: number; reason: string }>>({})
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'STORE_CREDIT'>('CASH')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function findSale() {
    setError(null)
    try {
      const { data } = await client.get('/sales', { params: { folio: query } })
      const list = Array.isArray(data) ? data : data?.items ?? []
      if (list.length === 0) throw new Error('No encontré esa venta.')
      const full = await client.get(`/sales/${list[0].id}`).then((r) => r.data)
      setSale(full); setStep('mark')
    } catch (e: any) { setError(e?.message ?? 'Error') }
  }

  async function submit() {
    if (!sale) return
    setSubmitting(true); setError(null)
    try {
      const items = Object.entries(picked).filter(([, v]) => v.qty > 0).map(([line_id, v]) => ({
        sale_line_id: Number(line_id), quantity: v.qty, reason: v.reason,
      }))
      await client.post('/returns', { sale_id: sale.id, items, refund_method: refundMethod })
      setStep('done')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'No pude registrar la devolución.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">{BRANCH_COPY.pages.returns}</h1>
      {error && <p className="text-rose-700 text-sm mb-3">{error}</p>}

      {step === 'find' && (
        <section className="rounded-xl border bg-white p-4">
          <label className="block text-sm">
            <span>Folio de la venta</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   className="mt-1 w-full rounded border px-3 py-2 font-mono"
                   placeholder="V-0001234" />
          </label>
          <button onClick={findSale}
                  className="mt-3 w-full py-2 rounded-xl bg-slate-900 text-white">
            Buscar venta
          </button>
        </section>
      )}

      {step === 'mark' && sale && (
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <p className="text-sm text-slate-500">Folio {sale.folio} · Total {sale.total}</p>
          {sale.lines.map((l) => (
            <div key={l.id} className="border rounded p-3">
              <p className="font-medium">{l.name}</p>
              <p className="text-xs text-slate-500">{l.sku} · {l.quantity} unidades</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="text-sm">
                  Cantidad a devolver
                  <input type="number" min={0} max={l.quantity}
                         value={picked[l.id]?.qty ?? 0}
                         onChange={(e) => setPicked((p) => ({
                           ...p, [l.id]: { qty: Number(e.target.value), reason: p[l.id]?.reason ?? REASONS[0] },
                         }))}
                         className="mt-1 w-full rounded border px-2 py-1" />
                </label>
                <label className="text-sm">
                  Motivo
                  <select value={picked[l.id]?.reason ?? REASONS[0]}
                          onChange={(e) => setPicked((p) => ({
                            ...p, [l.id]: { qty: p[l.id]?.qty ?? 0, reason: e.target.value },
                          }))}
                          className="mt-1 w-full rounded border px-2 py-1">
                    {REASONS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
          <button onClick={() => setStep('confirm')}
                  className="w-full py-2 rounded-xl bg-slate-900 text-white">
            Continuar
          </button>
        </section>
      )}

      {step === 'confirm' && (
        <section className="rounded-xl border bg-white p-4 space-y-3">
          <label className="block text-sm">
            Reembolso por
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}
                    className="mt-1 w-full rounded border px-3 py-2">
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="STORE_CREDIT">Nota de crédito</option>
            </select>
          </label>
          <button onClick={submit} disabled={submitting}
                  className="w-full py-2 rounded-xl bg-rose-600 text-white disabled:opacity-50">
            {submitting ? BRANCH_COPY.states.loading : 'Confirmar devolución'}
          </button>
        </section>
      )}

      {step === 'done' && (
        <section className="rounded-xl border bg-emerald-50 border-emerald-200 p-6 text-center">
          <p className="font-semibold">Devolución registrada.</p>
          <button onClick={() => { setStep('find'); setSale(null); setPicked({}); setQuery('') }}
                  className="mt-3 px-4 py-2 rounded-lg border bg-white">
            Otra devolución
          </button>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into Returns**

```tsx
// in frontend/src/pages/sales/Returns.tsx, top of default export
import { useIsBranchUser } from '../../components/branch/useIsBranchUser'
import { ReturnsBranchView } from '../../components/branch/ReturnsBranchView'

if (useIsBranchUser()) return <ReturnsBranchView />
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/ReturnsBranchView.tsx frontend/src/pages/sales/Returns.tsx
git commit -m "feat(branch-view): ReturnsBranchView 3-step wizard"
```

---

## Task 21: ProductsBranchView

**Files:**
- Create: `frontend/src/components/branch/ProductsBranchView.tsx`
- Modify: `frontend/src/pages/inventory/Products.tsx`

- [ ] **Step 1: Component**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { BRANCH_COPY } from '../../copy/branchCopy'

interface Variant { sku: string; price?: string | null; stock?: number | null }
interface Product {
  id: number; name: string; image_url?: string | null
  department_name?: string | null; variants: Variant[]
}

const fmtMoney = (s?: string | null) =>
  s == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(s))

export function ProductsBranchView() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (q.length < 2) { setItems([]); return }
    const t = setTimeout(() => {
      setLoading(true)
      client.get('/products', { params: { q, limit: 30 } })
        .then((r) => setItems(Array.isArray(r.data) ? r.data : r.data?.items ?? []))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{BRANCH_COPY.pages.products}</h1>
        <Link to="/products/new" className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm">
          Crear producto
        </Link>
      </div>
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o código…"
        className="w-full rounded-xl border px-4 py-3"
      />
      {loading && <p className="mt-4 text-slate-500">{BRANCH_COPY.states.loading}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {items.map((p) => (
          <article key={p.id} className="rounded-xl border bg-white p-3 flex gap-3">
            {p.image_url ? <img src={p.image_url} alt="" className="w-20 h-20 rounded object-cover" />
                         : <div className="w-20 h-20 rounded bg-slate-100" />}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              <p className="text-xs text-slate-500">{p.department_name ?? 'Sin categoría'}</p>
              {p.variants[0] && (
                <p className="text-sm mt-1">
                  {fmtMoney(p.variants[0].price)} · existencia {p.variants[0].stock ?? '—'}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into Products**

```tsx
// in frontend/src/pages/inventory/Products.tsx, top of default export
import { useIsBranchUser } from '../../components/branch/useIsBranchUser'
import { ProductsBranchView } from '../../components/branch/ProductsBranchView'

if (useIsBranchUser()) return <ProductsBranchView />
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/components/branch/ProductsBranchView.tsx frontend/src/pages/inventory/Products.tsx
git commit -m "feat(branch-view): ProductsBranchView search-first for cashiers"
```

---

## Task 22: POS — header tweak (shift indicator + back-to-cockpit)

**Files:**
- Modify: `frontend/src/pages/pos/POS.tsx`

- [ ] **Step 1: Add the header**

Inside the POS component's top-level JSX, before the cart UI, add:

```tsx
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getBranchDashboard } from '../../api/branchDashboard'
import { BRANCH_COPY } from '../../copy/branchCopy'

// inside the component body, near the top:
const [shiftBadge, setShiftBadge] = useState<string>('')
useEffect(() => {
  getBranchDashboard()
    .then((d) => setShiftBadge(d.shift.is_open ? BRANCH_COPY.cockpit.shiftOpen(d.shift.duration_minutes ?? 0) : BRANCH_COPY.cockpit.shiftClosed))
    .catch(() => setShiftBadge(''))
}, [])

// inside JSX, as the first child of the outer container:
<div className="flex items-center justify-between px-4 py-2 border-b bg-white">
  <Link to="/atlas-pos" className="text-sm text-slate-700 hover:underline">← {BRANCH_COPY.cockpit.backToHome}</Link>
  <span className="text-xs text-slate-500">{shiftBadge}</span>
</div>
```

If POS already has its own header, append the back link there instead of adding a new bar.

- [ ] **Step 2: Typecheck + commit**

```bash
cd frontend && npx tsc --noEmit
cd /home/atlas-tech/Devs/Atlas-API
git add frontend/src/pages/pos/POS.tsx
git commit -m "feat(pos): header with back-to-cockpit and shift indicator"
```

---

## Task 23: Sidebar — apply role-aware labels and order

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

The frontend sidebar is hardcoded (`ALL_NAV: NavItem[]`). The simplest correct change is:
1. Define a parallel `BRANCH_NAV: NavItem[]` with the new labels and order.
2. In the component, choose between `ALL_NAV` and `BRANCH_NAV` using `useIsBranchUser()`.

- [ ] **Step 1: Add `BRANCH_NAV`**

Read the existing `ALL_NAV` to see the `NavItem` shape (icon, label, href, group fields). After the `ALL_NAV` declaration, add:

```ts
import { useIsBranchUser } from '../branch/useIsBranchUser'

const BRANCH_NAV: NavItem[] = [
  { label: 'Mi día',     href: '/atlas-pos',         icon: 'fa-house',     group: 'Mi día' },
  { label: 'Cobrar',     href: '/pos',              icon: 'fa-cash-register', group: 'Cobrar' },
  { label: 'Mi caja',    href: '/cash-history',     icon: 'fa-vault',     group: 'Mi turno' },
  { label: 'Mis ventas', href: '/sales',            icon: 'fa-receipt',   group: 'Mi turno' },
  { label: 'Devolución', href: '/returns',          icon: 'fa-undo',      group: 'Mi turno' },
  { label: 'Inventario', href: '/products',         icon: 'fa-boxes',     group: 'Inventario' },
  { label: 'Reportes',   href: '/reports',          icon: 'fa-chart-pie', group: 'Inventario' },
  { label: 'Impresora',  href: '/printer-settings', icon: 'fa-print',     group: 'Configuración' },
]
```

Match exact `NavItem` keys from the existing definition; if the local interface uses `to` instead of `href`, align.

- [ ] **Step 2: Pick the right nav based on role**

In the top-level Sidebar component, replace the line that builds `items` for the existing layouts (search for `ALL_NAV` usage) with:

```tsx
const isBranch = useIsBranchUser()
const items = isBranch ? BRANCH_NAV : ALL_NAV
```

If `ALL_NAV` was filtered downstream (by role / permissions), keep that filter for the HQ branch but skip it for `BRANCH_NAV` since it is already curated.

- [ ] **Step 3: Manual smoke**

Login as CAJERO → sidebar shows the 8 ordered items with semantic labels. `Mi recibo` / `/hr/me` is absent. Login as ADMINISTRADOR → original sidebar unchanged.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): role-aware branch nav with semantic labels"
```

---

## Task 24: Backend regression run

**Files:** none modified.

- [ ] **Step 1: Run all tests with backend up**

In one terminal: `uvicorn app.main:app --reload`.
In another:

```bash
python tests/test_branch_dashboard.py
python tests/test_cash_close_guided.py
python tests/test_cash_variance.py
python tests/stress_test.py
```

Expected: every script prints `PASS` lines and exits 0.

If any pre-existing test fails because of changes in this branch, fix the underlying issue. Do not skip or comment out tests.

- [ ] **Step 2: Lint imports**

```bash
python -c "from app.main import app; print('routers:', len(app.routes))"
```

Expected: prints a number > 50, no import errors.

---

## Task 25: Frontend smoke checklist (manual handoff)

**Files:** none modified.

This task is performed by a human reviewer (per the testing decision in the spec, §11). The AI agent stops here and reports.

Smoke checklist to give to the human:

- [ ] Login as **CAJERO** (org "QA"). Land on `/atlas-pos`. Verify cockpit renders with greeting, KPIs, alerts list, quick-access tiles. No console errors.
- [ ] Sidebar shows 8 items in the order: Mi día, Cobrar, Mi caja, Mis ventas, Devolución, Inventario, Reportes, Impresora. `/hr/me` not in sidebar but `GET /hr/me` returns 200.
- [ ] Click `Cobrar` → POS. Click "Volver a Mi día" → Atlas POS.
- [ ] `/sales` shows `Mis ventas` (today only, branch locked).
- [ ] `/cash-history` shows current shift + last 7 days.
- [ ] `/returns`: complete the 3-step wizard against a real sale. Refund recorded.
- [ ] `/products` is search-first; tile cards appear after typing 2+ chars.
- [ ] Open shift, set `closing_time` to `now + 30min` on the user's branch, reload `/atlas-pos` → closing wizard appears in zone 4. Submit it → shift closes.
- [ ] Login as **ADMINISTRADOR** (HQ). Sidebar and pages unchanged from before this branch.
- [ ] Login as **GERENTE**. Same cockpit and views as CAJERO.
- [ ] DAXPOS preset (golden rule): `superadmin/admin123` → context org "QA" as ADMIN → no regression visible.

After the human confirms all boxes, the branch is ready for PR against `release/qa`. PR description must reference the spec, list the new endpoints, and state: "no schema change beyond `Branch.daily_sales_goal` + `Branch.closing_time` migration".

---

## Self-Review

**Spec coverage** — every section has a task:
- Spec §4 architecture → Tasks 17, 18–22 (role branching), 23 (sidebar), 3 (no new shell, single aggregator).
- Spec §5 cockpit zones → Tasks 11–16.
- Spec §6 role-aware page variants → Tasks 18–22.
- Spec §7 sidebar reorganisation → Tasks 9 (backend) and 23 (frontend).
- Spec §8 backend endpoints → Tasks 3–8.
- Spec §9 schema → Task 1 (with documented spec correction: closing_time also added).
- Spec §10 copy → Task 10.
- Spec §11 testing → Tasks 7 (multi-tenancy), 24 (regression), 25 (manual smoke).
- Spec §12 rollout → handled by branching strategy + Task 25 sign-off.
- Spec §13 risks — `TEMPLATE_LABEL_OVERRIDES_BY_ROLE` consistency lint is in Task 9; multi-tenancy regression in Task 7.

**Placeholder scan** — none. Each step has a runnable command or an exact code block. Items that depend on inspecting an existing model (Task 4, Task 5) explicitly tell the engineer to inspect and adapt rather than leaving "TBD".

**Type consistency** — service/schema names match: `BranchDashboardService.build()` → `BranchDashboardRead`. Cockpit components consume `BranchDashboard` (frontend type) which mirrors the backend response. Sidebar items align with the `BRANCH_NAV` definition referenced from the cockpit's quick-access tiles.

**Known divergence from spec** — `Branch.closing_time` is added by the migration in Task 1, not pre-existing as the spec assumed. Documented in the plan header.
