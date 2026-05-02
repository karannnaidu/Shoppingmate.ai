# Phase 1 — Plan 3b: Wedge Adapters (Shopify + Woo)

**Status:** Design
**Date:** 2026-05-02
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md) §6.2-§7.2
**Prior plan:** Plan 3a (onboarding completion) — see [`2026-05-02-phase1-plan3a-onboarding-completion-design.md`](./2026-05-02-phase1-plan3a-onboarding-completion-design.md)
**Decomposes:** Plan 3 of Phase 1 (parent spec §6.3 dispatcher + §7.1 common interface + §7.2 Tier-1 API adapters for Shopify and Woo only)

---

## 1. Goal

After Plan 3a, Shopify and Woo merchants reach `status='live'` with a populated `products` table and a passed smoke test. Plan 3b builds the **read+write surface** that Plan 4's voice agent will call:

1. A common `Adapter` interface (parent spec §7.1) with concrete `ShopifyAdapter` and `WooAdapter` implementations.
2. An adapter dispatcher that looks up `merchants.adapter_type` and returns the right adapter instance.
3. End-to-end read flows (`searchProducts`, `getProduct`) backed by Plan 3a's `catalogRepo`.
4. End-to-end write flows (`cartAdd`, `cartUpdate`, `cartGet`, `couponApply`, `checkoutUrl`) calling each platform's guest cart API.
5. A CLI smoke (`pnpm shoppingmate:dev adapter-smoke <merchantId>`) that exercises the full chain against a real dev store.

Plan 3b does **not** ship Magento / BigCommerce / Wix / Squarespace adapters (those are 3c) and does **not** ship the DOM or Suggest tiers (3d / 3e). Plan 3b is the minimum to make Plan 4's voice agent transactable for the wedge platforms.

## 2. Decomposition (parent context)

| Sub | Scope | Status |
|---|---|---|
| 3a | Onboarding steps 3-5: catalog sync + selector extract + smoke + `catalogRepo` | done (or in flight) |
| **3b** | Common adapter interface + dispatcher + ShopifyAdapter + WooAdapter | **this spec** |
| 3c | Magento/BigCommerce/Wix/Squarespace adapters + their catalog sync | next |
| 3d | DOMAdapter + selector_cache runtime + Haiku resolver | later |
| 3e | SuggestAdapter | later |

## 3. Non-goals (explicit for 3b)

- **No Plan 4 wiring.** No voice agent, no LiveKit, no Gemini Live, no LLM tool-call loop. Plan 3b ships the typed `Adapter` interface and a CLI driver — Plan 4 wires it into the voice agent.
- **No adapters beyond Shopify/Woo.** Magento/BigCommerce/Wix/Squarespace stay `status='degraded'` per Plan 3a.
- **No DOM or Suggest tiers.** Custom-platform merchants stay `status='degraded'` until 3d.
- **No real-time inventory.** `in_stock` is whatever Plan 3a wrote; no per-call freshness check. Phase 2 may add it.
- **No persistent session storage.** The CLI smoke uses an in-memory cart-token holder; durable Redis sessions land in Plan 4.
- **No coupon validation.** `couponApply` returns whatever the platform returns; we don't simulate or pre-check.
- **No order placement.** `checkoutUrl` returns the platform's hosted checkout URL — we never POST orders ourselves. Payment handoff lives at the merchant.

## 4. Architecture

```
Plan 4 voice agent (future)            Plan 3b CLI smoke (this plan)
        │                                       │
        └───────────────┬───────────────────────┘
                        ▼
        ┌─────────────────────────────────┐
        │  packages/adapters/dispatch.ts  │
        │  getAdapter(merchant)           │
        └──────┬──────────────────────────┘
               │ switch on merchant.adapterType
       ┌───────┴────────┐
       ▼                ▼
┌───────────────┐  ┌───────────────┐
│ ShopifyAdapter│  │ WooAdapter    │
└──────┬────────┘  └──────┬────────┘
       │                  │
       │ searchProducts/getProduct
       ▼                  ▼
┌──────────────────────────────────┐
│ packages/db catalogRepo (Plan 3a)│
└──────────────────────────────────┘
       │ cart*/coupon*/checkoutUrl
       ▼
┌──────────────────────────────────┐
│ {merchant.domain}/cart/add.js    │  (Shopify)
│ /wp-json/wc/store/v1/...         │  (Woo)
└──────────────────────────────────┘
```

