"""
Test: Cash Register Module — Complete Flow
Tests open/close, sales, change, inflows/outflows, mixed payments,
cancellations, and verifies all calculations match.

Usage:
    python tests/test_cash_complete.py

Requires: running server at localhost:8000 with a CAJERO user that has
a branch assigned and at least 1 product in their branch catalog.
"""
import requests
import sys
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000"

# ── Config ──────────────────────────────────────────────────────────
CAJERO_USER = "Adela"       # Change to your test cajero username
CAJERO_PASS = "admin123"    # Change to your test cajero password
OPENING_BALANCE = 500.00

passed = 0
failed = 0

def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✅ {label}")
        passed += 1
    else:
        print(f"  ❌ {label} — {detail}")
        failed += 1

def money(val):
    return round(float(val), 2)

# ── 1. Login ────────────────────────────────────────────────────────
print("\n═══════════════════════════════════════════════════")
print("  TEST: Cash Register Complete Flow")
print("═══════════════════════════════════════════════════\n")

print("1. LOGIN")
try:
    r = requests.post(f"{BASE_URL}/api/auth/login", data={"username": CAJERO_USER, "password": CAJERO_PASS})
    r.raise_for_status()
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  ✅ Logged in as {CAJERO_USER}")
except Exception as e:
    print(f"  ❌ Login failed: {e}")
    sys.exit(1)

# ── 2. Close any existing session ──────────────────────────────────
print("\n2. CLEANUP — Close existing session if any")
status = requests.get(f"{BASE_URL}/api/cash/status", headers=headers).json()
if status:
    requests.post(f"{BASE_URL}/api/cash/close", json={"closing_balance": 0, "notes": "Test cleanup"}, headers=headers)
    print("  ✅ Previous session closed")
else:
    print("  · No open session")

# ── 3. Open Session ────────────────────────────────────────────────
print(f"\n3. OPEN SESSION — Opening balance: ${OPENING_BALANCE}")
r = requests.post(f"{BASE_URL}/api/cash/open", json={"opening_balance": OPENING_BALANCE}, headers=headers)
check("Session opened", r.status_code == 200, f"Status {r.status_code}: {r.text}")
session = r.json()
session_id = session["id"]
print(f"  · Session ID: {session_id}")

# ── 4. Verify status ───────────────────────────────────────────────
print("\n4. VERIFY STATUS")
r = requests.get(f"{BASE_URL}/api/cash/status", headers=headers)
status = r.json()
check("Status returns open session", status is not None)
check("Opening balance correct", money(status["opening_balance"]) == OPENING_BALANCE)
check("Status is OPEN", status["status"] == "OPEN")

# ── 5. Get a product to sell ───────────────────────────────────────
print("\n5. FIND PRODUCT")
r = requests.get(f"{BASE_URL}/api/products/?limit=1&active_in_branch=true", headers=headers)
products = r.json()
if isinstance(products, dict):
    products = products.get("items", [])
if not products:
    print("  ❌ No products found for this branch. Cannot test sales.")
    sys.exit(1)

prod = products[0]
sku = prod["variants"][0]["sku"] if prod.get("variants") else prod.get("sku")
price = float(prod["variants"][0]["price"]) if prod.get("variants") else float(prod.get("price", 10))
print(f"  · Using: {prod['name']} | SKU: {sku} | Price: ${price}")

# ── 6. Sales ───────────────────────────────────────────────────────
print("\n6. CREATE SALES")

# Sale 1: Exact cash (no change)
print(f"  Sale 1: CASH exact ${price}")
r1 = requests.post(f"{BASE_URL}/api/sales/", json={
    "items": [{"sku": sku, "quantity": 1, "unit_price": price}],
    "payments": [{"method": "CASH", "amount": price}]
}, headers=headers)
check("Sale 1 created", r1.status_code == 200, r1.text[:100] if r1.status_code != 200 else "")

# Sale 2: Cash with change ($500 paid for a cheaper item)
overpay = price + 50
change_expected = 50.0
print(f"  Sale 2: CASH ${overpay} (change ${change_expected})")
r2 = requests.post(f"{BASE_URL}/api/sales/", json={
    "items": [{"sku": sku, "quantity": 1, "unit_price": price}],
    "payments": [{"method": "CASH", "amount": overpay}]
}, headers=headers)
check("Sale 2 created", r2.status_code == 200, r2.text[:100] if r2.status_code != 200 else "")

