"""
Integration tests for POST /api/cash/sessions/{id}/close-guided.
Run with backend up: python3 tests/test_cash_close_guided.py
"""
import requests

BASE = "http://127.0.0.1:8000"
USER = "cajero_qa1"
PASS = "123"


def login() -> dict:
    r = requests.post(f"{BASE}/api/auth/login", data={"username": USER, "password": PASS})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def reset(headers):
    try:
        requests.post(f"{BASE}/api/cash/close", json={"closing_balance": 0, "notes": "reset"}, headers=headers, timeout=5)
    except requests.RequestException:
        pass


def test_guided_close_happy_path():
    h = login()
    reset(h)
    try:
        requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=h)
        # Discover session id via dashboard
        body = requests.get(f"{BASE}/api/branch/dashboard", headers=h).json()
        sid = body["shift"]["session_id"]
        assert sid is not None, body
        r = requests.post(f"{BASE}/api/cash/sessions/{sid}/close-guided", json={
            "counted_cash": 100,
            "cash_total_per_method": {"CASH": 100},
            "day_expenses_total": 0,
            "notes": "guided test",
        }, headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("closed_at"), body
    finally:
        reset(h)
    print("PASS: guided close happy path")


def test_guided_close_session_not_found():
    h = login()
    r = requests.post(f"{BASE}/api/cash/sessions/9999999/close-guided", json={
        "counted_cash": 0,
        "cash_total_per_method": {},
        "day_expenses_total": 0,
    }, headers=h)
    assert r.status_code == 404, r.text
    print("PASS: 404 for unknown session")


def test_guided_close_already_closed():
    h = login()
    reset(h)
    try:
        requests.post(f"{BASE}/api/cash/open", json={"opening_balance": 100}, headers=h)
        sid = requests.get(f"{BASE}/api/branch/dashboard", headers=h).json()["shift"]["session_id"]
        # First close
        r1 = requests.post(f"{BASE}/api/cash/sessions/{sid}/close-guided", json={
            "counted_cash": 100, "cash_total_per_method": {}, "day_expenses_total": 0,
        }, headers=h)
        assert r1.status_code == 200, r1.text
        # Second close on same session
        r2 = requests.post(f"{BASE}/api/cash/sessions/{sid}/close-guided", json={
            "counted_cash": 100, "cash_total_per_method": {}, "day_expenses_total": 0,
        }, headers=h)
        assert r2.status_code == 409, r2.text
    finally:
        reset(h)
    print("PASS: 409 when session already closed")


if __name__ == "__main__":
    test_guided_close_happy_path()
    test_guided_close_session_not_found()
    test_guided_close_already_closed()
