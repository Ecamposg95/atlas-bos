"""Atlas BOS module - customers.

DOMAIN: Customer Relationship Management (clientes, crédito, ledger, loyalty)
STATUS: Stable

Phase 2 / S2: this package owns Customer, CustomerLedgerEntry and the
customers CRUD/ledger router. The legacy paths (app/models/crm.py,
app/schemas/customers.py, app/routers/customers.py) are reverse-shims
that re-export from here.

See docs/modules/MODULE_GUIDE.md §9 for the migration recipe used.
"""
