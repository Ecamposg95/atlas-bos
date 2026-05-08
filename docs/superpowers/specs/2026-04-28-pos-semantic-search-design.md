# POS Semantic Search — Design Spec

**Date:** 2026-04-28
**Status:** Deferred / not yet scheduled
**Origin:** Cockpit followup sprint, item 7b ("búsqueda semántica con embeddings")
**Pre-req shipped:** PR #168 — multi-field `ILIKE` search across `name`, `description`, `sku`, `barcode` (item 7a).

## 1. Problem

Cashiers describe products in natural language ("leche en bolsa azul", "el detergente chico de la marca azul") but POS search today only matches literal substrings against indexed columns. When the cashier doesn't remember the SKU and the product name uses different wording (e.g., catalog says "Lala Entera 1L bolsa azul", cashier types "leche azul lala"), the search fails or returns too many irrelevant matches.

The 7a multi-field `ILIKE` improves the keyword case (now matches across name + description + sku + barcode) but does NOT solve the synonym/paraphrase problem.

## 2. Goal

Semantic match over the product catalog so a query like "leche bolsa azul" surfaces the right product even when those exact words don't appear together in any indexed column.

## 3. Non-goals

- Replace the existing keyword search. Semantic search runs alongside; keyword wins on exact code/SKU matches (deterministic, faster, no LLM call).
- Auto-suggest / autocomplete UX. This spec is search ranking only.
- Cross-tenant retrieval. Embeddings are per-organization.
- Voice / OCR / image-based search.

## 4. Approach (recommended: pgvector + small embedding model)

Store an embedding per `Product` (or per `ProductVariant` for SKU-level granularity). On search, embed the query and run a `kNN` over the product embeddings, restricted to the cashier's organization.

### Components

- **`pgvector` extension** in Postgres. Atlas already runs Postgres 17 (per memory). Adding `pgvector` is a one-time migration.
- **Embedding model** — one of:
  - **Option A (cheap, fast, on-server):** local sentence-transformers model (`paraphrase-multilingual-MiniLM-L12-v2` or `intfloat/multilingual-e5-small`). 384-dim. ~80MB. CPU-friendly. Free.
  - **Option B (paid, higher quality):** OpenAI `text-embedding-3-small` (1536-dim) or Cohere `embed-multilingual-light-v3.0` (384-dim). ~\$0.02 / 1M tokens for OpenAI. Requires API key per org.
  - **Option C (Anthropic-only stack):** Use Claude API for query rewriting + ILIKE fallback, no embeddings at all. Cheaper to build, lower quality at scale.
- **Indexing job** — triggered on product create/update, computes embedding from `name + description + brand + department + variants[].sku`. Stored in `product_embeddings` table.
- **Search endpoint** — extends `GET /api/products/search-semantic?q=...` (new) or transparently re-ranks results from the existing `/api/products/?search=...`.

### Recommended: Option A (local sentence-transformers)

Reasons:
- Zero per-query cost (matters at POS scale).
- Latency 30-80ms on CPU for one query embedding.
- Multilingual — handles Spanish queries against Spanish catalog content.
- No external API dependency / outage exposure.
- Embeddings are stable and recomputable from scratch in minutes per organization.

Trade-off: lower recall on rare/long-tail queries vs. paid models. Acceptable for POS where cashiers know roughly what the product is.

## 5. Data model

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE product_embeddings (
  id UUID PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  source_text TEXT NOT NULL,          -- the concatenated text we embedded
  embedding_model VARCHAR(64) NOT NULL,  -- e.g. "minilm-l12-v2" so we can re-embed when model changes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, embedding_model)
);

CREATE INDEX ix_product_embeddings_org ON product_embeddings (organization_id);
CREATE INDEX ix_product_embeddings_vec ON product_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

`source_text` is recorded so we can audit what was indexed without recomputing.

## 6. Indexing pipeline

