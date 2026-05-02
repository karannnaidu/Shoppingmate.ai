# Phase 1 — Plan 3a: Onboarding Completion (Catalog + Selectors + Smoke)

**Status:** Design
**Date:** 2026-05-02
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md)
**Prior plan:** Plan 2 (Provisioning API + lifecycle) — complete, tagged `phase1-plan2-provisioning-complete`
**Decomposes:** Plan 3 of Phase 1 (parent spec §5.2 steps 3-5 + §6.2 read-side primitives + §11.1 catalog/selector schema)

---

## 1. Goal

Take the merchant from Plan-2's "we know the platform and Safe Browsing cleared them" state into a state where:

1. The merchant has a populated `products` table (catalog synced from their platform).
2. For DOM merchants, we have extracted selectors for the cart/checkout/policy pages.
3. We have proven cartAdd works against the merchant via a synthetic smoke test (or marked them `degraded` if it didn't).
4. The Plan 4 voice agent can call `catalogRepo.searchProducts(merchantId, query)` and get a Postgres-FTS-ranked list back.

After Plan 3a, a Shopify or Woo merchant onboards end-to-end to `status='live'` and is ready for Plan 3b's adapters to make them transactable.

## 2. Decomposition of Plan 3 (parent context)

Plan 3 is split into five sub-plans. This spec is **3a only**:

| Sub | Scope | Status |
|---|---|---|
| **3a** | Onboarding steps 3-5: catalog sync (Shopify + Woo + DOM crawl), selector extraction (DOM), smoke test, `products` + `selector_cache` schema, `catalogRepo` read primitive (FTS) | **this spec** |
| 3b | Common adapter interface + dispatcher + ShopifyAdapter + WooAdapter | next |
| 3c | MagentoAdapter + BigCommerceAdapter + WixAdapter + SquarespaceAdapter (also extends 3a's catalog sync to those 4 platforms) | later |
| 3d | DOMAdapter + selector_cache runtime population + Haiku 4.5 selector resolver | later |
| 3e | SuggestAdapter fallback | later |

## 3. Non-goals (explicit for 3a)

- **Adapters of any kind.** No `searchProducts` / `cartAdd` adapter methods. The `catalogRepo` is a plain DB module, not an adapter.
- **Magento / BigCommerce / Wix / Squarespace catalog sync.** Those four platforms are detected and tagged but their catalog sync is deferred to 3c.
- **Embedding-based product search.** FTS only. pgvector lands in Phase 2 alongside `brand_kb_chunks`.
- **Runtime selector healing.** The `selector_cache` table ships, but population at runtime + Haiku resolver are 3d.
- **Catalog refresh / daily recrawl.** Manual re-sync is via the existing `pnpm shoppingmate:dev retry-onboarding` only. Daily recrawl is Phase 2.
- **Voice agent integration.** Plan 3a does not depend on or unblock Plan 4 by itself; Plan 3b is the unblocker.

## 4. Architecture

```
existing (Plan 2)                                              new (Plan 3a)
┌───────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌─────────────────┐  ┌────────────┐  ┌──────────────┐
│safetyCheck│→ │fingerprint   │→ │(degrade tag)  │→ │catalogSync   │→ │selectorExtract  │→ │smokeTest   │→ │write status  │
│           │  │+ extended    │  │detected_      │  │ - Shopify    │  │ (DOM only)      │  │ - api OR   │  │+ metrics     │
│           │  │ platform     │  │ platform tag  │  │ - Woo        │  │ - Sonnet 4.6    │  │   playwright│  │              │
│           │  │ detection    │  │ for M/BC/W/SQ │  │ - DOM crawl  │  │ - Playwright    │  │            │  │              │
└───────────┘  └──────────────┘  └───────────────┘  └──────────────┘  └─────────────────┘  └────────────┘  └──────────────┘
                                                            │                  │                 │
                                                            ▼                  ▼                 ▼
                                                    ┌─────────────────────────────────────────────────────┐
                                                    │ Postgres: products, selector_cache;                 │
                                                    │ S3: merchants/{id}/onboarding/{ts}/screenshots      │
                                                    └─────────────────────────────────────────────────────┘
```

**No new services, no new queues.** `apps/worker/src/handlers/onboarding.ts` stays the single linear pipeline. New steps live as files under `apps/worker/src/steps/` next to the existing `fingerprint.ts` and `safetyCheck.ts`.

**Read primitive lands here, used in 3b+:** `packages/db/src/repos/catalogRepo.ts` exports `searchProducts(merchantId, query, limit)` (Postgres FTS over title + description) and `getProduct(merchantId, sku)`. Adapters in 3b/3c/3d call this for read; their write paths (cartAdd, etc.) are platform-specific.

**Resumability invariant from Plan 2 is preserved.** Each new step records progress in `install_attempts` so `retry-onboarding` can re-run from the failed step.

## 5. Schema changes

### 5.1 `products` table (new)

Per parent spec §11.1 with one addition (`source_meta` for sync provenance):

```sql
products (
  merchant_id     text REFERENCES merchants(id) ON DELETE CASCADE,
  sku             text NOT NULL,
  title           text NOT NULL,
  description     text,
  image_url       text,
  product_url     text NOT NULL,
  variants        jsonb,                    -- [{ id, options:{size,color}, price_cents, in_stock }]
  price_cents     integer,
  currency        text,
  in_stock        boolean,
  indexed_at      timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL,            -- 'shopify_storefront' | 'woo_store_api' | 'dom_crawl'
  source_meta     jsonb,                    -- { sync_attempt_id, fetched_url, http_status }
  search_vector   tsvector GENERATED ALWAYS AS
                  (setweight(to_tsvector('simple', coalesce(title,'')),     'A') ||
                   setweight(to_tsvector('simple', coalesce(description,'')),'B')) STORED,
  PRIMARY KEY (merchant_id, sku)
);
CREATE INDEX products_search_idx ON products USING GIN (search_vector);
CREATE INDEX products_merchant_indexed_idx ON products(merchant_id, indexed_at);
```

Notes:
- `simple` regconfig (no stemming) — D2C product names are short and skew toward proper nouns; stemming hurts more than it helps. Phase 2 can introduce per-merchant locale.
- Generated `search_vector` column means inserts and updates auto-maintain the index; no triggers.
- ON DELETE CASCADE keeps Plan 4 cleanup-on-suspend simple.

### 5.2 `selector_cache` table (new — schema only, no rows in 3a)

Per parent spec §11.1 verbatim. Lands here because 3d builds on top of it; shipping the table now keeps 3d a pure code change.

### 5.3 `merchants.adapter_config` JSONB shape (extended)

No DDL change (column exists). Plan 3a writes these new fields:

```jsonc
{
  "detected_platform": "magento" | "bigcommerce" | "wix" | "squarespace" | null,  // for "coming soon" merchants
  "selectors": {                       // DOM merchants only; null for Shopify/Woo
    "add_to_cart_button": "...",
    "qty_input": "...",
    "variant_selector_template": "...",
    "cart_url": "...",
    "cart_page_total": "...",
    "checkout_button": "...",
    "coupon_field": "...",
    "coupon_apply_button": "...",
    "line_item_remove_button": "...",
    "thank_you_order_id": "...",
    "thank_you_total": "..."
  },
  "page_templates": {
    "product": "sha256:...",
    "cart":    "sha256:...",
    "checkout":"sha256:..."
  }
}
```

### 5.4 `merchants` column additions

Two new columns (drizzle migration):

```sql
ALTER TABLE merchants ADD COLUMN catalog_synced_at timestamptz;
ALTER TABLE merchants ADD COLUMN smoke_passed_at  timestamptz;
```

These exist so `retry-onboarding` can resume mid-pipeline and so Plan 4 can `WHERE smoke_passed_at IS NOT NULL` to gate widget-eligibility.

### 5.5 `metric_names` registry additions

```ts
onboardingCatalogSyncStarted
onboardingCatalogSyncCompleted        // tags: { products_count, source }
onboardingCatalogSyncDegraded         // tags: { products_count, expected, source, reason }
onboardingCatalogSyncFailed           // tags: { source, reason }
onboardingSelectorExtractStarted
onboardingSelectorExtractCompleted    // tags: { pages_extracted, llm_input_tokens, llm_output_tokens }
onboardingSelectorExtractFailed       // tags: { reason }
onboardingSmokeStarted
onboardingSmokePassed                 // tags: { adapter_type, latency_ms }
onboardingSmokeFailed                 // tags: { adapter_type, reason }
onboardingDetectedPlatformDegraded    // tags: { detected_platform } — for B-decision merchants
```

## 6. Components

### 6.1 `apps/worker/src/steps/catalogSync.ts` (new)

Single entry point: `catalogSync(merchant: Merchant): Promise<CatalogSyncResult>`.

**Dispatch table:**

| `merchant.platform` | `merchant.adapterType` | Behavior |
|---|---|---|
| `shopify`     | `shopify` | Fetch `/products.json?limit=250` paginated, cap 5000, 90s wall timeout. |
| `woocommerce` | `woo`     | Fetch `/wp-json/wc/store/v1/products?per_page=100` paginated, cap 5000, 90s. |
| `custom`      | `dom`     | Fetch `/sitemap.xml`, filter for product-shaped URLs, cap 500, fetch in parallel (concurrency 4) with Playwright headless render, run LLM extraction on each (Haiku 4.5 — cheaper for batch product extraction), 90s wall timeout. |

`detected_platform ∈ {magento,bigcommerce,wix,squarespace}` merchants take the `custom` path (because their `adapter_type='dom'` per the B-decision in fingerprint).

**Result shape:**

```ts
type CatalogSyncResult =
  | { kind: 'ok';        productsCount: number; source: string; durationMs: number }
  | { kind: 'partial';   productsCount: number; expected: number; source: string; reason: string }
  | { kind: 'failed';    source: string; reason: string };
```

**Partial threshold:** `productsCount / expected >= 0.8` → `ok`, else `partial`.
- For Shopify/Woo, `expected` = the platform-reported count if available, else `productsCount + remaining_pages * page_size`.
- For DOM crawl, `expected` = total sitemap product-URL count.

**Failure modes:**
- Network timeout / 5xx → `failed` with reason `'http_error'`. Onboarding marks merchant `failed`. BullMQ retries the job up to `attempts` (existing config).
- Sitemap missing for DOM merchants → `failed` with reason `'no_sitemap'`. (Phase 2 adds homepage-link discovery.)

### 6.2 `apps/worker/src/steps/fingerprint.ts` (extended)

Today returns `'shopify' | 'woocommerce' | 'custom'`. Extended to **also** return a `detected_platform` for the four "coming soon" platforms:

```ts
type FingerprintResult = {
  platform: 'shopify' | 'woocommerce' | 'custom';
  detected_platform: 'magento' | 'bigcommerce' | 'wix' | 'squarespace' | null;
  confidence: number;
};
```

Detection rules per parent spec §5.2 step 2 (header/HTML/well-known-path inspection). For the four coming-soon platforms, `platform='custom'` (because we route them to DOM) but `detected_platform` is set so we know who to email when 3c lands.

### 6.3 `apps/worker/src/steps/selectorExtract.ts` (new — DOM merchants only)

Skipped entirely for `adapter_type` ∈ `{shopify, woo}` (their selectors live in `config/platform-defaults/`, future work in 3b).

For DOM merchants:
1. Pick representative pages from the synced catalog: first product, the cart page (`/cart`, `/checkout/cart`, or homepage-discovered), the policy page (`/privacy`, `/returns` heuristic).
2. Playwright headless: render each, save screenshot to S3 at `merchants/{id}/onboarding/{ts}/{page_type}.png`, save normalized DOM skeleton.
3. Compute `page_template_hash` per page (sha256 of normalized DOM skeleton — strip text content, keep tag tree + IDs/classes).
4. Single Sonnet 4.6 call with all three screenshots + DOMs concatenated, prompt from parent spec §5.2 step 4.
5. Write resulting selectors + page_templates back to `merchants.adapter_config`.

**Cost guardrail:** wall-time cap 120s, LLM input cap 200k tokens (truncate DOMs to fit). If cap exceeded → `failed` with reason `'selector_extract_timeout'`.

### 6.4 `apps/worker/src/steps/smokeTest.ts` (new)

| Adapter type | Smoke action |
|---|---|
| `shopify` | `POST {domain}/cart/add.js { id: variants[0].id, quantity: 1 }`. Pass = HTTP 200 with cart token. |
| `woo`     | `POST {domain}/wp-json/wc/store/v1/cart/add-item { id, quantity:1 }`. Pass = HTTP 200 + cart object. |
| `dom`     | Playwright session: navigate to first product, click `adapter_config.selectors.add_to_cart_button`, wait for `adapter_config.selectors.cart_page_total` mutation (5s). Pass = mutation observed. |

**Outcome rules:**
- Pass → `merchants.status='live'`, `smoke_passed_at=now()`.
- Fail (3a behavior) → `merchants.status='degraded'`, log reason in `lastError`. **Do NOT auto-fall-back to DOM in 3a** — that's 3d's job (when DOMAdapter exists). For now, `degraded` is a terminal state requiring `retry-onboarding` or manual intervention.

### 6.5 `packages/db/src/repos/catalogRepo.ts` (new)

```ts
export async function searchProducts(
  merchantId: string,
  query: string,
  limit = 20,
): Promise<Product[]>;

export async function getProduct(
  merchantId: string,
  sku: string,
): Promise<Product | null>;
```

`searchProducts` runs:

```sql
SELECT *, ts_rank(search_vector, plainto_tsquery('simple', $1)) AS rank
FROM products
WHERE merchant_id = $2 AND search_vector @@ plainto_tsquery('simple', $1)
ORDER BY rank DESC
LIMIT $3;
```

Empty query → most recently indexed N products. Used by Plan 4 for "show me what you have".

`getProduct` is a primary-key lookup.

## 7. Pipeline changes — `onboarding.ts` handler

The new pipeline (replaces existing Step 3 finalize):

```
... (existing steps 1-2 unchanged) ...

// Step 3: tag detected_platform on adapter_config (fingerprint result)
// Step 4: catalogSync — write to products, update merchants.catalog_synced_at
// Step 5: selectorExtract — DOM merchants only; update adapter_config
// Step 6: smokeTest — runs against synced catalog + extracted selectors
// Step 7: finalize — set status (live | degraded), smoke_passed_at, last_indexed_at
```

Each step:
- Records start/finish in `install_attempts.event_log` (existing JSONB column).
- Emits start + result metric (§5.5).
- On exception, calls `fail(merchantId, step, err)` (existing helper) and re-throws so BullMQ can retry.

## 8. Process boundaries

- **Worker:** all new steps run inside `apps/worker`. Playwright bundled (chromium-only, headless, ~900MB image hit). No new processes.
- **Postgres:** `products` + `selector_cache` tables added. No partitioning yet (premature for Phase 1 cohort).
- **Redis:** unchanged — BullMQ queues only.
- **S3:** new prefix `merchants/{id}/onboarding/{ts}/` for screenshots. 7d TTL via existing bucket lifecycle.
- **External:** OpenRouter (Sonnet for selectors, Haiku for DOM-crawl product extraction). Existing API key.

## 9. Acceptance criteria

A Plan 3a build is "done" when:

1. `pnpm shoppingmate:dev provision --domain=<real-shopify-dev-store>` produces:
   - `merchants.status='live'`
   - ≥1 row in `products` with `source='shopify_storefront'`
   - `smoke_passed_at` non-null
   - `metric_events`: `onboardingCatalogSyncCompleted`, `onboardingSmokePassed` rows present
2. Same for `--domain=<real-woocommerce-dev-store>` with `source='woo_store_api'`.
3. For `--domain=<a-magento-or-wix-test-site>`: merchant reaches `status='degraded'` (no smoke fall-back yet), `adapter_config.detected_platform` is set correctly, and `metric_events` includes `onboardingDetectedPlatformDegraded`.
4. `catalogRepo.searchProducts(merchantId, "shirt", 10)` returns rows ordered by FTS rank for the Shopify merchant from (1).
5. Unit tests cover: each platform's catalog sync (msw fixtures), partial-threshold logic, fingerprint detection of all four coming-soon platforms, smoke pass/fail, `searchProducts` ranking.
6. Integration test: full handler runs end-to-end against a fixture-mocked Shopify and Woo, plus a fixture-mocked DOM merchant, asserting expected metric events and final statuses.
7. Lint + typecheck pass repo-wide. Commit tag `phase1-plan3a-onboarding-completion-complete`.

## 10. Open questions

None at design lock-in — all decisions confirmed in 2026-05-02 brainstorming session (see `MEMORY.md` and conversation history for the question/answer trail: decomposition=A, catalog scope=ii, coming-soon=B, search=C, defaults batch confirmed).

---

**Out of scope, restated:** any adapter, runtime selector healing, embeddings, dashboard, daily recrawl, M/BC/Wix/SQ catalog sync. All deferred to 3b / 3c / 3d / 3e / Phase 2 per §2.
