# Runbook — onboarding a Shopify store

How to bring any Shopify store live on shoppingmate. The transactional path is
token-less (uses the store's public storefront); an Admin token is only needed
later for private data.

## Merchant-side steps (what the store owner does)

1. **Add the widget script** to the theme (Online Store → Themes → Edit code →
   `theme.liquid`, before `</body>`):
   ```html
   <script async src="https://shoppingmate-web.vercel.app/widget/v1.js"
           data-id="YOUR_MERCHANT_ID"></script>
   ```
   The merchant id + this exact snippet are shown at step 4 of the dashboard
   onboarding wizard (`/app/onboarding?step=4`).
2. **Keep `/products.json` public** (default on Shopify). If it's disabled,
   onboarding degrades to a DOM crawl (no variant ids → add-to-cart is best
   effort); re-enable it for reliable carts.
3. (Optional, later) For private data / write access, install the custom app
   and provide an Admin API token — not required for selling + native checkout.

## System pipeline (what happens automatically)

`onboarding` worker job (`apps/worker/src/handlers/onboarding.ts`):
1. **safetyCheck** → 2. **fingerprint** (detects `platform='shopify'`, sets
   `adapterType='shopify'`) → 3. **catalogSync** (pulls `/products.json`, writes
   `products` with numeric `variants[].id`; falls back to DOM crawl if the JSON
   endpoint is blocked) → 3.5 **syncMerchantBrand** (crawls home/about/faq/policy,
   generates + persists `brand_summary` + `brand_categories`; best-effort) →
   4. selectorExtract (DOM merchants only) → 5. smokeTest → 6. finalize (`live`).

## How the bot transacts on Shopify

- `products.search` / `products.get` return an explicit top-level `variantId`
  (single-variant) or a `variants` list (multi-variant).
- `cart.add` dispatches a host action to the widget, which drives the real cart
  via Shopify **Cart AJAX** (`/cart/add.js`). `resolveShopifyVariantId` coerces a
  handle/title/sku to the correct numeric variant id if the model didn't pass one.
- Checkout is the store's **own** secure page (`/checkout`) — the bot never
  collects PII on Shopify.

## Conversion attribution

Register a Shopify webhook `orders/create` → `POST /webhooks/shopify/orders/create`
(HMAC-verified with the store's secret). The handler looks up the merchant by
shop domain and attributes the order to the visitor/session/recommended SKU
(`conversion.ingested` metric). See `apps/api/src/routes/webhooks/shopify.ts`.

## Verify a store end to end

1. Dashboard shows the merchant `live` with a product count.
2. Load the storefront; the widget launcher appears.
3. Ask the bot for a product → a card with a price shows → "add it" → the store's
   real cart updates → "checkout" → lands on the store's `/checkout`.
4. Complete a test order → `conversion.ingested` appears in metrics.

## Guardrails

- Everything Shopify is gated on `merchant.platform === 'shopify'`; Calmosis and
  demo behaviour are unchanged.
- No Calmosis-owned target is ever touched by Shopify onboarding or deploys.
