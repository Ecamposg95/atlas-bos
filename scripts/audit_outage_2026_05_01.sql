-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT: Outage 2026-05-01 (mapper corrupto Payment)
-- ─────────────────────────────────────────────────────────────────────────────
-- Contexto: PR2 (dc97662) importó Payment desde app.models.payments (módulo
-- legacy con relationship('Branch') roto). Cualquier query que tocara Payment
-- fallaba al inicializar mappers → create_sale, print, reprint, payment-methods.
-- Hotfix: fc667ef cambió el import a app.models.sales.
--
-- Ventana sospechosa (UTC): 2026-05-01 16:30 → 2026-05-02 01:30 UTC
--                           (≈ 10:30 → 19:30 CST del 2026-05-01)
-- Worker Railway puede haberse "infectado" con mapper corrupto en distintos
-- momentos según qué worker recibió primero el call al dashboard.
--
-- Cómo correr: psql $DATABASE_URL -f scripts/audit_outage_2026_05_01.sql
-- ─────────────────────────────────────────────────────────────────────────────

\set OUTAGE_START '2026-05-01 16:30:00+00'
\set OUTAGE_END   '2026-05-02 01:30:00+00'

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  1. Sesiones de caja CERRADAS hoy con DIFFERENCE != 0'
\echo '════════════════════════════════════════════════════════════════════════'

SELECT
    cs.id                  AS session_id,
    cs.branch_id,
    b.name                 AS branch_name,
    cs.user_id,
    u.username             AS cashier,
    cs.opened_at AT TIME ZONE 'America/Mexico_City'  AS opened_mx,
    cs.closed_at AT TIME ZONE 'America/Mexico_City'  AS closed_mx,
    cs.opening_balance,
    cs.closing_balance,
    cs.difference,
    CASE
        WHEN cs.difference > 0 THEN '[+] SOBRANTE'
        WHEN cs.difference < 0 THEN '[-] FALTANTE'
    END AS tipo
FROM cash_sessions cs
LEFT JOIN branches b ON b.id = cs.branch_id
LEFT JOIN users u    ON u.id = cs.user_id
WHERE cs.status = 'CLOSED'
  AND cs.closed_at >= :'OUTAGE_START'
  AND cs.difference IS NOT NULL
  AND cs.difference != 0
ORDER BY cs.closed_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  2. Sesiones aún OPEN con actividad en la ventana del outage'
\echo '════════════════════════════════════════════════════════════════════════'

SELECT
    cs.id        AS session_id,
    cs.branch_id,
    b.name       AS branch_name,
    u.username   AS cashier,
    cs.opened_at AT TIME ZONE 'America/Mexico_City' AS opened_mx,
    (SELECT COUNT(*) FROM sales_documents sd
       WHERE sd.cash_session_id = cs.id) AS sales_count
FROM cash_sessions cs
LEFT JOIN branches b ON b.id = cs.branch_id
LEFT JOIN users u    ON u.id = cs.user_id
WHERE cs.status = 'OPEN'
  AND cs.opened_at <= :'OUTAGE_END'
ORDER BY cs.opened_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  3. SalesDocument PAID SIN ningún Payment asociado'
\echo '     (huérfanos: la venta se persistió pero los Payment no llegaron)'
\echo '════════════════════════════════════════════════════════════════════════'

SELECT
    sd.id           AS sale_id,
    sd.series || '-' || sd.folio AS folio,
    sd.branch_id,
    b.name          AS branch_name,
    sd.seller_id,
    u.username      AS cashier,
    sd.created_at AT TIME ZONE 'America/Mexico_City' AS created_mx,
    sd.total_amount,
    sd.status,
    sd.cash_session_id
FROM sales_documents sd
LEFT JOIN branches b ON b.id = sd.branch_id
LEFT JOIN users u    ON u.id = sd.seller_id
WHERE sd.status = 'PAID'
  AND sd.created_at >= :'OUTAGE_START'
  AND sd.created_at <= :'OUTAGE_END'
  AND NOT EXISTS (
      SELECT 1 FROM payments p WHERE p.sales_document_id = sd.id
  )
ORDER BY sd.created_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  4. SalesDocument PENDING creados en la ventana'
\echo '     (cajero pudo cobrar al cliente y la venta quedó como crédito sin querer)'
\echo '════════════════════════════════════════════════════════════════════════'

SELECT
    sd.id           AS sale_id,
    sd.series || '-' || sd.folio AS folio,
    sd.branch_id,
    b.name          AS branch_name,
    u.username      AS cashier,
    sd.created_at AT TIME ZONE 'America/Mexico_City' AS created_mx,
    sd.total_amount,
    sd.customer_id,
    sd.customer_name,
    (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
       WHERE p.sales_document_id = sd.id) AS paid_amount
