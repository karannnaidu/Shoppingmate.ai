# Phase 1 — Plan 3c: Remaining Platform Adapters (Magento + BigCommerce + Wix + Squarespace)

**Status:** Design
**Date:** 2026-05-02
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md) §6.3, §7.2
**Prior plans:** 3a (catalog sync + selectors), 3b (Adapter interface + Shopify + Woo)

---

## 1. Goal

Bring the four "coming soon" platforms from Plan 3a out of the degraded bucket:

1. Add catalog sync clients for Magento, BigCommerce, Wix, Squarespace into Plan 3a's `catalogSync` orchestrator.
2. Add `MagentoAdapter`, `BigCommerceAdapter`, `WixAdapter`, `SquarespaceAdapter` implementing the `Adapter` interface from Plan 3b.
3. Wire them into `getAdapter(merchant)` dispatcher.
4. Promote each platform from `adapter_type='dom'` (Plan 3a's degrade strategy) to its own adapter type during fingerprint, by fixing `apps/worker/src/handlers/onboarding.ts` to map `detected_platform` → `adapter_type` for these four.
5. Extend `adapter-smoke` CLI to exercise the four new adapters.

After Plan 3c, ~85% of merchants (the parent spec §7.2 "Tier 1" cohort) onboard end-to-end and are transactable.

## 2. Decomposition (parent context)

| Sub | Scope | Status |
|---|---|---|
| 3a | Catalog sync (Shopify+Woo+DOM) + selectors + smoke | done |
| 3b | Adapter interface + Shopify + Woo | done |
| **3c** | Magento/BigCommerce/Wix/Squarespace adapters + their catalog sync | **this spec** |
| 3d | DOMAdapter | next |
| 3e | SuggestAdapter | last |

## 3. Non-goals (explicit for 3c)

- **No DOM/Suggest tier work.** Custom-platform merchants (no detected platform) stay on the `dom` adapter type, which still throws `adapter_not_implemented_in_plan3c` until 3d.
- **No retry of already-onboarded merchants.** Existing rows where `detected_platform ∈ {magento,bigcommerce,wix,squarespace}` and `status='degraded'` need an explicit `pnpm shoppingmate:dev retry-onboarding <id>` to be promoted.
- **No real-time inventory or coupon validation** (same constraint as 3b).
- **No B2B / multi-store / B2C-with-customer-account flows.** Guest carts only. Magento Commerce, BigCommerce Enterprise, Wix Multilingual all hit the same guest-cart endpoint we use.

## 4. Architecture

```
Plan 3a fingerprint already returns detected_platform ∈ {magento,bigcommerce,wix,squarespace}.
                     │
                     ▼
   Plan 3a finalize step (extended):
     if detected_platform ∈ {…} and adapter implementation EXISTS in dispatcher:
       adapter_type = detected_platform
     else:
       adapter_type = 'dom'   ← Plan 3a fallback
                     │
                     ▼
   Plan 3a catalogSync (extended): dispatch by adapter_type
     - magento     → MagentoCatalogClient
     - bigcommerce → BigCommerceCatalogClient
     - wix         → WixCatalogClient
     - squarespace → SquarespaceCatalogClient
                     │
                     ▼
   Plan 3a smokeTest (extended): same per-adapter table
                     │
                     ▼
   merchants.status = 'live' (instead of 'degraded')
                     │
                     ▼
   Plan 3b dispatcher (extended): getAdapter() returns Magento/BC/Wix/Squarespace
                     │
                     ▼
   Plan 3b adapter-smoke (extended): now covers 6 adapters total
```

**Key insight:** 3c does not add new pipeline steps. It plugs four new clients into Plan 3a's `catalogSync` switch and four new adapter implementations into Plan 3b's dispatcher. The work is concentrated in two existing seams.

## 5. Schema changes

None. All four platforms use the existing `merchants.adapter_config jsonb` for credentials/store-specific config. No new columns, no new tables.

The `adapterTypes` enum already includes `'magento' | 'bigcommerce' | 'wix' | 'squarespace'` (parent spec §11.1, already in `packages/db/src/schema/merchants.ts`). No DB migration.

`metric_names` registry additions:

```ts
// no new keys — reuse the Plan 3a families with new tag values:
// onboardingCatalogSyncCompleted { source: 'magento_rest' | 'bigcommerce_storefront' | 'wix_stores' | 'squarespace_commerce' }
// onboardingSmokePassed         { adapter_type: 'magento' | 'bigcommerce' | 'wix' | 'squarespace' }
```

## 6. Catalog sync clients

All four follow the structure of Plan 3a's `apps/worker/src/steps/catalogClients/shopify.ts`:
- Export `fetchCatalog(domain, opts): Promise<CatalogClientResult>`
- Return `NormalizedProduct[]` with `source: '<platform>_<endpoint>'`
- Use `node:fetch`, no platform SDKs (smaller surface, faster cold start, easier to test)
- Cap 5000 products / 90s wall timeout

### 6.1 `magento.ts`

- **Endpoint:** `GET {domain}/rest/V1/products?searchCriteria[pageSize]=100&searchCriteria[currentPage]={n}`
- **Auth:** Magento allows guest access to `/rest/V1/products` for public catalogs. If 401, fall back to `/rest/V1/categories/list` then per-category `/rest/V1/categories/{id}/products`. If still 401, return `{ kind:'failed', reason:'requires_admin_token' }` — Plan 3 ships no admin-token path; the merchant stays degraded.
- **Source value:** `magento_rest`
- **Normalization:** Magento returns `{ id, sku, name, price, custom_attributes:[{attribute_code,value}], extension_attributes:{stock_item:{is_in_stock}} }`. Map to `NormalizedProduct`.

### 6.2 `bigcommerce.ts`

- **Endpoint:** `GET {domain}/api/storefront/products?limit=100&page={n}` (Storefront API, public for guest-shoppable stores)
- **Variants:** BC's product entity nests `variants[]` already; map directly.
- **Source value:** `bigcommerce_storefront`

### 6.3 `wix.ts`

- **Endpoint:** Wix doesn't expose a guest catalog REST endpoint without an OAuth token. Use Wix Stores' public widget API: `GET {domain}/_api/wix-ecommerce-storefront-web/api/storefront/products?limit=100&offset={n}`. Reverse-engineered but stable for at least the last three years; verified via Wix dev forum.
- **Source value:** `wix_stores`
- **Risk note:** if Wix changes this surface, fingerprint still detects Wix → `adapter_type='dom'` fallback (need to add this fallback rule in catalogSync).

### 6.4 `squarespace.ts`

- **Endpoint:** `GET {domain}/api/commerce/v1/products?limit=100&offset={n}` (Squarespace Commerce public guest API)
- **Source value:** `squarespace_commerce`
- **Variants:** Squarespace returns `variants[]` as `[{ id, attributes, price, stock }]`. Direct map.

## 7. Adapter implementations

All four new adapters live under `packages/adapters/src/<platform>.ts` and implement the `Adapter` interface from Plan 3b §5.

### 7.1 `magento.ts`

| Method | Endpoint |
|---|---|
| `cartAdd` | First call: `POST /rest/V1/guest-carts` → returns cart id (the `cartToken`). Subsequent: `POST /rest/V1/guest-carts/{cartId}/items { cartItem: { sku, qty, quote_id: cartId } }`. |
| `cartUpdate` | `PUT /rest/V1/guest-carts/{cartId}/items/{itemId} { cartItem: { qty } }`. |
| `cartGet` | `GET /rest/V1/guest-carts/{cartId}/totals`. |
| `couponApply` | `PUT /rest/V1/guest-carts/{cartId}/coupons/{code}`. |
| `checkoutUrl` | `{domain}/checkout/?guest-cart-id={cartId}`. |

### 7.2 `bigcommerce.ts`

| Method | Endpoint |
|---|---|
| `cartAdd` | `POST /api/storefront/carts` first call (creates cart, returns `{ id, ... }`). Then `POST /api/storefront/carts/{cartId}/items`. |
| `cartUpdate` | `PUT /api/storefront/carts/{cartId}/items/{itemId} { quantity }`. |
| `cartGet` | `GET /api/storefront/carts/{cartId}?include=lineItems.physicalItems.options`. |
| `couponApply` | `POST /api/storefront/carts/{cartId}/coupons { couponCode }`. |
| `checkoutUrl` | `POST /api/storefront/carts/{cartId}/redirect_urls` returns `{ checkout_url }` (single-use, ~24h TTL — caller must use it once). |

### 7.3 `wix.ts`

Wix guest cart APIs require a `_wixCIDX` cookie for cart correlation. We capture it the same way Shopify cookie capture works in Plan 3b.

| Method | Endpoint |
|---|---|
| `cartAdd` | `POST {domain}/_api/wix-ecommerce-storefront-web/api/storefront/cart/lines/add { lineItems: [{ catalogReference, quantity }] }`. |
| `cartUpdate` | `POST .../cart/lines/update { lineItems: [{ id, quantity }] }`. |
| `cartGet` | `GET .../cart`. |
| `couponApply` | `POST .../cart/coupon { couponCode }`. |
| `checkoutUrl` | `POST .../cart/createCheckout` returns `{ checkoutId }`, then `{domain}/checkout?checkoutId={id}`. |

### 7.4 `squarespace.ts`

| Method | Endpoint |
|---|---|
| `cartAdd` | `POST /api/commerce/v1/cart/items { productId, variantId, quantity }`. Cart token = `cart_id` cookie. |
| `cartUpdate` | `PUT /api/commerce/v1/cart/items/{lineId} { quantity }`. |
| `cartGet` | `GET /api/commerce/v1/cart`. |
| `couponApply` | `POST /api/commerce/v1/cart/promotions { code }`. |
| `checkoutUrl` | `{domain}/checkout/cart`. |

## 8. Dispatcher + fingerprint changes

### 8.1 `packages/adapters/src/dispatch.ts` (extended)

```ts
case 'magento':     return new MagentoAdapter();
case 'bigcommerce': return new BigCommerceAdapter();
case 'wix':         return new WixAdapter();
case 'squarespace': return new SquarespaceAdapter();
// 'dom', 'suggest' still throw 'adapter_not_implemented_in_plan3c'
```

### 8.2 `apps/worker/src/handlers/onboarding.ts` (extended)

After fingerprint, the existing platform mapping (Plan 3a Task 11):
```ts
PLATFORM_TO_ADAPTER = { shopify:'shopify', woocommerce:'woo', custom:'dom' };
```

Plan 3c adds an override: if `fingerprintResult.detected_platform` is one of the four new platforms AND `getAdapterImplementations()` (a new helper that introspects which adapters are wired) includes it, set `adapter_type` to the detected platform instead of `'dom'`. Otherwise keep the Plan 3a `'dom'` fallback (so adapters can be added platform-by-platform without touching this branch).

### 8.3 `apps/worker/src/steps/catalogSync.ts` (extended)

Dispatch table grows:

| `adapter_type` | Client |
|---|---|
| `shopify`     | `shopifyClient.fetchCatalog` (3a) |
| `woo`         | `wooClient.fetchCatalog` (3a) |
| `magento`     | `magentoClient.fetchCatalog` (3c) |
| `bigcommerce` | `bigcommerceClient.fetchCatalog` (3c) |
| `wix`         | `wixClient.fetchCatalog` (3c) |
| `squarespace` | `squarespaceClient.fetchCatalog` (3c) |
| `dom`         | `domCrawl.fetchCatalog` (3a) |

### 8.4 `apps/worker/src/steps/smokeTest.ts` (extended)

Each new adapter type gets a smoke action: a real `cartAdd` against the merchant via the new `Adapter` from Plan 3b, then asserting `kind==='ok'`.

## 9. Testing strategy

- **Unit tests** per catalog client and per adapter using `msw` fixtures captured from each platform's public docs/sandbox.
- **Contract test** from Plan 3b is auto-extended: it now iterates over six adapters instead of two.
- **CLI smoke** (`pnpm shoppingmate:dev adapter-smoke <merchantId>`) runs against one real merchant per platform during acceptance.

## 10. Acceptance criteria

A Plan 3c build is "done" when:

1. `pnpm shoppingmate:dev provision --domain=<real-magento-2-test-store>` produces `status='live'` and `adapter_type='magento'` (no longer `'dom'`).
2. Same for BigCommerce, Wix (using a Wix Stores test site), Squarespace.
3. `pnpm shoppingmate:dev adapter-smoke` runs all 7 steps green for all four new adapters.
4. Unit tests cover happy + error paths per platform; contract test green for all 6 adapters.
5. Lint + typecheck clean. Tag `phase1-plan3c-remaining-platform-adapters-complete`.

## 11. Open questions

- **Magento admin-token path:** if a Magento merchant blocks guest catalog access, do we ship an OAuth flow in Phase 1? **Decision: no.** They stay `degraded`; Phase 2 adds admin-token onboarding.
- **Wix endpoint stability:** the `_api/wix-ecommerce-storefront-web/...` path is undocumented. **Decision: ship anyway.** A canary in Plan 5+ monitoring will alert us if it drifts.

---

**Out of scope, restated:** DOM, Suggest, voice agent, real-time inventory, coupon validation, OAuth credentials, B2B catalog. Deferred to 3d / 3e / Plan 4 / Phase 2.
