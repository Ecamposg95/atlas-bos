#!/usr/bin/env python3
"""
Railway Deployment Initialization Script
Ejecuta la secuencia completa de inicialización:
1. Crear Superadmin
2. Crear Organización Rmazh con preset ATLAS_POS
3. Vincular Superadmin a Rmazh
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import app.models to ensure all tables are registered in Base.metadata
import app.models  # This imports all submodules defined in app/models/__init__.py

from app.database import SessionLocal, engine, Base
from app.models.users import User, PlatformRole, Role, UserOrganization
from app.models.organization import Organization, IndustryType
from app.security import get_password_hash
from sqlalchemy.exc import IntegrityError

def init_database():
    """Initialize database tables"""
    print("🔧 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")

def run_migrations():
    """Run incremental column migrations (idempotent)."""
    print("\n🔄 Running column migrations...")
    from sqlalchemy import text

    migrations = [
        # (table, column, ddl)
        ("products", "image_url",      "ALTER TABLE products ADD COLUMN image_url VARCHAR;"),
        ("product_variants", "has_iva", "ALTER TABLE product_variants ADD COLUMN has_iva BOOLEAN DEFAULT FALSE;"),
        ("brands",   "logo_url",       "ALTER TABLE brands ADD COLUMN logo_url VARCHAR;"),
        ("branches", "paper_width_mm", "ALTER TABLE branches ADD COLUMN paper_width_mm INTEGER DEFAULT 80;"),
        ("branches", "printer_cols",   "ALTER TABLE branches ADD COLUMN printer_cols INTEGER;"),
        ("branches", "open_drawer_on_print", "ALTER TABLE branches ADD COLUMN open_drawer_on_print BOOLEAN NOT NULL DEFAULT TRUE;"),
        # Cashier Cockpit (PR #165) — Branch.daily_sales_goal and Branch.closing_time
        ("branches", "daily_sales_goal", "ALTER TABLE branches ADD COLUMN daily_sales_goal NUMERIC(12,2);"),
        ("branches", "closing_time",     "ALTER TABLE branches ADD COLUMN closing_time TIME;"),
        # Branch logo (E#2) — per-branch ticket logo override
        ("branches", "logo_url",         "ALTER TABLE branches ADD COLUMN logo_url VARCHAR;"),
        ("cash_sessions", "total_change_given", "ALTER TABLE cash_sessions ADD COLUMN total_change_given NUMERIC(10,2) DEFAULT 0.00;"),
        ("sales_lines", "discount_percent", "ALTER TABLE sales_lines ADD COLUMN discount_percent NUMERIC(5,2) DEFAULT 0.00;"),
        # Sprint 2 — multi-tenancy completa (S2.2)
        ("cash_sessions", "organization_id", "ALTER TABLE cash_sessions ADD COLUMN organization_id INTEGER REFERENCES organization(id);"),
        ("employees", "organization_id", "ALTER TABLE employees ADD COLUMN organization_id INTEGER REFERENCES organization(id);"),
        # Track 1 (POS bug-fix) — vincular venta a sesión de caja
        ("sales_documents", "cash_session_id", "ALTER TABLE sales_documents ADD COLUMN cash_session_id INTEGER REFERENCES cash_sessions(id);"),
        # Fase 1.3 — vuelto entregado por venta (persistido al crear, leído al cuadrar).
        # NULL = venta legada → reconciliación recomputa con la lógica antigua.
        ("sales_documents", "change_given", "ALTER TABLE sales_documents ADD COLUMN change_given NUMERIC(12,2);"),
        # Track 4 (POS bug-fix) — tracking per-PC en print_jobs
        ("print_jobs", "device_id",          "ALTER TABLE print_jobs ADD COLUMN device_id VARCHAR(64);"),
        ("print_jobs", "device_fingerprint", "ALTER TABLE print_jobs ADD COLUMN device_fingerprint VARCHAR(128);"),
        ("print_jobs", "client_ip",          "ALTER TABLE print_jobs ADD COLUMN client_ip VARCHAR(64);"),
        # CAJERO audit 2026-04-29 (H-2) — descuento global persistido para reportes.
        # No se agrega al modelo ORM; solo lectura defensiva via setattr.
        ("sales_documents", "global_discount_pct", "ALTER TABLE sales_documents ADD COLUMN global_discount_pct NUMERIC(5,2) DEFAULT 0;"),
        # CAJERO audit 2026-04-29 (M-3) — lifecycle de parked tickets. status='ACTIVE' default;
        # se setea a 'CONVERTED' cuando el ticket se materializa en una venta. converted_to_sale_id
        # da trazabilidad parked → sale.
        ("parked_tickets", "status",                "ALTER TABLE parked_tickets ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';"),
        ("parked_tickets", "converted_to_sale_id",  "ALTER TABLE parked_tickets ADD COLUMN converted_to_sale_id VARCHAR(36) REFERENCES sales_documents(id);"),
    ]

    # Track 1 — Audit + cleanup de Payment huérfanos antes de NOT NULL.
    # Listar count en logs; en QA borramos. En prod, ESTA acción se replantea
    # antes de promover (ver tech-debt roadmap).
    print("\n  Track 1 — Auditando payments huérfanos (sales_document_id IS NULL)…")
    with engine.begin() as conn:
        orphan_count = conn.execute(text(
            "SELECT count(*) FROM payments WHERE sales_document_id IS NULL"
        )).scalar() or 0
        print(f"  · payments huérfanos detectados: {orphan_count}")
        if orphan_count > 0:
            conn.execute(text("DELETE FROM payments WHERE sales_document_id IS NULL"))
            print(f"  ✓ {orphan_count} payments huérfanos eliminados (QA cleanup)")
        # Aplicar NOT NULL si aún no lo es
        is_nullable = conn.execute(text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name='payments' AND column_name='sales_document_id'"
        )).scalar()
        if is_nullable == 'YES':
            conn.execute(text(
                "ALTER TABLE payments ALTER COLUMN sales_document_id SET NOT NULL"
            ))
            print("  ✓ payments.sales_document_id ahora NOT NULL")
        else:
            print("  · payments.sales_document_id ya era NOT NULL")

    with engine.connect() as conn:
        for table, column, ddl in migrations:
            res = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_name='{table}' AND column_name='{column}'"
            ))
            if not res.fetchone():
                conn.execute(text(ddl))
                conn.commit()
                print(f"  ✓ {table}.{column} added")
            else:
                print(f"  · {table}.{column} already exists")

    # --- Index migrations (idempotent via CREATE INDEX IF NOT EXISTS) ---
    index_migrations = [
        # (name, ddl)
        (
            "ix_pbs_branch_active_pos",
            """
            CREATE INDEX IF NOT EXISTS ix_pbs_branch_active_pos
                ON product_branch_status (branch_id, variant_id)
                WHERE is_active_pos = true;
            """,
        ),
        # Sprint 2 — índices para filtros por organization_id
        (
            "ix_cash_sessions_organization_id",
            "CREATE INDEX IF NOT EXISTS ix_cash_sessions_organization_id ON cash_sessions (organization_id);",
        ),
        (
            "ix_employees_organization_id",
            "CREATE INDEX IF NOT EXISTS ix_employees_organization_id ON employees (organization_id);",
        ),
        # Track 1 (POS bug-fix)
        (
            "ix_sales_documents_cash_session_id",
            "CREATE INDEX IF NOT EXISTS ix_sales_documents_cash_session_id ON sales_documents (cash_session_id);",
        ),
        # Track 4 (POS bug-fix)
        (
            "ix_print_jobs_device_id",
            "CREATE INDEX IF NOT EXISTS ix_print_jobs_device_id ON print_jobs (device_id);",
        ),
        # Platform pack 2026-04-30 — Control Tower / Stats endpoints filtran sales_documents
        # por created_at en cada request (sales-now, system-health-summary, kpis-extended,
        # cohort-retention, etc). Sin este índice, full table scan = endpoints cuelgan.
        (
            "ix_sales_documents_created_at",
            "CREATE INDEX IF NOT EXISTS ix_sales_documents_created_at ON sales_documents (created_at);",
        ),
        # Cashier perf 2026-05-07 — /cash/summary y /cash/branch-summary filtran por
        # (seller_id, created_at) cada vez que el cajero refresca el dashboard del turno.
        # Sin composite, plan = bitmap heap scan sobre miles de filas.
        (
            "ix_sales_seller_created",
            "CREATE INDEX IF NOT EXISTS ix_sales_seller_created ON sales_documents (seller_id, created_at);",
        ),
        # Cashier perf 2026-05-07 — cierre de turno scanea parked_tickets por user+branch+created_at
        # para detectar tickets pausados. Composite acelera tanto el cierre como el polling
        # del badge de pendientes en POS.
        (
            "ix_parked_tickets_user_branch_created",
            "CREATE INDEX IF NOT EXISTS ix_parked_tickets_user_branch_created ON parked_tickets (user_id, branch_id, created_at);",
        ),
    ]

    with engine.connect() as conn:
        for name, ddl in index_migrations:
            conn.execute(text(ddl))
            conn.commit()
            print(f"  ✓ index {name} ensured")

    # --- Sprint 2 backfill: cash_sessions.organization_id y employees.organization_id ---
    # Derivado de branches.organization_id. Idempotente (solo filas con NULL).
    print("\n  Backfill organization_id (Sprint 2)…")
    with engine.begin() as conn:
        result_cs = conn.execute(text(
            "UPDATE cash_sessions cs "
            "SET organization_id = b.organization_id "
            "FROM branches b "
            "WHERE cs.branch_id = b.id AND cs.organization_id IS NULL "
            "RETURNING cs.id"
        ))
        cs_count = len(result_cs.fetchall())
        print(f"  ✓ cash_sessions backfill: {cs_count} filas actualizadas")

        result_emp = conn.execute(text(
            "UPDATE employees e "
            "SET organization_id = b.organization_id "
            "FROM branches b "
            "WHERE e.base_branch_id = b.id "
            "AND e.organization_id IS NULL "
            "AND e.base_branch_id IS NOT NULL "
            "RETURNING e.id"
        ))
        emp_count = len(result_emp.fetchall())
        print(f"  ✓ employees backfill: {emp_count} filas actualizadas")

        orphans = conn.execute(text(
            "SELECT COUNT(*) FROM employees WHERE organization_id IS NULL"
        )).scalar()
        if orphans:
            print(f"  ⚠ {orphans} employees sin organization_id (sin base_branch_id) — resolver manual antes de Sprint 9.")

    print("✅ Migrations complete")

def create_superadmin(db):
    """Create superadmin user if not exists"""
    print("\n👤 Creating Superadmin...")
    
    # Check if superadmin exists
    existing = db.query(User).filter(User.username == "superadmin").first()
    if existing:
        print("⚠️  Superadmin already exists, skipping...")
        return existing
    
    superadmin = User(
        username="superadmin",
        password_hash=get_password_hash("784512"),
        role=Role.ADMINISTRADOR,
        platform_role=PlatformRole.SUPERADMIN,
        is_active=True
    )
    
    db.add(superadmin)
    db.commit()
    db.refresh(superadmin)
    
    print(f"✅ Superadmin created: {superadmin.username}")
    print(f"   Password: 784512")
    return superadmin

def create_rmazh_organization(db):
    """Create Rmazh organization with ATLAS_POS preset"""
    print("\n🏢 Creating Rmazh Organization...")
    
    # Check if organization exists
    existing = db.query(Organization).filter(Organization.name == "Rmazh").first()
    if existing:
        print("⚠️  Rmazh organization already exists, skipping...")
        return existing
    
    rmazh = Organization(
        name="Rmazh",
        industry_type=IndustryType.ATLAS_POS,
        is_active=True,
        plan="Pro",
        status="ACTIVE"
    )
    
    db.add(rmazh)
    db.commit()
    db.refresh(rmazh)
    
    print(f"✅ Organization created: {rmazh.name}")
    print(f"   Industry: {rmazh.industry_type.value}")
    return rmazh

def link_superadmin_to_rmazh(db, superadmin, organization):
    """Link superadmin to Rmazh organization"""
    print("\n🔗 Linking Superadmin to Rmazh...")
    
    # Check if link exists
    existing_link = db.query(UserOrganization).filter(
        UserOrganization.user_id == superadmin.id,
        UserOrganization.organization_id == organization.id
    ).first()
    
    if existing_link:
        print("⚠️  Link already exists, skipping...")
        return
    
    link = UserOrganization(
        user_id=superadmin.id,
        organization_id=organization.id,
        is_active=True
    )
    
    db.add(link)
    db.commit()
    
    print(f"✅ Superadmin linked to {organization.name}")

def initialize_modules(db, organization):
    """Initialize ATLAS_POS modules for organization"""
    print("\n📦 Initializing ATLAS_POS modules...")
    
    from app.models.modules import Module, OrganizationModule
    
    # ATLAS_POS module keys — alineado con scripts/init_presets_v2.py preset
    # canónico (Wave 2: removidos purchasing/fulfillment/documents/
    # sales_pipeline/invoicing/quotes que no son parte del preset Atlas POS).
    atlas_pos_modules = [
        "core", "pos", "cash_management", "inventory", "catalog",
        "branch_catalog_enablement", "returns", "pricing", "promotions",
        "payments", "crm", "reports",
    ]

    modules_created = 0
    for module_key in atlas_pos_modules:
        # Check if module exists in catalog
        module = db.query(Module).filter(Module.key == module_key).first()
        if not module:
            # Create module if doesn't exist
            module = Module(
                key=module_key,
                name=module_key.replace("_", " ").title(),
                description=f"Module for {module_key}"
            )
            db.add(module)
            db.commit()
            db.refresh(module)
        
        # Check if already enabled for org
        org_module = db.query(OrganizationModule).filter(
            OrganizationModule.organization_id == organization.id,
            OrganizationModule.module_key == module.key
        ).first()
        
        if not org_module:
            org_module = OrganizationModule(
                organization_id=organization.id,
                module_key=module.key,
                is_enabled=True
            )
            db.add(org_module)
            modules_created += 1
    
    db.commit()
    print(f"✅ {modules_created} modules initialized for {organization.name}")
    
def initialize_presets(db):
    """Initialize Industry Presets"""
    print("\n📋 Initializing Industry Presets...")
    
    from app.models.modules import IndustryPreset, Module
    
    # ATLAS_POS Preset
    preset_data = {
        "industry_type": "ATLAS_POS",
        "display_name": "Atlas POS Retail",
        "description": "Configuración completa para punto de venta retail con inventario avanzado.",
        "modules": [
            "pos", "inventory", "sales", "customers", "finance", 
            "reports", "users", "branches", "cash_register",
            "products", "categories", "suppliers", "returns",
            "invoicing", "receipts", "dashboard"
        ],
        "is_system": True
    }
    
    existing = db.query(IndustryPreset).filter(IndustryPreset.industry_type == preset_data["industry_type"]).first()
    if not existing:
        preset = IndustryPreset(**preset_data)
        db.add(preset)
        print("✅ Created preset: ATLAS_POS Retail")
    else:
        print("⚠️  Preset ATLAS_POS already exists, skipping...")
        
    db.commit()

def main():
    """Main initialization sequence"""
    print("=" * 60)
    print("🚀 RAILWAY DEPLOYMENT INITIALIZATION")
    print("=" * 60)
    
    try:
        # Initialize database
        init_database()

        # Run incremental migrations
        run_migrations()

        # Create database session
        db = SessionLocal()
        
        try:
            # Step 1: Create Superadmin
            create_superadmin(db)

            # Step 2: Initialize Presets
            initialize_presets(db)

            print("\n" + "=" * 60)
            print("✅ INITIALIZATION COMPLETE!")
            print("=" * 60)
            print("\n📋 Summary:")
            print(f"   • Superadmin: superadmin")
            print(f"   • Presets: Initialized")
            print("=" * 60)
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
