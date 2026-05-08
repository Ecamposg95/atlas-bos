"""
Integration tests for /api/branch/dashboard.
Backend runs in Docker container atlas-api-backend-1 on http://127.0.0.1:8000.
Run from host: python3 tests/test_branch_dashboard.py
"""
import requests

BASE = "http://127.0.0.1:8000"
USER = "cajero_qa1"
PASS = "123"


def login() -> dict:
    r = requests.post(f"{BASE}/api/auth/login", data={"username": USER, "password": PASS})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def reset_shift(headers: dict) -> None:
    """Best-effort: ensure no open shift before/after a test. Swallows transient errors."""
    try:
        requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=headers, timeout=5)
    except requests.RequestException:
        pass


def test_shift_closed_when_no_session():
    headers = login()
    reset_shift(headers)
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["shift"]["is_open"] is False
    assert body["shift"]["session_id"] is None
    assert body["shift"]["duration_minutes"] is None
    print("PASS: shift closed when no session")


def test_shift_open_after_open_call():
    headers = login()
    reset_shift(headers)
    try:
        r = requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=headers)
        assert r.status_code in (200, 201), r.text
        body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
        assert body["shift"]["is_open"] is True
        assert body["shift"]["session_id"] is not None
        assert body["shift"]["duration_minutes"] is not None
    finally:
        reset_shift(headers)
    print("PASS: shift open after open")


def test_today_aggregates_after_a_sale():
    headers = login()
    reset_shift(headers)
    # ensure clean shift, then open one
    try:
        requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=headers)
        # one sale with the first available product
        prods = requests.get(f"{BASE}/api/products/?limit=1", headers=headers).json()
        items = prods if isinstance(prods, list) else prods.get("items", [])
        if not items:
            print("SKIP: no products available in test org")
            return
        variants = items[0].get("variants") or []
        if not variants:
            print("SKIP: first product has no variants")
            return
        sku = variants[0]["sku"]
        price = float(variants[0]["price"])
        sale_payload = {
            "items": [{"sku": sku, "quantity": 1}],
            "payments": [{"amount": price, "method": "CASH"}],
        }
        r = requests.post(f"{BASE}/api/sales/", json=sale_payload, headers=headers)
        assert r.status_code in (200, 201), r.text
        body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
        assert body["today"]["sales_count"] >= 1, body["today"]
        assert float(body["today"]["sales_total"]) >= price - 0.01, body["today"]
        assert float(body["today"]["avg_ticket"]) > 0, body["today"]
    finally:
        reset_shift(headers)
    print("PASS: today aggregates")


def test_goal_progress_omitted_when_no_goal():
    headers = login()
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert body["today"].get("goal") is None, body["today"]
    assert body["today"].get("goal_progress_pct") is None, body["today"]
    print("PASS: goal omitted when null")


def test_alerts_shape():
    headers = login()
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    assert isinstance(body["alerts"], list)
    valid_kinds = {"low_stock", "no_branch_price", "quote_expiring", "cash_variance"}
    for a in body["alerts"]:
        assert a["kind"] in valid_kinds, a
        assert a["deeplink"].startswith("/"), a
        if a["kind"] == "cash_variance":
            assert a.get("amount") is not None, a
        else:
            assert a.get("count") is not None, a
    print("PASS: alerts shape")


def test_closing_visible_false_without_closing_time():
    headers = login()
    body = requests.get(f"{BASE}/api/branch/dashboard", headers=headers).json()
    # The QA1 branch has no closing_time configured; wizard must not appear.
    assert body["closing_visible"] is False, body
    print("PASS: closing_visible false without config")


def test_branch_scoping_locked_to_user_branch():
    """A CAJERO assigned to branch X must not have their context overridden by X-Branch-ID."""
    headers = login()
    headers_spoof = {**headers, "X-Branch-ID": "999999"}
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=headers_spoof)
    assert r.status_code == 200, r.text
    body = r.json()
    # branch_name is the user's actual branch (QA1), regardless of header
    assert body["user"]["branch_name"] == "QA1", body["user"]
    print("PASS: branch scoping locked to user branch")


def test_org_spoof_rejected():
    """A user passing X-Organization-ID for an org they don't belong to is rejected."""
    headers = login()
    headers_spoof = {**headers, "X-Organization-ID": "999999"}
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=headers_spoof)
    assert r.status_code in (403, 404), r.status_code
    print("PASS: org spoofing rejected")


def test_hq_user_branch_must_belong_to_org():
    """An HQ user (no branch_id) cannot use X-Branch-ID to query a branch in another org."""
    sa = requests.post(f"{BASE}/api/auth/login", data={"username": "superadmin", "password": "admin123"})
    sa.raise_for_status()
    sa_token = sa.json()["access_token"]
    sa_headers = {
        "Authorization": f"Bearer {sa_token}",
        "X-Organization-ID": "2",        # QA org
        "X-Branch-ID": "999999",         # branch that doesn't exist
    }
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=sa_headers)
    assert r.status_code in (403, 404), r.status_code
    print("PASS: HQ user cannot use foreign X-Branch-ID")


def test_hq_user_with_valid_branch_in_org_works():
    """An HQ user (no branch_id) with X-Branch-ID for a branch IN their active org succeeds."""
    sa = requests.post(f"{BASE}/api/auth/login", data={"username": "superadmin", "password": "admin123"})
    sa.raise_for_status()
    sa_token = sa.json()["access_token"]
    sa_headers = {
        "Authorization": f"Bearer {sa_token}",
        "X-Organization-ID": "2",        # QA org
        "X-Branch-ID": "1",              # QA1 (branch_id=1 in QA)
    }
    r = requests.get(f"{BASE}/api/branch/dashboard", headers=sa_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["branch_name"] == "QA1", body
    print("PASS: HQ user with valid X-Branch-ID can query")


if __name__ == "__main__":
    test_shift_closed_when_no_session()
    test_shift_open_after_open_call()
    test_today_aggregates_after_a_sale()
    test_goal_progress_omitted_when_no_goal()
    test_alerts_shape()
    test_closing_visible_false_without_closing_time()
    test_branch_scoping_locked_to_user_branch()
    test_org_spoof_rejected()
    test_hq_user_branch_must_belong_to_org()
    test_hq_user_with_valid_branch_in_org_works()