**New package:** `packages/adapters/` — sibling to `packages/db/`, holds the interface + every adapter. Reason for a new package: adapters are imported by both `apps/api` (HTTP tool routes in Plan 4) and `apps/worker` (catalog sync already lives there). Putting them in either app would force a cross-app import.

**HTTP client:** reuse `node:fetch`. No `undici`/`axios`. Keep the dependency graph small.

## 5. Common interface

`packages/adapters/src/types.ts`:

```ts
export type AdapterContext = {
  merchant: Merchant;          // from packages/db
  cartToken: string | null;    // platform-specific opaque token; null for first call
  fetch?: typeof globalThis.fetch;  // injectable for tests
};

export type CartLine = {
  lineId: string;              // platform line id (used by cartUpdate)
  sku: string;
  variantId: string | null;
  title: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
  imageUrl: string | null;
};

export type CartState = {
  cartToken: string;           // refreshed token (caller persists)
  lines: CartLine[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  appliedCoupons: string[];
};

export type AdapterResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'platform_error'; status: number; body: string }   // 4xx/5xx from platform
  | { kind: 'unsupported'; reason: string };                    // adapter doesn't support this op

export interface Adapter {
  readonly kind: AdapterType;  // 'shopify' | 'woo' | ... (from packages/db)
  searchProducts(ctx: AdapterContext, query: string, limit?: number): Promise<AdapterResult<Product[]>>;
  getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>>;
  cartAdd(ctx: AdapterContext, sku: string, variantId: string | null, qty: number): Promise<AdapterResult<CartState>>;
  cartUpdate(ctx: AdapterContext, lineId: string, qty: number): Promise<AdapterResult<CartState>>;
  cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>>;
  couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>>;
  checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>>;
}
```

**Why `AdapterResult` instead of throwing:** the voice agent in Plan 4 needs to distinguish "platform said no" (read the message back to the visitor) from "we don't support this" (silently degrade) from real exceptions (page oncall). Returning a tagged result keeps that distinction at the type level. Real network/JSON exceptions still throw — the dispatcher wraps them into `platform_error` at the boundary.

**Why `cartToken` in/out instead of stateful adapter:** keeps adapters pure-functional and unit-testable. Persistence is the caller's job (Plan 4 stores in Redis; Plan 3b CLI stores in-process).

## 6. Components

### 6.1 `packages/adapters/src/dispatch.ts`

```ts
export function getAdapter(merchant: Merchant): Adapter;
```

Switch on `merchant.adapterType`. For 3b, only `'shopify'` and `'woo'` are wired; everything else throws `new Error('adapter_not_implemented_in_plan3b')`. Plan 3c adds the next four; 3d adds dom; 3e adds suggest.

### 6.2 `packages/adapters/src/shopify.ts`

| Method | Implementation |
|---|---|
| `searchProducts` | Delegates to `catalogRepo.searchProducts(merchant.id, query, limit)`. |
| `getProduct` | Delegates to `catalogRepo.getProduct(merchant.id, sku)`. |
| `cartAdd` | `POST {domain}/cart/add.js` body `{ id: variantId, quantity: qty }`. Shopify returns the added line; we follow with `GET {domain}/cart.js` to build full `CartState`. Cart token = the `cart` cookie value Shopify sets. |
| `cartUpdate` | `POST {domain}/cart/change.js` body `{ id: lineId, quantity: qty }`. Then `GET /cart.js`. |
| `cartGet` | `GET {domain}/cart.js`. Token unchanged. |
| `couponApply` | `POST {domain}/discount/{code}` (Shopify storefront discount endpoint) → follow with `GET /cart.js`. |
| `checkoutUrl` | Returns `{domain}/checkout?cart={cartToken}` (Shopify hosts checkout). |

**SKU↔variantId mapping:** Plan 3a's catalogSync already populated `products.variants[]` with `{ id, options, price_cents, in_stock }`. `cartAdd` looks up the variant by `sku + variantId` from `catalogRepo.getProduct` first to confirm both exist; otherwise returns `unsupported` with `reason='sku_or_variant_not_found'`.

**Cookie handling:** Shopify uses a `cart` cookie. Strategy: parse `Set-Cookie` from response, treat the `cart=...` value as the opaque `cartToken` we hand back. On subsequent calls, send `Cookie: cart={token}`.

**Rate guardrails:** Shopify Storefront APIs are not rate-limited per merchant for guest carts at our volume. No backoff in 3b — Plan 5+ will revisit if real traffic shows otherwise.

### 6.3 `packages/adapters/src/woo.ts`

WooCommerce Store API requires `Nonce` header obtained from the `X-WC-Store-API-Nonce` response header on the first GET.