- **Sync write path:** when `Product` is created/updated, enqueue an embedding task. Synchronous (blocks the request) is fine if embedding takes <100ms; otherwise background worker.
- **Backfill:** management command `python scripts/embed_products.py --org <id>` iterates all products in batches of 64 and writes embeddings.
- **Re-indexing on model change:** if `embedding_model` constant changes in code, the next product update triggers re-embed for that product. Full re-embed via the backfill script.
- **Source text format** (Spanish, normalized):
  ```
  {name}. {brand_name}. {department_name}. {description or ''}. SKUs: {sku1}, {sku2}, ...
  ```

## 7. Query path

```
POST /api/products/search-semantic
Body: { "q": "leche bolsa azul lala" }
```

1. Embed `q` with the same model.
2. `SELECT product_id FROM product_embeddings WHERE organization_id = :org ORDER BY embedding <=> :q_vec LIMIT 20`.
3. Hydrate products + branch availability + price.
4. Return ranked list.

POS frontend can call this endpoint when the keyword search returns 0 hits, or always (and merge with keyword results, deduplicated).

### Hybrid ranking (optional, follow-up)

Combine keyword score + vector distance with a weighted sum (e.g., `0.5 * keyword + 0.5 * vector`). The first iteration ships with vector-only fallback; hybrid is a tuning pass after we see real cashier queries.

## 8. Performance targets

- **Index build:** < 5 min for an organization with 50k products on a single CPU.
- **Query latency:** < 150ms p95 for the embedding step + kNN combined.
- **Cost (Option A):** server CPU only, no external API spend.

## 9. Rollout

1. Schema migration — add `vector` extension + `product_embeddings` table.
2. Backend: embedding service module, sync write hook, search endpoint behind a feature flag (`pos_semantic_search`).
3. Backfill script run per organization.
4. Frontend: POS search calls keyword first, falls back to semantic if 0 hits.
5. Enable for one pilot organization. Measure precision/recall qualitatively for 2 weeks.
6. Roll out to all organizations.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Embedding model misses regional/Mexican Spanish | Pilot with real cashier queries; if MiniLM fails, switch to multilingual-e5 or upgrade to OpenAI for higher recall. |
| Storage growth | Embeddings are ~1.5KB each (384 dim × 4 bytes). 50k products × 1.5KB = 75MB per org. Acceptable. |
| Re-embedding cost on model change | Versioning via `embedding_model` column; backfill is idempotent and resumable. |
| Multi-tenancy leak via vector index | Always filter by `organization_id` before kNN; the index supports filtered queries. Add a SQL test that asserts cross-tenant retrieval returns empty. |
| Latency on cold start | Keep model loaded in process memory; no per-request load. |

## 11. Open questions

- Which embedding model exactly? Pin in spec before plan. Default proposal: `intfloat/multilingual-e5-small` (384 dim, top-tier on Spanish benchmarks at this size).
- Do we re-embed on `ProductBranchStatus` price/availability change? **No** — those are filter columns, not part of semantic content. Embed only on `Product`/`ProductVariant` text changes.
- Sync vs async write hook? Default proposal: sync if model loaded in-process; async via a small task queue if we move embedding to a separate service.
- Per-tenant embedding model override? **No** for v1. Single model across the platform; revisit if a tenant needs domain-specific tuning.

## 12. When to schedule

This spec is **deferred** — not blocking, no fixed date. Ship after at least one cashier-feedback cycle on the 7a keyword search to confirm the gap is real and quantifiable. Reasonable triggers to schedule the work:

- Cashier reports >10 "no encontré el producto" incidents in a week against a populated catalog.
- A pilot client requests it as a sales requirement.
- Engineering capacity exists for ~1 week of focused work (1 engineer, backend + frontend).

## 13. Sequel work (out of scope here)

- LLM-based query rewriting ("leche descremada de 1L marca lala" → expanded query terms) before embedding.
- Cashier-facing autocomplete suggestions powered by the same index.
- Cross-org embedding model evaluation harness with held-out queries.
