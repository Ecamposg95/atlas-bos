"""
seed_pos_products.py
Llena la org QA con productos realistas y completos para pruebas de POS:
  - Precios escalonados: Menudeo (base), Mayoreo, Distribuidor
  - Unidades de empaque: Caja / Six-Pack / Master según aplique
  - IVA en una fracción de productos
  - Barcodes EAN-13-like
  - Stock en todas las sucursales de QA
  - Imágenes públicas de Unsplash para que se vean las cards

Uso:
    python scripts/seed_pos_products.py
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from app.core.database import SessionLocal
from app.models.organization import Organization, Branch, BranchType
from app.models.products import (
    Department, Brand, Product, ProductVariant,
    ProductPrice, PackagingUnit, ProductBranchStatus
)
from app.models.inventory import StockOnHand, InventoryMovement, MovementType

# ---------------------------------------------------------------------------
# Catálogo de productos de prueba
# Cada entrada: (nombre, dept, brand, precio_base, costo, has_iva, barcode_prefix,
#                [(precio_name, min_qty, factor)],          # precios escalonados
#                [(pack_name, units, price_factor, barcode_suffix)] o []  # empaques
#                imagen_url)
# ---------------------------------------------------------------------------
CATALOG = [
    # ── Bebidas ───────────────────────────────────────────────────────────
    # pack_units: (nombre, unidades, factor_precio) — factor se aplica sobre precio_base
    # El precio de caja se alinea con el tier "Caja" o "Mayoreo" según corresponda
    (
        "Coca-Cola 600ml", "Bebidas", "Coca-Cola", 18.00, 10.00, True,
        "7501055",
        [("Mayoreo", 24, 0.88), ("Caja", 96, 0.78)],
        [("Six-Pack", 6, 0.88), ("Caja", 24, 0.78)],   # Six-Pack=Mayoreo, Caja=tier Caja
        "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400"
    ),
    (
        "Agua Bonafont 1.5L", "Bebidas", "Bonafont", 14.00, 7.50, False,
        "7501050",
        [("Mayoreo", 12, 0.90), ("Caja", 48, 0.82)],
        [("Pack ×12", 12, 0.82)],
        "https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400"
    ),
    (
        "Jugo Del Valle 1L Naranja", "Bebidas", "Del Valle", 22.00, 13.00, True,
        "7501234",
        [("Mayoreo", 12, 0.87), ("Caja", 36, 0.76)],
        [("Caja ×12", 12, 0.76)],
        "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400"
    ),
    (
        "Monster Energy 473ml", "Bebidas", "Monster", 38.00, 22.00, True,
        "7503021",
        [("Mayoreo", 12, 0.86), ("Caja", 24, 0.78)],
        [("Caja ×24", 24, 0.78)],
        "https://images.unsplash.com/photo-1635700903700-3f36c4b6f327?w=400"
    ),
    (
        "Leche Lala Entera 1L", "Lácteos", "Lala", 26.00, 16.00, False,
        "7500630",
        [("Mayoreo", 12, 0.91)],
        [("Caja ×12", 12, 0.91)],
        "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400"
    ),

    # ── Snacks ────────────────────────────────────────────────────────────
    (
        "Sabritas Originales 45g", "Snacks", "Sabritas", 15.00, 8.50, False,
        "7501030",
        [("Mayoreo", 24, 0.87), ("Caja", 72, 0.79)],
        [("Caja ×24", 24, 0.79)],
        "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400"
    ),
    (
        "Doritos Nachos 50g", "Snacks", "Sabritas", 16.00, 9.00, False,
        "7501031",
        [("Mayoreo", 24, 0.87), ("Caja", 72, 0.79)],
        [("Caja ×24", 24, 0.79)],
        "https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=400"
    ),
    (
        "Gansito Marinela", "Panificación", "Marinela", 18.00, 10.50, False,
        "7500362",
        [("Mayoreo", 12, 0.89)],
        [("Caja ×12", 12, 0.89)],
        "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400"
    ),
    (
        "Palomitas Totis 80g", "Snacks", "Totis", 19.00, 11.00, False,
        "7503102",
        [("Mayoreo", 12, 0.88), ("Caja", 48, 0.80)],
        [],
        "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?w=400"
    ),

    # ── Higiene ───────────────────────────────────────────────────────────
    (
        "Jabón Dove 135g", "Higiene", "Dove", 28.00, 15.00, True,
        "7501801",
        [("Mayoreo", 12, 0.88), ("Caja", 48, 0.80)],
        [("Caja ×12", 12, 0.80)],
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400"
    ),
    (
        "Shampoo Pantene 400ml", "Higiene", "Pantene", 89.00, 52.00, True,
        "7501840",
        [("Mayoreo", 6, 0.90), ("Caja", 24, 0.82)],
        [],
        "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400"
    ),
    (
        "Pasta Colgate Triple 75ml", "Higiene", "Colgate", 35.00, 20.00, True,
        "7509546",
        [("Mayoreo", 12, 0.87)],
        [("Caja ×12", 12, 0.87)],
        "https://images.unsplash.com/photo-1559591935-c42e4d6ece35?w=400"
    ),
    (
        "Papel Higiénico Kleenex ×4", "Limpieza", "Kleenex", 42.00, 25.00, True,
        "7501540",
        [("Mayoreo", 12, 0.88), ("Caja", 36, 0.80)],
        [("Master ×12", 12, 0.80)],
        "https://images.unsplash.com/photo-1584737459426-33bfef2e5b25?w=400"
    ),

    # ── Abarrotes ─────────────────────────────────────────────────────────
    (
        "Aceite Nutrioli 900ml", "Abarrotes", "Nutrioli", 58.00, 36.00, False,
        "7501062",
        [("Mayoreo", 12, 0.91)],
        [("Caja ×12", 12, 0.91)],
        "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400"
    ),
    (
        "Arroz SOS 1kg", "Abarrotes", "SOS", 30.00, 18.00, False,
        "7501070",
        [("Mayoreo", 20, 0.90), ("Caja", 60, 0.83)],
        [("Costal ×20", 20, 0.83)],
        "https://images.unsplash.com/photo-1568347877321-f8935e334f52?w=400"
    ),
    (
        "Frijol Peruano La Sierra 1kg", "Abarrotes", "La Sierra", 27.00, 15.00, False,
        "7501088",
        [("Mayoreo", 20, 0.90)],
        [],
        "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=400"
    ),
    (
        "Atún Dolores 140g", "Abarrotes", "Dolores", 21.00, 12.00, False,
        "7501090",
        [("Mayoreo", 24, 0.87), ("Caja", 96, 0.79)],
        [("Caja ×24", 24, 0.79)],
        "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400"
    ),

    # ── Electrónica ───────────────────────────────────────────────────────
    (
        "Foco LED 9W Philips", "Electrónica", "Philips", 65.00, 38.00, True,
        "7694558",
        [("Mayoreo", 10, 0.88), ("Caja", 50, 0.78)],
        [("Caja ×10", 10, 0.78)],
        "https://images.unsplash.com/photo-1563461660947-507ef49e9c47?w=400"
    ),
    (
        "Pila Duracell AA ×2", "Electrónica", "Duracell", 32.00, 18.00, True,
        "7622400",
        [("Mayoreo", 12, 0.87), ("Caja", 48, 0.79)],
        [("Blister ×12", 12, 0.79)],
        "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400"
    ),
    (
        "Cable USB-C 1m Genérico", "Electrónica", "Genérico", 120.00, 55.00, True,
        "6901234",
        [("Mayoreo", 10, 0.85), ("Caja", 50, 0.75)],
        [],
        "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400"
    ),
]

# Mapeo de brand -> marca ya existente o nueva
BRAND_REMAP = {
    "Coca-Cola": "Coca-Cola",
    "Bonafont": "Bonafont",
    "Del Valle": "Del Valle",
    "Monster": "Monster",
    "Lala": "Lala",
    "Sabritas": "Sabritas",
    "Marinela": "Marinela",
    "Totis": "Totis",
    "Dove": "Dove",
    "Pantene": "Pantene",
    "Colgate": "Colgate",
    "Kleenex": "Kleenex",
    "Nutrioli": "Nutrioli",
    "SOS": "SOS",
    "La Sierra": "La Sierra",
    "Dolores": "Dolores",
    "Philips": "Philips",
    "Duracell": "Duracell",
    "Genérico": "Genérico",
}

DEPT_NAMES = [
    "Bebidas", "Snacks", "Panificación", "Lácteos",
    "Higiene", "Limpieza", "Abarrotes", "Electrónica"
]


def run():
    db = SessionLocal()
    try:
        # ── 1. Org QA ────────────────────────────────────────────────────
        org = db.query(Organization).filter_by(name="QA").first()
        if not org:
            print("❌  No se encontró la organización QA. Ejecuta primero scripts/init_users.py")
            return

        branches = db.query(Branch).filter_by(organization_id=org.id).all()
        if not branches:
            print("❌  No hay sucursales en QA. Ejecuta primero scripts/init_users.py")
            return
        print(f"✅  Org QA — {len(branches)} sucursales encontradas")

        # ── 2. Departamentos ─────────────────────────────────────────────
        dept_map: dict[str, Department] = {}
        for name in DEPT_NAMES:
            dept = db.query(Department).filter_by(name=name, organization_id=org.id).first()
            if not dept:
                dept = Department(name=name, organization_id=org.id)
                db.add(dept)
                db.flush()
            dept_map[name] = dept
        print(f"✅  {len(dept_map)} departamentos listos")

        # ── 3. Marcas ────────────────────────────────────────────────────
        brand_map: dict[str, Brand] = {}
        for brand_name in set(BRAND_REMAP.values()):
            brand = db.query(Brand).filter_by(name=brand_name, organization_id=org.id).first()
            if not brand:
                brand = Brand(name=brand_name, organization_id=org.id)
                db.add(brand)
                db.flush()
            brand_map[brand_name] = brand
        print(f"✅  {len(brand_map)} marcas listas")

        # ── 4. Productos ─────────────────────────────────────────────────
        created = 0
        skipped = 0

        for idx, (
            p_name, dept_name, brand_name, base_price, cost,
            has_iva, barcode_prefix, tier_prices, pack_units, image_url
        ) in enumerate(CATALOG, start=1):

            # Verificar si ya existe
            existing = db.query(Product).filter_by(name=p_name, organization_id=org.id).first()
            if existing:
                skipped += 1
                continue

            dept = dept_map.get(dept_name)
            brand = brand_map.get(brand_name)

            # Producto padre
            prod = Product(
                name=p_name,
                description=f"Producto de prueba — {p_name}",
                unit="PZA",
                image_url=image_url,
                department_id=dept.id if dept else None,
                brand_id=brand.id if brand else None,
                has_variants=False,
                is_active=True,
                organization_id=org.id,
                approval_status="APPROVED",
            )
            db.add(prod)
            db.flush()

            # SKU simple
            sku = f"POS-{idx:03d}"
            barcode = f"{barcode_prefix}{idx:04d}0"  # EAN-like

            # Variante estándar
            variant = ProductVariant(
                product_id=prod.id,
                sku=sku,
                barcode=barcode,
                variant_name="Estándar",
                price=Decimal(str(base_price)),
                cost=Decimal(str(cost)),
                has_iva=has_iva,
                tax_rate=Decimal("16.00") if has_iva else Decimal("0.00"),
                organization_id=org.id,
            )
            db.add(variant)
            db.flush()

            # Precios escalonados
            for price_name, min_qty, factor in tier_prices:
                db.add(ProductPrice(
                    variant_id=variant.id,
                    price_name=price_name,
                    min_quantity=Decimal(str(min_qty)),
                    unit_price=Decimal(str(round(base_price * factor, 2))),
                    organization_id=org.id,
                ))

            # Unidades de empaque (PackagingUnit)
            # price_factor es el factor del tier a usar (e.g. 0.78 para Caja, 0.88 para Mayoreo)
            # package_price = units × (base_price × price_factor) = precio al tier correspondiente
            for pack_name, units, price_factor, *extra_barcode in pack_units:
                pack_barcode = f"{barcode_prefix}9{idx:03d}0" if not extra_barcode else f"{barcode_prefix}9{idx:03d}0"
                db.add(PackagingUnit(
                    variant_id=variant.id,
                    name=pack_name,
                    barcode=pack_barcode,
                    units_per_package=Decimal(str(units)),
                    package_price=Decimal(str(round(units * base_price * price_factor, 2))),
                    organization_id=org.id,
                ))

            # Habilitación y stock por sucursal
            for branch in branches:
                # ProductBranchStatus
                db.add(ProductBranchStatus(
                    variant_id=variant.id,
                    branch_id=branch.id,
                    is_active_pos=True,
                    is_active_hq=True,
                    is_visible=True,
                    organization_id=org.id,
                ))

                # Stock
                qty = 200 if branch.branch_type == BranchType.WAREHOUSE else 50
                stock = StockOnHand(
                    branch_id=branch.id,
                    variant_id=variant.id,
                    qty_on_hand=qty,
                    organization_id=org.id,
                )
                db.add(stock)

                db.add(InventoryMovement(
                    branch_id=branch.id,
                    variant_id=variant.id,
                    movement_type=MovementType.ADJUSTMENT_IN,
                    qty_change=qty,
                    qty_before=0,
                    qty_after=qty,
                    reference="SEED-POS",
                    organization_id=org.id,
                ))

            created += 1
            print(f"   + {p_name} (SKU {sku}, {len(tier_prices)} precios, {len(pack_units)} empaques)")

        db.commit()
        print(f"\n✅  Seeding completado: {created} creados, {skipped} ya existían")

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"\n❌  Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
