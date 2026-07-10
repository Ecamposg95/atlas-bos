# Modelo de Datos · Atlas BOS (73 tablas)

Catálogo de la base de datos por dominio. Fuente: auditoría profunda (julio 2026). Modelos en `app/models/*.py` y `app/modules/*/models.py`.

## Mixins base (`app/models/mixins.py`)

| Mixin | Aporta | Notas |
|---|---|---|
| `UUIDMixin` | `id = String(36)` PK (uuid4) | PK **UUID**. Catálogo (products) y ventas. |
| `AuditMixin` | `created_at`, `updated_at`, `deleted_at` (tz-aware) | `deleted_at` = soft-delete. |
| `TenantMixin` | `organization_id = Integer FK→organization.id` (**nullable**, index) | Scoping multi-tenant. |

**Dos convenciones de PK conviven:** catálogo/ventas usan `id UUID String(36)`; tenancy/usuarios/caja/RRHH/logística/gastro/appointments usan `id Integer`. **Las FKs a IDs UUID (`product_variants.id`, `sales_documents.id`, `parked_tickets.id`, `departments.id`) deben declararse `String(36)`, nunca Integer** (SQLite no lo valida, Postgres crashea en `create_all`).

---

## Organización / Tenancy
| Tabla | PK | Propósito | Enums |
|---|---|---|---|
| `organization` | Int | Tenant root (fiscal, branding, plan SaaS) | `industry_type`=IndustryType |
| `branches` | Int | Sucursal (tienda/HQ/almacén/oficina) | `branch_type`=BranchType |
| `modules` | **String (key)** | Catálogo global de módulos SaaS | `scope`=ModuleScope, `status`=ModuleStatus |
| `organization_modules` | (org_id, module_key) | Habilitación de módulo por org | — |
| `industry_presets` | Int | Preset de módulos por vertical | `industry_type` (String) |

`BranchType`{HQ,STORE,WAREHOUSE,OFFICE} · `ModuleScope`{HQ,BRANCH,WAREHOUSE,GLOBAL} · `ModuleStatus`{BETA,STABLE} · `IndustryType` (~19 valores: ATLAS_POS, DISTRIBUTOR_POS, RETAIL_CHAIN, RESTAURANT_QSR/FULL, CAFE_BAKERY, AUTO_REPAIR_SHOP, WAREHOUSE_LOGISTICS, CUSTOM, familia ATLAS_ONE_* incl. RESTAURANT/CAFE/BAR, varios legacy).

## Usuarios / Auth
| Tabla | PK | Propósito | Enums |
|---|---|---|---|
| `users` | Int | Cuenta login (perfil, FaceID, roles) | `role`=Role, `platform_role`=PlatformRole |
| `user_organizations` | (user_id, org_id) | Membresía M2M user↔org | `org_role` String (ADMIN/MEMBER/OWNER) |

`Role`{ADMINISTRADOR,GERENTE,CAJERO,DUEÑO,VENDEDOR,SOPORTE_OPERATIVO,CLIENTE} · `PlatformRole`{SUPERADMIN,SUPPORT,NONE}. `users` **no** usa TenantMixin (scoping vía `user_organizations`). Ver [`RBAC.md`](RBAC.md).

## Productos / Catálogo (`modules/products/models.py`, PK UUID)
| Tabla | Propósito |
|---|---|
| `departments` | Departamento/categoría |
| `brands` | Marca |
| `uom` | Unidad de medida |
| `products` | Producto padre (approval_status) |
| `product_variants` | SKU vendible (precio, costo, IVA) — UNIQUE `(org, sku) WHERE deleted_at IS NULL` |
| `product_prices` | Precios escalonados por cantidad |
| `packaging_units` | Jerarquía de empaque (caja/pack) |
| `product_branch_status` | Matriz habilitación producto×sucursal — UNIQUE `(variant_id, branch_id)` |

## Inventario (`app/models/inventory.py`)
| Tabla | PK | Propósito | Enums |
|---|---|---|---|
| `inventory_movements` | Int | Kardex de stock | `movement_type`=MovementType |
| `stock_on_hand` | Int | Existencias por sucursal+variante — UNIQUE `(branch, variant)` | — |