# Sale 3: Card only (no cash impact)
print(f"  Sale 3: CARD ${price}")
r3 = requests.post(f"{BASE_URL}/api/sales/", json={
    "items": [{"sku": sku, "quantity": 1, "unit_price": price}],
    "payments": [{"method": "CARD", "amount": price}]
}, headers=headers)
check("Sale 3 created", r3.status_code == 200, r3.text[:100] if r3.status_code != 200 else "")

# Sale 4: Mixed payment (cash + card)
cash_part = round(price * 0.4, 2)
card_part = round(price - cash_part, 2)
print(f"  Sale 4: MIXED (Cash ${cash_part} + Card ${card_part})")
r4 = requests.post(f"{BASE_URL}/api/sales/", json={
    "items": [{"sku": sku, "quantity": 1, "unit_price": price}],
    "payments": [
        {"method": "CASH", "amount": cash_part},
        {"method": "CARD", "amount": card_part}
    ]
}, headers=headers)
check("Sale 4 created", r4.status_code == 200, r4.text[:100] if r4.status_code != 200 else "")

# Sale 5: Cash then CANCEL
print(f"  Sale 5: CASH ${price} → CANCEL")
r5 = requests.post(f"{BASE_URL}/api/sales/", json={
    "items": [{"sku": sku, "quantity": 1, "unit_price": price}],
    "payments": [{"method": "CASH", "amount": price}]
}, headers=headers)
if r5.status_code == 200:
    sale5_id = r5.json().get("sale_id")
    rc = requests.delete(f"{BASE_URL}/api/sales/{sale5_id}?reason=Test+cancel", headers=headers)
    check("Sale 5 cancelled", rc.status_code == 200, rc.text[:100] if rc.status_code != 200 else "")
else:
    check("Sale 5 created", False, r5.text[:100])

# ── 7. Cash Movements ─────────────────────────────────────────────
print("\n7. CASH MOVEMENTS")

# Inflow
r_in = requests.post(f"{BASE_URL}/api/cash/inflow?amount=200&reason=Cambio+de+billete", headers=headers)
check("Inflow $200 registered", r_in.status_code == 200, r_in.text[:100] if r_in.status_code != 200 else "")

# Outflow
r_out = requests.post(f"{BASE_URL}/api/cash/outflow?amount=75&reason=Pago+de+agua", headers=headers)
check("Outflow $75 registered", r_out.status_code == 200, r_out.text[:100] if r_out.status_code != 200 else "")

# Invalid amount
r_neg = requests.post(f"{BASE_URL}/api/cash/inflow?amount=-50&reason=Invalid", headers=headers)
check("Negative inflow rejected", r_neg.status_code == 400)

# ── 8. Verify Summary (audit data) ────────────────────────────────
print("\n8. VERIFY SUMMARY (before close)")
r_sum = requests.get(f"{BASE_URL}/api/cash/summary", headers=headers)
check("Summary endpoint works", r_sum.status_code == 200, r_sum.text[:100] if r_sum.status_code != 200 else "")
summary = r_sum.json()

# Expected calculations:
# Cash gross = Sale1(price) + Sale2(price+50) + Sale4(cash_part) = price + price + 50 + cash_part
# (Sale 5 cancelled = excluded, Sale 3 card = excluded)
# Change given = Sale2(50)
# Cash net = cash_gross - change = price + price + 50 + cash_part - 50 = 2*price + cash_part
# Expected in drawer = opening + cash_net + inflows - outflows
#                     = 500 + (2*price + cash_part) + 200 - 75

cash_net_expected = money(2 * price + cash_part)
expected_in_drawer = money(OPENING_BALANCE + cash_net_expected + 200 - 75)

print(f"\n  ── Calculation Verification ──")
print(f"  Cash gross (3 sales):    ${money(2*price + 50 + cash_part)}")
print(f"  Change given (Sale 2):   -${change_expected}")
print(f"  Cash net:                ${cash_net_expected}")
print(f"  Opening:                 ${OPENING_BALANCE}")
print(f"  Inflows:                 $200.00")
print(f"  Outflows:                -$75.00")
print(f"  Expected in drawer:      ${expected_in_drawer}")

