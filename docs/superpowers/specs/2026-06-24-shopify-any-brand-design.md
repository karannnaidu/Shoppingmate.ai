# shoppingmate on any Shopify store — multi-brand, auto-onboarded

**Date:** 2026-06-24
**Goal:** Any Shopify store can install shoppingmate and get the exact bot we built for Calmosis — cart, checkout, catalog, coupons, navigation, voice + text — working automatically against *their* products and brand, with **zero manual brand configuration**. Auto-crawl everything; the bot generalizes from each brand's own data and industry.
**Distribution (decided):** Path A — custom/unlisted, pilot-grade. No App Store review, no Shopify-managed billing, no GDPR webhooks yet (those are the later public-listing phase). Optimised for "any store live fast."
**Constraint:** Calmosis (custom Netlify storefront + `__shoppingmate*__` hooks) must keep working unchanged. Shopify is a NEW platform path selected per-merchant by `merchant.platform === 'shopify'`.

---

## 1. The core architectural shift

Calmosis works because **its own frontend** implements `window.__shoppingmateCartAdd__/GetCart/CheckoutFill/PlaceOrder`. A Shopify brand cannot implement those. The Shopify path replaces them with **Shopify-native mechanisms that work from any storefront script, same-origin**:

| Capability | Calmosis (today) | Shopify (this spec) |
|---|---|---|
| Add / read / update / clear cart | custom `__shoppingmate*__` hooks | **Cart AJAX API** `/cart/add.js`, `/cart.js`, `/cart/change.js`, `/cart/clear.js` (client-side, verify-after-write) |
| Coupon | `__shoppingmateApplyCoupon__` | discount link `/discount/{code}` (applied at checkout) |
| Checkout | custom form-fill + Cashfree | **native Shopify checkout** — bot navigates to `/checkout` (Shopify owns payment; no form-fill, no PII handling) |
| Catalog | manual KB + hardcoded SKUs | **Admin GraphQL** bulk product pull on connect + product webhooks |
| Brand data | manual `brand_summary`/KB | **auto-crawl** store pages → summary, categories, KB, site-graph |
| Widget injection | script tag w/ `data-id` | **same script tag** (platform-agnostic JS) — pilot; theme-app-extension is the public-listing phase |
| Auth to merchant | n/a | merchant-created **custom-app Admin API token**, stored encrypted per merchant |

**Key simplification for the pilot:** the widget bundle is already platform-agnostic JavaScript. Dropped onto a Shopify storefront via a `<script>` tag, it can call `/cart/*.js` and `/checkout` directly (same-origin) — so the pilot needs **no OAuth embedded app and no theme app extension**. Those belong to Spec 3 / public listing.

---

## 2. Decomposition (three specs, built in sequence)

### Spec 1 — Shopify transactional foundation
Make the bot drive a real Shopify cart + checkout from the widget.
- **Shopify cart adapter for the widget** (`packages/widget/src/host/shopifyCart.ts`): `cartAdd/cartGet/cartSetQty/cartClear/applyCoupon` via Cart AJAX, each with verify-after-read. Returns the same `HostActionResult` shape (incl. `values` for `cart_get`) the worker already consumes.
- **Platform routing in the widget host dispatcher**: when the page is a Shopify storefront (or merchant config says shopify), route `cart_*`/`open_cart` host actions to `shopifyCart` instead of the `__shoppingmate*__` hooks. Calmosis path untouched.
- **Native checkout**: a `checkout_url`/navigate host action that sends the visitor to `/checkout`. The bot collects nothing — Shopify's checkout owns PII + payment. The voice "checkout.fill/place" flow is Calmosis-only and stays gated off for Shopify.
- **Variant resolution**: Cart AJAX needs a numeric `variant_id`, not a SKU. The catalog (Spec 2) stores `variantId` per product; the bot's `cart.add` passes the resolved variant. Until catalog exists, fall back to SKU→variant lookup via Storefront API.