| Method | Implementation |
|---|---|
| `searchProducts` / `getProduct` | Delegate to `catalogRepo`. |
| `cartAdd` | `POST {domain}/wp-json/wc/store/v1/cart/add-item` body `{ id, quantity, variation }`. First request: `GET /wp-json/wc/store/v1/cart` to capture nonce. Subsequent: re-use nonce. Cart token = `cart_token` from response (Woo Store API supplies one explicitly when the `Cart-Token` header is sent in/out). |
| `cartUpdate` | `POST .../cart/update-item` body `{ key: lineId, quantity }`. |
| `cartGet` | `GET .../cart` with `Cart-Token: {token}`. |
| `couponApply` | `POST .../cart/apply-coupon` body `{ code }`. |
| `checkoutUrl` | `merchants.checkoutUrl` if non-null else `{domain}/checkout/`. |

**Nonce refresh:** if a request returns 403 with `rest_cookie_invalid_nonce`, re-fetch `GET /cart` once to get a new nonce, retry the original request once. Two strikes → `platform_error`.

**variation handling:** Woo expects `variation: [{ attribute: 'pa_size', value: 'M' }, ...]` rather than a variant id. Plan 3a's catalogSync stores variant `options` in `products.variants[i].options`. Adapter translates `options` → `variation[]` at the boundary.

### 6.4 `packages/adapters/src/index.ts`

Public exports: `Adapter`, `AdapterContext`, `AdapterResult`, `CartLine`, `CartState`, `getAdapter`. Internal adapters not re-exported (only via `getAdapter`).

### 6.5 `apps/api/scripts/adapter-smoke.ts` (new CLI)

```
pnpm shoppingmate:dev adapter-smoke <merchantId>
```

Exercises `getAdapter(merchant)` end-to-end:
1. `searchProducts(ctx, '')` → expect ≥1 result
2. `getProduct(ctx, firstResult.sku)` → expect non-null
3. `cartAdd(ctx, sku, variantId, 1)` → capture token
4. `cartGet(ctx with token)` → expect 1 line
5. `cartUpdate(ctx, lineId, 2)` → expect qty=2
6. `couponApply(ctx, process.env.SMOKE_COUPON || 'TESTNONE')` → result printed but failure tolerated
7. `checkoutUrl(ctx)` → print URL

Prints a green/red summary per step. Used as Plan 3b acceptance.

## 7. Pipeline / wiring changes

- **Onboarding handler:** unchanged. Plan 3a wrote everything 3b needs.
- **`merchants.adapterConfig.cartUrlTemplate`, `.checkoutUrl`:** populated for Shopify/Woo if not already (Shopify default `cart/`, Woo default `checkout/`). Backfill happens once, at adapter load time, if `null` (defensive — onboarding should set them, but old rows from Plan 2 may not have).
- **`apps/api`:** no new HTTP routes. Plan 4 will add `/v1/tool/*` routes that thunk into the dispatcher. Plan 3b just exposes the package.

## 8. Testing strategy

- **Unit tests** per adapter file using `msw` to mock platform HTTP. Cover happy-path plus 4xx and nonce-refresh for Woo.
- **Adapter contract test:** a single test file `packages/adapters/test/contract.test.ts` parameterized over each adapter, asserting both implement the `Adapter` interface and behave the same way on shape (returned `CartState` types, error handling on missing SKU). Re-runs automatically when 3c/3d/3e add adapters.
- **CLI smoke:** runs against a real Shopify dev store and a real Woo dev store as the acceptance gate. Not in CI.

## 9. Acceptance criteria

A Plan 3b build is "done" when:

1. `pnpm shoppingmate:dev adapter-smoke <real-shopify-merchant>` walks the 7-step flow and prints all green.
2. Same for `<real-woo-merchant>`.
3. `getAdapter(merchant)` for any of `magento|bigcommerce|wix|squarespace|dom|suggest` throws `adapter_not_implemented_in_plan3b` with a typed error message.
4. Unit tests cover shopify + woo happy + error paths, contract test green for both.
5. `pnpm typecheck` and `pnpm lint` clean repo-wide. Tag `phase1-plan3b-wedge-adapters-complete`.

## 10. Open questions

None at design lock-in. Coupon failure handling and inventory freshness deferred per §3.

---

**Out of scope, restated:** voice agent, LLM tool-call loop, Magento/BC/Wix/SQ adapters, DOM, Suggest, Redis session storage, real-time inventory checks. All deferred to 3c / 3d / 3e / Plan 4 / Phase 2.
