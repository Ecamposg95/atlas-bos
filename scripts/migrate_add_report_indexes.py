"""Advisory index migration for /api/platform/reports/* queries.

Idempotent — safe to re-run. Creates the two indexes recommended in
``docs/superpowers/specs/2026-04-30-platform-reports-design.md`` to keep
cross-tenant pivots fast as ``sales_documents`` grows.

Run manually per environment:

    python scripts/migrate_add_report_indexes.py
"""

from sqlalchemy import text

from app.core.database import engine

INDEXES = [
    (
        "ix_sales_doc_created_org",
        "CREATE INDEX IF NOT EXISTS ix_sales_doc_created_org "
        "ON sales_documents(created_at, organization_id);",
    ),
    (
        "ix_sales_doc_branch_created",
        "CREATE INDEX IF NOT EXISTS ix_sales_doc_branch_created "
        "ON sales_documents(branch_id, created_at);",
    ),
]


def main():
    with engine.begin() as conn:
        for name, ddl in INDEXES:
            print(f"Creating {name}...")
            conn.execute(text(ddl))
            print("  OK")
    print("Done.")


if __name__ == "__main__":
    main()