`MovementType`{PURCHASE_IN,SALE_OUT,ADJUSTMENT_IN/OUT,TRANSFER_IN/OUT,SALE_RETURN,RECIPE_CONSUMPTION}.

## Ventas / Caja
| Tabla | PK | Propósito | Enums |
|---|---|---|---|
| `sales_documents` | UUID | Venta/cotización/pedido (tip_amount, server_user_id) | `doc_type`=DocumentType, `status`=DocumentStatus |
| `sales_lines` | UUID | Detalle de venta | — |
| `payments` | UUID | Pagos (o abono si doc NULL) | `method`=PaymentMethod |
| `parked_tickets` | UUID | Tickets pausados / cuentas de mesa (cart_json JSONB) | — |
| `cash_sessions` | Int | Turno de caja | `status`=CashSessionStatus |
| `cash_movements` | Int | Entradas/salidas manuales | `type` String (IN/OUT) |
| `cash_audit_log` | Int | Log append-only monetario | `event_type` String |

`DocumentType`{QUOTE,ORDER,INVOICE,RETURN} · `DocumentStatus`{DRAFT,PENDING,PAID,CANCELLED,REFUNDED_PARTIAL,REFUNDED_TOTAL} · `PaymentMethod`{CASH,CARD,TRANSFER,OTHER} · `CashSessionStatus`{OPEN,CLOSED}.

## CRM / Finanzas
| Tabla | PK | Propósito | Enums |
|---|---|---|---|
| `customers` | Int | Cliente (crédito, lealtad) | — |
| `customer_ledger_entries` | Int | Kardex financiero del cliente | — |
| `account_transactions` | Int | Movimientos de cuenta (cargo/pago) | `tx_type`=TransactionType |
| `expenses` | Int | Egresos operativos | `category` String |
| `purchase_orders` | Int | OC a proveedor | `status`=PurchaseOrderStatus |
| `purchase_order_lines` | Int | Línea de OC | — |
| `purchase_recommendations` | UUID | Reorden por bajo stock (abasto) | `status`=RecommendationStatus |

## Devoluciones (`app/models/returns.py`, PK UUID)
`sale_returns` (refund_method=PaymentMethod, status String), `sale_return_items` (reentrada a stock o merma).

## Logística (`app/models/logistics.py`, PK Int)
`container_types`, `box_types`, `product_packagings`, `container_load_calcs`, `inbound_shipments` (status String), `shipment_items`, `transfer_orders` (`TransferStatus`), `transfer_order_lines`, `transfer_fulfillments` (`FulfillmentStatus`), `transfer_fulfillment_lines`.

`TransferStatus`{DRAFT,REQUESTED,PARTIALLY_FULFILLED,COMPLETED,CANCELLED} · `FulfillmentStatus`{PREPARED,SHIPPED,RECEIVED,CANCELLED}.

## RRHH (`app/models/hr.py`, PK Int)
`employees` (fiscal MX, `employee_type`=EmployeeType), `branch_assignments`, `attendances` (`verification_method`=VerificationMethod, `incident_type`=IncidentType).

## Impresión
`print_jobs` (UUID, cola ESC/POS base64, `status`=PrintJobStatus).

## Platform / SaaS (`app/models/platform.py`, PK Int)
`platform_audit_log`, `platform_alert`, `platform_announcement`, `feature_flag`, `org_feature_override` (UNIQUE org+flag), `platform_incident`, `api_key` (SHA-256 hash + prefix). Ver [`API_REFERENCE.md`](API_REFERENCE.md) §platform.

## Outbox / Eventos
`event_outbox` (UUID, `status` String OutboxStatus{PENDING,PROCESSED,FAILED}, ml de reintento/backoff). Índice `ix_event_outbox_due (status, available_at)`. Ver [`ARCHITECTURE.md`](ARCHITECTURE.md) §3.