FROM sales_documents sd
LEFT JOIN branches b ON b.id = sd.branch_id
LEFT JOIN users u    ON u.id = sd.seller_id
WHERE sd.status = 'PENDING'
  AND sd.created_at >= :'OUTAGE_START'
  AND sd.created_at <= :'OUTAGE_END'
ORDER BY sd.created_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  5. POSIBLES DUPLICADOS: mismo branch + cashier + monto en <60s'
\echo '════════════════════════════════════════════════════════════════════════'

WITH ranked AS (
    SELECT
        sd.id, sd.series, sd.folio, sd.branch_id, sd.seller_id,
        sd.total_amount, sd.created_at, sd.customer_id,
        LAG(sd.created_at) OVER (
            PARTITION BY sd.branch_id, sd.seller_id, sd.total_amount
            ORDER BY sd.created_at
        ) AS prev_created
    FROM sales_documents sd
    WHERE sd.created_at >= :'OUTAGE_START'
      AND sd.created_at <= :'OUTAGE_END'
      AND sd.status IN ('PAID', 'PENDING')
)
SELECT
    r.id           AS sale_id,
    r.series || '-' || r.folio AS folio,
    r.branch_id,
    b.name         AS branch_name,
    u.username     AS cashier,
    r.created_at AT TIME ZONE 'America/Mexico_City' AS created_mx,
    r.total_amount,
    EXTRACT(EPOCH FROM (r.created_at - r.prev_created))::INT AS sec_since_prev
FROM ranked r
LEFT JOIN branches b ON b.id = r.branch_id
LEFT JOIN users u    ON u.id = r.seller_id
WHERE r.prev_created IS NOT NULL
  AND r.created_at - r.prev_created < INTERVAL '60 seconds'
ORDER BY r.created_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  6. Por sesión cerrada con diff: desglose esperado vs realidad'
\echo '════════════════════════════════════════════════════════════════════════'

WITH affected_sessions AS (
    SELECT cs.id
    FROM cash_sessions cs
    WHERE cs.status = 'CLOSED'
      AND cs.closed_at >= :'OUTAGE_START'
      AND cs.difference IS NOT NULL
      AND cs.difference != 0
)
SELECT
    cs.id                        AS session_id,
    u.username                   AS cashier,
    b.name                       AS branch_name,
    cs.opening_balance,
    cs.closing_balance,
    cs.difference                AS diff_reportado,
    -- Recuento crudo de payments CASH para esta sesión
    COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        JOIN sales_documents sd ON sd.id = p.sales_document_id
        WHERE p.method = 'CASH'
          AND sd.status = 'PAID'
          AND (sd.cash_session_id = cs.id
               OR (sd.cash_session_id IS NULL
                   AND sd.seller_id = cs.user_id
                   AND sd.branch_id = cs.branch_id
                   AND sd.created_at BETWEEN cs.opened_at AND COALESCE(cs.closed_at, NOW())))
    ), 0)                        AS gross_cash_db,
    -- change_given total (Track 1)
    COALESCE((
        SELECT SUM(sd.change_given)
        FROM sales_documents sd
        WHERE sd.status = 'PAID'
          AND sd.change_given IS NOT NULL
          AND (sd.cash_session_id = cs.id
               OR (sd.cash_session_id IS NULL
                   AND sd.seller_id = cs.user_id
                   AND sd.branch_id = cs.branch_id
                   AND sd.created_at BETWEEN cs.opened_at AND COALESCE(cs.closed_at, NOW())))
    ), 0)                        AS change_given_db,
    -- Tickets count
    COALESCE((
        SELECT COUNT(*)
        FROM sales_documents sd
        WHERE sd.status = 'PAID'
          AND (sd.cash_session_id = cs.id
               OR (sd.cash_session_id IS NULL
                   AND sd.seller_id = cs.user_id
                   AND sd.branch_id = cs.branch_id
                   AND sd.created_at BETWEEN cs.opened_at AND COALESCE(cs.closed_at, NOW())))
    ), 0)                        AS tickets
FROM affected_sessions afs
JOIN cash_sessions cs ON cs.id = afs.id
JOIN users u          ON u.id = cs.user_id
LEFT JOIN branches b  ON b.id = cs.branch_id
ORDER BY cs.closed_at DESC;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  7. Resumen total: sales totals durante la ventana del outage'
\echo '════════════════════════════════════════════════════════════════════════'

SELECT
    sd.status,
    COUNT(*)                         AS docs,
    COALESCE(SUM(sd.total_amount), 0) AS total_amount,
    COUNT(DISTINCT sd.seller_id)     AS distinct_cashiers,
    COUNT(DISTINCT sd.branch_id)     AS distinct_branches
FROM sales_documents sd
WHERE sd.created_at >= :'OUTAGE_START'
  AND sd.created_at <= :'OUTAGE_END'
GROUP BY sd.status
ORDER BY sd.status;

\echo
\echo 'FIN DEL AUDIT.'
