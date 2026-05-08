"""Atlas BOS modules.

Each subpackage is a self-contained domain (auth, tenants, branches, products,
inventory, sales, cash, etc.). See context/PHASE_2_BACKEND_MODULARIZATION.md
for the migration plan.

S0.1: this package exists but most submodules will be populated incrementally
in S1-S7. Today only `platform/` is scaffolded with shims pointing at the
legacy `app.security` symbols, so consumers can already migrate their imports.
"""
