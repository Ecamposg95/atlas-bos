-- Wave 2 BD audit — verifica si alguna org está usando industries/módulos
-- removidos del código antes de hacer cleanup en BD (Phase B futuro).
--
-- Ejecutar contra la BD del ambiente (qa primero) ANTES de cualquier
-- migración que borre rows de `industry_presets`, `modules`, o intente
-- alterar el enum `industrytype`. Si cualquier query devuelve filas, NO
-- proceder con el cleanup BD hasta migrar los rows afectados.
--
-- Uso:
--   psql $QA_DATABASE_URL -f scripts/audit_wave2_dropped_verticals.sql
--
-- Industries droppadas (Wave 2): SALON, CLINIC, DENTAL, PROFESSIONAL_SERVICES,
-- ECOMMERCE, WHOLESALE_B2B, FLEET_SERVICE, SALES_DISTRIBUTION, B2B_ENTERPRISE,
-- WAREHOUSE_LOGISTICS, MANUFACTURING_LIGHT.
--
-- Módulos droppados: clinical, services, sales_pipeline, purchasing,
-- fulfillment, pm, documents, appointments (solo de init_presets_v2),
-- ecommerce.

\echo '=== 1. Orgs con industry_type droppado ==='
SELECT id, name, industry_type, created_at
FROM organization
WHERE industry_type IN (
    'SALON', 'CLINIC', 'DENTAL', 'PROFESSIONAL_SERVICES',
    'ECOMMERCE', 'WHOLESALE_B2B', 'FLEET_SERVICE',
    'SALES_DISTRIBUTION', 'B2B_ENTERPRISE',
    'WAREHOUSE_LOGISTICS', 'MANUFACTURING_LIGHT'
)
ORDER BY id;

\echo ''
\echo '=== 2. Orgs con módulos droppados habilitados ==='
SELECT
    om.organization_id,
    o.name AS org_name,
    o.industry_type,
    om.module_key,
    om.is_enabled
FROM organization_modules om
JOIN organization o ON o.id = om.organization_id
WHERE om.is_enabled = true
  AND om.module_key IN (
    'clinical', 'services', 'sales_pipeline', 'purchasing',
    'fulfillment', 'pm', 'documents', 'ecommerce'
  )
ORDER BY om.organization_id, om.module_key;

\echo ''
\echo '=== 3. industry_presets con industries droppadas ==='
SELECT industry_type, display_name, is_system, jsonb_array_length(modules::jsonb) AS module_count
FROM industry_presets
WHERE industry_type IN (
    'SALON', 'CLINIC', 'DENTAL', 'PROFESSIONAL_SERVICES',
    'ECOMMERCE', 'WHOLESALE_B2B', 'FLEET_SERVICE',
    'SALES_DISTRIBUTION', 'B2B_ENTERPRISE',
    'WAREHOUSE_LOGISTICS', 'MANUFACTURING_LIGHT'
)
ORDER BY industry_type;

\echo ''
\echo '=== 4. modules droppados aún en catálogo ==='
SELECT key, name, scope, status
FROM modules
WHERE key IN (
    'clinical', 'services', 'sales_pipeline', 'purchasing',
    'fulfillment', 'pm', 'documents', 'ecommerce'
)
ORDER BY key;

\echo ''
\echo '=== Resumen ==='
\echo 'Si todas las queries devuelven 0 filas → safe para Phase B (BD cleanup).'
\echo 'Si alguna query devuelve filas → migrar antes:'
\echo '  - Industries droppadas: UPDATE organization SET industry_type = NULL'
\echo '    (o reasignar a CUSTOM/ATLAS_POS según el caso).'
\echo '  - Módulos habilitados: UPDATE organization_modules SET is_enabled = false'
\echo '    o DELETE FROM organization_modules para esos rows.'
\echo '  - industry_presets/modules rows: DELETE manual tras lo anterior.'
