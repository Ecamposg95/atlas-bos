from typing import List, Dict
from app.models.users import Role

# Module keys (matching capabilities_service.py).
# Wave 2: removidos clinical, services, sales_pipeline, purchasing,
# fulfillment, pm, documents (verticals no-POS).
MOD_CORE = "core"
MOD_REPORTS = "reports"
MOD_POS = "pos"
MOD_WAREHOUSE = "warehouse"
MOD_QUOTES = "quotes"
MOD_APPOINTMENTS = "appointments"

MOD_CRM = "crm"
MOD_CUSTOMER_PORTAL = "customer_portal"
MOD_INVOICING = "invoicing"
MOD_PAYMENTS = "payments"
MOD_CASH = "cash_management"
MOD_RETURNS = "returns"
MOD_PRICING = "pricing"
MOD_PROMOTIONS = "promotions"
MOD_CATALOG = "catalog"
MOD_BRANCH_CATALOG = "branch_catalog_enablement"
MOD_INVENTORY = "inventory"
MOD_WORK_ORDERS = "work_orders"
MOD_KDS = "kds"
MOD_TABLES = "tables"
MOD_MENU = "menu"

NAV_REGISTRY = [
    # --- HQ CONTEXT ---
    {
        "key": "dashboard_hq",
        "label": "Command Center",
        "href": "/command-center",
        "icon": "fas fa-tachometer-alt",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "org_management",
        "label": "Organization",
        "href": "/organization",
        "icon": "fas fa-building",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    {
        "key": "user_identities",
        "label": "Global Identities",
        "href": "/users",
        "icon": "fas fa-id-badge",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    {
        "key": "catalog_master",
        "label": "Catalog Master",
        "href": "/products",
        "icon": "fas fa-cubes",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "hq_inventory",
        "label": "Global Stock",
        "href": "/hq/inventory",
        "icon": "fas fa-globe",
        "context": "HQ",
        "required_module": MOD_INVENTORY,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "crm_hq",
        "label": "CRM & Customers",
        "href": "/customers",
        "icon": "fas fa-user-friends",
        "context": "HQ",
        "required_module": MOD_CRM,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO, Role.GERENTE]
    },
    {
        "key": "logistics",
        "label": "Logistics & Cargo",
        "href": "/logistics",
        "icon": "fas fa-truck-loading",
        "context": "HQ",
        "required_module": MOD_WAREHOUSE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "hq_reports",
        "label": "Reportes HQ",
        "href": "/hq/reports",
        "icon": "fas fa-chart-line",
        "context": "HQ",
        "required_module": MOD_REPORTS,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO, Role.GERENTE]
    },
    {
        "key": "hq_brands_master",
        "label": "Marcas",
        "href": "/brands",
        "icon": "fas fa-trademark",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    {
        "key": "hq_purchases",
        "label": "Purchases",
        "href": "/purchases",
        "icon": "fas fa-shopping-cart",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "hq_expenses",
        "label": "Expenses",
        "href": "/expenses",
        "icon": "fas fa-coins",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    
    {
        "key": "hq_branches",
        "label": "Branch Registry",
        "href": "/hq/branches",
        "icon": "fas fa-network-wired",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    {
        "key": "hq_products_master",
        "label": "Branch Catalogs",
        "href": "/admin/catalog",
        "icon": "fas fa-list-check",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    {
        "key": "hq_seguimiento",
        "label": "Invoicing Pipeline",
        "href": "/seguimiento",
        "icon": "fas fa-file-invoice",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "hq_cash",
        "label": "Cash Cuts",
        "href": "/cash-history",
        "icon": "fas fa-money-bill-wave",
        "context": "HQ",
        "required_module": MOD_CASH,
        "roles_allowed": [Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "hq_hr",
        "label": "Human Resources",
        "href": "/hr",
        "icon": "fas fa-users-cog",
        "context": "HQ",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.ADMINISTRADOR]
    },
    
    # --- BRANCH/POS CONTEXT ---
    {
        "key": "pos_dashboard",
        "label": "INICIO",
        "href": "/index",
        "icon": "fas fa-home",
        "context": "BRANCH",
        "required_module": MOD_CORE,
        "roles_allowed": [Role.GERENTE, Role.CAJERO]
    },
    {
        "key": "pos_new",
        "label": "NUEVA VENTA",
        "href": "/pos",
        "icon": "fas fa-plus-circle",
        "context": "BRANCH",
        "required_module": MOD_POS,
        "roles_allowed": [Role.GERENTE, Role.CAJERO]
    },
    {
        "key": "pos_sales",
        "label": "MIS TICKETS",
        "href": "/sales",
        "icon": "fas fa-receipt",
        "context": "BRANCH",
        "required_module": MOD_POS,
        "roles_allowed": [Role.GERENTE, Role.CAJERO, Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "pos_returns",
        "label": "DEVOLUCIONES",
        "href": "/returns",
        "icon": "fas fa-undo",
        "context": "BRANCH",
        "required_module": MOD_POS,
        "roles_allowed": [Role.GERENTE, Role.CAJERO, Role.ADMINISTRADOR, Role.DUEÑO]
    },
    {
        "key": "pos_cash",
        "label": "CIERRE DE CAJA",
        "href": "/cash-history",
        "icon": "fas fa-vault",
        "context": "BRANCH",
        "required_module": MOD_POS,
        "roles_allowed": [Role.GERENTE, Role.CAJERO]
    },
    {
        "key": "pos_customers",
        "label": "CLIENTES",
        "href": "/customers",
        "icon": "fas fa-user-friends",
        "context": "BRANCH",
        "required_module": MOD_CRM,
        "roles_allowed": [Role.GERENTE, Role.CAJERO]
    },
    {
        "key": "pos_tables",
        "label": "MESAS / COMANDAS",
        "href": "/pos/tables",
        "icon": "fas fa-chair",
        "context": "BRANCH",
        "required_module": MOD_TABLES,
        "roles_allowed": [Role.GERENTE, Role.CAJERO]
    },
    {
        "key": "pos_kds",
        "label": "COCINA (KDS)",
        "href": "/pos/kds",
        "icon": "fas fa-utensils",
        "context": "BRANCH",
        "required_module": MOD_KDS,
        "roles_allowed": [Role.GERENTE, Role.SOPORTE_OPERATIVO]
    },
    {
        "key": "pos_work_orders",
        "label": "ÓRDENES DE SERVICIO",
        "href": "/service/orders",
        "icon": "fas fa-tools",
        "context": "BRANCH",
        "required_module": MOD_WORK_ORDERS,
        "roles_allowed": [Role.GERENTE, Role.SOPORTE_OPERATIVO]
    },
    
    # --- WAREHOUSE CONTEXT ---
    {
        "key": "wh_dashboard",
        "label": "Warehouse Console",
        "href": "/warehouse/dashboard",
        "icon": "fas fa-warehouse",
        "context": "WAREHOUSE",
        "required_module": MOD_WAREHOUSE,
        "roles_allowed": [Role.SOPORTE_OPERATIVO, Role.ADMINISTRADOR]
    },
    {
        "key": "wh_stock",
        "label": "STOCK ACTUAL",
        "href": "/inventory",
        "icon": "fas fa-barcode",
        "context": "WAREHOUSE",
        "required_module": MOD_INVENTORY,
        "roles_allowed": [Role.SOPORTE_OPERATIVO, Role.ADMINISTRADOR]
    },
    {
        "key": "wh_logistics",
        "label": "RECIBO & CARGA",
        "href": "/logistics",
        "icon": "fas fa-box-open",
        "context": "WAREHOUSE",
        "required_module": MOD_WAREHOUSE,
        "roles_allowed": [Role.SOPORTE_OPERATIVO, Role.ADMINISTRADOR]
    },
    {
        "key": "wh_boxes",
        "label": "EMBALAJES",
        "href": "/boxes",
        "icon": "fas fa-pallet",
        "context": "WAREHOUSE",
        "required_module": MOD_WAREHOUSE,
        "roles_allowed": [Role.SOPORTE_OPERATIVO, Role.ADMINISTRADOR]
    }
]

def get_nav_for_context(context: str, enabled_modules: list, user_role: str):
    """
    Filters the nav registry based on current context, enabled modules, and user roles.
    """
    filtered = []
    for item in NAV_REGISTRY:
        if item["context"] != context:
            continue
            
        if item["required_module"] not in enabled_modules:
            continue
            
        if user_role not in [r.value for r in item["roles_allowed"]]:
            continue
            
        filtered.append(item)
    return filtered
