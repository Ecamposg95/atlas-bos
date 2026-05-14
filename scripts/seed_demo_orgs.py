#!/usr/bin/env python3
"""Atlas One — seed demo organizations (one per preset).

Creates 7 demo orgs covering every Atlas One industry_type:
- ATLAS_POS, ATLAS_ONE_RETAIL, ATLAS_ONE_BEAUTY, ATLAS_ONE_GASTRO,
  ATLAS_ONE_SERVICES, ATLAS_ONE_ENTERPRISE, CUSTOM.

Per org it creates:
  1. Organization with the correct industry_type
  2. Branch "Matriz" tipo HQ
  3. Admin user demo_<preset_short> / demo1234  (linked via UserOrganization)
  4. Apply the industry preset → populates organization_modules
  5. Sample products/services with one ProductVariant each (with SKU + price)

Idempotent: if the demo org already exists (matched by name), the script
logs `SKIP` and moves on. To regenerate, drop the org manually first.

Usage:
    python scripts/seed_demo_orgs.py
    DATABASE_URL=postgresql://... python scripts/seed_demo_orgs.py

Default admin password for all demos: `demo1234`.
"""
import logging
import os
import sys
import uuid
from decimal import Decimal

sys.path.append(os.getcwd())

# Register all models on Base.metadata
import app.models  # noqa: F401

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.modules import OrganizationModule
from app.models.organization import Branch, Organization
from app.models.products import Product, ProductVariant
from app.modules.tenants.models import BranchType, IndustryType
from app.modules.users.models import PlatformRole, Role, User, UserOrganization
from app.services.capabilities_service import apply_industry_preset

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


