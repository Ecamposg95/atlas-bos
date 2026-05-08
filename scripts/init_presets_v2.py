
import sys
import os
import logging

# Add project root to path
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.modules import IndustryPreset, Module, ModuleScope, ModuleStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_presets():
    """
    Initializes ALL standard Industry Presets and Base Modules.
    """
    db = SessionLocal()
    try:
        logger.info("🚀 Initializing Modules & Presets...")

        # 1. Base Modules Catalog
        # ----------------------------------------------------
        # Wave 2: catálogo enfocado a POS multi-sucursal. Removidos
        # `appointments` (solo en SALON/CLINIC/DENTAL — presets eliminados) y
        # `ecommerce` (solo en ECOMMERCE — preset eliminado). Las filas
        # existentes en BD quedan inocuas; este seed solo crea/actualiza.
        modules_catalog = [
            ("core", "Core", "Funcionalidades base del sistema", ModuleScope.GLOBAL),
            ("pos", "Punto de Venta", "Ventas mostrador, caja, cortes", ModuleScope.GLOBAL),
            ("cash_management", "Gestión de Caja", "Cortes de caja, arqueos, control de efectivo", ModuleScope.GLOBAL),
            ("inventory", "Inventario", "Stock, movimientos, kardex", ModuleScope.GLOBAL),
            ("catalog", "Catálogo", "Productos, servicios, listas de precio", ModuleScope.GLOBAL),
            ("branch_catalog_enablement", "Habilitación de Catálogo por Sucursal", "Control de productos disponibles por sucursal", ModuleScope.BRANCH),
            ("returns", "Devoluciones", "Gestión de devoluciones y notas de crédito", ModuleScope.GLOBAL),
            ("pricing", "Precios", "Gestión de precios y listas de precios", ModuleScope.GLOBAL),
            ("promotions", "Promociones", "Descuentos, ofertas y promociones", ModuleScope.GLOBAL),
            ("payments", "Pagos", "Métodos de pago y procesamiento", ModuleScope.GLOBAL),
            ("crm", "CRM / Clientes", "Gestión de clientes, crédito, fidelidad", ModuleScope.GLOBAL),
            ("users", "Usuarios", "Control de acceso y roles", ModuleScope.GLOBAL),
            ("finance", "Finanzas", "Cuentas por cobrar/pagar, gastos", ModuleScope.GLOBAL),
            ("reports", "Reportes", "Inteligencia de negocios básica", ModuleScope.GLOBAL),
            ("quotes", "Cotizaciones", "Generación de presupuestos", ModuleScope.GLOBAL),
            ("workshops", "Taller / Servicio", "Órdenes de servicio y reparación", ModuleScope.GLOBAL),
            ("kitchen", "Cocina / KDS", "Display de cocina para restaurantes", ModuleScope.BRANCH),
            ("tables", "Mesas", "Gestión de plano de mesas", ModuleScope.BRANCH),
            ("logistics", "Logística", "Envíos, rutas, paquetería", ModuleScope.GLOBAL),
            ("manufacturing", "Manufactura", "Producción y ensamblaje", ModuleScope.GLOBAL),
            ("hr", "Recursos Humanos", "Asistencia, nómina básica", ModuleScope.GLOBAL),
        ]

        logger.info("--- Seeding/Updating Modules ---")
        for key, name, desc, scope in modules_catalog:
            mod = db.query(Module).get(key)
            if not mod:
                mod = Module(key=key, name=name, description=desc, scope=scope, status=ModuleStatus.STABLE)
                db.add(mod)
            else:
                mod.name = name
                mod.description = desc
                # mod.scope = scope # Don't override scope blindly if edited
        db.commit()

        # 2. Industry Presets Definition
        # ----------------------------------------------------
        # Modules common to almost everyone
        core_modules = ["users", "catalog", "finance", "reports", "crm"]
        
        # Wave 2: enfoque POS multi-sucursal. Presets de servicios médicos/
        # belleza, e-commerce puro, B2B/manufactura/3PL/professional services
        # eliminados — el producto ya no los soporta. Las filas existentes en
        # `industry_presets` quedan en BD hasta que el operador las depure
        # manualmente; este seed solo upserts. Industrias kept: ATLAS_POS,
        # DISTRIBUTOR_POS, RETAIL_CHAIN, RESTAURANT_*, CAFE_BAKERY,
        # AUTO_REPAIR_SHOP, CUSTOM.
        presets_data = [
            # Retail
            {
                "id": "ATLAS_POS", "name": "Atlas POS",
                "desc": "Punto de venta ligero y de alto rendimiento con gestión completa de inventario, catálogo, precios, promociones y CRM",
                "mods": [
                    "core",
                    "pos",
                    "cash_management",
                    "inventory",
                    "catalog",
                    "branch_catalog_enablement",
                    "returns",
                    "pricing",
                    "promotions",
                    "payments",
                    "crm",
                    "reports"
                ]
            },
            {
                "id": "DISTRIBUTOR_POS", "name": "Distribuidora Mayorista",
                "desc": "Venta por volumen, múltiples listas de precio.",
                "mods": core_modules + ["pos", "inventory", "quotes", "logistics"]
            },
            {
                "id": "RETAIL_CHAIN", "name": "Cadena de Tiendas",
                "desc": "Gestión multi-sucursal centralizada.",
                "mods": core_modules + ["pos", "inventory", "hr", "logistics"]
            },

            # Hospitality
            {
                "id": "RESTAURANT_QSR", "name": "Comida Rápida (QSR)",
                "desc": "Fast food, sin meseros, pantalla de cocina.",
                "mods": core_modules + ["pos", "kitchen", "inventory"]
            },
            {
                "id": "RESTAURANT_FULL", "name": "Restaurante Completo",
                "desc": "Mesas, comanderos, propinas.",
                "mods": core_modules + ["pos", "kitchen", "tables", "inventory", "hr"]
            },
            {
                "id": "CAFE_BAKERY", "name": "Cafetería / Panadería",
                "desc": "Venta ágil + producción ligera.",
                "mods": core_modules + ["pos", "manufacturing", "inventory"]
            },

            # Automotriz
            {
                "id": "AUTO_REPAIR_SHOP", "name": "Taller Mecánico",
                "desc": "Recepción de vehículos, órdenes de servicio.",
                "mods": core_modules + ["workshops", "inventory", "pos"]
            },

            # Genérico
            {
                "id": "CUSTOM", "name": "Personalizado",
                "desc": "Configuración manual desde cero.",
                "mods": core_modules
            },
        ]

        logger.info(f"--- Seeding {len(presets_data)} Industry Presets ---")
        
        for p in presets_data:
            existing = db.query(IndustryPreset).filter(IndustryPreset.industry_type == p["id"]).first()
            if existing:
                existing.display_name = p["name"]
                existing.description = p["desc"]
                existing.modules = p["mods"]
                existing.is_system = True
                logger.info(f"Updated: {p['name']}")
            else:
                new_preset = IndustryPreset(
                    industry_type=p["id"],
                    display_name=p["name"],
                    description=p["desc"],
                    modules=p["mods"],
                    is_system=True
                )
                db.add(new_preset)
                logger.info(f"Created: {p['name']}")
        
        db.commit()
        logger.info("✅ Presets and Modules Initialized Successfully!")

    except Exception as e:
        logger.error(f"❌ Error initializing presets: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_presets()