api_expected = money(summary.get("expected", {}).get("cash_physical", 0))
print(f"  API expected:            ${api_expected}")
check("Expected cash matches calculation", abs(api_expected - expected_in_drawer) < 0.02,
      f"API={api_expected} vs Calc={expected_in_drawer}")

# Ticket count (should be 4 — sales 1,2,3,4 — sale 5 cancelled)
api_tickets = summary.get("kpis", {}).get("total_tickets", 0)
check("Ticket count = 4 (excl cancelled)", api_tickets == 4, f"Got {api_tickets}")

# Total sales (all 4 paid sales: 4 * price)
api_total_sales = money(summary.get("kpis", {}).get("total_sales", 0))
expected_total = money(4 * price)
check("Total sales = 4 * price", abs(api_total_sales - expected_total) < 0.02,
      f"API={api_total_sales} vs Expected={expected_total}")

# Avg ticket
api_avg = money(summary.get("kpis", {}).get("avg_ticket", 0))
check("Avg ticket = price", abs(api_avg - price) < 0.02, f"API={api_avg} vs Expected={price}")

# Movements
api_inflows = money(summary.get("movements", {}).get("inflows", 0))
api_outflows = money(summary.get("movements", {}).get("outflows", 0))
check("Inflows = $200", abs(api_inflows - 200) < 0.01, f"Got {api_inflows}")
check("Outflows = $75", abs(api_outflows - 75) < 0.01, f"Got {api_outflows}")

# ── 9. Close Session ───────────────────────────────────────────────
print(f"\n9. CLOSE SESSION — Reporting ${expected_in_drawer} counted")
r_close = requests.post(f"{BASE_URL}/api/cash/close", json={
    "closing_balance": expected_in_drawer,
    "notes": "Test automated close"
}, headers=headers)
check("Session closed", r_close.status_code == 200, r_close.text[:100] if r_close.status_code != 200 else "")

if r_close.status_code == 200:
    close_data = r_close.json()
    diff = money(close_data.get("difference", 999))
    check("Difference = $0.00 (exact count)", abs(diff) < 0.02, f"Got ${diff}")

    stored_cash = money(close_data.get("total_cash_sales", 0))
    check("Stored total_cash_sales = net cash", abs(stored_cash - cash_net_expected) < 0.02,
          f"Stored={stored_cash} vs Expected={cash_net_expected}")

# ── 10. Verify closed session data ─────────────────────────────────
print("\n10. VERIFY CLOSED SESSION (ticket/PDF endpoint)")
r_ticket = requests.get(f"{BASE_URL}/api/cash/{session_id}/ticket", headers=headers)
check("Ticket endpoint works", r_ticket.status_code == 200, r_ticket.text[:100] if r_ticket.status_code != 200 else "")

if r_ticket.status_code == 200:
    ticket = r_ticket.json()
    t_expected = money(ticket.get("expected", {}).get("cash_physical", 0))
    t_reported = money(ticket.get("reconciliation", {}).get("reported", 0))
    t_diff = money(ticket.get("reconciliation", {}).get("difference", 999))

    check("Ticket expected matches close", abs(t_expected - expected_in_drawer) < 0.02,
          f"Ticket={t_expected} vs Close={expected_in_drawer}")
    check("Ticket reported = closing_balance", abs(t_reported - expected_in_drawer) < 0.02)
    check("Ticket difference = 0", abs(t_diff) < 0.02, f"Got ${t_diff}")

# ── 11. Cannot re-open status ──────────────────────────────────────
print("\n11. POST-CLOSE CHECKS")
r_status = requests.get(f"{BASE_URL}/api/cash/status", headers=headers)
check("Status returns null after close", r_status.json() is None)

# ── Results ────────────────────────────────────────────────────────
print("\n═══════════════════════════════════════════════════")
print(f"  RESULTS: {passed} passed, {failed} failed")
print("═══════════════════════════════════════════════════\n")

if failed > 0:
    sys.exit(1)
