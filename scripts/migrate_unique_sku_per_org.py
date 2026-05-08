"""
Migration: Enforce SKU uniqueness per organization on product_variants.

Run once: python scripts/migrate_unique_sku_per_org.py

Behavior:
  1. Scans for duplicate (organization_id, sku) pairs on non-deleted variants.
     If any are found, prints them and aborts without touching the schema.
  2. Drops the old single-column unique index ix_product_variants_sku if present.
  3. Creates partial unique index ux_variant_sku_per_org on
     (organization_id, sku) WHERE deleted_at IS NULL.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine
from sqlalchemy import text


DUP_QUERY = text("""
    SELECT organization_id, sku, COUNT(*) AS n
    FROM product_variants
    WHERE deleted_at IS NULL
    GROUP BY organization_id, sku
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 50;
""")


def run():
    with engine.connect() as conn:
        dups = conn.execute(DUP_QUERY).fetchall()
        if dups:
            print("✗ Found duplicate (organization_id, sku) pairs. Resolve them first:")
            for row in dups:
                print(f"    org_id={row.organization_id}  sku={row.sku!r}  count={row.n}")
            print("\nSuggestion: rename or soft-delete the duplicates, then re-run.")
            sys.exit(1)

        existing = conn.execute(text("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'product_variants'
              AND indexname IN ('ix_product_variants_sku', 'ux_variant_sku_per_org')
        """)).fetchall()
        existing_names = {row.indexname for row in existing}

        if 'ix_product_variants_sku' in existing_names:
            conn.execute(text("DROP INDEX IF EXISTS ix_product_variants_sku;"))
            print("✓ Dropped legacy index ix_product_variants_sku.")

        if 'ux_variant_sku_per_org' in existing_names:
            print("✓ Index ux_variant_sku_per_org already exists — nothing to do.")
            conn.commit()
            return

        conn.execute(text("""
            CREATE UNIQUE INDEX ux_variant_sku_per_org
            ON product_variants (organization_id, sku)
            WHERE deleted_at IS NULL;
        """))
        conn.commit()
        print("✓ Created partial unique index ux_variant_sku_per_org.")


if __name__ == "__main__":
    run()
