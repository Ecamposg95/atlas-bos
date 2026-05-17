"""Atlas BOS module - products.

DOMAIN: Product Catalog (productos, variantes, marcas, departamentos, precios,
empaques, habilitación comercial por sucursal)
STATUS: Stable

Phase 2 / S2: this package owns Product, ProductVariant, Brand, Department,
ProductPrice, PackagingUnit, ProductBranchStatus, UnitOfMeasure plus the
products router package (core, search, stats, packaging, branch_status, bulk,
import_export, reports, audit, departments) and the historical
``departments_router`` and ``brands_router`` mounts.

The legacy paths (app/models/products.py, app/schemas/products.py,
app/routers/products/) are reverse-shims that re-export from here.

See docs/modules/MODULE_GUIDE.md §9 for the migration recipe used.
"""
