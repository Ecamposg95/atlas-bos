"""Atlas BOS module - tenants.

S1 placeholder: this package will own the tenant domain (router, schemas,
services, models). In Pack vocab a "tenant" is an organization, so this
package will absorb the existing organization.py logic (app/routers/
organization.py, app/models/organization.py, app/crud/organization.py,
app/schemas/organization.py) and re-expose it under the tenant namespace.
Migration happens in S1 of Phase 2.

See context/PHASE_2_BACKEND_MODULARIZATION.md.
"""