# ── Per-preset demo spec ──────────────────────────────────────────────────────
DEMOS = [
    {
        "industry_type": IndustryType.ATLAS_POS,
        "name": "Demo Atlas POS",
        "branch_name": "Matriz POS",
        "admin_username": "demo_pos",
        "products": [
            ("Refresco 600ml",   "Bebida lista para venta",       Decimal("18.00"),  Decimal("10.00")),
            ("Café americano",   "Bebida caliente del día",       Decimal("35.00"),  Decimal("12.00")),
            ("Pan dulce",        "Pieza individual",              Decimal("12.00"),  Decimal("4.00")),
            ("Cigarros 20pz",    "Cajetilla estándar",            Decimal("78.00"),  Decimal("60.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_RETAIL,
        "name": "Demo Atlas One Retail",
        "branch_name": "Matriz Retail",
        "admin_username": "demo_retail",
        "products": [
            ("Cable USB-C 1m",         "Cargador rápido tipo C",         Decimal("199.00"), Decimal("80.00")),
            ("Resma papel carta",      "500 hojas Bond 75g",             Decimal("285.00"), Decimal("180.00")),
            ("Martillo 16oz",          "Mango fibra de vidrio",          Decimal("450.00"), Decimal("220.00")),
            ("Pasta dental 90g",       "Triple acción",                  Decimal("48.00"),  Decimal("28.00")),
            ("Foco LED 9W",            "Luz cálida E27",                 Decimal("65.00"),  Decimal("30.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_BEAUTY,
        "name": "Demo Atlas One Beauty",
        "branch_name": "Matriz Beauty",
        "admin_username": "demo_beauty",
        "products": [
            ("Corte de cabello",   "Servicio · 30 min",            Decimal("250.00"), Decimal("0.00")),
            ("Manicure básico",    "Servicio · 25 min",            Decimal("180.00"), Decimal("20.00")),
            ("Tinte completo",     "Servicio · 90 min",            Decimal("850.00"), Decimal("150.00")),
            ("Limpieza facial",    "Servicio · 60 min",            Decimal("450.00"), Decimal("80.00")),
            ("Paquete novia",      "Servicio + maquillaje",        Decimal("2200.00"),Decimal("300.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_GASTRO,
        "name": "Demo Atlas One Gastro",
        "branch_name": "Sucursal Gastro Centro",
        "admin_username": "demo_gastro",
        "products": [
            ("Hamburguesa clásica",  "Carne + lechuga + tomate",     Decimal("120.00"), Decimal("45.00")),
            ("Pizza Margherita",     "Mediana, masa delgada",        Decimal("220.00"), Decimal("80.00")),
            ("Café latte",           "Bebida caliente con leche",    Decimal("55.00"),  Decimal("15.00")),
            ("Tacos al pastor 3pz",  "Piña, cebolla, cilantro",      Decimal("75.00"),  Decimal("30.00")),
            ("Ensalada César",       "Lechuga, pollo, aderezo",      Decimal("145.00"), Decimal("50.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_SERVICES,
        "name": "Demo Atlas One Services",
        "branch_name": "Taller Matriz",
        "admin_username": "demo_services",
        "products": [
            ("Mantenimiento preventivo", "Servicio cada 5000 km",     Decimal("1450.00"), Decimal("400.00")),
            ("Diagnóstico computarizado","Escaneo completo de fallas",Decimal("450.00"),  Decimal("100.00")),
            ("Cambio de aceite",         "Aceite sintético 5W30",     Decimal("850.00"),  Decimal("420.00")),
            ("Alineación y balanceo",    "4 ruedas",                  Decimal("700.00"),  Decimal("180.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_ENTERPRISE,
        "name": "Demo Atlas One Enterprise",
        "branch_name": "Corporativo",
        "admin_username": "demo_enterprise",
        "products": [
            ("Plan anual ejecutivo",      "Licencia anual full-stack",      Decimal("85000.00"),  Decimal("0.00")),
            ("Consultoría 1h",            "Sesión estratégica con experto", Decimal("3500.00"),   Decimal("0.00")),
            ("Implementación módulo IA",  "Setup + entrenamiento + soporte",Decimal("125000.00"), Decimal("0.00")),
            ("Integración ERP",           "Conector enterprise",            Decimal("45000.00"),  Decimal("0.00")),
        ],
    },
    {
        "industry_type": IndustryType.CUSTOM,
        "name": "Demo Custom",
        "branch_name": "Sucursal Principal",
        "admin_username": "demo_custom",
        "products": [],  # Custom intentionally empty — operator builds catalog manually
    },
]

DEFAULT_PASSWORD = "demo1234"


# ── Helpers ───────────────────────────────────────────────────────────────────
def ensure_organization(db, spec) -> Organization | None:
    """Return the org if newly created, None if it already existed (skip)."""
    existing = db.query(Organization).filter(Organization.name == spec["name"]).first()
    if existing:
        logger.info(f"  SKIP organization '{spec['name']}' (id={existing.id}) — already exists")
        return None

    org = Organization(
        name=spec["name"],
        industry_type=spec["industry_type"],
        is_active=True,
        plan="Demo",
        status="ACTIVE",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    logger.info(f"  + organization '{org.name}' (id={org.id}, industry={spec['industry_type'].value})")
    return org


def ensure_branch(db, org: Organization, branch_name: str) -> Branch:
    existing = (
        db.query(Branch)
        .filter(Branch.organization_id == org.id, Branch.name == branch_name)
        .first()
    )
    if existing:
        logger.info(f"    · branch '{branch_name}' already exists (id={existing.id})")
        return existing

    branch = Branch(
        name=branch_name,
        branch_type=BranchType.HQ,
        is_headquarters=True,
        is_active=True,
        can_sell=True,
        organization_id=org.id,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    logger.info(f"    + branch '{branch.name}' (id={branch.id}, type=HQ)")
    return branch


def ensure_admin(db, org: Organization, branch: Branch, username: str) -> User:
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        logger.info(f"    · user '{username}' already exists (id={existing.id})")
        # Ensure the link to the org exists even if user is reused
        link = (
            db.query(UserOrganization)
            .filter(
                UserOrganization.user_id == existing.id,
                UserOrganization.organization_id == org.id,
            )
            .first()
        )
        if not link:
            db.add(UserOrganization(user_id=existing.id, organization_id=org.id, is_active=True, org_role="ADMIN"))
            db.commit()
            logger.info(f"      + linked existing user to org")
        return existing

    user = User(
        username=username,
        full_name=f"Demo Admin {username}",
        email=f"{username}@atlasone.demo",
        password_hash=get_password_hash(DEFAULT_PASSWORD),
        role=Role.ADMINISTRADOR,
        platform_role=PlatformRole.NONE,
        branch_id=branch.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(UserOrganization(user_id=user.id, organization_id=org.id, is_active=True, org_role="ADMIN"))
    db.commit()
    logger.info(f"    + user '{user.username}' / password=demo1234 (id={user.id}, role=ADMINISTRADOR)")
    return user


def ensure_products(db, org: Organization, items: list) -> int:
    """Create Product + ProductVariant rows for items missing in the org. Returns count of created products."""
    if not items:
        return 0

    created = 0
    for idx, (name, desc, price, cost) in enumerate(items, start=1):
        existing = (
            db.query(Product)
            .filter(Product.organization_id == org.id, Product.name == name)
            .first()
        )
        if existing:
            continue

        product = Product(
            name=name,
            description=desc,
            unit="pza",
            organization_id=org.id,
            is_active=True,
            has_variants=False,
            approval_status="APPROVED",
        )
        db.add(product)
        db.flush()  # need product.id before variant

        # SKU = first 3 letters of org name (uppercase) + zero-padded index
        prefix = "".join(ch for ch in org.name.upper() if ch.isalpha())[:4] or "DEMO"
        sku = f"{prefix}-{idx:03d}-{uuid.uuid4().hex[:4].upper()}"

        variant = ProductVariant(
            product_id=product.id,
            sku=sku,
            variant_name="Estándar",
            price=price,
            cost=cost,
            has_iva=True,
            tax_rate=Decimal("16.00"),
            organization_id=org.id,
        )
        db.add(variant)
        created += 1

    if created:
        db.commit()
        logger.info(f"    + {created} product(s) seeded")
    else:
        logger.info(f"    · all products already present")
    return created


# ── Main ──────────────────────────────────────────────────────────────────────
def seed_all(db) -> None:
    logger.info(f"🚀 Seeding {len(DEMOS)} demo organizations...")
    for spec in DEMOS:
        logger.info(f"\n▶ {spec['name']} ({spec['industry_type'].value})")
        org = ensure_organization(db, spec)
        if org is None:
            continue  # SKIP — org already existed; we don't touch its branches/users/modules/products

        branch = ensure_branch(db, org, spec["branch_name"])
        ensure_admin(db, org, branch, spec["admin_username"])

        try:
            apply_industry_preset(db, org.id, spec["industry_type"])
            db.commit()
            n_mods = (
                db.query(OrganizationModule)
                .filter(OrganizationModule.organization_id == org.id, OrganizationModule.is_enabled == True)  # noqa: E712
                .count()
            )
            logger.info(f"    + preset applied — {n_mods} module(s) enabled")
        except Exception as e:
            db.rollback()
            logger.error(f"    ✗ preset apply failed: {e}")

        ensure_products(db, org, spec["products"])

    logger.info("\n✅ Demo seed complete.")
    logger.info("   Default password for every demo admin: demo1234")


def main() -> None:
    db = SessionLocal()
    try:
        seed_all(db)
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
