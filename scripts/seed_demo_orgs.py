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
from datetime import datetime, time, timedelta, timezone

from app.models.products import Product, ProductVariant
from app.modules.appointments.models import (
    Appointment,
    AppointmentService as ApptServiceLink,
    AppointmentStatus,
    BookingChannel,
    Professional,
    ProfessionalSchedule,
    Resource,
    ResourceType,
    Service,
)
from app.modules.customers.models import Customer
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
        "cashier_username": "demo_cajero_pos",
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
        "cashier_username": "demo_cajero_retail",
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
        "cashier_username": "demo_cajero_beauty",
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
        "cashier_username": "demo_cajero_gastro",
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
        "cashier_username": "demo_cajero_services",
        "products": [
            ("Mantenimiento preventivo", "Servicio cada 5000 km",     Decimal("1450.00"), Decimal("400.00")),
            ("Diagnóstico computarizado","Escaneo completo de fallas",Decimal("450.00"),  Decimal("100.00")),
            ("Cambio de aceite",         "Aceite sintético 5W30",     Decimal("850.00"),  Decimal("420.00")),
            ("Alineación y balanceo",    "4 ruedas",                  Decimal("700.00"),  Decimal("180.00")),
        ],
    },
    # ── Taxonomy v2 verticals (2026-05-15) ──────────────────────────────────
    {
        "industry_type": IndustryType.ATLAS_ONE_BARBER,
        "name": "Demo Atlas One Barber",
        "branch_name": "Barber Shop Centro",
        "admin_username": "demo_barber",
        "cashier_username": "demo_cajero_barber",
        "products": [
            ("Corte de cabello",       "Servicio · 25 min",                Decimal("180.00"), Decimal("0.00")),
            ("Barba clásica",          "Recorte y perfilado · 20 min",     Decimal("120.00"), Decimal("0.00")),
            ("Diseño de barba",        "Trazos finos · 30 min",            Decimal("180.00"), Decimal("0.00")),
            ("Combo corte + barba",    "Servicio · 45 min",                Decimal("280.00"), Decimal("0.00")),
            ("Tinte para hombre",      "Color natural · 40 min",           Decimal("350.00"), Decimal("80.00")),
            ("Paquete 4 cortes",       "Bono prepagado",                   Decimal("640.00"), Decimal("0.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_BEAUTY_WELLNESS,
        "name": "Demo Atlas One Beauty & Wellness",
        "branch_name": "Matriz Beauty & Wellness",
        "admin_username": "demo_beauty_wellness",
        "cashier_username": "demo_cajero_beauty_wellness",
        "products": [
            ("Manicure básico",        "Servicio · 25 min",                Decimal("180.00"), Decimal("20.00")),
            ("Pedicure spa",           "Servicio · 45 min",                Decimal("320.00"), Decimal("40.00")),
            ("Tinte completo",         "Servicio · 90 min",                Decimal("850.00"), Decimal("150.00")),
            ("Limpieza facial",        "Servicio · 60 min",                Decimal("450.00"), Decimal("80.00")),
            ("Masaje relajante 60min", "Servicio · 60 min",                Decimal("600.00"), Decimal("80.00")),
            ("Paquete novia",          "Servicio + maquillaje + peinado",  Decimal("2200.00"),Decimal("300.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_HEALTH,
        "name": "Demo Atlas One Health",
        "branch_name": "Consultorio Matriz",
        "admin_username": "demo_health",
        "cashier_username": "demo_cajero_health",
        "products": [
            ("Consulta general",         "Médica · 30 min",                  Decimal("500.00"),  Decimal("0.00")),
            ("Limpieza dental",          "Profilaxis · 45 min",              Decimal("750.00"),  Decimal("0.00")),
            ("Sesión quiropráctica",     "Ajuste · 40 min",                  Decimal("650.00"),  Decimal("0.00")),
            ("Fisioterapia 45min",       "Rehabilitación",                   Decimal("550.00"),  Decimal("0.00")),
            ("Plan trimestral wellness", "Paquete 12 sesiones",              Decimal("5800.00"), Decimal("0.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_RESTAURANT,
        "name": "Demo Atlas One Restaurant",
        "branch_name": "Restaurant Matriz",
        "admin_username": "demo_restaurant",
        "cashier_username": "demo_cajero_restaurant",
        "products": [
            ("Hamburguesa clásica", "Carne 150g, queso, pan brioche", Decimal("180.00"), Decimal("65.00")),
            ("Pizza Margherita",    "Mediana, masa delgada",          Decimal("260.00"), Decimal("90.00")),
            ("Pasta Carbonara",     "Con tocino y huevo",             Decimal("220.00"), Decimal("75.00")),
            ("Filete de res 250g",  "Término al gusto",               Decimal("385.00"), Decimal("180.00")),
            ("Postre del día",      "Variable",                       Decimal("95.00"),  Decimal("30.00")),
            ("Refresco 600ml",      "Bebida fría",                    Decimal("45.00"),  Decimal("18.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_CAFE,
        "name": "Demo Atlas One Café",
        "branch_name": "Café Centro",
        "admin_username": "demo_cafe",
        "cashier_username": "demo_cajero_cafe",
        "products": [
            ("Café americano",       "Bebida caliente · 8 oz",       Decimal("45.00"),  Decimal("12.00")),
            ("Latte",                "Café con leche · 12 oz",       Decimal("65.00"),  Decimal("18.00")),
            ("Capuchino",            "Espresso + espuma · 8 oz",     Decimal("60.00"),  Decimal("17.00")),
            ("Croissant",            "Mantequilla, recién horneado", Decimal("48.00"),  Decimal("18.00")),
            ("Sandwich de pollo",    "Pan artesanal, ensalada",      Decimal("125.00"), Decimal("45.00")),
            ("Smoothie de frutas",   "Mezcla del día · 16 oz",       Decimal("85.00"),  Decimal("30.00")),
        ],
    },
    {
        "industry_type": IndustryType.ATLAS_ONE_BAR,
        "name": "Demo Atlas One Bar",
        "branch_name": "Bar La Noche",
        "admin_username": "demo_bar",
        "cashier_username": "demo_cajero_bar",
        "products": [
            ("Cerveza nacional",     "Botella 355 ml",                 Decimal("55.00"),  Decimal("20.00")),
            ("Cerveza importada",    "Botella 355 ml",                 Decimal("85.00"),  Decimal("38.00")),
            ("Cuba libre",           "Ron + cola · 2 oz",              Decimal("95.00"),  Decimal("28.00")),
            ("Margarita clásica",    "Tequila + limón + sal",          Decimal("125.00"), Decimal("38.00")),
            ("Tequila premium",      "Reposado · caballito",           Decimal("160.00"), Decimal("55.00")),
            ("Botana mixta",         "Para 2-3 personas",              Decimal("180.00"), Decimal("60.00")),
        ],
    },

    {
        "industry_type": IndustryType.ATLAS_ONE_ENTERPRISE,
        "name": "Demo Atlas One Enterprise",
        "branch_name": "Corporativo",
        "admin_username": "demo_enterprise",
        "cashier_username": "demo_cajero_enterprise",
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
        "cashier_username": "demo_cajero_custom",
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


def ensure_user(
    db,
    org: Organization,
    branch: Branch,
    username: str,
    role: Role,
    org_role: str,
    full_name: str,
) -> User:
    """Idempotent: create the User if missing, link to org if not linked yet."""
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        logger.info(f"    · user '{username}' already exists (id={existing.id}, role={existing.role.value})")
        link = (
            db.query(UserOrganization)
            .filter(
                UserOrganization.user_id == existing.id,
                UserOrganization.organization_id == org.id,
            )
            .first()
        )
        if not link:
            db.add(UserOrganization(user_id=existing.id, organization_id=org.id, is_active=True, org_role=org_role))
            db.commit()
            logger.info(f"      + linked existing user to org as {org_role}")
        return existing

    user = User(
        username=username,
        full_name=full_name,
        email=f"{username}@atlasone.demo",
        password_hash=get_password_hash(DEFAULT_PASSWORD),
        role=role,
        platform_role=PlatformRole.NONE,
        branch_id=branch.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(UserOrganization(user_id=user.id, organization_id=org.id, is_active=True, org_role=org_role))
    db.commit()
    logger.info(f"    + user '{user.username}' / password=demo1234 (id={user.id}, role={role.value})")
    return user


def ensure_admin(db, org: Organization, branch: Branch, username: str) -> User:
    return ensure_user(
        db, org, branch, username,
        role=Role.ADMINISTRADOR,
        org_role="ADMIN",
        full_name=f"Demo Admin {username}",
    )


def ensure_cashier(db, org: Organization, branch: Branch, username: str) -> User:
    return ensure_user(
        db, org, branch, username,
        role=Role.CAJERO,
        org_role="MEMBER",
        full_name=f"Demo Cajero {username}",
    )


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


def seed_appointments_demo(db, spec, org, branch, cashier_user, products):
    """For demos with appointments-enabled presets, populate professional + schedule + sample appointments."""
    APPT_PRESETS = {
        "ATLAS_ONE_BARBER":          ResourceType.CHAIR,
        "ATLAS_ONE_BEAUTY_WELLNESS": ResourceType.CABIN,
        "ATLAS_ONE_HEALTH":          ResourceType.CONSULTORY,
        "ATLAS_ONE_SERVICES":        ResourceType.BAY,
        "ATLAS_ONE_BEAUTY":          ResourceType.CABIN,  # legacy alias
    }
    industry = spec["industry_type"].value
    res_type = APPT_PRESETS.get(industry)
    if res_type is None:
        return  # preset doesn't use appointments

    # Idempotent: skip if professional already exists for this cashier+branch
    existing_pro = (
        db.query(Professional)
        .filter(Professional.user_id == cashier_user.id, Professional.branch_id == branch.id)
        .first()
    )
    if existing_pro:
        logger.info("    · appointments seed already present, skipping")
        return

    pro = Professional(
        organization_id=org.id, user_id=cashier_user.id, branch_id=branch.id,
        is_bookable=True, color="#06b6d4",
        bio=f"Profesional demo de {spec['name']}",
    )
    db.add(pro); db.flush()
    for wd in range(0, 6):  # Mon-Sat
        db.add(ProfessionalSchedule(
            organization_id=org.id, professional_id=pro.id, weekday=wd,
            start_time=time(9, 0), end_time=time(18, 0),
        ))

    res = Resource(
        organization_id=org.id, branch_id=branch.id,
        name=f"{res_type.value} 1", resource_type=res_type, capacity=1, is_active=True,
    )
    db.add(res); db.commit()

    # Mark first 4 product variants as Services
    durations = [30, 45, 60, 30]
    variants = (
        db.query(ProductVariant)
        .filter(ProductVariant.organization_id == org.id)
        .order_by(ProductVariant.created_at)
        .limit(4)
        .all()
    )
    services = []
    for v, d in zip(variants, durations):
        if db.query(Service).filter(Service.product_variant_id == v.id).first():
            continue
        s = Service(
            organization_id=org.id, product_variant_id=v.id,
            duration_minutes=d, buffer_minutes_after=5,
            requires_resource_type=res_type, is_bookable_online=True,
        )
        db.add(s)
        services.append(s)
    db.commit()
    for s in services:
        db.refresh(s)
    logger.info(f"    + {len(services)} service(s) marked")

    if not services:
        # Org has no variants to upgrade to services — skip the demo customer + appointments
        return

    # Demo customer (only when we have at least one service to attach)
    cust = Customer(
        organization_id=org.id, name="Cliente Demo Agenda",
        email="cliente.demo@atlasone.test", phone="+5215555555555",
    )
    db.add(cust); db.commit()

    svc = services[0]
    today = datetime.now(timezone.utc)
    today_local = today.replace(hour=10, minute=0, second=0, microsecond=0)
    yesterday = today_local - timedelta(days=1)
    later_today = today_local + timedelta(hours=2)

    demos = [
        (today_local, AppointmentStatus.CONFIRMED),
        (later_today, AppointmentStatus.PENDING),
        (yesterday, AppointmentStatus.COMPLETED),
    ]
    for starts_at, st in demos:
        a = Appointment(
            organization_id=org.id, branch_id=branch.id, customer_id=cust.id,
            professional_id=pro.id, resource_id=res.id,
            starts_at=starts_at, ends_at=starts_at + timedelta(minutes=svc.duration_minutes),
            status=st, booking_channel=BookingChannel.STAFF,
        )
        db.add(a); db.flush()
        db.add(ApptServiceLink(
            organization_id=org.id, appointment_id=a.id, service_id=svc.id,
            sort_order=0, duration_minutes=svc.duration_minutes,
        ))
    db.commit()
    logger.info(f"    + 3 demo appointments seeded (1 confirmed today, 1 pending, 1 completed yesterday)")


# ── Main ──────────────────────────────────────────────────────────────────────
def seed_all(db) -> None:
    logger.info(f"🚀 Seeding {len(DEMOS)} demo organizations...")
    succeeded = 0
    failed = []
    for spec in DEMOS:
        logger.info(f"\n▶ {spec['name']} ({spec['industry_type'].value})")
        try:
            org = ensure_organization(db, spec)
            if org is None:
                succeeded += 1  # already existed counts as success
                continue

            branch = ensure_branch(db, org, spec["branch_name"])
            ensure_admin(db, org, branch, spec["admin_username"])
            if spec.get("cashier_username"):
                ensure_cashier(db, org, branch, spec["cashier_username"])

            try:
                apply_industry_preset(db, org.id, spec["industry_type"])
                db.commit()
                n_mods = (
                    db.query(OrganizationModule)
                    .filter(
                        OrganizationModule.organization_id == org.id,
                        OrganizationModule.is_enabled == True,  # noqa: E712
                    )
                    .count()
                )
                logger.info(f"    + preset applied — {n_mods} module(s) enabled")
            except Exception as e:
                db.rollback()
                logger.error(f"    ✗ preset apply failed: {e}")

            ensure_products(db, org, spec["products"])

            # Appointments-enabled presets get a professional, schedule, and 3 demo appointments
            try:
                cashier = db.query(User).filter(User.username == spec.get("cashier_username", "")).first()
                if cashier:
                    seed_appointments_demo(db, spec, org, branch, cashier, spec["products"])
            except Exception as e:
                db.rollback()
                logger.warning(f"    ⚠ appointments demo seed failed: {e}")

            succeeded += 1
        except Exception as e:
            # IMPORTANT: roll back so the next iteration starts from a clean
            # session. Without this, a constraint violation in one org
            # poisons every subsequent operation with "current transaction
            # is aborted" errors.
            db.rollback()
            failed.append((spec["name"], str(e)))
            logger.error(f"    ✗✗ FAILED {spec['name']}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    logger.info("")
    logger.info(f"✅ Demo seed: {succeeded}/{len(DEMOS)} OK")
    if failed:
        logger.warning(f"⚠️  {len(failed)} demo(s) failed:")
        for name, err in failed:
            logger.warning(f"   - {name}: {err}")
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