## Gastro
| Módulo | Tablas | Enums |
|---|---|---|
| **tables** | `dining_areas`, `dining_tables` (current_ticket_id→parked_tickets, server_user_id) | `TableStatus`{AVAILABLE,OCCUPIED,BILL_REQUESTED,CLEANING,RESERVED} |
| **kitchen** | `kitchen_stations`, `kitchen_routes` (dept→estación, UNIQUE branch+dept), `kitchen_tickets`, `kitchen_ticket_items` | `KdsStatus`{NEW,IN_PROGRESS,READY,SERVED,CANCELED}, `ItemStatus`{PENDING,PREPARING,READY,SERVED,VOIDED} |
| **recipes** | `recipes` (product_variant_id UNIQUE), `recipe_ingredients` | — |
| **bar** | `bar_bottles` (`BottleStatus`{OPEN,EMPTY,ARCHIVED}), `bar_bottle_events` (ledger: ml_change firmado) | `BarEventType`{OPEN,POUR,WASTE,REFILL} |

## Appointments (`modules/appointments/models.py`, PK Int)
`appointments_resources` (`ResourceType`), `appointments_professionals` (1:1 user), `appointments_schedules` (UNIQUE prof+weekday), `appointments_blocks`, `appointments_services` (1:1 variant), `appointments` (`AppointmentStatus`, `BookingChannel`), `appointments_services_link`, `appointments_events` (`AppointmentEventType`).

`ResourceType`{CHAIR,CABIN,CONSULTORY,BAY,TABLE} · `AppointmentStatus`{PENDING,CONFIRMED,IN_PROGRESS,COMPLETED,CANCELED,NO_SHOW} · `BookingChannel`{STAFF,PORTAL}.

---

## ⚠️ Gotchas de esquema

**A) FKs a IDs UUID = `String(36)`.** Cualquier tabla con `id` Integer que referencie `product_variants.id`, `sales_documents.id`, `parked_tickets.id` o `departments.id` (todos UUID) **debe** usar `String(36)`. Verificado correcto en todo el esquema actual; respetarlo en tablas nuevas.

**B) Columnas RAW añadidas por `scripts/railway_init.py` — NO están en el ORM** (se leen defensivamente vía `setattr`/SQL crudo). Documentarlas aunque no aparezcan en los modelos:
- `parked_tickets.status VARCHAR(16) DEFAULT 'ACTIVE'` (ACTIVE→CONVERTED/CANCELLED) — usada por tables/services y el subscriber.
- `parked_tickets.converted_to_sale_id VARCHAR(36) → sales_documents.id` — seteada en checkout.
- `sales_documents.global_discount_pct NUMERIC(5,2)` — descuento global.
- `branches.printer_cols INTEGER` — en DDL raw, no en el modelo Branch.

**C) Tablas SIN tenant scoping** (ni TenantMixin ni FK org): `cash_movements`, `event_outbox`, `branch_assignments`, `attendances`, `purchase_order_lines`. `cash_audit_log` tiene `organization_id` Integer manual **sin FK**. El scoping depende de joins con la tabla padre.

**D) `organization_id` inconsistente:** TenantMixin lo hace nullable; los módulos gastro/appointments/tables lo declaran FK manual **NOT NULL** (más estricto). No hay patrón único.

**E) Enums-como-String sin validación DB:** `inbound_shipments.status`, `sale_returns.status`, `cash_movements.type`, `bar_bottle_events.event_type`, `event_outbox.status` son columnas `String` con valores tipo-enum (elegido a propósito para evitar migraciones de enum Postgres).

**F) Divergencias ORM↔DB:** `payments.sales_document_id` es `nullable=True` en el ORM pero railway_init lo fuerza a NOT NULL en prod. `CashSessionStatus` está definido dos veces (sales.py y cash.py). `event_outbox` usa `datetime.utcnow` **naive** (el resto usa tz-aware). `IndustryPreset` existe en el ORM pero no se exporta en `app/models/__init__.py` (se crea vía create_all porque comparte metadata).

**Conteo:** 73 tablas (41 en `app/models/*` + 32 en `app/modules/*/models.py`).
