// Types for Platform Reports module (F4 — 2026-04-30)
// Mirrors the response shapes from /api/platform/reports/* endpoints.

export type ReportTab = 'productos' | 'sucursales' | 'vendedores' | 'clientes'

export interface ReportFilters {
  range?: '7d' | '30d' | '90d' | '12m' | 'custom'
  start?: string  // ISO date
  end?: string    // ISO date
  org_id?: number
  branch_id?: number
}

export interface ReportParams extends ReportFilters {
  limit?: number   // default 100, max 500
  offset?: number
  sort?: string    // e.g. "revenue:desc"
}

export interface PaginatedReport<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

// ── Pivot row shapes ────────────────────────────────────────────────────────

export interface ProductRow {
  product_id: string
  sku: string
  name: string
  brand: string | null
  department: string | null
  units_sold: number
  revenue: string                        // Decimal as string
  aov: string
  return_rate_pct: string
  estimated_margin_pct: string | null
}

export interface BranchRow {
  branch_id: number
  name: string
  org_id: number
  org_name: string
  city: string | null
  transactions: number
  revenue: string
  avg_ticket: string
  active_cashiers: number
  return_rate_pct: string
}

export interface SellerRow {
  user_id: number
  full_name: string
  role: string
  branch_id: number
  branch_name: string
  org_id: number
  org_name: string
  transactions: number
  revenue: string
  avg_ticket: string
  active_days: number
}

export interface CustomerRow {
  customer_id: number
  customer_name: string
  ticket_count: number
  total_revenue: string
  avg_ticket: string
  last_purchase: string                  // ISO datetime
  avg_days_between_purchases: number | null
}

// ── Drill-down detail shapes ────────────────────────────────────────────────

export interface ProductDetailRow {
  document_id: string
  folio: number
  series: string
  created_at: string
  org_name: string
  branch_name: string
  seller_name: string
  quantity: number
  unit_price: string
  total_line: string
}

export interface ProductDetailResponse {
  product_id: string
  product_name: string
  items: ProductDetailRow[]
  total: number
  offset: number
  limit: number
}

export interface BranchDetailTopProduct {
  sku: string
  name: string
  units: number
  revenue: string
}

export interface BranchDetailTopSeller {
  full_name: string
  transactions: number
  revenue: string
}

export interface BranchDetailResponse {
  branch_id: number
  branch_name: string
  top_products: BranchDetailTopProduct[]
  top_sellers: BranchDetailTopSeller[]
}

export interface SellerDetailRow {
  document_id: string
  folio: number
  created_at: string
  total_amount: string
  branch_name: string
  customer_name: string | null
}

export interface SellerDetailResponse {
  user_id: number
  full_name: string
  items: SellerDetailRow[]
  total: number
  offset: number
  limit: number
}

export interface CustomerDetailRow {
  document_id: string
  folio: number
  created_at: string
  branch_name: string
  total_amount: string
  payment_method: string | null
  status: string
}

export interface CustomerDetailResponse {
  customer_id: number
  customer_name: string
  items: CustomerDetailRow[]
  total: number
  offset: number
  limit: number
}