### Spec 2 — Auto-onboarding ("make the bot work, automatically")
Turn a bare store + token into a fully-knowledgeable, de-Calmosis'd bot.
- **Connect flow**: merchant enters store domain + custom-app Admin API token (encrypted at rest). Validates the token, sets `merchant.platform='shopify'`, `adapterType='shopify'`, `siteGraphEnabled=true`.
- **Catalog sync**: Admin GraphQL bulk pull → `products` table (title, description, price, image, SKU, **variantId**, tags, collections). Product webhooks (`products/create|update|delete`) keep it fresh.
- **Brand-data auto-crawl** (reuse existing `crawlSite`/KB/site-graph machinery):
  - `brand_summary` + `brand_categories` auto-generated from the store: shop name/description, `/policies/*`, About/FAQ pages, and collection names — summarised by an LLM call into the same shape Calmosis has.
  - **KB**: crawl + ingest FAQ / shipping / returns / about / product-education pages into `brand_kb_chunks`.
  - **Site graph**: existing `extractSiteGraph` over crawled pages → navigation.
- **Prompt generalization** (de-Calmosis): replace hardcoded blocks with brand-parameterized ones driven by merchant data, with **industry features auto-detected**:
  - Product names/benefits/prices → from `products` (never hardcoded).
  - Opening line → templated from `brandName` + `brandSummary`.
  - **Consultation** block → included only when the brand is health/wellness/regulated (detected from categories/KB keywords) AND a contact channel exists; else omitted.
  - **Membership/subscription upsell** → included only if the store sells a subscription/membership product (detected from product types/tags); else omitted.
  - **Usage/dosage guardrails** → sourced from the brand's own KB, not hardcoded (no more "sublingual" unless that brand's KB says so).
  - Cart-mutation transactional flow → enabled for any `merchantCanMutateCart` merchant (already a generic gate), now true for shopify.

### Spec 3 — Attribution + path-to-listing
- `orders/create` webhook → assisted-revenue attribution (reuse existing conversion attribution; match by visitor → session → recommended SKU).
- Onboarding dashboard page (connect token, see sync status, copy the widget snippet).
- (Deferred, documented only) public-listing phase: OAuth embedded app, theme app extension, Shopify-managed billing, GDPR webhooks, App Store review.

---

## 3. What stays Calmosis-specific vs generalizes

- **Stays gated to Calmosis** (`isCalmosisStitch`): the `__shoppingmate*__` custom-hook cart/checkout, the bespoke `checkout.fill/place` voice flow, the doctor `consultation.request` server tool (offered to other brands only when industry-detected), the `page.*` DOM-control tools.
- **Generalizes to every brand**: `products.search/get`, `cart.add/update/get/clear`, `coupon.apply`, `checkout.url`/native checkout, `site.navigate`, the whole prompt builder (now brand-parameterized), voice + text, the honesty/grounding/SKU-normalization/cart-awareness fixes already shipped.
- **Note:** SKU normalization (`normalizeCalmosisSku`) becomes a generic `resolveVariant(merchant, ref)` against the synced catalog for Shopify (fuzzy product/variant match), keeping the Calmosis canonical-SKU map as the Calmosis branch.

---

## 4. Data model additions

- `merchants.shopify_domain` (text, nullable) — `*.myshopify.com`.
- `merchants.shopify_admin_token_enc` (text, nullable) — encrypted Admin API token.
- `merchants.platform` already exists; set to `'shopify'`.
- `products` already has variant fields; ensure `variantId` (numeric Shopify variant) is populated by sync.
- No schema change for brand_summary/categories/KB/site-graph — reuse existing per-merchant tables.

---

## 5. Testing strategy

- **Unit (in-repo, no live store):** shopifyCart Cart-AJAX logic (mock `fetch` to `/cart/*.js`), variant resolution, platform routing in the dispatcher, catalog-sync GraphQL mapping (mock Admin API), brand-summary generation (mock LLM), prompt generalization (snapshot the generated prompt for 2–3 synthetic brands across industries), industry-feature auto-detection.
- **Integration (mocked Shopify):** connect → sync → prompt build → tool surface for a synthetic apparel store and a synthetic supplement store; assert apparel gets no consultation block, supplement does.
- **Live (human-gated handoff):** real store + custom-app token; smoke add-to-cart + checkout redirect.

---

## 6. External handoffs (only the merchant can do)

1. Create a **custom app** in their Shopify admin → copy Admin API access token (+ enable the scopes: read_products, read_content, read_orders).
2. Paste store domain + token into shoppingmate onboarding.
3. Add the one-line widget `<script>` to their theme (`theme.liquid`), or we provide a copy-paste snippet.

Everything else (sync, crawl, prompt generation, cart/checkout behaviour) is automatic.
